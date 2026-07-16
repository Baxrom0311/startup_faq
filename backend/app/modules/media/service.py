import uuid

import boto3
from botocore.client import Config
from fastapi import HTTPException, status

from app.core.config import settings

ALLOWED_MEDIA: dict[str, dict[str, object]] = {
    "audio": {
        "content_types": {"audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm"},
        "max_size": 10 * 1024 * 1024,
    },
    "photo": {
        "content_types": {"image/jpeg", "image/png", "image/webp"},
        "max_size": 5 * 1024 * 1024,
    },
}


def validate_media(*, kind: str, content_type: str, size: int) -> None:
    config = ALLOWED_MEDIA.get(kind)
    if not config:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported media kind")
    if content_type not in config["content_types"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported content type")
    if size <= 0 or size > config["max_size"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File size is not allowed")


def build_object_key(*, kind: str, content_type: str) -> str:
    extension_by_content_type = {
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "audio/ogg": "ogg",
        "audio/wav": "wav",
        "audio/webm": "webm",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }
    extension = extension_by_content_type.get(content_type, "bin")
    return f"{kind}/{uuid.uuid4()}.{extension}"


def create_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        config=Config(signature_version="s3v4"),
    )


def create_presigned_upload_url(*, object_key: str, content_type: str) -> str:
    client = create_s3_client()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET_MEDIA,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=3600,
    )


def create_presigned_read_url(*, object_key: str) -> str:
    client = create_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.S3_BUCKET_MEDIA,
            "Key": object_key,
        },
        ExpiresIn=3600,
    )


def delete_media_object(*, object_key: str) -> None:
    client = create_s3_client()
    client.delete_object(Bucket=settings.S3_BUCKET_MEDIA, Key=object_key)


def download_media_object(*, object_key: str, destination_path: str) -> None:
    client = create_s3_client()
    client.download_file(settings.S3_BUCKET_MEDIA, object_key, destination_path)
