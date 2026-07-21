"""Synchronous AI content moderation for problem submissions.

Called directly in the API endpoint (not via worker) so the user
gets instant feedback before the problem is saved.
"""

import logging
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.modules.ai.providers import _extract_json_object, _with_retry

logger = logging.getLogger(__name__)

_PROMPT = """\
Siz O'zbekiston startup muammolar platformasi uchun kontent moderatorsiz.

Soha: {sector}
Muammo matni: {text}

Quyidagi holatlardan biri aniq bo'lsa REJECTED qiling:
- Haqoratli, kamsituvchi yoki xo'rlovchi so'zlar
- Siyosiy tashviqot, partiyalar yoki hukumat tanqidi
- Diniy munozara, mazhablar yoki e'tiqod haqida gaplar
- Spam, reklama yoki tijorat maqsadli matn
- Shaxsiy ma'lumotlar (telefon, pasport, manzil)
- Matn "{sector}" sohasiga mutlaqo aloqasiz

Qolgan BARCHA hollarda APPROVED qiling.
Shubha bo'lsa yoki chegaraviy holat — APPROVED.
Qisqa, noaniq yoki grammatik xatolikli matnlar — APPROVED.

Faqat JSON javob bering (hech qanday qo'shimchasiz):
{{"approved": true, "reason": null}}
yoki
{{"approved": false, "reason": "sabab o'zbek tilida, qisqa"}}
"""


@dataclass
class ModerationResult:
    approved: bool
    reason: str | None = None  # shown to user in Uzbek if rejected


async def moderate_content(*, text: str, sector_name: str) -> ModerationResult:
    """Moderate problem text synchronously. Defaults to approved on any error."""
    if not text or len(text.strip()) < 5:
        return ModerationResult(approved=False, reason="Muammo matni juda qisqa.")

    prompt = _PROMPT.format(sector=sector_name, text=text[:2000])

    try:
        raw = await _call_llm(prompt)
        data = _extract_json_object(raw)
        approved = bool(data.get("approved", True))
        reason = str(data["reason"]) if not approved and data.get("reason") else None
        return ModerationResult(approved=approved, reason=reason)
    except Exception:
        logger.exception("Moderation LLM failed; defaulting to approved")
        return ModerationResult(approved=True)


async def _call_llm(prompt: str) -> str:
    provider = settings.LLM_PROVIDER
    if provider == "deepseek" and settings.DEEPSEEK_API_KEY:
        return await _deepseek(prompt)
    if provider == "openai" and settings.OPENAI_API_KEY:
        return await _openai(prompt)
    if provider == "anthropic" and settings.ANTHROPIC_API_KEY:
        return await _anthropic(prompt)
    if provider == "gemini" and settings.GEMINI_API_KEY:
        return await _gemini(prompt)
    if provider == "ollama":
        return await _ollama(prompt)
    # No LLM configured → approve everything
    return '{"approved": true, "reason": null}'


async def _deepseek(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await _with_retry(
            lambda: client.post(
                f"{settings.DEEPSEEK_BASE_URL.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.DEEPSEEK_MODEL,
                    "messages": [
                        {"role": "system", "content": "Return only valid JSON. No markdown."},
                        {"role": "user", "content": prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.0,
                    "max_tokens": 80,
                },
            )
        )
    payload = response.json()
    return payload.get("choices", [{}])[0].get("message", {}).get("content", "{}")


async def _openai(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await _with_retry(
            lambda: client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.OPENAI_MODEL,
                    "messages": [
                        {"role": "system", "content": "Return only valid JSON. No markdown."},
                        {"role": "user", "content": prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.0,
                    "max_tokens": 80,
                },
            )
        )
    payload = response.json()
    return payload.get("choices", [{}])[0].get("message", {}).get("content", "{}")


async def _anthropic(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await _with_retry(
            lambda: client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.ANTHROPIC_MODEL,
                    "max_tokens": 80,
                    "temperature": 0.0,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
        )
    payload = response.json()
    return "".join(
        b.get("text", "") for b in payload.get("content", []) if b.get("type") == "text"
    )


async def _ollama(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await _with_retry(
            lambda: client.post(
                f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat",
                headers={"Content-Type": "application/json"},
                json={
                    "model": settings.OLLAMA_MODEL,
                    "messages": [
                        {"role": "system", "content": "Return only valid JSON. No markdown."},
                        {"role": "user", "content": prompt},
                    ],
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0.0},
                },
            )
        )
    payload = response.json()
    return payload.get("message", {}).get("content", "{}")


async def _gemini(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await _with_retry(
            lambda: client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent",
                headers={"Content-Type": "application/json"},
                params={"key": settings.GEMINI_API_KEY},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.0, "maxOutputTokens": 80},
                },
            )
        )
    payload = response.json()
    return (
        payload.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "{}")
    )
