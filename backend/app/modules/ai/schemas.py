import uuid
from datetime import datetime

from pydantic import BaseModel, Field
from sqlmodel import SQLModel


class StructuredProblem(BaseModel):
    title: str = Field(max_length=120)
    summary: str
    who_affected: str | None = None
    frequency: str | None = None
    current_workaround: str | None = None
    pain_level: int | None = Field(default=None, ge=1, le=5)
    urgency: str | None = None
    impact_scope: str | None = None
    suggested_sector: str | None = None
    suggested_region: str | None = None
    tags: list[str] = Field(default_factory=list)
    duplicate_keywords: list[str] = Field(default_factory=list)
    is_actionable: bool = True
    confidence: float = Field(default=0.7, ge=0, le=1)
    flags: dict[str, bool] = Field(default_factory=dict)
    moderation_reason: str | None = None


class AIResult(BaseModel):
    transcript: str | None = None
    structured: StructuredProblem
    embedding: list[float]
    severity_score: float
    model: str


class AIAnalysisPublic(SQLModel):
    id: uuid.UUID
    problem_id: uuid.UUID
    model: str
    summary_json: dict
    created_at: datetime


class AIAnalysisPublics(SQLModel):
    data: list[AIAnalysisPublic]
    count: int
