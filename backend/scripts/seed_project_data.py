"""Seed demo milestones, updates, and issues for existing projects."""
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, "/app/backend")

from sqlmodel import Session, create_engine, select
from app.core.config import settings
from app.models import Project, ProjectMilestone, ProjectUpdateLog, ProjectIssue, IssueComment

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))

NOW = datetime.now(timezone.utc)


def dt(days_ago: int) -> datetime:
    return NOW - timedelta(days=days_ago)


PROJECT_DATA = {
    "4add0125-8c01-4299-b604-dfef4bfb339c": {  # Shaffof yer ajratish platformasi
        "milestones": [
            ("Talablar va MVP rejasi", "done", -30),
            ("Backend API dizayni", "done", -22),
            ("Frontend prototip", "done", -15),
            ("Beta testlash", "in_progress", -5),
            ("Rasmiy ishga tushirish", "todo", 0),
        ],
        "updates": [
            ("Loyiha boshlandı! Jamoamiz 4 kishidan iborat, haftada 3 kun yig'ilamiz. Birinchi sprint — talablar yig'ish.", -28),
            ("Backend API ning asosiy endpointlari tayyor: yer parchalari, arizalar, foydalanuvchilar. Swagger hujjatlar yozildi.", -18),
            ("Frontend React da prototip tayyorlandi. Yer ko'rsatish uchun Leaflet xaritasi integratsiya qilindi.", -10),
            ("Beta testlash boshlandi. 12 ta test foydalanuvchi jalb qilindi. Dastlabki feedbacklar ijobiy.", -3),
        ],
        "issues": [
            ("Xaritada yer parcellarini belgilash sekin ishlaydi", "bug", "open", -20),
            ("Ariza holati haqida SMS xabarnoma qo'shish", "feature", "open", -15),
            ("Foydalanuvchi profil sahifasini yaratish", "task", "closed", -25),
            ("Ma'lumotlar bazasini optimize qilish kerak", "task", "open", -8),
            ("Mobil versiya dizayni yaxshilansin", "feature", "open", -5),
        ],
    },
    "583c1190-894e-4d66-b1e8-770c75f024e7": {  # Arzon o'quv resurslari kutubxonasi
        "milestones": [
            ("Platforma arxitekturasi", "done", -25),
            ("Kontent yuklab olish tizimi", "done", -18),
            ("Qidiruv va filtrlash", "done", -10),
            ("Foydalanuvchi hisobi", "in_progress", -3),
            ("Mobile app", "todo", 0),
        ],
        "updates": [
            ("Platformaning asosiy tuzilmasi qurildi. PostgreSQL + FastAPI backend, React frontend.", -23),
            ("Kontent yuklab olish va saqlash tizimi ishga tushdi. MinIO ob'ekt saqlash integratsiya.", -16),
            ("Qidiruv tizimi tayyor — full-text search, kategoriya va narx bo'yicha filtrlash.", -8),
            ("Foydalanuvchi autentifikatsiya tizimi ustida ishlayapmiz. JWT tokenlar bilan.", -2),
        ],
        "issues": [
            ("PDF viewer brauzerda og'ir yuklanadi", "bug", "closed", -20),
            ("Resurslarni reytinglash tizimi kerak", "feature", "open", -12),
            ("Video darslar uchun progress saqlash", "feature", "open", -7),
            ("Admin panel yaratish", "task", "in_progress", -15),
        ],
    },
    "98d9e0ed-d2fd-4092-88cc-2d04efa13fb7": {  # Internet tariflarini solishtirish vositasi
        "milestones": [
            ("Operatorlar API integratsiyasi", "done", -20),
            ("Taqqoslash algoritmi", "done", -14),
            ("Web interface", "done", -8),
            ("Real-time narx yangilash", "in_progress", -2),
        ],
        "updates": [
            ("Ucell, Beeline, UMS va Mobiuz operatorlari bilan API integratsiya tugallandi.", -18),
            ("Taqqoslash algoritmi tayyorlandi — foydalanuvchi ehtiyojiga qarab eng yaxshi tarif tavsiyasi.", -12),
            ("Web interfeys tayyor. Foydalanuvchi internet tezligi va byudjetini kiritib optimal tarif topadi.", -6),
            ("Hozir real-time narx yangilash ustida ishlayapmiz. Webhook yondashuvi sinab ko'rilmoqda.", -1),
        ],
        "issues": [
            ("Beeline API ba'zan 503 qaytaradi", "bug", "open", -10),
            ("Tarif solishtirish jadvali mobilda siqilip qoladi", "bug", "closed", -8),
            ("Foydalanuvchi saqlangan tariflar ro'yxati", "feature", "open", -5),
            ("Tarix va narx o'zgarish grafigi", "feature", "open", -3),
        ],
    },
    "ade27bfe-357f-4161-be6a-a24f233d2bcd": {  # Mobil sovuq omborxona tarmog'i
        "milestones": [
            ("Biznes model va bozor tadqiqoti", "done", -35),
            ("Logistika tizimi dizayni", "done", -28),
            ("Pilot omborxona bilan shartnoma", "done", -20),
            ("Mobil ilova MVP", "in_progress", -7),
            ("Ikkinchi omborxona qo'shish", "todo", 0),
        ],
        "updates": [
            ("Bozor tadqiqoti tugallandi. O'zbekistonda 3000+ kichik fermer xo'jaligi maqsadli auditoriya.", -32),
            ("Samarqand va Toshkent shahridagi 2 ta sovuq omborxona bilan kelishuvlar bo'ldi.", -24),
            ("Logistika tizimi: buyurtma qabul qilish, transport marshrutlash, temperatura monitoring.", -16),
            ("Mobil ilovaning birinchi versiyasi Android uchun tayyorlandi. iOS ustida ishlayapmiz.", -5),
        ],
        "issues": [
            ("GPS tracking real-vaqt yangilanmaydi", "bug", "open", -8),
            ("Temperatura ogohlantirish tizimi", "feature", "open", -12),
            ("Fermerlar uchun to'lov tizimi integratsiyasi", "task", "open", -6),
            ("Omborxona to'liqlik ko'rsatkichi dashboard", "feature", "closed", -20),
        ],
    },
    "7ad80125-3935-49f5-a381-4880859573e1": {  # Naqd pul yetkazib berish xizmati
        "milestones": [
            ("Xavfsizlik va compliance tadqiqoti", "done", -40),
            ("Kuryer tizimi prototip", "done", -30),
            ("To'lov integratsiyasi", "done", -20),
            ("Pilot testlash (100 ta buyurtma)", "in_progress", -5),
            ("Kengaytirilgan ishga tushirish", "todo", 0),
        ],
        "updates": [
            ("Markaziy bank va moliya vazirligi bilan maslahatlar o'tkazildi. Litsenziya talablari aniqlashtirildi.", -38),
            ("Kuryer dispatch tizimi tayyor. Yaqin kuryer aniqlash, optimal marshrut hisoblash.", -25),
            ("Payme va Click to'lov tizimlari integratsiya qilindi. Komissiya 0.8% bo'ladi.", -18),
            ("Pilot testlash Toshkent Yunusobod tumanida boshlandi. 23 ta kuryer jalb qilindi.", -3),
        ],
        "issues": [
            ("Kuryer ilovasida autentifikatsiya muammosi", "bug", "closed", -15),
            ("Yetkazib berish vaqti hisoblash noto'g'ri", "bug", "open", -10),
            ("Mijoz uchun real-vaqt tracking", "feature", "open", -8),
            ("Kuryer baholash tizimi", "feature", "open", -5),
            ("Katta summalar uchun qo'shimcha tasdiqlash", "task", "closed", -20),
        ],
    },
}

ISSUE_STATUS_MAP = {
    "open": "open",
    "closed": "closed",
    "in_progress": "open",
}

ISSUE_COMMENTS = {
    "bug": [
        "Bu muammoni men ham ko'rdim. Tez hal qilinishi kerak.",
        "Qayta ishga tushirgandan keyin yaxshilandi, lekin to'liq tuzatilmadi.",
    ],
    "feature": [
        "Juda yaxshi g'oya! Bu foydalanuvchilar uchun qulay bo'ladi.",
        "Qachon amalga oshiriladi? Buni ko'p foydalanuvchilar so'rayapti.",
    ],
    "task": [
        "Bu vazifaga kirishaman. Taxminan 3 kun kerak bo'ladi.",
        "Vazifa bajarildi, PR yuborildi.",
    ],
    "question": [
        "Texnik jihatdan bu mumkin, lekin biraz murakkab.",
        "Buni qilish uchun qo'shimcha ma'lumot kerak.",
    ],
}


def seed():
    with Session(engine) as session:
        # Get user IDs for seeding
        projects = session.exec(select(Project)).all()

        total_milestones = 0
        total_updates = 0
        total_issues = 0
        total_comments = 0

        # Assign data by position — UUIDs in PROJECT_DATA are local dev IDs
        data_list = list(PROJECT_DATA.values())
        for idx, project in enumerate(projects):
            data = data_list[idx] if idx < len(data_list) else None
            if not data:
                continue

            lead_id = project.lead_id

            # Seed milestones
            for title, status, days_ago in data["milestones"]:
                ms = ProjectMilestone(
                    id=uuid.uuid4(),
                    project_id=project.id,
                    title=title,
                    status=status,
                    created_at=dt(abs(days_ago)),
                )
                session.add(ms)
                total_milestones += 1

            # Seed updates
            for text_content, days_ago in data["updates"]:
                upd = ProjectUpdateLog(
                    id=uuid.uuid4(),
                    project_id=project.id,
                    author_id=lead_id,
                    text=text_content,
                    created_at=dt(abs(days_ago)),
                )
                session.add(upd)
                total_updates += 1

            # Seed issues
            for title, kind, status, days_ago in data["issues"]:
                closed_at = dt(abs(days_ago) - 3) if status == "closed" else None
                issue = ProjectIssue(
                    id=uuid.uuid4(),
                    project_id=project.id,
                    author_id=lead_id,
                    title=title,
                    kind=kind,
                    status=status,
                    closed_at=closed_at,
                    comment_count=2,
                    created_at=dt(abs(days_ago)),
                )
                session.add(issue)
                session.flush()  # get the id
                total_issues += 1

                # Add 2 comments per issue
                comments = ISSUE_COMMENTS.get(kind, ISSUE_COMMENTS["task"])
                for i, comment_text in enumerate(comments):
                    comment = IssueComment(
                        id=uuid.uuid4(),
                        issue_id=issue.id,
                        author_id=lead_id,
                        text=comment_text,
                        created_at=dt(max(abs(days_ago) - 1 - i, 0)),
                    )
                    session.add(comment)
                    total_comments += 1

        session.commit()
        print(f"Seeded: {total_milestones} milestones, {total_updates} updates, {total_issues} issues, {total_comments} comments")


if __name__ == "__main__":
    seed()
