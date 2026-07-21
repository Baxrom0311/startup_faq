from sqlmodel import Session, create_engine, select

from app import crud
from app.core.config import settings
from app.models import Region, Sector, User, UserCreate

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))

# Seeded once on first startup; safe to re-run (id-based upsert)
_SECTORS: list[dict] = [
    {"id": 1,  "slug": "agro",        "name_uz": "Agro-texnologiya",        "name_ru": "Агротехнологии",             "name_en": "Agrotech",               "icon": "🌾"},
    {"id": 2,  "slug": "food",        "name_uz": "Oziq-ovqat sanoati",      "name_ru": "Пищевая промышленность",     "name_en": "Food Industry",          "icon": "🍎"},
    {"id": 3,  "slug": "textile",     "name_uz": "Tekstil va kiyim",        "name_ru": "Текстиль и одежда",          "name_en": "Textile & Apparel",      "icon": "🧵"},
    {"id": 4,  "slug": "construction","name_uz": "Qurilish va ko'chmas mulk","name_ru": "Строительство и недвижимость","name_en": "Construction & Real Estate","icon": "🏗️"},
    {"id": 5,  "slug": "industry",    "name_uz": "Ishlab chiqarish",        "name_ru": "Производство",               "name_en": "Manufacturing",          "icon": "🏭"},
    {"id": 6,  "slug": "mining",      "name_uz": "Tog'-kon sanoati",        "name_ru": "Горнодобывающая промышленность","name_en": "Mining",              "icon": "⛏️"},
    {"id": 7,  "slug": "pharma",      "name_uz": "Kimyo va farmatsevtika",  "name_ru": "Химия и фармацевтика",       "name_en": "Pharma & Chemicals",     "icon": "💊"},
    {"id": 8,  "slug": "energy",      "name_uz": "Energetika",              "name_ru": "Энергетика",                 "name_en": "Energy",                 "icon": "⚡"},
    {"id": 9,  "slug": "finance",     "name_uz": "Moliya va bank",          "name_ru": "Финансы и банки",            "name_en": "Finance & Banking",      "icon": "🏦"},
    {"id": 10, "slug": "insurance",   "name_uz": "Sug'urta",                "name_ru": "Страхование",                "name_en": "Insurance",              "icon": "🛡️"},
    {"id": 11, "slug": "trade",       "name_uz": "Savdo va e-commerce",     "name_ru": "Торговля и e-commerce",      "name_en": "Trade & E-commerce",     "icon": "🛒"},
    {"id": 12, "slug": "logistics",   "name_uz": "Transport va logistika",  "name_ru": "Транспорт и логистика",      "name_en": "Transport & Logistics",  "icon": "🚛"},
    {"id": 13, "slug": "tourism",     "name_uz": "Turizm va mehmonxona",    "name_ru": "Туризм и гостиничный бизнес","name_en": "Tourism & Hospitality",  "icon": "✈️"},
    {"id": 14, "slug": "media",       "name_uz": "Media va ko'ngilochar",   "name_ru": "Медиа и развлечения",        "name_en": "Media & Entertainment",  "icon": "📺"},
    {"id": 15, "slug": "marketing",   "name_uz": "Marketing va reklama",    "name_ru": "Маркетинг и реклама",        "name_en": "Marketing & Advertising","icon": "📣"},
    {"id": 16, "slug": "education",   "name_uz": "Ta'lim",                  "name_ru": "Образование",                "name_en": "Education",              "icon": "📚"},
    {"id": 17, "slug": "health",      "name_uz": "Sog'liqni saqlash",       "name_ru": "Здравоохранение",            "name_en": "Healthcare",             "icon": "🏥"},
    {"id": 18, "slug": "sport",       "name_uz": "Sport va sog'lom turmush","name_ru": "Спорт и здоровый образ жизни","name_en": "Sports & Wellness",    "icon": "⚽"},
    {"id": 19, "slug": "ecology",     "name_uz": "Ekologiya va atrof-muhit","name_ru": "Экология и окружающая среда","name_en": "Ecology & Environment",  "icon": "🌿"},
    {"id": 20, "slug": "water",       "name_uz": "Suv ta'minoti",           "name_ru": "Водоснабжение",              "name_en": "Water Supply",           "icon": "💧"},
    {"id": 21, "slug": "it",          "name_uz": "IT va dasturiy ta'minot", "name_ru": "ИТ и программное обеспечение","name_en": "IT & Software",         "icon": "💻"},
    {"id": 22, "slug": "telecom",     "name_uz": "Telekommunikatsiya",      "name_ru": "Телекоммуникации",           "name_en": "Telecom",                "icon": "📡"},
    {"id": 23, "slug": "ai",          "name_uz": "Sun'iy intellekt",        "name_ru": "Искусственный интеллект",    "name_en": "Artificial Intelligence","icon": "🤖"},
    {"id": 24, "slug": "cybersec",    "name_uz": "Kibxavfsizlik",           "name_ru": "Кибербезопасность",          "name_en": "Cybersecurity",          "icon": "🔐"},
    {"id": 25, "slug": "gov",         "name_uz": "Davlat xizmatlari",       "name_ru": "Государственные услуги",     "name_en": "Government Services",    "icon": "🏛️"},
    {"id": 26, "slug": "legal",       "name_uz": "Huquq va yuridik xizmat", "name_ru": "Право и юридические услуги","name_en": "Legal Services",         "icon": "⚖️"},
    {"id": 27, "slug": "hr",          "name_uz": "HR va bandlik",           "name_ru": "HR и занятость",             "name_en": "HR & Employment",        "icon": "👥"},
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
        if existing:
            for key, val in row.items():
                setattr(existing, key, val)
            session.add(existing)
        else:
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
