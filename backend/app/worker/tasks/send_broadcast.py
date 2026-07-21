import asyncio
import logging
import uuid
from datetime import datetime, timezone

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError, TelegramForbiddenError
from aiogram.types import BufferedInputFile, InlineKeyboardButton, InlineKeyboardMarkup
from sqlmodel import Session, select

from app.core.config import settings
from app.core.db import engine
from app.models import Broadcast, User
from app.modules.media.service import create_s3_client

logger = logging.getLogger(__name__)


async def _fetch_photo_bytes(photo_key: str) -> bytes | None:
    try:
        s3 = create_s3_client()
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: s3.get_object(Bucket=settings.S3_BUCKET_MEDIA, Key=photo_key),
        )
        body = response["Body"]
        return await loop.run_in_executor(None, body.read)
    except Exception:
        logger.exception("Failed to fetch photo from S3 for broadcast photo_key=%s", photo_key)
        return None


async def send_broadcast(ctx: dict, broadcast_id: str) -> None:
    logger.info("Starting send_broadcast task for broadcast_id=%s", broadcast_id)
    if not settings.TG_BOT_TOKEN:
        logger.error("TG_BOT_TOKEN not set; cannot send broadcast")
        return

    # 1. Fetch the broadcast object
    with Session(engine) as session:
        broadcast = session.get(Broadcast, uuid.UUID(broadcast_id))
        if not broadcast:
            logger.error("Broadcast with id=%s not found", broadcast_id)
            return

        if broadcast.status in ("sending", "completed"):
            logger.warning("Broadcast already in state %s; skipping", broadcast.status)
            return

        broadcast.status = "sending"
        broadcast.started_at = datetime.now(timezone.utc)
        session.add(broadcast)
        session.commit()

        # 2. Select target users
        statement = select(User).where(User.telegram_id != None)
        if broadcast.target_region_id is not None:
            statement = statement.where(User.region_id == broadcast.target_region_id)

        users = session.exec(statement).all()

        # Build inline keyboard if buttons are provided
        keyboard_buttons = []
        for btn in broadcast.buttons:
            text = btn.get("text")
            url = btn.get("url")
            if text and url:
                keyboard_buttons.append([InlineKeyboardButton(text=text, url=url)])
        reply_markup = (
            InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
            if keyboard_buttons
            else None
        )

        # Fetch photo if any
        photo_bytes = None
        if broadcast.photo_key:
            photo_bytes = await _fetch_photo_bytes(broadcast.photo_key)

    # 3. Send messages
    bot = Bot(token=settings.TG_BOT_TOKEN)
    sent_count = 0
    failed_count = 0

    try:
        for user in users:
            # Select appropriate translation
            text = broadcast.text_uz
            if user.language == "ru" and broadcast.text_ru:
                text = broadcast.text_ru
            elif user.language == "en" and broadcast.text_en:
                text = broadcast.text_en

            try:
                if photo_bytes:
                    photo_file = BufferedInputFile(photo_bytes, filename="promo.jpg")
                    await bot.send_photo(
                        chat_id=user.telegram_id,
                        photo=photo_file,
                        caption=text,
                        reply_markup=reply_markup,
                        parse_mode="HTML",
                    )
                else:
                    await bot.send_message(
                        chat_id=user.telegram_id,
                        text=text,
                        reply_markup=reply_markup,
                        parse_mode="HTML",
                    )
                sent_count += 1
            except TelegramForbiddenError:
                failed_count += 1
                logger.info("User blocked bot: telegram_id=%s", user.telegram_id)
            except TelegramAPIError as exc:
                failed_count += 1
                logger.warning("Telegram API error for telegram_id=%s: %s", user.telegram_id, exc)
            except Exception:
                failed_count += 1
                logger.exception("Failed to send broadcast message to telegram_id=%s", user.telegram_id)

            # Avoid Telegram rate limit (max 30 messages per second)
            await asyncio.sleep(0.05)

    finally:
        await bot.session.close()

    # 4. Save results
    with Session(engine) as session:
        db_broadcast = session.get(Broadcast, uuid.UUID(broadcast_id))
        if db_broadcast:
            db_broadcast.status = "completed"
            db_broadcast.sent_count = sent_count
            db_broadcast.failed_count = failed_count
            db_broadcast.completed_at = datetime.now(timezone.utc)
            session.add(db_broadcast)
            session.commit()
            logger.info(
                "Broadcast completed: broadcast_id=%s sent=%d failed=%d",
                broadcast_id,
                sent_count,
                failed_count,
            )
