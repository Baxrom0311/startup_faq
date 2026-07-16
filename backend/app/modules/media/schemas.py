import uuid
from datetime import datetime

from sqlmodel import SQLModel


class PresignRequest(SQLModel):
    kind: str
    content_type: str
    size: int
    problem_id: str | None = None


class PresignResponse(SQLModel):
    upload_url: str
    object_key: str
    method: str = "PUT"


class ProblemMediaPublic(SQLModel):
    id: uuid.UUID
    problem_id: uuid.UUID | None
    kind: str
    object_key: str
    url: str
    created_at: datetime


class ProblemMediaPublics(SQLModel):
    data: list[ProblemMediaPublic]
    count: int
