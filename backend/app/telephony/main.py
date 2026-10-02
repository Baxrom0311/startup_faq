"""Telephony PoC entrypoint (docs/TELEPHONY_VOICE_AI.md, Faza 1).

A FastAGI server: Asterisk's dialplan opens one TCP connection per call to
us (see infra/asterisk/extensions.conf), and for the lifetime of that call we
run the exact same record -> transcribe -> voice-chat -> speak -> playback
loop the Telegram bot already runs (app.bot.main._process_bot_user_message),
just swapping Telegram voice notes for Asterisk RECORD FILE / STREAM FILE.

Each call is handled by its own asyncio connection handler with its own
local state (call_id-scoped Redis history key) — this is what makes
concurrent calls safe, see docs/TELEPHONY_VOICE_AI.md section 4.
"""
import asyncio
import base64
import json
import logging
import uuid
from pathlib import Path

import httpx
import redis.asyncio as aioredis

from app.core.config import settings
from app.telephony.agi import AGIChannelHungUp, AGISession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None

SILENCE_RETRY_LIMIT = 2  # consecutive empty turns before we give up and hang up
GOODBYE_NO_INPUT = (
    "Ovozingizni eshitmadim. Iltimos, saytimiz yoki Telegram bot orqali qaytadan urinib ko'ring. Xayr!"
)
GOODBYE_MAX_TURNS = (
    "Suhbat davomiyligi tugadi. Murojaatingizni saytimiz yoki Telegram bot orqali yakunlashingiz mumkin. Xayr!"
)


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def _headers() -> dict[str, str]:
    headers = {}
    if settings.TG_WEBHOOK_SECRET:
        headers["X-Telegram-Webhook-Secret"] = settings.TG_WEBHOOK_SECRET
    return headers


async def _transcribe(client: httpx.AsyncClient, wav_path: Path) -> str:
    if not wav_path.exists() or wav_path.stat().st_size < 100:
        return ""
    audio_b64 = base64.b64encode(wav_path.read_bytes()).decode("utf-8")
    try:
        res = await client.post(
            "/appeals/transcribe",
            json={"audio": audio_b64, "mime_type": "audio/wav"},
        )
        if res.status_code == 200:
            return res.json().get("text", "").strip()
    except Exception as exc:
        logger.warning("Telephony transcribe error: %s", exc)
    return ""


async def _voice_chat(client: httpx.AsyncClient, history: list[dict]) -> dict:
    try:
        res = await client.post(
            "/appeals/voice-chat", json={"messages": history, "language": "uz"}
        )
        if res.status_code == 200:
            return res.json()
    except Exception as exc:
        logger.warning("Telephony voice-chat error: %s", exc)
    return {
        "reply_text": "Kechirasiz, tizimda vaqtinchalik nosozlik yuz berdi. Birozdan so'ng qaytadan qo'ng'iroq qiling.",
        "ready_to_submit": False,
        "collected_data": {},
    }


async def _speak_to_file(client: httpx.AsyncClient, text: str, out_path_no_ext: Path) -> bool:
    """Fetch Gemini TTS audio (24kHz WAV) and downsample it to the 8kHz mono
    16-bit PCM WAV Asterisk's default playback format expects."""
    try:
        res = await client.post("/appeals/speak", json={"text": text})
        if res.status_code != 200:
            return False
    except Exception as exc:
        logger.warning("Telephony speak error: %s", exc)
        return False

    raw_path = out_path_no_ext.with_suffix(".raw.wav")
    raw_path.write_bytes(res.content)
    final_path = out_path_no_ext.with_suffix(".wav")

    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-i", str(raw_path), "-ar", "8000", "-ac", "1", "-sample_fmt", "s16",
        str(final_path),
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await proc.wait()
    raw_path.unlink(missing_ok=True)
    return proc.returncode == 0 and final_path.exists()


def _appeal_summary(caller_id: str | None, call_id: str, collected: dict) -> str:
    loc = collected.get("location") or "Ko'rsatilmadi"
    name = collected.get("citizen_name") or (caller_id or f"Qo'ng'iroq {call_id}")
    phone = collected.get("phone") or caller_id or "Noma'lum"
    prob = collected.get("problem_description") or ""
    return (
        f"[Telefon orqali AI Murojaat]\n"
        f"Ism: {name}\n"
        f"Tel: {phone}\n"
        f"Manzil: {loc}\n\n"
        f"Muammo:\n{prob}"
    )


async def _submit_appeal(
    client: httpx.AsyncClient, call_id: str, caller_id: str | None, collected: dict
) -> bool:
    summary = _appeal_summary(caller_id, call_id, collected)
    try:
        res = await client.post(
            "/appeals/call-submit",
            json={"call_id": call_id, "caller_id": caller_id, "raw_text": summary},
            headers=_headers(),
        )
        if res.status_code >= 400:
            logger.warning("Telephony call-submit rejected: %s %s", res.status_code, res.text)
            return False
        return True
    except Exception as exc:
        logger.warning("Telephony call-submit failed: %s", exc)
        return False


async def _run_call(agi: AGISession) -> None:
    call_id = agi.env.get("agi_uniqueid") or str(uuid.uuid4())
    caller_id = agi.env.get("agi_callerid")
    if not caller_id or caller_id.lower() == "unknown":
        caller_id = None

    logger.info("Telephony call started: call_id=%s caller_id=%s", call_id, caller_id)

    media_dir = Path(settings.TELEPHONY_MEDIA_DIR)
    media_dir.mkdir(parents=True, exist_ok=True)

    r = _get_redis()
    history_key = f"call_appeal_chat:{call_id}"
    history: list[dict] = []
    turn_files: list[Path] = []

    try:
        await agi.answer()
        async with httpx.AsyncClient(base_url=settings.BACKEND_INTERNAL_URL, timeout=30) as client:
            silence_streak = 0
            for turn in range(1, settings.TELEPHONY_MAX_TURNS + 1):
                rec_base = media_dir / f"{call_id}_{turn}_in"
                turn_files.append(rec_base.with_suffix(".wav"))
                await agi.record_file(str(rec_base))

                text = await _transcribe(client, rec_base.with_suffix(".wav"))
                if not text:
                    silence_streak += 1
                    if silence_streak > SILENCE_RETRY_LIMIT:
                        goodbye_path = media_dir / f"{call_id}_{turn}_bye"
                        turn_files.append(goodbye_path.with_suffix(".wav"))
                        if await _speak_to_file(client, GOODBYE_NO_INPUT, goodbye_path):
                            await agi.stream_file(str(goodbye_path))
                        break
                    continue
                silence_streak = 0

                history.append({"role": "user", "content": text})
                data = await _voice_chat(client, history)
                reply_text = data.get("reply_text", "")
                history.append({"role": "assistant", "content": reply_text})
                await r.setex(history_key, 600, json.dumps(history))

                reply_base = media_dir / f"{call_id}_{turn}_out"
                turn_files.append(reply_base.with_suffix(".wav"))
                if await _speak_to_file(client, reply_text, reply_base):
                    await agi.stream_file(str(reply_base))

                if data.get("ready_to_submit"):
                    collected = data.get("collected_data") or {}
                    await _submit_appeal(client, call_id, caller_id, collected)
                    break
            else:
                # Loop exhausted TELEPHONY_MAX_TURNS without ready_to_submit.
                bye_path = media_dir / f"{call_id}_maxturns_bye"
                turn_files.append(bye_path.with_suffix(".wav"))
                if await _speak_to_file(client, GOODBYE_MAX_TURNS, bye_path):
                    await agi.stream_file(str(bye_path))

        await agi.hangup()
    except AGIChannelHungUp:
        logger.info("Telephony call_id=%s: caller hung up", call_id)
    except Exception:
        logger.exception("Telephony call_id=%s failed", call_id)
    finally:
        for f in turn_files:
            f.unlink(missing_ok=True)
            f.with_suffix(".raw.wav").unlink(missing_ok=True)
        try:
            await r.delete(history_key)
        except Exception:
            pass
        agi.close()


async def _handle_connection(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        agi = await AGISession.read_handshake(reader, writer)
    except Exception:
        logger.exception("Failed to read AGI handshake")
        writer.close()
        return
    await _run_call(agi)


async def main() -> None:
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY is not set; telephony voice AI will fail")
    server = await asyncio.start_server(
        _handle_connection, settings.TELEPHONY_AGI_HOST, settings.TELEPHONY_AGI_PORT
    )
    logger.info(
        "Telephony FastAGI server listening on %s:%s", settings.TELEPHONY_AGI_HOST, settings.TELEPHONY_AGI_PORT
    )
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
