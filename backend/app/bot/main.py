import asyncio
import logging

import httpx
import redis.asyncio as aioredis
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

    token = await _pop_token(message.from_user.id)
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
