"""Government-facing civic-appeal layer (idora yo'naltirish + ijro kuzatuvi).

Additive: operates only on problems with track == "civic". The startup problem
flow is untouched. Citizens submit appeals through the normal POST /problems/
endpoint with track="civic"; the AI worker routes them to an agency and flags
emergencies. These endpoints let officials list, track execution, and see
aggregate statistics in one place.
"""
import json
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import select

from app.core.config import settings

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Agency,
    AgencyPublic,
    AppealActionLog,
    AppealActionLogPublic,
    AppealActionLogsPublic,
    AppealRouteUpdate,
    AppealStatusUpdate,
    Problem,
    ProblemPublic,
    ProblemsPublic,
    User,
)

router = APIRouter(prefix="/appeals", tags=["appeals"])

_OFFICIAL_ROLES = {"official", "gov", "moderator"}


def _ensure_official(user: User) -> None:
    """Only government officials (or superusers) may use the tracking layer."""
    if user.is_superuser:
        return
    if any(role in _OFFICIAL_ROLES for role in (user.roles or [])):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
    )


def _appeal_public(problem: Problem, author_name: str | None) -> ProblemPublic:
    data = ProblemPublic.model_validate(problem.model_dump())
    data.author_name = author_name
    return data


@router.get("/agencies", response_model=list[AgencyPublic])
def list_agencies(*, session: SessionDep, current_user: CurrentUser) -> Any:
    """Agencies (idoralar) appeals can be routed to. Any logged-in user."""
    return session.exec(select(Agency).order_by(Agency.id)).all()


@router.get("", response_model=ProblemsPublic)
def list_appeals(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    agency_id: int | None = None,
    appeal_status: str | None = None,
    region_id: int | None = None,
    is_emergency: bool | None = None,
    q: str | None = None,
    sort: str = "urgent",  # urgent | reports | newest
    skip: int = 0,
    limit: int = 30,
) -> Any:
    _ensure_official(current_user)
    filters = [Problem.track == "civic"]
    if agency_id is not None:
        filters.append(Problem.agency_id == agency_id)
    if appeal_status:
        filters.append(Problem.appeal_status == appeal_status)
    if region_id is not None:
        filters.append(Problem.region_id == region_id)
    if is_emergency is not None:
        filters.append(Problem.is_emergency == is_emergency)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        filters.append(Problem.raw_text.ilike(pattern) | Problem.title.ilike(pattern))

    count = session.exec(select(func.count()).select_from(Problem).where(*filters)).one()

    statement = select(Problem).where(*filters)
    if sort == "reports":
        statement = statement.order_by(Problem.report_count.desc(), Problem.created_at.desc())
    elif sort == "newest":
        statement = statement.order_by(Problem.created_at.desc())
    else:  # "urgent": emergencies first, then most-reported, then most severe
        statement = statement.order_by(
            Problem.is_emergency.desc(),
            Problem.report_count.desc(),
            Problem.severity_score.desc().nullslast(),
            Problem.created_at.desc(),
        )
    statement = statement.offset(skip).limit(min(limit, 100))
    problems = session.exec(statement).all()

    author_ids = list({p.author_id for p in problems})
    names: dict[Any, str | None] = {}
    if author_ids:
        for u in session.exec(select(User).where(User.id.in_(author_ids))).all():
            names[u.id] = u.full_name
    data = [_appeal_public(p, names.get(p.author_id)) for p in problems]
    return ProblemsPublic(data=data, count=count)


@router.get("/stats")
def appeal_stats(*, session: SessionDep, current_user: CurrentUser) -> dict[str, Any]:
    """Aggregate statistics for the hokimiyat dashboard."""
    _ensure_official(current_user)
    civic = Problem.track == "civic"

    total = session.exec(select(func.count()).select_from(Problem).where(civic)).one()
    emergency = session.exec(
        select(func.count()).select_from(Problem).where(civic, Problem.is_emergency == True)  # noqa: E712
    ).one()

    def _group(column) -> dict[str, int]:
        rows = session.exec(
            select(column, func.count()).where(civic).group_by(column)
        ).all()
        return {str(key) if key is not None else "none": int(cnt) for key, cnt in rows}

    by_status = _group(Problem.appeal_status)
    by_agency = _group(Problem.agency_id)
    by_region = _group(Problem.region_id)

    resolved = by_status.get("resolved", 0)
    resolution_rate = round(resolved / total, 3) if total else 0.0
    open_count = total - resolved - by_status.get("rejected", 0)

    return {
        "total": total,
        "emergency": emergency,
        "open": open_count,
        "resolved": resolved,
        "resolution_rate": resolution_rate,
        "by_status": by_status,
        "by_agency": by_agency,
        "by_region": by_region,
    }


@router.get("/{problem_id}/history", response_model=AppealActionLogsPublic)
def appeal_history(
    *, session: SessionDep, current_user: CurrentUser, problem_id: str
) -> Any:
    _ensure_official(current_user)
    logs = session.exec(
        select(AppealActionLog)
        .where(AppealActionLog.problem_id == problem_id)
        .order_by(AppealActionLog.created_at.asc())
    ).all()
    return AppealActionLogsPublic(
        data=[AppealActionLogPublic.model_validate(log.model_dump()) for log in logs],
        count=len(logs),
    )


@router.post("/{problem_id}/status", response_model=ProblemPublic)
def update_appeal_status(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    problem_id: str,
    body: AppealStatusUpdate,
) -> Any:
    """Move an appeal along its execution track and record the action."""
    _ensure_official(current_user)
    problem = session.get(Problem, problem_id)
    if not problem or problem.track != "civic":
        raise HTTPException(status_code=404, detail="Appeal not found")

    from_status = problem.appeal_status
    problem.appeal_status = body.status
    if body.agency_id is not None:
        problem.agency_id = body.agency_id
    if body.due_date is not None:
        problem.appeal_due_date = body.due_date
    if body.status == "resolved":
        problem.appeal_resolved_at = datetime.now(timezone.utc)
    problem.updated_at = datetime.now(timezone.utc)
    session.add(problem)
    session.add(
        AppealActionLog(
            problem_id=problem.id,
            agency_id=problem.agency_id,
            from_status=from_status,
            to_status=body.status,
            note=body.note,
            actor_id=current_user.id,
        )
    )
    session.commit()
    session.refresh(problem)
    return _appeal_public(problem, None)


@router.post("/{problem_id}/route", response_model=ProblemPublic)
def reroute_appeal(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    problem_id: str,
    body: AppealRouteUpdate,
) -> Any:
    """Manually (re)assign the responsible agency / emergency flag (overrides AI)."""
    _ensure_official(current_user)
    problem = session.get(Problem, problem_id)
    if not problem or problem.track != "civic":
        raise HTTPException(status_code=404, detail="Appeal not found")
    if body.agency_id is not None:
        if not session.get(Agency, body.agency_id):
            raise HTTPException(status_code=422, detail="Agency not found")
        problem.agency_id = body.agency_id
    if body.is_emergency is not None:
        problem.is_emergency = body.is_emergency
    problem.updated_at = datetime.now(timezone.utc)
    session.add(problem)
    session.commit()
    session.refresh(problem)
    return _appeal_public(problem, None)


class VoiceChatMessage(BaseModel):
    role: str
    content: str


class VoiceChatRequest(BaseModel):
    messages: list[VoiceChatMessage]
    language: str = "uz"


class CollectedData(BaseModel):
    citizen_name: str | None = None
    phone: str | None = None
    location: str | None = None
    problem_description: str | None = None
    suggested_agency_slug: str | None = None
    is_emergency: bool = False


class VoiceChatResponse(BaseModel):
    reply_text: str
    ready_to_submit: bool = False
    collected_data: CollectedData | None = None


VOICE_SYSTEM_PROMPT = """Sen "SolutionLab Ovozli AI Yordamchisi"san. Vazifang — fuqarolardan murojaat va shikoyatlarni ovozli muloqot orqali qabul qilish va ularga ko'maklashish.

Muloqot va javob berish qoidalari:
1. Har doim fuqaroning tilida (o'zbek tilida: "uz", rus tilida: "ru", ingliz tilida: "en") xushmuomalalik va hurmat bilan javob ber ("Assalomu aleykum hurmatli fuqaro!...").
2. Fuqaro murojaatining mazmunini (muammosini) tahlil qil va tushunib ol.
3. Murojaatni to'liq shakllantirish uchun fuqarodan quyidagi ma'lumotlar borligini tekshir:
   - Muammo tavsifi (nimadan shikoyat qilmoqda)
   - Fuqaroning ismi (Ism-familiya)
   - Telefon raqami
   - Manzili (Tuman, shahar yoki mahalla)
4. Agar ism, telefon raqami yoki manzil hali aytilmagan bo'lsa, fuqarodan bularni qisqa va aniq so'ra (masalan: "Muammoingiz tushunarli. Iltimos, ismingiz, telefon raqamingiz va manzilingizni ham aytib o'tsangiz, murojaatingizni rasmiylashtiramiz...").
5. Tizim idoralarini quyidagi sluglardan biriga mosla: "suv", "elektr", "gaz", "issiqlik", "yol", "kommunal", "obodonlashtirish", "transport", "mahalla", "iib", "soglik", "talim", "ekologiya", "ijtimoiy", "aloqa", "boshqa".
6. Shoshilinch xavf (gaz sizib chiqishi, sim uzilishi, suv toshishi, inson hayotiga xavf) bo'lsa: "is_emergency": true qil.
7. Ma'lumotlar yetarli bo'lgach (muammo va fuqaro aloqa ma'lumotlari bo'lsa), fuqaroga murojaat qabul qilinganini ayt va "ready_to_submit": true deb o'rnat.

HAR DOIM FAQAT shunday yagona JSON obyekt qaytar:
{
  "reply_text": "<Fuqaroga ovoz bilan o'qiladigan javob matni>",
  "ready_to_submit": false,
  "collected_data": {
    "citizen_name": "<ism yoki null>",
    "phone": "<telefon yoki null>",
    "location": "<manzil yoki null>",
    "problem_description": "<muammo matni yoki null>",
    "suggested_agency_slug": "<slug yoki null>",
    "is_emergency": false
  }
}
"""


@router.post("/voice-chat", response_model=VoiceChatResponse)
async def voice_chat(body: VoiceChatRequest) -> VoiceChatResponse:
    """Interactive Gemini Voice AI assistant endpoint for civic appeals."""
    api_key = settings.GEMINI_API_KEY or "AIzaSyB10Cl-vb91H6znU2_j-9evrnTY-Lncz9k"
    model_name = "gemini-1.5-flash"


    contents = [{"role": "user", "parts": [{"text": VOICE_SYSTEM_PROMPT}]}]
    for msg in body.messages:
        role = "user" if msg.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg.content}]})

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                url,
                params={"key": api_key},
                json={
                    "contents": contents,
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.2,
                    },
                },
            )

            # Fallback model check if 2.5-flash returns 404 or error
            if res.status_code != 200:
                fallback_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
                res = await client.post(
                    fallback_url,
                    params={"key": api_key},
                    json={
                        "contents": contents,
                        "generationConfig": {
                            "responseMimeType": "application/json",
                            "temperature": 0.2,
                        },
                    },
                )

            if res.status_code == 200:
                payload = res.json()
                raw_text = "".join(
                    part.get("text", "")
                    for candidate in payload.get("candidates", [])
                    for part in candidate.get("content", {}).get("parts", [])
                )
                try:
                    data = json.loads(raw_text)
                    return VoiceChatResponse(
                        reply_text=data.get(
                            "reply_text", "Rahmat, murojaatingiz tushunarli."
                        ),
                        ready_to_submit=bool(data.get("ready_to_submit", False)),
                        collected_data=data.get("collected_data"),
                    )
                except Exception:
                    pass
    except Exception as e:
        print(f"Gemini Voice Chat Error: {e}")

    last_user_msg = body.messages[-1].content if body.messages else ""
    return VoiceChatResponse(
        reply_text="Assalomu aleykum hurmatli fuqaro! Murojaatingizni va shaxsiy ma'lumotlaringizni (ism, telefon, manzil) yozib yoki so'zlab bering, biz uni tegishli idoraga yuboramiz.",
        ready_to_submit=len(last_user_msg) > 30,
        collected_data=CollectedData(problem_description=last_user_msg),
    )

