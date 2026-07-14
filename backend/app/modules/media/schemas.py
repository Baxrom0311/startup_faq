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
