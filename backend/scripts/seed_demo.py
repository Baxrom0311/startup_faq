"""
Demo ma'lumotlar seed skripti.
Ishlatish: uv run python scripts/seed_demo.py
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime, timezone, timedelta
from sqlmodel import Session, select
from app.core.db import engine
from app.models import (
    User, Problem, Project, ProjectMember, Comment, Vote,
    ProblemStatusLog, Sector, Region,
)
from app.core.security import get_password_hash
import random

DEMO_USERS = [
    {
        "full_name": "Alisher Toshmatov",
        "email": "alisher.demo@signalhub.uz",
        "telegram_id": 100000001,
        "telegram_username": "alisher_demo",
        "phone": "+998901001001",
        "language": "uz",
        "bio": "IT sohasidagi tadbirkor. Raqamli transformatsiya va startaplarga qiziqaman.",
        "is_active": True,
        "is_superuser": False,
    },
    {
        "full_name": "Nilufar Rashidova",
        "email": "nilufar.demo@signalhub.uz",
        "telegram_id": 100000002,
        "telegram_username": "nilufar_demo",
        "phone": "+998901002002",
        "language": "uz",
        "bio": "Agrotexnologiya sohasida ishlayman. Fermerlarni raqamlashtirish loyihasini boshqaraman.",
        "is_active": True,
        "is_superuser": False,
    },
    {
        "full_name": "Rustam Nazarov",
        "email": "rustam.demo@signalhub.uz",
        "telegram_id": 100000003,
        "telegram_username": "rustam_demo",
        "phone": "+998901003003",
        "language": "ru",
        "bio": "Финансовый аналитик. Работаю над улучшением финтех решений в Узбекистане.",
        "is_active": True,
        "is_superuser": False,
    },
    {
        "full_name": "Madina Yusupova",
        "email": "madina.demo@signalhub.uz",
        "telegram_id": 100000004,
        "telegram_username": "madina_demo",
        "phone": "+998901004004",
        "language": "uz",
        "bio": "Ta'lim sohasida metodist. O'qituvchilar uchun raqamli vositalar yaratishga intilaman.",
        "is_active": True,
        "is_superuser": False,
    },
    {
        "full_name": "Jasur Mirzayev",
        "email": "jasur.demo@signalhub.uz",
        "telegram_id": 100000005,
        "telegram_username": "jasur_demo",
        "phone": "+998901005005",
        "language": "en",
        "bio": "Software engineer. Passionate about solving real problems in Central Asia.",
        "is_active": True,
        "is_superuser": False,
    },
]

DEMO_PROBLEMS = [
    {
        "raw_text": "Fermerlar uchun bozorga to'g'ridan-to'g'ri kirish platformasi yo'q. Vositachilar narxni 40-60% ga oshiradi. Fermerlarga zarar, iste'molchilarga zarar.",
        "title": "Fermerlardan iste'molchilarga to'g'ridan-to'g'ri savdo yo'nalishi yo'q",
        "sector_slug": "agro",
        "region_name": "Farg'ona viloyati",
        "status": "published",
        "vote_offset": 24,
        "summary": "Vositachilarni chetlab o'tib, fermerlar va iste'molchilarni to'g'ridan-to'g'ri bog'laydigan raqamli platforma kerak.",
    },
    {
        "raw_text": "Mahalliy bizneslar uchun kreditga kirish juda qiyin. Banklar ko'p hujjat so'raydi, jarayon 2-3 oy davom etadi. Bu kichik biznesning rivojlanishiga to'sqinlik qiladi.",
        "title": "Kichik biznes uchun tezkor mikrokreditlash mexanizmi yo'q",
        "sector_slug": "finance",
        "region_name": "Toshkent shahri",
        "status": "published",
        "vote_offset": 31,
        "summary": "Raqamli scoring va tezkor tasdiqlash tizimi orqali SMB larga 24 soat ichida kredit berish.",
    },
    {
        "raw_text": "Maktablarda internet tezligi juda past, ayniqsa qishloqlarda. O'qituvchilar video darslarni yuklay olmaydi. Bolalar zamonaviy ta'limdan mahrum.",
        "title": "Qishloq maktablarida internet infratuzilmasi yetarli emas",
        "sector_slug": "education",
        "region_name": "Andijon viloyati",
        "status": "claimed",
        "vote_offset": 18,
        "summary": "Qishloq maktablarida optik tolali internet va Wi-Fi infratuzilmasini yaratish.",
    },
    {
        "raw_text": "Shifokorlar qo'lda yozadi, tibbiy tarixni topish qiyin. Kasalxonalar o'rtasida ma'lumot almashish yo'q. Bir bemorni 3 martta bir xil tekshiruvdan o'tkazishadi.",
        "title": "Yagona elektron tibbiy tarix tizimi mavjud emas",
        "sector_slug": "healthcare",
        "region_name": "Toshkent shahri",
        "status": "published",
        "vote_offset": 42,
        "summary": "Barcha kasalxonalar uchun umumiy elektron tibbiy tarix (EMR) platformasi.",
    },
    {
        "raw_text": "Yuk tashish narxi haqiqiy vaqtda ma'lum emas. Transportchilar bo'sh qaytadi, yuk egasi narx bilmaydi. Ikki tomon ham zarar ko'radi.",
        "title": "Logistika sohasida real-vaqt narx va bo'sh yuk birzhalari yo'q",
        "sector_slug": "transport",
        "region_name": "Toshkent viloyati",
        "status": "piloting",
        "vote_offset": 15,
        "summary": "Yuk transportchilari va jo'natuvchilarni bog'laydigan real-vaqt platforma.",
    },
    {
        "raw_text": "Startap asoschilari biznes ro'yxatdan o'tkazish uchun 10+ davlat idorasiga borishi kerak. Butun jarayon 3-4 hafta ketadi. Ko'p vaqt va resurs sarflanadi.",
        "title": "Startap ro'yxatdan o'tkazish jarayoni haddan tashqari murakkab",
        "sector_slug": "gov",
        "region_name": "Toshkent shahri",
        "status": "published",
        "vote_offset": 56,
        "summary": "Bir oynali raqamli davlat xizmati orqali startapni 1 kunda ro'yxatdan o'tkazish.",
    },
    {
        "raw_text": "Tekstil korxonalari energiya sarfini bilishmaydi. Eski uskunalar ko'p elektr iste'mol qiladi, lekin o'lchov qurilmalari yo'q. Energiya samaradorligini oshirish imkonsiz.",
        "title": "Tekstil fabrikalarida energiya monitoring tizimi yo'q",
        "sector_slug": "textile",
        "region_name": "Namangan viloyati",
        "status": "published",
        "vote_offset": 9,
        "summary": "IoT sensorlar va sun'iy intellekt yordamida energiya sarfini real vaqtda monitoring qilish.",
    },
    {
        "raw_text": "Oziq-ovqat sifatini nazorat qilish qo'lda amalga oshiriladi. Laboratoriya natijalari 3-5 kun kutiladi. Bu muddatda buzilgan mahsulotlar sotuvda qoladi.",
        "title": "Oziq-ovqat sifatini tezkor raqamli nazorat qilish tizimi kerak",
        "sector_slug": "food",
        "region_name": "Samarqand viloyati",
        "status": "published",
        "vote_offset": 13,
        "summary": "Portativ sensorlar va AI tahlil orqali oziq-ovqat sifatini darhol aniqlash.",
    },
    {
        "raw_text": "Yangi dasturchilar ish izlaydi, lekin reytingi va ko'nikmalarini tasdiqlash yo'li yo'q. Kompaniyalar ham mos nomzodlarni topish uchun ko'p vaqt sarflaydi.",
        "title": "IT mutaxassislar uchun ko'nikma tasdiqlash va ish topish platformasi yo'q",
        "sector_slug": "it",
        "region_name": "Toshkent shahri",
        "status": "published",
        "vote_offset": 28,
        "summary": "Portfolio, sertifikat va loyiha tajribasini tasdiqlash orqali ishga olish jarayonini tezlashtirish.",
    },
    {
        "raw_text": "Kichik savdo nuqtalari inventar boshqaruvini qo'lda qiladi. Qachon tovar tugashini bilishmaydi, buyurtmalar o'z vaqtida berilmaydi. Tovar yo'qligi tufayli daromad kamayadi.",
        "title": "Kichik do'konlar uchun aqlli inventar boshqaruv tizimi yo'q",
        "sector_slug": "trade",
        "region_name": "Buxoro viloyati",
        "status": "published",
        "vote_offset": 11,
        "summary": "Mobil ilova orqali inventarni kuzatish va avtomatik buyurtma berish tizimi.",
    },
    {
        "raw_text": "Turizm sohasidagi ko'rsatmalar faqat rus tilida. Xorijiy sayyohlar yo'l topolmaydi. Turistik joylarni topish uchun yaxlit raqamli xarita yo'q.",
        "title": "Xorijiy sayyohlar uchun ko'p tilli turistik yo'llanma yo'q",
        "sector_slug": "tourism",
        "region_name": "Samarqand viloyati",
        "status": "solved",
        "vote_offset": 19,
        "summary": "AR va GPS texnologiyalari asosida ko'p tilli interaktiv turistik yo'llanma ilovasi.",
    },
    {
        "raw_text": "Suv hisoblagichlari ko'pincha noto'g'ri ko'rsatma beradi. Hisobotlar qo'lda to'ldiriladi, xatoliklar ko'p. Suv sarfi real ma'lumotlarga asoslanmaydi.",
        "title": "Suv ta'minotida raqamli hisoblagich va monitoring tizimi yo'q",
        "sector_slug": "water",
        "region_name": "Xorazm viloyati",
        "status": "published",
        "vote_offset": 22,
        "summary": "Aqlli suv hisoblagichlari va bulutli platforma orqali suv sarfini real vaqtda nazorat qilish.",
    },
    {
        "raw_text": "Ko'chmas mulk narxlari haqiqiy ma'lumotlarga asoslanmaydi. Baholarni solishtirish qiyin, aldov holatlari ko'p. Xaridor ham, sotuvchi ham qiyinchilikda.",
        "title": "Ko'chmas mulk bozorida shaffof narx va tarix ma'lumotlari yo'q",
        "sector_slug": "construction",
        "region_name": "Toshkent shahri",
        "status": "published",
        "vote_offset": 33,
        "summary": "Barcha ko'chmas mulk bitimlarining ommaviy ma'lumotlar bazasi va narx tahlil vositasi.",
    },
    {
        "raw_text": "Ekologik ma'lumotlar tarqoq. Havo ifloslanishi, suv sifati kabi ko'rsatkichlarni bitta joyda ko'rish imkonsiz. Fuqarolar qaror qabul qila olmaydi.",
        "title": "Atrof-muhit monitoring ma'lumotlarini birlashtiradigan platforma yo'q",
        "sector_slug": "ecology",
        "region_name": "Toshkent viloyati",
        "status": "needs_review",
        "vote_offset": 7,
        "summary": "Sensor tarmoqlari va ochiq ma'lumotlardan real vaqt ekologik monitoring dashboardi.",
    },
    {
        "raw_text": "Sug'urta kompaniyalari zarar taqdirlashda juda sekin. 15-30 kun kutiladi. Avtomobil avariyasidan keyin transport harakatlanmaydi, ish to'xtaydi.",
        "title": "Sug'urta zararini tezkor raqamli taqdirlash mexanizmi yo'q",
        "sector_slug": "insurance",
        "region_name": "Toshkent shahri",
        "status": "published",
        "vote_offset": 16,
        "summary": "AI fotosuratlar tahlili va blockchain orqali 24 soat ichida sug'urta zararini tasdiqlash.",
    },
]

DEMO_PROJECTS = [
    {
        "title": "AgroConnect — Fermer-Iste'molchi Platformasi",
        "description": "Fermerlarni iste'molchilar bilan to'g'ridan-to'g'ri bog'laydigan raqamli bozor. GPS, narx tahlili va real-vaqt buyurtma tizimini o'z ichiga oladi. Farg'ona vodiysida 500+ fermer bilan pilot o'tkazilmoqda.",
        "status": "in_progress",
        "problem_title": "Fermerlardan iste'molchilarga to'g'ridan-to'g'ri savdo yo'nalishi yo'q",
    },
    {
        "title": "EduNet — Qishloq Maktablari Internet Tizimi",
        "description": "Andijon viloyatining 47 ta qishloq maktabiga optik tolali internet o'tkazish. Har bir maktabda Wi-Fi tarmog'i, o'qituvchilar uchun raqamli resurs platformasi.",
        "status": "piloting",
        "problem_title": "Qishloq maktablarida internet infratuzilmasi yetarli emas",
    },
    {
        "title": "MedHistory — Yagona Tibbiy Tarix",
        "description": "3 ta Toshkent kasalxonasini yagona EMR tizimiga birlashtirish. HL7 FHIR standartiga mos, ma'lumotlar shifrlangan, bemorlar o'z tarixini mobil ilovadan ko'radi.",
        "status": "approved",
        "problem_title": "Yagona elektron tibbiy tarix tizimi mavjud emas",
    },
    {
        "title": "FreightHub — Yuk Birzha Platformasi",
        "description": "Real-vaqt yuk birzhasi: transportchi bo'sh reys e'lon qiladi, jo'natuvchi topadi. GPS tracking, narx kalkulyatori, to'lov tizimi birlashtirilgan.",
        "status": "completed",
        "problem_title": "Logistika sohasida real-vaqt narx va bo'sh yuk birzhalari yo'q",
    },
    {
        "title": "GovStart — Tezlashtirilgan Ro'yxatga Olish",
        "description": "Startaplar uchun yagona raqamli ro'yxatga olish portali. Soliq, statistika, bank hisob ochish — barchasi 1 kunda. Toshkent innovatsiya markazi bilan hamkorlik.",
        "status": "in_progress",
        "problem_title": "Startap ro'yxatdan o'tkazish jarayoni haddan tashqari murakkab",
    },
]

DEMO_COMMENTS = [
    "Bu muammo bizning mintaqada ham juda dolzarb. Yaqinda ushbu sohada tadqiqot o'tkazdik.",
    "Ajoyib taklif! Biz ham shunga o'xshash muammo bilan duch kelamiz. Qo'llab-quvvatlash tayyormiz.",
    "Texnik yechim sifatida blockchain dan foydalanish mumkin bo'lar. Shaffoflik uchun yaxshi.",
    "Pilot loyiha uchun Farg'ona viloyatida biz bilan bog'laning. 20+ korxona qo'llab-quvvatlaydi.",
    "Bu muammoning yana bir tomoni bor: mutaxassislar etishmasligi. Buni ham hisobga olish kerak.",
    "Men bu loyihada texnik maslahatchi sifatida yordam bera olaman.",
    "Xuddi shunday muammo Qozog'istonda ham bor edi. Ular qanday hal qilishganini o'rganaylik.",
    "Bu sohada xalqaro investitsiya jalb qilish mumkin. EBRD va IFC shu kabi loyihalarga qiziqadi.",
    "Davlat-xususiy sheriklik modeli bu yerda eng mos keladi deb o'ylayman.",
    "Raqamli infratuzilma bo'lmasa, bu muammo to'liq hal bo'lmaydi. Ketma-ket approach kerak.",
]


def seed():
    with Session(engine) as session:
        # Check if already seeded
        existing = session.exec(
            select(User).where(User.telegram_id == 100000001)
        ).first()
        if existing:
            print("Demo ma'lumotlar allaqachon mavjud. O'tkazib yuborildi.")
            return

        print("Sektorlar va regionlarni yuklash...")
        sectors_map = {
            s.slug: s for s in session.exec(select(Sector)).all()
        }
        regions_map = {
            r.name: r for r in session.exec(select(Region)).all()
        }

        print("Demo foydalanuvchilar yaratish...")
        users = []
        for ud in DEMO_USERS:
            region_key = "Toshkent shahri"
            region = regions_map.get(region_key)
            u = User(
                full_name=ud["full_name"],
                email=ud["email"],
                telegram_id=ud["telegram_id"],
                telegram_username=ud["telegram_username"],
                phone=ud["phone"],
                language=ud["language"],
                bio=ud["bio"],
                is_active=ud["is_active"],
                is_superuser=ud["is_superuser"],
                region_id=region.id if region else None,
                hashed_password=get_password_hash("demo1234"),
            )
            session.add(u)
            users.append(u)
        session.flush()
        print(f"  {len(users)} foydalanuvchi yaratildi")

        print("Demo muammolar yaratish...")
        problems = []
        base_time = datetime.now(timezone.utc) - timedelta(days=60)
        for i, pd in enumerate(DEMO_PROBLEMS):
            sector = sectors_map.get(pd["sector_slug"])
            region = regions_map.get(pd["region_name"])
            owner = users[i % len(users)]
            created_at = base_time + timedelta(days=i * 3 + random.randint(0, 2), hours=random.randint(8, 20))
            p = Problem(
                raw_text=pd["raw_text"],
                title=pd["title"],
                sector_id=sector.id if sector else None,
                region_id=region.id if region else None,
                author_id=owner.id,
                status=pd["status"],
                vote_count=pd["vote_offset"],
                created_at=created_at,
                updated_at=created_at,
            )
            # Add AI summary fields if they exist
            if hasattr(p, "ai_summary"):
                p.ai_summary = pd.get("summary")
            session.add(p)
            problems.append(p)

            # status log added after flush

        session.flush()

        # Add status logs after flush (problem IDs now known)
        for p, pd in zip(problems, DEMO_PROBLEMS):
            log = ProblemStatusLog(
                problem_id=p.id,
                actor_id=p.author_id,
                from_status=None,
                to_status=pd["status"],
                created_at=p.created_at,
            )
            session.add(log)

        print(f"  {len(problems)} muammo yaratildi")

        print("Ovozlar qo'shish...")
        vote_count = 0
        for p in problems:
            num_voters = min(p.vote_count, len(users))
            for j in range(num_voters):
                voter = users[j % len(users)]
                if voter.id == p.author_id and num_voters > 1:
                    continue
                v = Vote(problem_id=p.id, user_id=voter.id)
                session.add(v)
                vote_count += 1
        print(f"  {vote_count} ovoz qo'shildi")

        print("Izohlar qo'shish...")
        comment_count = 0
        for idx, p in enumerate(problems[:10]):
            num_comments = random.randint(1, 3)
            for j in range(num_comments):
                commenter = users[(idx + j + 1) % len(users)]
                c = Comment(
                    problem_id=p.id,
                    user_id=commenter.id,
                    text=DEMO_COMMENTS[(idx + j) % len(DEMO_COMMENTS)],
                    created_at=p.created_at + timedelta(hours=random.randint(1, 48)),
                )
                session.add(c)
                comment_count += 1
        session.flush()
        print(f"  {comment_count} izoh qo'shildi")

        print("Demo loyihalar yaratish...")
        project_count = 0
        for i, projd in enumerate(DEMO_PROJECTS):
            # Find matching problem
            matching_problem = None
            for p in problems:
                if p.title and projd["problem_title"] in p.title:
                    matching_problem = p
                    break

            owner = users[i % len(users)]
            sector_id = matching_problem.sector_id if matching_problem else None
            proj_created = datetime.now(timezone.utc) - timedelta(days=30 - i * 5)

            if not matching_problem:
                print(f"  ⚠ Loyiha uchun muammo topilmadi: {projd['problem_title']}")
                continue

            proj = Project(
                title=projd["title"],
                description=projd["description"],
                status=projd["status"],
                problem_id=matching_problem.id,
                lead_id=owner.id,
                sector_id=sector_id,
                created_at=proj_created,
                updated_at=proj_created,
            )
            session.add(proj)
            session.flush()

            # Add project member (lead)
            member = ProjectMember(project_id=proj.id, user_id=owner.id, role="lead")
            session.add(member)

            # Add 1-2 more members
            for k in range(1, min(3, len(users))):
                extra_user = users[(i + k) % len(users)]
                if extra_user.id != owner.id:
                    m = ProjectMember(project_id=proj.id, user_id=extra_user.id, role="member")
                    session.add(m)

            project_count += 1

        session.commit()
        print(f"  {project_count} loyiha yaratildi")
        print()
        print("✓ Demo ma'lumotlar muvaffaqiyatli yuklandi!")
        print()
        print("Demo akkauntlar:")
        for ud in DEMO_USERS:
            print(f"  @{ud['telegram_username']} — {ud['full_name']} ({ud['language']})")


if __name__ == "__main__":
    seed()
