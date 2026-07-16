import asyncio
import logging
import time

import httpx
from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import (
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)

from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = Router()

# {telegram_id: (token, created_at)}
auth_tokens_by_user_id: dict[int, tuple[str, float]] = {}
TOKEN_TTL_SECONDS = 300  # 5 daqiqa


def _store_token(telegram_id: int, token: str) -> None:
    auth_tokens_by_user_id[telegram_id] = (token, time.monotonic())


def _pop_token(telegram_id: int) -> str | None:
    entry = auth_tokens_by_user_id.pop(telegram_id, None)
    if entry is None:
        return None
    token, created_at = entry
    if time.monotonic() - created_at > TOKEN_TTL_SECONDS:
        logger.info("Token expired for telegram_id=%s", telegram_id)
        return None
    return token


def _purge_stale_tokens() -> None:
    now = time.monotonic()
    stale = [uid for uid, (_, ts) in auth_tokens_by_user_id.items() if now - ts > TOKEN_TTL_SECONDS]
    for uid in stale:
        auth_tokens_by_user_id.pop(uid, None)
    if stale:
        logger.debug("Purged %d stale auth tokens", len(stale))


@router.message(CommandStart(deep_link=False))
async def start_no_token(message: Message) -> None:
    await message.answer(
        "Salom! Bu bot platformaga kirish uchun ishlatiladi.\n\n"
        "Kirish uchun saytga o'ting va «Telegram orqali kirish» tugmasini bosing.",
    )


@router.message(CommandStart(deep_link=True))
async def start_auth(message: Message, command: CommandObject) -> None:
    token = command.args or ""
    if not token:
        await message.answer("Login sessiya topilmadi. Saytga qaytib qaytadan urinib ko'ring.")
        return

    if message.from_user:
        _purge_stale_tokens()
        _store_token(message.from_user.id, token)

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

    token = _pop_token(message.from_user.id)
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

    await message.answer(
        "Kirdingiz. Saytga qayting.",
        reply_markup=ReplyKeyboardRemove(),
    )
    logger.info(
        "Telegram auth verified: user_id=%s phone=%s",
        message.from_user.id,
        message.contact.phone_number,
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
