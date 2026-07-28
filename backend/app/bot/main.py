import asyncio
import logging

import httpx
import redis.asyncio as aioredis
from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)

from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = Router()

TOKEN_TTL_SECONDS = 300  # 5 daqiqa
_redis: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def _redis_key(telegram_id: int) -> str:
    return f"tg_auth_token:{telegram_id}"


async def _store_token(telegram_id: int, token: str) -> None:
    try:
        await _get_redis().setex(_redis_key(telegram_id), TOKEN_TTL_SECONDS, token)
    except Exception as exc:
        logger.warning("Redis store token failed: %s", exc)


async def _pop_token(telegram_id: int) -> str | None:
    key = _redis_key(telegram_id)
    try:
        r = _get_redis()
        token = await r.getdel(key)
        return token
    except Exception as exc:
        logger.warning("Redis pop token failed: %s", exc)
        return None


async def _peek_token(telegram_id: int) -> str | None:
    try:
        return await _get_redis().get(_redis_key(telegram_id))
    except Exception as exc:
        logger.warning("Redis peek token failed: %s", exc)
        return None


async def _delete_token(telegram_id: int) -> None:
    try:
        await _get_redis().delete(_redis_key(telegram_id))
    except Exception as exc:
        logger.warning("Redis delete token failed: %s", exc)


@router.message(CommandStart(deep_link=False))
async def start_no_token(message: Message) -> None:
    frontend = settings.FRONTEND_HOST.rstrip("/")
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🌐 Platformani ochish", url=frontend)],
    ])
    await message.answer(
        "👋 Salom! Bu <b>SolutionLab</b> boti.\n\n"
        "Bu orqali:\n"
        "• Platformaga kirish (login) qilasiz\n"
        "• Muammo va loyihalar bo'yicha bildirishnoma olasiz\n\n"
        "Kirish uchun saytga o'ting va «Telegram orqali kirish» tugmasini bosing.",
        parse_mode="HTML",
        reply_markup=keyboard,
    )


@router.message(Command("help"))
async def help_command(message: Message) -> None:
    frontend = settings.FRONTEND_HOST.rstrip("/")
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🌐 Platforma", url=frontend)],
    ])
    await message.answer(
        "<b>SolutionLab boti yordami</b>\n\n"
        "🔑 <b>Kirish:</b> Saytda «Telegram orqali kirish» bosing, so'ng raqamingizni ulashing.\n\n"
        "🔔 <b>Bildirishnomalar:</b> Muammo yoki loyiha yangilanganda bu orqali xabar olasiz.\n\n"
        "📌 Barcha funksiyalar platforma saytida mavjud.",
        parse_mode="HTML",
        reply_markup=keyboard,
    )


@router.message(CommandStart(deep_link=True))
async def start_auth(message: Message, command: CommandObject) -> None:
    token = command.args or ""
    if not token:
        await message.answer("Login sessiya topilmadi. Saytga qaytib qaytadan urinib ko'ring.")
        return

    if message.from_user:
        await _store_token(message.from_user.id, token)

    headers = {}
    if settings.TG_WEBHOOK_SECRET:
        headers["X-Telegram-Webhook-Secret"] = settings.TG_WEBHOOK_SECRET

    try:
        async with httpx.AsyncClient(base_url=settings.BACKEND_INTERNAL_URL, timeout=10) as client:
            response = await client.post(f"/auth/telegram/mark-start/{token}", headers=headers)
        if response.status_code >= 400:
            logger.warning("Telegram auth mark-start failed: %s %s", response.status_code, response.text)
    except httpx.HTTPError as exc:
        logger.warning("Telegram auth mark-start HTTP error: %s", exc)

    keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="Raqamni ulashish", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    await message.answer(
        "Kirishni yakunlash uchun Telegram raqamingizni ulashing.",
        reply_markup=keyboard,
    )


@router.message(F.contact)
async def verify_contact(message: Message) -> None:
    if not message.contact or not message.from_user:
        await message.answer("Kontakt kelmadi. Qaytadan urinib ko'ring.")
        return

    # Read the token WITHOUT consuming it — a transient backend failure below
    # must not burn the single-use token, or the "try again" retry would fail.
    token = await _peek_token(message.from_user.id)
    if not token:
        await message.answer("Login sessiya topilmadi yoki muddati tugagan. Saytga qaytib qaytadan urinib ko'ring.")
        return

    payload = {
        "token": token,
        "telegram_id": message.from_user.id,
        "phone": message.contact.phone_number,
        "first_name": message.from_user.first_name,
        "last_name": message.from_user.last_name,
        "username": message.from_user.username,
        "contact_user_id": message.contact.user_id,
        "from_user_id": message.from_user.id,
    }
    headers = {}
    if settings.TG_WEBHOOK_SECRET:
        headers["X-Telegram-Webhook-Secret"] = settings.TG_WEBHOOK_SECRET

    try:
        async with httpx.AsyncClient(base_url=settings.BACKEND_INTERNAL_URL, timeout=10) as client:
            response = await client.post(
                "/auth/telegram/verify-contact",
                json=payload,
                headers=headers,
            )
    except httpx.HTTPError as exc:
        logger.warning("Telegram contact verification HTTP error: %s", exc)
        await message.answer("Tarmoq xatosi. Qaytadan urinib ko'ring.")
        return

    if response.status_code >= 400:
        logger.warning("Telegram contact verification failed: %s %s", response.status_code, response.text)
        await message.answer("Tasdiqlashda xatolik bo'ldi. Saytga qaytib qaytadan urinib ko'ring.")
        return

    # Success — now safe to consume the single-use token.
    await _delete_token(message.from_user.id)

    frontend = settings.FRONTEND_HOST.rstrip("/")
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="▶️ Platformaga kirish", url=f"{frontend}/login")],
    ])
    await message.answer(
        "✅ Muvaffaqiyatli kirdingiz! Platformaga qayting.",
        reply_markup=ReplyKeyboardRemove(),
    )
    await message.answer(
        "Muammolarni ko'rish va loyihalar bilan ishlash uchun:",
        reply_markup=keyboard,
    )
    logger.info(
        "Telegram auth verified: user_id=%s phone=%s",
        message.from_user.id,
        message.contact.phone_number,
    )


@router.message(F.voice | F.audio)
async def handle_voice_appeal(message: Message, bot: Bot) -> None:
    voice_or_audio = message.voice or message.audio
    if not voice_or_audio or not message.from_user:
        return

    status_msg = await message.answer("🎙️ Ovozingiz Gemini AI tomonidan eshitilmoqda...")

    try:
        file_info = await bot.get_file(voice_or_audio.file_id)
        file_bytes_io = await bot.download_file(file_info.file_path)
        file_bytes = file_bytes_io.read()

        audio_b64 = base64.b64encode(file_bytes).decode("utf-8")
        async with httpx.AsyncClient(
            base_url=settings.BACKEND_INTERNAL_URL, timeout=30
        ) as client:
            tr_res = await client.post(
                "/appeals/transcribe",
                json={"audio_base64": audio_b64, "mime_type": "audio/ogg"},
            )
            if tr_res.status_code == 200:
                transcribed_text = tr_res.json().get("text", "").strip()
            else:
                transcribed_text = ""
    except Exception as exc:
        logger.warning("Bot transcribe error: %s", exc)
        transcribed_text = ""

    if not transcribed_text:
        await status_msg.edit_text(
            "Ovozingizni aniqlab bo'lmadi. Iltimos, qaytadan aniqroq so'zlang yoki matn shaklida yozing."
        )
        return

    await status_msg.delete()
    await _process_bot_user_message(message, message.from_user.id, transcribed_text)


@router.message(F.text & ~F.text.startswith("/"))
async def handle_text_appeal(message: Message) -> None:
    if not message.from_user or not message.text:
        return
    await _process_bot_user_message(message, message.from_user.id, message.text.strip())


async def _process_bot_user_message(message: Message, user_id: int, text: str) -> None:
    r = _get_redis()
    history_key = f"tg_appeal_chat:{user_id}"
    try:
        raw_history = await r.get(history_key)
        history = json.loads(raw_history) if raw_history else []
    except Exception:
        history = []

    history.append({"role": "user", "content": text})

    try:
        async with httpx.AsyncClient(
            base_url=settings.BACKEND_INTERNAL_URL, timeout=30
        ) as client:
            vc_res = await client.post(
                "/appeals/voice-chat",
                json={"messages": history, "language": "uz"},
            )
            if vc_res.status_code != 200:
                await message.answer("Tizimda vaqtinchalik uzilish yuz berdi.")
                return
            data = vc_res.json()
    except Exception as exc:
        logger.warning("Bot voice-chat error: %s", exc)
        await message.answer("Tarmoq xatoligi yuz berdi.")
        return

    reply_text = data.get("reply_text", "")
    history.append({"role": "assistant", "content": reply_text})
    try:
        await r.setex(history_key, 600, json.dumps(history))
    except Exception:
        pass

    # Send text reply
    await message.answer(reply_text)

    # If appeal is ready to submit -> submit automatically!
    if data.get("ready_to_submit"):
        collected = data.get("collected_data", {})
        summary = (
            f"[Telegram Bot AI Murojaat]\n"
            f"Ism: {collected.get('citizen_name') or message.from_user.first_name}\n"
            f"Tel: {collected.get('phone') or 'Telegram ID: ' + str(user_id)}\n"
            f"Manzil: {collected.get('location') or 'Ko\'rsatilmadi'}\n\n"
            f"Muammo:\n{collected.get('problem_description')}"
        )
        try:
            async with httpx.AsyncClient(
                base_url=settings.BACKEND_INTERNAL_URL, timeout=30
            ) as client:
                await client.post(
                    "/problems/civic",
                    json={"raw_text": summary},
                )
            await r.delete(history_key)
        except Exception as exc:
            logger.warning("Bot submit civic appeal failed: %s", exc)


@router.message()
async def default_message_handler(message: Message) -> None:
    frontend = settings.FRONTEND_HOST.rstrip("/")
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🌐 Platformada murojaat yuborish",
                    url=f"{frontend}/appeal",
                )
            ],
            [
                InlineKeyboardButton(
                    text="🔑 Platformaga kirish", url=f"{frontend}/login"
                )
            ],
        ]
    )
    await message.answer(
        "Assalomu alaykum! Bu <b>SolutionLab</b> rasmiy boti.\n\n"
        "Murojaat va shikoyatlaringizni shu yerda ovozli xabar yuborib yoki matn shaklida yozib yo'llashingiz mumkin!",
        parse_mode="HTML",
        reply_markup=keyboard,
    )


async def _run_placeholder() -> None:

    logger.info("TG_BOT_TOKEN is not set; bot is idle")
    while True:
        await asyncio.sleep(3600)


async def main() -> None:
    logger.info("Platforma Telegram bot starting; username=%s", settings.TG_BOT_USERNAME or "<unset>")
    if not settings.TG_BOT_TOKEN:
        await _run_placeholder()
        return

    bot = Bot(token=settings.TG_BOT_TOKEN)
    dispatcher = Dispatcher()
    dispatcher.include_router(router)
    await dispatcher.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
