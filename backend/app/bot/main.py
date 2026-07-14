import asyncio
import logging

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
auth_tokens_by_user_id: dict[int, str] = {}


@router.message(CommandStart(deep_link=True))
async def start_auth(message: Message, command: CommandObject) -> None:
    token = command.args or ""
    if not token:
        await message.answer("Login sessiya topilmadi. Saytga qaytib qaytadan urinib ko'ring.")
        return
    if message.from_user:
        auth_tokens_by_user_id[message.from_user.id] = token
    headers = {}
    if settings.TG_WEBHOOK_SECRET:
        headers["X-Telegram-Webhook-Secret"] = settings.TG_WEBHOOK_SECRET
    async with httpx.AsyncClient(base_url=settings.BACKEND_INTERNAL_URL, timeout=10) as client:
        response = await client.post(f"/auth/telegram/mark-start/{token}", headers=headers)
    if response.status_code >= 400:
        logger.warning("Telegram auth mark-start failed: %s %s", response.status_code, response.text)

    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Raqamni ulashish", request_contact=True)],
        ],
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

    token = auth_tokens_by_user_id.get(message.from_user.id)
    if not token:
        await message.answer("Login sessiya eskirgan. Saytga qaytib qaytadan urinib ko'ring.")
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

    async with httpx.AsyncClient(base_url=settings.BACKEND_INTERNAL_URL, timeout=10) as client:
        response = await client.post(
            "/auth/telegram/verify-contact",
            json=payload,
            headers=headers,
        )

    if response.status_code >= 400:
        logger.warning("Telegram contact verification failed: %s %s", response.status_code, response.text)
        await message.answer("Tasdiqlashda xatolik bo'ldi. Saytga qaytib qaytadan urinib ko'ring.")
        return

    auth_tokens_by_user_id.pop(message.from_user.id, None)

    await message.answer(
        "Kirdingiz. Saytga qayting.",
        reply_markup=ReplyKeyboardRemove(),
    )
    logger.info(
        "Received Telegram contact user_id=%s phone=%s token_present=%s",
        message.from_user.id,
        message.contact.phone_number,
        True,
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
