from sqlmodel import Session, create_engine, select

from app import crud
from app.core.config import settings
from app.models import Region, Sector, User, UserCreate

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))

# Seeded once on first startup; safe to re-run (id-based upsert)
_SECTORS: list[dict] = [
    {"id": 1,  "slug": "agro",        "name_uz": "Agro-texnologiya",       "icon": "🌾"},
    {"id": 2,  "slug": "food",        "name_uz": "Oziq-ovqat sanoati",     "icon": "🍎"},
    {"id": 3,  "slug": "textile",     "name_uz": "Tekstil va kiyim",       "icon": "🧵"},
    {"id": 4,  "slug": "construction","name_uz": "Qurilish va ko'chmas mulk","icon": "🏗️"},
    {"id": 5,  "slug": "industry",    "name_uz": "Ishlab chiqarish",       "icon": "🏭"},
    {"id": 6,  "slug": "mining",      "name_uz": "Tog'-kon sanoati",       "icon": "⛏️"},
    {"id": 7,  "slug": "pharma",      "name_uz": "Kimyo va farmatsevtika", "icon": "💊"},
    {"id": 8,  "slug": "energy",      "name_uz": "Energetika",             "icon": "⚡"},
    {"id": 9,  "slug": "finance",     "name_uz": "Moliya va bank",         "icon": "🏦"},
    {"id": 10, "slug": "insurance",   "name_uz": "Sug'urta",               "icon": "🛡️"},
    {"id": 11, "slug": "trade",       "name_uz": "Savdo va e-commerce",    "icon": "🛒"},
    {"id": 12, "slug": "logistics",   "name_uz": "Transport va logistika", "icon": "🚛"},
    {"id": 13, "slug": "tourism",     "name_uz": "Turizm va mehmonxona",   "icon": "✈️"},
    {"id": 14, "slug": "media",       "name_uz": "Media va ko'ngilochar",  "icon": "📺"},
    {"id": 15, "slug": "marketing",   "name_uz": "Marketing va reklama",   "icon": "📣"},
    {"id": 16, "slug": "education",   "name_uz": "Ta'lim",                 "icon": "📚"},
    {"id": 17, "slug": "health",      "name_uz": "Sog'liqni saqlash",      "icon": "🏥"},
    {"id": 18, "slug": "sport",       "name_uz": "Sport va sog'lom turmush","icon": "⚽"},
    {"id": 19, "slug": "ecology",     "name_uz": "Ekologiya va atrof-muhit","icon": "🌿"},
    {"id": 20, "slug": "water",       "name_uz": "Suv ta'minoti",          "icon": "💧"},
    {"id": 21, "slug": "it",          "name_uz": "IT va dasturiy ta'minot","icon": "💻"},
    {"id": 22, "slug": "telecom",     "name_uz": "Telekommunikatsiya",     "icon": "📡"},
    {"id": 23, "slug": "ai",          "name_uz": "Sun'iy intellekt",       "icon": "🤖"},
    {"id": 24, "slug": "cybersec",    "name_uz": "Kibxavfsizlik",          "icon": "🔐"},
    {"id": 25, "slug": "gov",         "name_uz": "Davlat xizmatlari",      "icon": "🏛️"},
    {"id": 26, "slug": "legal",       "name_uz": "Huquq va yuridik xizmat","icon": "⚖️"},
    {"id": 27, "slug": "hr",          "name_uz": "HR va bandlik",          "icon": "👥"},
]

_REGIONS: list[dict] = [
    {"id": 1,  "name": "Toshkent shahri"},
    {"id": 2,  "name": "Toshkent viloyati"},
    {"id": 3,  "name": "Andijon viloyati"},
    {"id": 4,  "name": "Farg'ona viloyati"},
    {"id": 5,  "name": "Namangan viloyati"},
    {"id": 6,  "name": "Samarqand viloyati"},
    {"id": 7,  "name": "Buxoro viloyati"},
    {"id": 8,  "name": "Qashqadaryo viloyati"},
    {"id": 9,  "name": "Surxondaryo viloyati"},
    {"id": 10, "name": "Sirdaryo viloyati"},
    {"id": 11, "name": "Jizzax viloyati"},
    {"id": 12, "name": "Navoiy viloyati"},
    {"id": 13, "name": "Xorazm viloyati"},
    {"id": 14, "name": "Qoraqalpog'iston Respublikasi"},
]


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def _seed_sectors(session: Session) -> None:
    for row in _SECTORS:
        existing = session.get(Sector, row["id"])
        if not existing:
            session.add(Sector(**row))
    session.commit()


def _seed_regions(session: Session) -> None:
    for row in _REGIONS:
        existing = session.get(Region, row["id"])
        if not existing:
            session.add(Region(**row))
    session.commit()


def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    # from sqlmodel import SQLModel

    # This works because the models are already imported and registered from app.models
    # SQLModel.metadata.create_all(engine)

    _seed_sectors(session)
    _seed_regions(session)

    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
        )
        user = crud.create_user(session=session, user_create=user_in)
