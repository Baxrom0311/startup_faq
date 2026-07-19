"""
DeepSeek AI yordamida real signallar generatsiya qilish va bazaga qo'shish.
Ishlatish: uv run python scripts/seed_ai_signals.py
"""

import sys
import os
import json
import time
import random

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import httpx
from sqlmodel import Session, select
from app.core.db import engine
from app.models import (
    User, Problem, Project, ProjectMember, Comment,
    Vote, ProblemStatusLog, Sector, Region,
)

DEEPSEEK_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"

# ──────────────────────────────────────────────
# Sektor guruhlari (bir so'rovda 4-5 sektor)
# ──────────────────────────────────────────────
SECTOR_GROUPS = [
    ["agro", "food", "water"],
    ["textile", "construction", "manufacturing"],
    ["mining", "energy", "ecology"],
    ["finance", "insurance", "trade"],
    ["transport", "tourism", "media"],
    ["marketing", "education", "healthcare"],
    ["sport", "it", "telecom"],
    ["ai_tech", "cybersecurity", "gov"],
    ["law", "hr"],
]

STATUS_WEIGHTS = [
    ("published", 0.55),
    ("claimed",   0.18),
    ("piloting",  0.12),
    ("solved",    0.10),
    ("needs_review", 0.05),
]

REGIONS_DIST = [
    "Toshkent shahri", "Toshkent shahri", "Toshkent shahri",
    "Farg'ona viloyati", "Farg'ona viloyati",
    "Andijon viloyati", "Namangan viloyati",
    "Samarqand viloyati", "Samarqand viloyati",
    "Buxoro viloyati", "Qashqadaryo viloyati",
    "Surxondaryo viloyati", "Sirdaryo viloyati",
    "Jizzax viloyati", "Navoiy viloyati",
    "Xorazm viloyati", "Qoraqalpog'iston Respublikasi",
    "Toshkent viloyati",
]

DEMO_COMMENTS_POOL = [
    "Bu muammo bizning mintaqada ham juda og'riqli. Yaqinda shu haqida konferensiyada gapirishdi.",
    "Men ushbu sohadagi mutaxassislardan biriman. Bu muammo bir necha yildan beri hal qilinmayapti.",
    "Biz o'zimiz ham shu muammoga duch kelamiz. Agar yechim topsak, hamkorlik qilishga tayyormiz.",
    "Bu kabi muammolarni hal qilish uchun davlat-xususiy sheriklik modeli eng yaxshi yondashuv.",
    "Texnik yechim sifatida blockchain yoki AI dan foydalanish samarali bo'lishi mumkin.",
    "Xalqaro tajribani o'rganib, moslashtirib tatbiq etish kerak. Janubiy Koreya bu sorada yaxshi natijalarga erishgan.",
    "Bu muammoning yana bir tomoni — malakali kadrlar yetishmasligi. Buni ham e'tiborga olish kerak.",
    "EBRD va IFC bu kabi loyihalarga moliyaviy ko'mak beradi. Grant topshirish kerak.",
    "Pilot loyiha uchun bizning tashkilot ishtirok etishga tayyor. Bog'laning!",
    "Raqamli transformatsiya bu muammoni 70-80% ga kamaytirishi mumkin, lekin infratuzilma kerak.",
    "O'zbekistonda bu sohadagi qonunchilik hali ham mukammal emas. Avval regulyatorlar bilan ishlash kerak.",
    "Bu muammo yechilsa, yiliga millionlab so'mlik iqtisodiy samara beradi.",
    "Men startup asoschisiman, bizning mahsulot bu muammoni hal qilishga yo'naltirilgan.",
    "Ushbu muammoni ko'targaningiz uchun rahmat. Ko'plar duch keladi, lekin hech kim gapirmaydi.",
    "Shu muammo bilan bog'liq tadqiqot olib boryapmiz. Natijalarni ulashishga tayyormiz.",
    "Amaliy yechim: birinchi bosqichda MVP yaratib, 3-4 tashkilot bilan sinab ko'rish.",
    "Bu sohadagi raqamli echimlar Hindistonda juda yaxshi ishlaydi. Ularning tajribasini o'rganaylik.",
    "Muammoni hal qilish uchun eng avvalo ma'lumotlar bazasini yaratish kerak.",
    "Biz ham shu sohadamiz va ushbu muammoni yaxshi tushunamiz. Hamkorlik taklif qilamiz.",
    "Ushbu muammo biznes muhitiga katta to'siq bo'lyapti. Tezroq yechim topish zarur.",
]


def weighted_status() -> str:
    r = random.random()
    total = 0.0
    for status, w in STATUS_WEIGHTS:
        total += w
        if r <= total:
            return status
    return "published"


def call_deepseek(prompt: str, retries: int = 3) -> str:
    for attempt in range(retries):
        try:
            resp = httpx.post(
                DEEPSEEK_URL,
                headers={
                    "Authorization": f"Bearer {DEEPSEEK_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 3000,
                    "temperature": 0.85,
                    "response_format": {"type": "json_object"},
                },
                timeout=60,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return content
        except Exception as e:
            print(f"  ⚠ DeepSeek xato ({attempt+1}/{retries}): {e}")
            if attempt < retries - 1:
                time.sleep(3)
    return "{}"


def generate_signals_for_sectors(
    sector_slugs: list[str],
    sectors_map: dict,
    regions: list,
) -> list[dict]:
    sector_info = []
    for slug in sector_slugs:
        s = sectors_map.get(slug)
        if s:
            sector_info.append(f"- slug: {slug}, nom: {s.name_uz} {s.icon or ''}")

    if not sector_info:
        return []

    region_examples = ", ".join(random.sample(REGIONS_DIST, min(5, len(REGIONS_DIST))))

    prompt = f"""Siz O'zbekistondagi "SignalHub" platformasi uchun real biznes muammolarini generatsiya qilasiz.
Bu platforma O'zbekistondagi tadbirkorlar, tashkilotlar va aholining real muammolarini to'playdi va startaplarga yo'naltiradi.

Quyidagi sektorlar uchun har biridan 3 ta real muammo (signal) yozing:
{chr(10).join(sector_info)}

Har bir muammo HAQIQIY bo'lishi kerak — O'zbekiston sharoitiga mos, aniq raqamlar va faktlar bilan.
Muammolar O'zbek tilida, oddiy tadbirkor yoki mutaxassis ovozida yozilsin.
Har bir muammo qisqa sarlavha (80 belgi gacha) va batafsil tavsif (3-5 gap, aniq muammo ko'rsatilsin) bo'lsin.

Hududlar misoli: {region_examples}

JSON formatida qaytaring:
{{
  "signals": [
    {{
      "title": "Muammo sarlavhasi (O'zbekcha, 80 belgi gacha)",
      "raw_text": "Muammoning batafsil tavsifi (O'zbekcha, 3-5 gap, aniq raqamlar va holatlar bilan)",
      "sector_slug": "sektor_slug",
      "region": "viloyat yoki shahar nomi (yuqoridagi ro'yxatdan)",
      "vote_count": <5 dan 90 gacha son>,
      "status": "published" | "claimed" | "piloting" | "solved"
    }}
  ]
}}

Eslatma:
- "published" — ko'p ishlating (55%)
- "claimed" — 18%
- "piloting" — 12%
- "solved" — 10%
- Muammolar TURLI hududlarga taqsimlangan bo'lsin
- Har bir muammo noyob va real bo'lsin
- Texnik jargonn kamroq, oddiy til ko'proq
"""

    raw = call_deepseek(prompt)
    try:
        data = json.loads(raw)
        return data.get("signals", [])
    except json.JSONDecodeError as e:
        print(f"  ⚠ JSON parse xato: {e}")
        print(f"  Raw: {raw[:200]}")
        return []


def generate_projects_for_problems(
    problems: list,
    sectors_map: dict,
) -> list[dict]:
    """Top muammolar uchun loyihalar generatsiya qilish."""
    top = sorted(problems, key=lambda p: p.vote_count, reverse=True)[:8]
    if not top:
        return []

    problems_info = []
    for p in top:
        s = sectors_map.get(getattr(p, "_slug", ""), "")
        problems_info.append(f'- ID:{p.id} | "{p.title}" | sektor: {s}')

    prompt = f"""Quyidagi muammolar uchun real startap/loyiha takliflari yozing.
Har bir muammo uchun 1 ta loyiha tavsifi yozing (hammasi emas — faqat eng qiziqarlilariga):

{chr(10).join(problems_info[:5])}

JSON formatida:
{{
  "projects": [
    {{
      "problem_index": <0 dan {min(len(top)-1, 4)} gacha>,
      "title": "Loyiha nomi (O'zbekcha, qisqa)",
      "description": "Loyiha tavsifi (3-4 gap, nima qiladi, qanday ishlaydi, maqsad)",
      "status": "proposed" | "approved" | "in_progress" | "piloting" | "completed"
    }}
  ]
}}
"""
    raw = call_deepseek(prompt)
    try:
        data = json.loads(raw)
        projects = data.get("projects", [])
        # Link back to actual problem objects
        result = []
        for proj in projects:
            idx = proj.get("problem_index", 0)
            if 0 <= idx < len(top):
                proj["_problem"] = top[idx]
                result.append(proj)
        return result
    except json.JSONDecodeError:
        return []


def seed():
    print("=" * 60)
    print("SignalHub — AI Demo Ma'lumotlar Generatori (DeepSeek)")
    print("=" * 60)

    with Session(engine) as session:
        # ── Sektorlar va Hududlarni yuklash ──
        sectors_map = {s.slug: s for s in session.exec(select(Sector)).all()}
        regions_map = {r.name: r for r in session.exec(select(Region)).all()}
        regions_list = list(regions_map.values())

        print(f"Sektorlar: {len(sectors_map)} | Hududlar: {len(regions_map)}")

        # ── Demo foydalanuvchilar (mavjud bo'lmasa yaratish) ──
        demo_tg_ids = [100000001, 100000002, 100000003, 100000004, 100000005]
        users = []
        for tg_id in demo_tg_ids:
            u = session.exec(select(User).where(User.telegram_id == tg_id)).first()
            if u:
                users.append(u)

        if not users:
            print("⚠ Demo foydalanuvchilar topilmadi. Avval seed_demo.py ni ishlatib foydalanuvchilarni yarating.")
            print("  Superuser ni qo'llamoqda...")
            su = session.exec(select(User).where(User.is_superuser == True)).first()
            if su:
                users = [su]
            else:
                print("❌ Hech qanday foydalanuvchi topilmadi!")
                return

        print(f"Foydalanuvchilar: {len(users)} ta")

        # ── Oldingi demo muammolarni tozalash (loyihalar bilan birga) ──
        old_count = 0
        for u in users:
            old_problems = session.exec(
                select(Problem).where(Problem.author_id == u.id)
            ).all()
            for p in old_problems:
                projs = session.exec(
                    select(Project).where(Project.problem_id == p.id)
                ).all()
                for proj in projs:
                    members = session.exec(
                        select(ProjectMember).where(ProjectMember.project_id == proj.id)
                    ).all()
                    for m in members:
                        session.delete(m)
                    session.delete(proj)
                session.delete(p)
                old_count += 1
        if old_count:
            session.flush()
            print(f"  {old_count} ta eski demo muammo o'chirildi")

        # ── AI bilan signallar generatsiya qilish ──
        all_signals_data = []
        total_groups = len(SECTOR_GROUPS)

        for i, group in enumerate(SECTOR_GROUPS, 1):
            print(f"\n[{i}/{total_groups}] Sektorlar: {', '.join(group)}")
            signals = generate_signals_for_sectors(group, sectors_map, regions_list)
            if signals:
                all_signals_data.extend(signals)
                print(f"  ✓ {len(signals)} ta signal generatsiya qilindi")
            else:
                print(f"  ✗ Bu guruhdan signal olinmadi")
            # Rate limit uchun kichik pauza
            if i < total_groups:
                time.sleep(1.2)

        print(f"\nJami generatsiya qilingan: {len(all_signals_data)} ta signal")

        # ── Signallarni bazaga qo'shish ──
        print("\nSignallarni bazaga qo'shish...")
        problems_saved = []
        problem_sector_cache = {}  # problem_id -> sector_slug

        from datetime import datetime, timezone, timedelta
        base_time = datetime.now(timezone.utc) - timedelta(days=90)

        for idx, sig in enumerate(all_signals_data):
            sector_slug = sig.get("sector_slug", "").strip()
            sector = sectors_map.get(sector_slug)

            region_name = sig.get("region", "").strip()
            region = regions_map.get(region_name)
            if not region:
                region = random.choice(regions_list)

            author = users[idx % len(users)]
            status = sig.get("status", "published")
            if status not in ("published", "claimed", "piloting", "solved", "needs_review"):
                status = "published"

            vote_count = int(sig.get("vote_count", random.randint(5, 40)))
            vote_count = max(1, min(vote_count, 99))

            days_offset = random.randint(0, 85)
            hours_offset = random.randint(7, 22)
            created_at = base_time + timedelta(days=days_offset, hours=hours_offset)

            title = str(sig.get("title", ""))[:120].strip()
            raw_text = str(sig.get("raw_text", "")).strip()

            if not title or not raw_text:
                continue

            p = Problem(
                raw_text=raw_text,
                title=title,
                sector_id=sector.id if sector else None,
                region_id=region.id,
                author_id=author.id,
                status=status,
                vote_count=vote_count,
                created_at=created_at,
                updated_at=created_at,
            )
            session.add(p)
            problems_saved.append(p)

        session.flush()
        print(f"  ✓ {len(problems_saved)} ta signal bazaga qo'shildi")

        # ── Status log ──
        for p in problems_saved:
            log = ProblemStatusLog(
                problem_id=p.id,
                actor_id=p.author_id,
                from_status=None,
                to_status=p.status,
                created_at=p.created_at,
            )
            session.add(log)

        # ── Ovozlar qo'shish ──
        print("Ovozlar qo'shish...")
        vote_total = 0
        added_votes: set[tuple] = set()
        for p in problems_saved:
            target = p.vote_count
            voters = [u for u in users if u.id != p.author_id]
            random.shuffle(voters)
            for voter in voters[:min(target, len(voters))]:
                key = (str(p.id), str(voter.id))
                if key not in added_votes:
                    v = Vote(problem_id=p.id, user_id=voter.id)
                    session.add(v)
                    added_votes.add(key)
                    vote_total += 1
        print(f"  ✓ {vote_total} ta ovoz qo'shildi")

        # ── Izohlar ──
        print("Izohlar qo'shish...")
        comment_total = 0
        # Top 20 most voted get 2-4 comments
        top_problems = sorted(problems_saved, key=lambda x: x.vote_count, reverse=True)[:25]
        for idx, p in enumerate(top_problems):
            n = random.randint(2, 4)
            for j in range(n):
                commenter = users[(idx + j + 1) % len(users)]
                c = Comment(
                    problem_id=p.id,
                    user_id=commenter.id,
                    text=DEMO_COMMENTS_POOL[(idx * 3 + j) % len(DEMO_COMMENTS_POOL)],
                    created_at=p.created_at + timedelta(hours=random.randint(2, 72)),
                )
                session.add(c)
                comment_total += 1
        print(f"  ✓ {comment_total} ta izoh qo'shildi")

        # ── Loyihalar uchun AI generatsiya ──
        print("\nLoyihalar generatsiya qilinmoqda (AI)...")
        sector_by_id = {s.id: s.slug for s in sectors_map.values()}
        # Build a wrapper list with slug info
        problems_with_slug = []
        for p in problems_saved:
            p._slug = sector_by_id.get(p.sector_id, "") if p.sector_id else ""
            problems_with_slug.append(p)

        project_data_list = generate_projects_for_problems(problems_with_slug, sectors_map)
        project_total = 0

        for pdata in project_data_list:
            prob = pdata.get("_problem")
            if not prob:
                continue
            lead = users[project_total % len(users)]
            status = pdata.get("status", "proposed")
            if status not in ("proposed", "approved", "in_progress", "piloting", "completed"):
                status = "proposed"

            proj = Project(
                title=str(pdata.get("title", ""))[:255].strip(),
                pitch=str(pdata.get("description", "")).strip() or None,
                status=status,
                problem_id=prob.id,
                lead_id=lead.id,
                created_at=prob.created_at + timedelta(days=random.randint(3, 14)),
                updated_at=prob.created_at + timedelta(days=random.randint(3, 14)),
            )
            session.add(proj)
            session.flush()

            # Members
            member = ProjectMember(project_id=proj.id, user_id=lead.id, role="lead")
            session.add(member)
            for k in range(1, random.randint(2, 3)):
                extra = users[(project_total + k) % len(users)]
                if extra.id != lead.id:
                    m = ProjectMember(project_id=proj.id, user_id=extra.id, role="member")
                    session.add(m)

            project_total += 1

        print(f"  ✓ {project_total} ta loyiha bazaga qo'shildi")

        session.commit()

        print("\n" + "=" * 60)
        print("✅ MUVAFFAQIYATLI YAKUNLANDI!")
        print("=" * 60)
        print(f"  Signallar:  {len(problems_saved)}")
        print(f"  Ovozlar:    {vote_total}")
        print(f"  Izohlar:    {comment_total}")
        print(f"  Loyihalar:  {project_total}")
        print(f"  Sektor qamrovi: {len(set(p.sector_id for p in problems_saved if p.sector_id))}/{len(sectors_map)}")
        print()
        print("http://localhost:5173 da ko'rish mumkin")


if __name__ == "__main__":
    seed()
