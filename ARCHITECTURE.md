# PLATFORMA — Template-Asosli To'liq Texnik Arxitektura v2

> **Ishchi nom:** Platforma  
> **Versiya:** 2.0  
> **Sana:** 2026-07-13  
> **Model:** Bepul va ochiq platforma; monetizatsiya keyingi bosqichlarda  
> **Asos:** `fastapi/full-stack-fastapi-template` ustiga quriladigan API-first modular monolith  
> **Muallif:** Bahrom

---

## 0. Qisqa Xulosa

Platforma — real muammo egalari o'z muammolarini joylaydigan, startaperlar esa shu muammolar ustida real foydalanuvchilar bilan birga yechim quradigan ekotizim.

Mahsulot tashqi tomondan Reddit/Fiderga o'xshaydi:

- muammolar lentasi;
- ovoz berish;
- izohlar;
- sektorlar;
- statuslar;
- muhokama.

Lekin asosiy farq: Platforma forum emas. Platformaning mahsuloti — **yechilgan muammo**.

Shuning uchun north star metrika:

```text
submitted problem -> validated problem -> claimed project -> pilot -> solved
```

Asosiy texnik qarorlar:

- Mikroservis emas, **modulli monolit**.
- Barcha mijozlar bitta **REST API** ishlatadi.
- Boshlang'ich kod bazasi sifatida `fastapi/full-stack-fastapi-template`.
- Auth SMS orqali emas, **Telegram bot + contact verification** orqali.
- AI Analyzer HTTP request ichida emas, Redis/arq worker ichida.
- Dastlab bepul va ochiq model. Payment faqat kelajak bo'limida.

---

## 1. Mahsulot G'oyasi

### 1.1. Muammo

Ko'p startaplar real bozor ehtiyoji yo'qligi sababli yopiladi. Muammo shundaki, startaper ko'pincha:

- real foydalanuvchi bilan gaplashmaydi;
- og'riqli muammoni emas, o'ziga qiziq g'oyani quradi;
- pilot qiladigan odamni topolmaydi;
- bir xil muammo nechta odamda borligini bilmaydi.

Platforma shu riskni kamaytiradi: startaper allaqachon odamlar aytgan, ovoz bergan va AI tomonidan strukturalangan muammolardan boshlaydi.

### 1.2. Kimlar Uchun

| Rol | Tavsif | Asosiy harakatlar |
|---|---|---|
| `problem_owner` | Dehqon, o'qituvchi, shifokor, tadbirkor yoki boshqa muammo egasi | Muammo yuborish, ovoz berish, pilotda qatnashish, review berish |
| `startuper` | Yechim quruvchi shaxs yoki jamoa | Muammo qidirish, claim qilish, loyiha yuritish |
| `expert` | Soha eksperti yoki mentor | Izoh berish, loyiha yo'naltirish, ekspertiza qilish |
| `org` | IT Park, universitet, donor, tashkilot | Analytics ko'rish, hackathon uchun muammo tanlash |
| `moderator` | Kontent nazorati | Review queue, approve/reject, duplicate tekshirish |
| `admin` | Tizim boshqaruvi | Hamma narsa |

Bitta user bir nechta rolga ega bo'lishi mumkin.

---

## 2. Product Prinsiplar

### 2.1. Redditga O'xshashlik Foydali

Reddit/Fiderdan olinadigan yaxshi mexanikalar:

- oddiy post/feed UX;
- ovoz orqali jamoaviy validatsiya;
- izohlar orqali muhokama;
- statuslar orqali muammo holatini ko'rsatish;
- sektor/kategoriya bo'yicha ajratish.

### 2.2. Redditdan Farq

Reddit engagement uchun optimallashtirilgan. Platforma esa solved outcome uchun optimallashtiriladi.

Shuning uchun quyidagilar product darajasida majburiy:

- Har muammo lifecyclega ega bo'ladi.
- Muammo faqat muhokamada qolib ketmaydi.
- Startaper claim qilgandan keyin progress ko'rsatishi kerak.
- 21 kun update bo'lmasa loyiha avtomatik abandoned bo'ladi.
- Muammo egasi pilot/review bosqichida qatnashadi.
- Analytics engagement emas, solved conversionni o'lchaydi.

### 2.3. North Star

```text
solved problems per month
```

Yordamchi metrikalar:

- `submitted_problems`
- `published_problems`
- `duplicate_cluster_size`
- `problem_votes`
- `claims_created`
- `approved_projects`
- `active_pilots`
- `solved_projects`
- `problem_to_project_conversion`
- `project_to_solved_conversion`

---

## 3. Texnik Strategiya

### 3.1. Nima Uchun Template

Noldan yozish o'rniga `fastapi/full-stack-fastapi-template` ishlatiladi, chunki u quyidagilarni tayyor beradi:

- FastAPI backend;
- PostgreSQL;
- SQLModel/SQLAlchemy asosidagi model qatlami;
- Alembic migration;
- React + TypeScript + Vite frontend;
- Tailwind/shadcn uslubidagi UI bazasi;
- JWT auth skeleti;
- Docker Compose;
- Traefik reverse proxy;
- GitHub Actions CI;
- test skeleti;
- auto-generated frontend API client.

Bu roadmapdagi 1-bosqichni tezlashtiradi. Lekin template product emas, faqat poydevor. Demo `items` moduli Platformadagi `problems` moduliga aylantiriladi.

### 3.2. Muhim Template Moslashtirishlar

| Template qismi | Platformadagi holat |
|---|---|
| Email/password auth | Telegram-auth bilan almashtiriladi |
| `items` demo CRUD | `problems` moduliga aylantiriladi |
| Basic users | Roles, Telegram ID, phone, reputation qo'shiladi |
| Traefik | Qoldiriladi; Caddy shart emas |
| SQLModel | Qoldiriladi; kerak joyda SQLAlchemy expression ishlatiladi |
| Docker Compose | Redis, MinIO, worker, bot qo'shiladi |
| Frontend client | OpenAPI orqali saqlanadi |

### 3.3. Arxitektura Printsiplari

1. **API-first** — web, mobile, Telegram bot bitta REST API ishlatadi.
2. **Modular monolith** — bitta FastAPI app, ichida qat'iy modullar.
3. **Async jobs** — AI, media processing, notification request ichida bajarilmaydi.
4. **Provider abstraction** — auth, LLM, STT, storage, payment interfeys ortida.
5. **Offline tolerant mobile** — Android draft/outbox pattern bilan ishlaydi.
6. **No premature microservices** — servisga ajratish faqat real yuk bo'lsa.

---

## 4. Yuqori Darajali Arxitektura

```text
┌────────────────┐   ┌──────────────────┐   ┌─────────────────┐
│ Web React/Vite │   │ Flutter Android  │   │ Telegram Bot    │
│ SPA            │   │ offline outbox   │   │ aiogram 3       │
└───────┬────────┘   └────────┬─────────┘   └────────┬────────┘
        │ HTTPS/JSON           │ HTTPS/JSON           │ HTTPS/JSON
        └──────────────┬───────┴──────────────────────┘
                       ▼
              ┌────────────────┐
              │ Traefik Proxy  │
              │ TLS, routing   │
              └───────┬────────┘
                      ▼
        ┌────────────────────────────────────┐
        │ FastAPI /api/v1                    │
        │ auth users problems votes comments │
        │ projects matching notifications    │
        │ ai analytics admin media           │
        └─────────┬────────────────┬─────────┘
                  │ SQL            │ enqueue
                  ▼                ▼
        ┌────────────────┐   ┌───────────────────────┐
        │ PostgreSQL 16  │   │ Worker arq             │
        │ pgvector       │   │ STT -> LLM -> embed    │
        ├────────────────┤   │ dedup -> scoring       │
        │ Redis 7        │◄──┤ notifications, cron    │
        ├────────────────┤   └──────────┬────────────┘
        │ MinIO S3       │              ▼
        └────────────────┘       LLM API / Ollama
                                  faster-whisper
```

---

## 5. Monorepo Tuzilishi

Template o'rnatilgandan keyingi maqsadli tuzilma:

```text
platforma/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   └── routes/
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   ├── errors.py
│   │   │   └── events.py
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── problems/
│   │   │   ├── votes/
│   │   │   ├── comments/
│   │   │   ├── media/
│   │   │   ├── projects/
│   │   │   ├── matching/
│   │   │   ├── notifications/
│   │   │   ├── ai/
│   │   │   ├── analytics/
│   │   │   └── admin/
│   │   ├── worker/
│   │   │   ├── main.py
│   │   │   ├── tasks/
│   │   │   └── providers/
│   │   ├── models.py
│   │   └── tests/
│   ├── alembic/
│   └── pyproject.toml
├── frontend/
│   └── src/
├── mobile/
│   └── lib/
├── bot/
│   ├── app/
│   └── pyproject.toml
├── infra/
│   ├── docker-compose.override.yml
│   └── monitoring/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   └── API.md
└── docker-compose.yml
```

Template ichidagi mavjud `frontend`, `backend`, `docker-compose.yml` saqlanadi. `mobile`, `bot`, `infra`, `docs` qo'shiladi.

---

## 6. Backend Qatlamlari

Har modul ichida bir xil pattern:

```text
router.py      HTTP layer: request/response, status code, dependency
schemas.py     Pydantic/SQLModel input-output schemas
models.py      DB models yoki modulga tegishli model export
service.py     business logic, transaction, event, permission
repository.py  DB query only
exceptions.py  module-specific errors
```

Qatlam yo'nalishi:

```text
router -> service -> repository -> database
```

Qoidalar:

- Routerda business logic bo'lmaydi.
- Repository boshqa modul serviceini chaqirmaydi.
- Boshqa modulning DB jadvaliga to'g'ridan-to'g'ri query yozilmaydi.
- Modullararo aloqa service orqali yoki event orqali.
- Status transitionlar bitta joyda tekshiriladi.

---

## 7. Auth: Telegram Contact Verification

### 7.1. Nega SMS Emas

Telegram-auth tanlanadi, chunki:

- SMS xarajati yo'q;
- O'zbekistonda Telegram penetration yuqori;
- user botga ulanadi, keyin notification kanali tayyor bo'ladi;
- OTP yetkazish operatorga bog'liq emas;
- SMS fallback keyin provider sifatida qo'shilishi mumkin.

### 7.2. Login/Register Flow

```text
User          Web/App           Backend API            Telegram Bot
 │              │                    │                      │
 │ phone        │                    │                      │
 ├─────────────►│ POST /auth/telegram/start                 │
 │              ├───────────────────►│                      │
 │              │                    │ auth_session create  │
 │              │                    │ token, TTL 5 min     │
 │              │◄───────────────────┤                      │
 │              │ deep_link, sid     │                      │
 │ click link   │                    │                      │
 ├──────────────┼────────────────────┼─────────────────────►│
 │              │                    │ /start <token>       │
 │              │                    │◄─────────────────────┤
 │              │                    │ validate token       │
 │              │                    ├─────────────────────►│
 │              │                    │ request_contact btn  │
 │ share phone  │                    │                      │
 ├──────────────┼────────────────────┼─────────────────────►│
 │              │                    │ contact payload      │
 │              │                    │◄─────────────────────┤
 │              │                    │ checks pass          │
 │              │ polling status     │                      │
 │              ├───────────────────►│                      │
 │              │◄───────────────────┤ access + refresh     │
 │ logged in    │                    │                      │
```

### 7.3. Majburiy Tekshiruvlar

1. `contact.user_id == message.from_user.id`.
2. Token mavjud va muddati o'tmagan.
3. Token bir martalik.
4. Telefon E.164 formatga normalizatsiya qilinadi.
5. `phone_entered` bor bo'lsa, Telegram contact phone bilan solishtiriladi.
6. IP va phone bo'yicha rate limit.
7. Telegram webhook `secret_token` tekshiriladi.

### 7.4. Auth Session Statuslari

```text
pending
used_start
verified
expired
phone_mismatch
cancelled
```

### 7.5. Token Strategiyasi

- Access token: 15 daqiqa.
- Refresh token: 60 kun.
- Refresh token DB whitelistda saqlanadi.
- Har refreshda token rotation.
- Reuse detection bo'lsa token family revoke qilinadi.
- Web refresh tokenni `httpOnly Secure` cookie'da saqlaydi.
- Mobile secure storage ishlatadi.

### 7.6. Provider Interface

```python
class AuthProvider(Protocol):
    async def start(self, phone: str | None) -> AuthStartResult: ...
    async def check(self, session_id: str) -> AuthStatus: ...
```

Providerlar:

- `TelegramAuthProvider` — asosiy.
- `SmsOtpProvider` — kelajak fallback, hozir o'chiq.

---

## 8. Database Model

### 8.1. Core Tables

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE NOT NULL,
    telegram_id BIGINT UNIQUE,
    telegram_username TEXT,
    full_name TEXT NOT NULL,
    roles TEXT[] NOT NULL DEFAULT '{problem_owner}',
    region_id INT REFERENCES regions(id),
    bio TEXT,
    reputation INT NOT NULL DEFAULT 0,
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    tg_linked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auth_sessions (
    token TEXT PRIMARY KEY,
    phone_entered TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    telegram_id BIGINT,
    user_id UUID REFERENCES users(id),
    client TEXT,
    ip INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE refresh_tokens (
    jti UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    family UUID NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sectors (
    id INT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name_uz TEXT NOT NULL,
    icon TEXT
);

CREATE TABLE regions (
    id INT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INT REFERENCES regions(id)
);
```

### 8.2. Problems

```sql
CREATE TABLE problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES users(id),
    sector_id INT REFERENCES sectors(id),
    region_id INT REFERENCES regions(id),
    raw_text TEXT,
    raw_audio_key TEXT,
    transcript TEXT,
    title TEXT,
    structured_desc JSONB,
    status TEXT NOT NULL DEFAULT 'draft',
    severity_score NUMERIC(5,2),
    vote_count INT NOT NULL DEFAULT 0,
    duplicate_of UUID REFERENCES problems(id),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE problem_status_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    actor_id UUID REFERENCES users(id),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE problem_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    object_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE votes (
    user_id UUID REFERENCES users(id),
    problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, problem_id)
);

CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    parent_id UUID REFERENCES comments(id),
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 8.3. AI

```sql
CREATE TABLE ai_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID UNIQUE NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    result JSONB NOT NULL,
    latency_ms INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE problem_embeddings (
    problem_id UUID PRIMARY KEY REFERENCES problems(id) ON DELETE CASCADE,
    embedding vector(768) NOT NULL
);

CREATE INDEX idx_problem_embeddings_hnsw
    ON problem_embeddings USING hnsw (embedding vector_cosine_ops);
```

### 8.4. Projects

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL REFERENCES problems(id),
    lead_id UUID NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    pitch TEXT,
    repo_url TEXT,
    status TEXT NOT NULL DEFAULT 'proposed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project_members (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    role TEXT NOT NULL DEFAULT 'member',
    PRIMARY KEY (project_id, user_id)
);

CREATE TABLE project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    due_date DATE,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE project_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    media_keys TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id),
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, reviewer_id)
);
```

### 8.5. Notifications, Analytics, Idempotency

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    channels TEXT[] NOT NULL DEFAULT '{inapp}',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analytics_daily (
    day DATE NOT NULL,
    sector_id INT REFERENCES sectors(id),
    region_id INT REFERENCES regions(id),
    submitted_count INT NOT NULL DEFAULT 0,
    published_count INT NOT NULL DEFAULT 0,
    claimed_count INT NOT NULL DEFAULT 0,
    solved_count INT NOT NULL DEFAULT 0,
    vote_count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (day, sector_id, region_id)
);

CREATE TABLE idempotency_keys (
    key TEXT PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    request_hash TEXT NOT NULL,
    response_body JSONB,
    status_code INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 9. Problem Lifecycle

```text
draft
  -> ai_processing
  -> needs_review
  -> published
  -> claimed
  -> piloting
  -> solved
  -> archived
```

O'tish qoidalari:

- `draft -> ai_processing`: problem create qilinganda worker queuega tushadi.
- `ai_processing -> published`: AI confidence yaxshi, duplicate aniq emas, toxic/spam yo'q.
- `ai_processing -> needs_review`: confidence past, spam/toxic flag, duplicate shubhali.
- `published -> claimed`: loyiha approved bo'lganda.
- `claimed -> piloting`: muammo egasi bilan real test boshlanganda.
- `piloting -> solved`: muammo egasi review berganda yoki moderator tasdiqlaganda.
- Istalgan holatdan `archived`: moderator/admin yoki lifecycle qoidasiga ko'ra.

Har o'tish `problem_status_log`ga yoziladi.

---

## 10. Claim va Matching Qoidalari

Claim Reddit/Fiderdan asosiy farq qiladigan joy.

Qoidalar:

- Bitta published problemga ko'pi bilan 3 ta `proposed` project bo'lishi mumkin.
- Muammo egasi bittasini approve qiladi.
- 7 kun ichida muammo egasi javob bermasa moderator approve qilishi mumkin.
- Bitta approved project bo'lganda problem `claimed` bo'ladi.
- Approved project 21 kun update bermasa `abandoned` bo'ladi.
- Project abandoned bo'lsa problem yana `published` holatiga qaytishi mumkin.

Project statuslari:

```text
proposed
approved
in_progress
piloting
completed
abandoned
rejected
```

---

## 11. AI Analyzer Pipeline

AI Analyzer platformaning asosiy farqlanish nuqtasi.

```text
input text/audio
  -> STT if audio
  -> LLM structured JSON
  -> embedding
  -> dedup search
  -> severity scoring
  -> status transition
  -> event publish
```

### 11.1. Structured JSON

```json
{
  "title": "string, max 90 chars, Uzbek",
  "summary": "2-3 sentences",
  "who_affected": "target group",
  "frequency": "daily | weekly | seasonal | once",
  "current_workaround": "string or null",
  "pain_level": 1,
  "suggested_sector": "sector slug",
  "suggested_region": "string or null",
  "tags": ["string"],
  "is_actionable": true,
  "confidence": 0.85,
  "flags": {
    "toxic": false,
    "spam": false,
    "not_a_problem": false
  }
}
```

### 11.2. Dedup Thresholds

| Cosine similarity | Natija |
|---|---|
| `> 0.92` | duplicate, `duplicate_of` belgilanadi |
| `0.80 - 0.92` | `needs_review`, moderator ko'radi |
| `< 0.80` | yangi muammo |

### 11.3. Severity Scoring

```text
score =
  0.4 * normalized_vote_count
  + 0.3 * duplicate_cluster_size
  + 0.2 * pain_level / 5
  + 0.1 * region_spread
```

Score kunlik cron bilan qayta hisoblanadi.

### 11.4. Providerlar

```python
class LLMProvider(Protocol):
    async def complete_json(self, system: str, user: str, schema: type[BaseModel]) -> BaseModel: ...

class STTProvider(Protocol):
    async def transcribe(self, audio_key: str, lang: str = "uz") -> str: ...

class EmbeddingProvider(Protocol):
    async def embed(self, text: str) -> list[float]: ...
```

Boshlanish:

- LLM: Claude yoki OpenAI API.
- Keyin: Qwen/Ollama self-host.
- STT: faster-whisper.
- Embedding: multilingual model yoki API.

---

## 12. API v1

Base prefix:

```text
/api/v1
```

### Auth

```text
POST   /auth/telegram/start
GET    /auth/telegram/status/{session_id}
POST   /auth/refresh
POST   /auth/logout
```

### Users

```text
GET    /users/me
PATCH  /users/me
POST   /users/me/roles
GET    /users/{id}
```

### Media

```text
POST   /media/presign
GET    /media/{object_key}/signed-url
```

### Problems

```text
POST   /problems
GET    /problems
GET    /problems/{id}
PATCH  /problems/{id}
DELETE /problems/{id}
GET    /problems/{id}/similar
```

### Votes and Comments

```text
PUT    /problems/{id}/vote
DELETE /problems/{id}/vote
GET    /problems/{id}/comments
POST   /problems/{id}/comments
DELETE /comments/{id}
```

### Projects

```text
POST   /problems/{id}/claim
GET    /projects
GET    /projects/{id}
PATCH  /projects/{id}
POST   /projects/{id}/approve
POST   /projects/{id}/reject
POST   /projects/{id}/members
POST   /projects/{id}/milestones
PATCH  /milestones/{id}
POST   /projects/{id}/updates
POST   /projects/{id}/reviews
```

### Notifications

```text
GET    /notifications
POST   /notifications/read
```

### Analytics

```text
GET    /analytics/overview
GET    /analytics/sectors
GET    /analytics/regions
GET    /analytics/funnel
```

### Admin

```text
GET    /admin/review-queue
POST   /admin/problems/{id}/approve
POST   /admin/problems/{id}/reject
POST   /admin/problems/{id}/merge
POST   /admin/users/{id}/ban
GET    /admin/audit-log
```

### WebSocket

```text
GET    /ws
```

Channels:

- `notifications`
- `problem:{id}`
- `auth_session:{session_id}`

---

## 13. Web Frontend

Stack template bilan keladi:

- React;
- TypeScript;
- Vite;
- TanStack Query;
- generated API client;
- Tailwind/shadcn style.

### 13.1. Web Tuzilishi

```text
frontend/src/
├── api/
├── app/
├── features/
│   ├── auth/
│   ├── problems/
│   ├── projects/
│   ├── analytics/
│   └── admin/
├── shared/
│   ├── ui/
│   └── lib/
└── routes/
```

### 13.2. Asosiy Ekranlar

Problem owner:

- Telegram login;
- submit problem: text/audio/photo;
- my problems;
- problem status;
- pilot/review.

Startuper:

- problem feed;
- filters: sector, region, severity, votes;
- problem detail;
- claim form;
- project dashboard;
- milestones and updates.

Moderator:

- review queue;
- duplicate candidates;
- approve/reject;
- merge problems.

Org/Admin:

- analytics dashboard;
- sector/region heatmap;
- solved funnel.

---

## 14. Mobile Flutter

Mobile 1-bosqichda shart emas, lekin architecture boshidan tayyor turadi.

Stack:

- Flutter;
- Riverpod;
- dio;
- go_router;
- drift SQLite;
- connectivity_plus;
- secure storage.

### 14.1. Offline Outbox

Qishloq sharoitida internet uzilishi normal. Shuning uchun:

- problem draft lokal drift DBga yoziladi;
- audio lokal faylda saqlanadi;
- internet qaytsa presign -> upload -> create problem;
- har POST `Idempotency-Key` bilan yuboriladi;
- feed oxirgi 50 muammoni lokal cache qiladi.

---

## 15. Telegram Bot

Bot 1-bosqichda mini-rejimda kerak.

### 15.1. Phase 1 Bot

- `/start <token>`;
- auth session tekshirish;
- `request_contact` button;
- contactni backendga yuborish;
- userga "Saytga qayting" xabari.

### 15.2. Phase 2 Bot

- notification yuborish;
- muammo statusini ko'rsatish;
- ovoz berish inline button;
- text/voice orqali muammo yuborish.

Bot hech qanday business logic saqlamaydi. Hammasi REST API orqali.

---

## 16. Infra va Deployment

Template Traefik ishlatadi. Uni qoldiramiz.

```text
services:
  proxy: Traefik
  backend: FastAPI
  frontend: React static/app
  worker: arq worker
  bot: aiogram webhook app
  postgres: PostgreSQL 16 + pgvector
  redis: Redis 7
  minio: S3-compatible storage
  prometheus: metrics
  grafana: dashboard
  loki: logs
```

### 16.1. Environmentlar

- `local`
- `staging`
- `production`

### 16.2. CI/CD

PR:

```text
backend lint -> backend tests -> frontend lint -> frontend build
```

Main:

```text
tests -> docker build -> push image -> deploy -> migration -> smoke test
```

### 16.3. Health Checks

```text
GET /api/v1/utils/health-check/
GET /api/v1/readyz
```

`readyz` DB, Redis, MinIO ulanishini tekshiradi.

---

## 17. Security

| Yo'nalish | Qaror |
|---|---|
| Transport | HTTPS only |
| Auth | Telegram contact verification + JWT rotation |
| Refresh | DB whitelist, family revoke |
| Rate limit | Redis counter |
| RBAC | Role dependency |
| Object permission | Service layer ownership check |
| Media | Private MinIO bucket + presigned URL |
| PII | Phone masking in logs |
| Prompt injection | Strict schema validation, LLM output never executed |
| Audit | Admin and status transition logs |

---

## 18. Payment

Hozir payment yo'q.

Platforma:

- muammo egalari uchun bepul;
- startaperlar uchun bepul;
- ochiq muammo katalogi bilan boshlanadi.

Kelajak monetizatsiya:

- org analytics subscription;
- hackathon problem package;
- donor/university dashboards;
- premium startuper profile.

PaymentProvider faqat kelajak uchun docsda qoladi:

```python
class PaymentProvider(Protocol):
    async def create_invoice(self, ...) -> Invoice: ...
    async def handle_webhook(self, raw: bytes, signature: str) -> WebhookResult: ...
```

---

## 19. Roadmap

### Phase 1 — Template Poydevor

- `fastapi/full-stack-fastapi-template` clone/copy;
- project naming;
- local Docker Compose;
- health checks;
- users modelni Platformaga moslash;
- Redis, MinIO, pgvector qo'shish.

Natija: deploy bo'ladigan skelet.

### Phase 2 — Telegram Auth

- bot service;
- auth_sessions;
- `/auth/telegram/start`;
- `/auth/telegram/status`;
- contact verification;
- JWT access/refresh;
- frontend login flow.

Natija: user Telegram orqali kira oladi.

### Phase 3 — Problems Core

- `items` demo modulini `problems`ga aylantirish;
- problem create/list/detail;
- media presign;
- votes;
- comments;
- basic feed.

Natija: Reddit/Fiderga o'xshash muammo feed ishlaydi.

### Phase 4 — AI Analyzer

- arq worker;
- STT provider;
- LLM structured JSON;
- embeddings;
- pgvector dedup;
- severity scoring;
- needs_review.

Natija: muammolar avtomatik strukturalanadi.

### Phase 5 — Projects and Lifecycle

- claim;
- approve/reject;
- milestones;
- updates;
- piloting;
- review;
- status logs.

Natija: forum emas, solution pipeline ishlaydi.

### Phase 6 — Web Product

- problem owner UX;
- startuper dashboard;
- moderator panel;
- analytics views.

Natija: full web MVP.

### Phase 7 — Mobile

- Flutter app;
- auth;
- feed;
- submit problem;
- offline outbox.

Natija: Android internal test.

### Phase 8 — Bot v2 and Analytics

- botdan problem submit;
- Telegram notifications;
- org analytics;
- export/reporting.

Natija: pilot uchun tayyor ekotizim.

---

## 20. Template Migration Xarita

Template olingandan keyin amaliy ishlar:

1. Project nomlarini Platformaga moslash.
2. `Item` model/router/testlarni `Problem`ga rename qilish.
3. User modelga `phone`, `telegram_id`, `roles`, `region_id`, `reputation` qo'shish.
4. Email/password flow frontenddan olib tashlash yoki dev-only qilib qoldirish.
5. Telegram-auth endpointlarini qo'shish.
6. `bot/` service yaratish.
7. Docker Composega Redis, MinIO, worker, bot qo'shish.
8. Alembic migrationlarni tozalash.
9. Seed data: sectors, regions.
10. `docs/DECISIONS.md` ochish.

---

## 21. Birinchi ADRlar

`docs/DECISIONS.md`ga kiritiladigan qarorlar:

### ADR-001: Platforma Forum Emas, Solution Pipeline

Feed, vote va comments Reddit/Fiderdan olinadi, lekin barcha UX va backend qarorlar solved outcomega xizmat qiladi.

### ADR-002: Modular Monolith Before Microservices

Mikroservis hozircha kerak emas. Modullar qat'iy chegaralanadi, lekin deploy bitta backend sifatida qoladi.

### ADR-003: Telegram Auth as Primary Auth

SMS xarajati va conversion muammosi sabab primary auth Telegram contact verification bo'ladi.

### ADR-004: Template-Based Start

`fastapi/full-stack-fastapi-template` poydevor sifatida ishlatiladi, product logic esa Platforma arxitekturasiga ko'ra yoziladi.

---

## 22. .env Namuna

```env
ENVIRONMENT=local
PROJECT_NAME=Platforma
DOMAIN=localhost

SECRET_KEY=change-me
FIRST_SUPERUSER=admin@example.com
FIRST_SUPERUSER_PASSWORD=change-me

POSTGRES_SERVER=db
POSTGRES_PORT=5432
POSTGRES_DB=platforma
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

REDIS_URL=redis://redis:6379/0

S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123
S3_BUCKET_MEDIA=media

AUTH_PROVIDER=telegram
TG_BOT_TOKEN=
TG_BOT_USERNAME=
TG_WEBHOOK_SECRET=

JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_DAYS=60

LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=
OLLAMA_BASE_URL=http://ollama:11434

STT_PROVIDER=whisper_local
EMBEDDING_MODEL=paraphrase-multilingual-mpnet-base-v2

SENTRY_DSN=
```

---

## 23. Yakuniy Qaror

Platforma quyidagicha quriladi:

```text
fastapi/full-stack-fastapi-template
  + Telegram-auth
  + Reddit/Fider-style problem feed
  + AI Analyzer
  + claim/project/pilot lifecycle
  + solved-first analytics
```

Bu yondashuv tez boshlash imkonini beradi, lekin mahsulotni oddiy forumga aylantirib qo'ymaydi. Template poydevor beradi, Reddit/Fider UX reference beradi, Platformaning haqiqiy farqi esa lifecycle, AI dedup va solved metricda bo'ladi.
