import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import EmailStr, model_validator
from sqlalchemy import JSON, BigInteger, Column, DateTime
from sqlmodel import Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(timezone.utc)


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, unique=True, index=True, max_length=32)
    telegram_id: int | None = Field(
        default=None,
        sa_column=Column(BigInteger, unique=True, index=True, nullable=True),
    )
    telegram_username: str | None = Field(default=None, max_length=255)
    roles: list[str] = Field(
        default_factory=lambda: ["problem_owner"],
        sa_column=Column(JSON, nullable=False),
    )
    region_id: int | None = None
    bio: str | None = Field(default=None, max_length=1000)
    reputation: int = 0
    tg_linked_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)
    problems: list["Problem"] = Relationship(back_populates="author", cascade_delete=True)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


class AuthSession(SQLModel, table=True):
    __tablename__ = "auth_session"

    token: str = Field(primary_key=True, max_length=128)
    phone_entered: str | None = Field(default=None, index=True, max_length=32)
    status: str = Field(default="pending", index=True, max_length=32)
    telegram_id: int | None = Field(default=None, sa_column=Column(BigInteger))
    user_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    client: str | None = Field(default=None, max_length=32)
    ip: str | None = Field(default=None, max_length=64)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    expires_at: datetime = Field(sa_type=DateTime(timezone=True))  # type: ignore


class Sector(SQLModel, table=True):
    id: int = Field(primary_key=True)
    slug: str = Field(unique=True, index=True, max_length=80)
    name_uz: str = Field(max_length=255)
    icon: str | None = Field(default=None, max_length=80)


class Region(SQLModel, table=True):
    id: int = Field(primary_key=True)
    name: str = Field(max_length=255)
    parent_id: int | None = Field(default=None, foreign_key="region.id")


class ProblemBase(SQLModel):
    raw_text: str | None = Field(default=None, max_length=5000)
    raw_audio_key: str | None = Field(default=None, max_length=512)
    region_id: int | None = Field(default=None, foreign_key="region.id")


class ProblemCreate(ProblemBase):
    @model_validator(mode="after")
    def _require_text_or_audio(self) -> "ProblemCreate":
        if not self.raw_text and not self.raw_audio_key:
            raise ValueError("raw_text or raw_audio_key is required")
        return self


class ProblemUpdate(SQLModel):
    raw_text: str | None = Field(default=None, max_length=5000)
    region_id: int | None = None


class Problem(ProblemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    author_id: uuid.UUID = Field(foreign_key="user.id", nullable=False, ondelete="CASCADE")
    sector_id: int | None = Field(default=None, foreign_key="sector.id")
    transcript: str | None = None
    title: str | None = Field(default=None, max_length=120)
    structured_desc: dict[str, Any] | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )
    status: str = Field(default="ai_processing", index=True, max_length=32)
    severity_score: float | None = None
    vote_count: int = 0
    duplicate_of: uuid.UUID | None = Field(default=None, foreign_key="problem.id")
    published_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    updated_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    author: User | None = Relationship(back_populates="problems")


class ProblemStatusLog(SQLModel, table=True):
    __tablename__ = "problem_status_log"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    problem_id: uuid.UUID = Field(foreign_key="problem.id", nullable=False, ondelete="CASCADE")
    from_status: str | None = Field(default=None, max_length=32)
    to_status: str = Field(max_length=32)
    actor_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    reason: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class ProblemMedia(SQLModel, table=True):
    __tablename__ = "problem_media"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    problem_id: uuid.UUID | None = Field(default=None, foreign_key="problem.id", ondelete="CASCADE")
    kind: str = Field(max_length=32)
    object_key: str = Field(unique=True, index=True, max_length=512)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class Vote(SQLModel, table=True):
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True, ondelete="CASCADE")
    problem_id: uuid.UUID = Field(
        foreign_key="problem.id",
        primary_key=True,
        ondelete="CASCADE",
    )
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class CommentBase(SQLModel):
    text: str = Field(min_length=1, max_length=2000)
    parent_id: uuid.UUID | None = Field(default=None, foreign_key="comment.id")


class CommentCreate(CommentBase):
    pass


class Comment(CommentBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    problem_id: uuid.UUID = Field(foreign_key="problem.id", nullable=False, ondelete="CASCADE")
    user_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class CommentPublic(CommentBase):
    id: uuid.UUID
    problem_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime


class CommentsPublic(SQLModel):
    data: list[CommentPublic]
    count: int


class ProblemPublic(SQLModel):
    id: uuid.UUID
    author_id: uuid.UUID
    sector_id: int | None = None
    region_id: int | None = None
    raw_text: str | None = None
    raw_audio_key: str | None = None
    transcript: str | None = None
    title: str | None = None
    structured_desc: dict[str, Any] | None = None
    status: str
    severity_score: float | None = None
    vote_count: int
    duplicate_of: uuid.UUID | None = None
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ProblemsPublic(SQLModel):
    data: list[ProblemPublic]
    count: int


class ProjectBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    pitch: str | None = Field(default=None, max_length=3000)
    repo_url: str | None = Field(default=None, max_length=500)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    pitch: str | None = Field(default=None, max_length=3000)
    repo_url: str | None = Field(default=None, max_length=500)


class Project(ProjectBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    problem_id: uuid.UUID = Field(foreign_key="problem.id", nullable=False)
    lead_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    status: str = Field(default="proposed", index=True, max_length=32)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    updated_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class ProjectPublic(ProjectBase):
    id: uuid.UUID
    problem_id: uuid.UUID
    lead_id: uuid.UUID
    status: str
    created_at: datetime
    updated_at: datetime


class ProjectsPublic(SQLModel):
    data: list[ProjectPublic]
    count: int


class ProjectMember(SQLModel, table=True):
    project_id: uuid.UUID = Field(foreign_key="project.id", primary_key=True, ondelete="CASCADE")
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    role: str = Field(default="member", max_length=32)


class ProjectMilestoneBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    status: str = Field(default="todo", max_length=32)
    due_date: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    sort_order: int = 0


class ProjectMilestoneCreate(ProjectMilestoneBase):
    pass


class ProjectMilestoneUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    status: str | None = Field(default=None, max_length=32)
    due_date: datetime | None = None
    sort_order: int | None = None


class ProjectMilestone(ProjectMilestoneBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", nullable=False, ondelete="CASCADE")
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class ProjectMilestonePublic(ProjectMilestoneBase):
    id: uuid.UUID
    project_id: uuid.UUID
    created_at: datetime


class ProjectMilestonesPublic(SQLModel):
    data: list[ProjectMilestonePublic]
    count: int


class ProjectUpdateBase(SQLModel):
    text: str = Field(min_length=1, max_length=3000)
    media_keys: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))


class ProjectUpdateCreate(ProjectUpdateBase):
    pass


class ProjectUpdateLog(ProjectUpdateBase, table=True):
    __tablename__ = "project_update"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", nullable=False, ondelete="CASCADE")
    author_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class ProjectUpdatePublic(ProjectUpdateBase):
    id: uuid.UUID
    project_id: uuid.UUID
    author_id: uuid.UUID
    created_at: datetime


class ProjectUpdatesPublic(SQLModel):
    data: list[ProjectUpdatePublic]
    count: int


class ReviewBase(SQLModel):
    rating: int = Field(ge=1, le=5)
    text: str | None = Field(default=None, max_length=2000)


class ReviewCreate(ReviewBase):
    pass


class Review(ReviewBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", nullable=False, ondelete="CASCADE")
    reviewer_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class ReviewPublic(ReviewBase):
    id: uuid.UUID
    project_id: uuid.UUID
    reviewer_id: uuid.UUID
    created_at: datetime


class Notification(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", nullable=False, index=True, ondelete="CASCADE")
    type: str = Field(max_length=80, index=True)
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    read_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    delivery_status: str = Field(default="pending", max_length=32, index=True)
    delivered_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    delivery_error: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class NotificationPublic(SQLModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: str
    payload: dict[str, Any]
    read_at: datetime | None = None
    delivery_status: str
    delivered_at: datetime | None = None
    delivery_error: str | None = None
    created_at: datetime


class NotificationsPublic(SQLModel):
    data: list[NotificationPublic]
    count: int
    unread_count: int


class NotificationReadRequest(SQLModel):
    notification_ids: list[uuid.UUID] = Field(default_factory=list)


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)
