# Telefoniya orqali Voice AI Murojaat — Arxitektura + Faza 1 PoC

> **Holat:** Faza 1 (PoC) kodi yozildi, lekin **hech qachon canlı sinovdan o'tkazilmagan** — bu muhitda Docker daemon va SIP softphone yo'q edi, shuning uchun konfiguratsiya va kod qo'lda ko'rib chiqilgan, ruff/pytest bilan tekshirilgan, lekin haqiqiy qo'ng'iroq bilan tasdiqlanmagan. **Ishga tushirishdan oldin pastdagi "Sinovdan o'tkazish" bo'limiga qarang.**
> **Sana:** 2026-07-28 (arxitektura), 2026-07-28 (Faza 1 kod)
> **Bog'liq:** [ARCHITECTURE.md](../ARCHITECTURE.md), `backend/app/api/routes/appeals.py`, `backend/app/bot/main.py`, `backend/app/telephony/`, `infra/asterisk/`

## 0. Maqsad

Fuqaro Telegram yoki veb orqali emas, oddiy telefon qo'ng'irog'i orqali ham murojaat qoldira olishi — AI operator sifatida javob berib, `ready_to_submit=true` bo'lganda murojaatni tizimga kiritadi. Kelajakda davlat idoralarining qisqa raqamlariga ham chiqish (outbound) ko'zda tutiladi, lekin bu hozircha **Faza 3** — telekom shartnomasi talab qiladi.

## 1. Bosqichlar

| Faza | Qamrov | Holat |
|---|---|---|
| **Faza 1 — PoC** | Bitta SIP trunk (test raqam yoki softphone), bitta faol qo'ng'iroq, AI bilan tabiiy suhbat namoyishi | **Kod yozildi** (`backend/app/telephony/`, `infra/asterisk/`), sinovdan o'tkazilmagan |
| **Faza 2 — Parallel production** | Ko'plab bir vaqtdagi qo'ng'iroqlar, monitoring | Arxitektura tayyor (4-bo'lim), qo'shimcha kod kerak emas — asosiy shart Faza 1'da qondirilgan (call-ID bo'yicha izolyatsiya) |
| **Faza 3 — Qisqa raqamga outbound** | Davlat idorasi qisqa raqamiga avtomatik chiqib, murojaatni og'zaki topshirish | Boshlanmagan — telekom operator bilan short-code ruxsatnomasi kerak |

## 2. Mavjud poydevor (qayta ishlatiladi, o'zgarmaydi)

Voice AI logikasi allaqachon REST orqali, **navbat-navbat (turn-based)** ishlaydi:

- `POST /api/v1/appeals/transcribe` — audio (base64) → matn (Gemini STT)
- `POST /api/v1/appeals/voice-chat` — suhbat tarixi → `{reply_text, ready_to_submit, collected_data}`
- `POST /api/v1/appeals/speak` — matn → WAV audio (Gemini TTS, 24kHz)

Telegram bot (`backend/app/bot/main.py`, `_process_bot_user_message`) bu uchtasini bitta halqada ishlatadi; telefoniya integratsiyasi ham xuddi shu halqani takrorlaydi — "foydalanuvchi" Telegram ID emas, Asterisk call-ID bo'ladi.

Bundan tashqari ikkita **yangi ichki endpoint** qo'shildi (`appeals.py`), ikkalasi ham `X-Telegram-Webhook-Secret` bilan himoyalangan (JWT emas — Telegram/telefon orqali murojaat qiluvchilarning web-sessiyasi yo'q):

- `POST /appeals/bot-submit` — Telegram bot uchun (`telegram_id` bo'yicha foydalanuvchi avtomatik yaratiladi)
- `POST /appeals/call-submit` — telefoniya uchun (avval `caller_id` (telefon raqami) bo'yicha, keyin `call_id` bo'yicha foydalanuvchi izlanadi/yaratiladi)

Ikkalasi ham `backend/app/api/routes/problems.py`dagi `create_problem_for_user()` — asl `POST /problems/` endpointidan chiqarilgan umumiy yadro (dedup/moderatsiya/nashr) — orqali ishlaydi.

## 3. Faza 1 komponentlari (amalga oshirildi)

```
                         ┌─────────────────────────┐
   SIP softphone         │   Asterisk (PBX)         │
   (Zoiper/Linphone)     │   infra/asterisk/*.conf   │
   ───────────────────►  │   ext. 600 → AGI          │
                         └────────────┬─────────────┘
                                      │ FastAGI (TCP, oddiy matn protokoli):
                                      │ ANSWER / RECORD FILE / STREAM FILE / HANGUP
                                      ▼
                         ┌─────────────────────────┐
                         │  telephony xizmati        │
                         │  backend/app/telephony/   │
                         │  - agi.py: AGI protokoli   │
                         │  - main.py: har call uchun │
                         │    alohida asyncio handler,│
                         │    navbat-navbat halqa     │
                         └────────────┬─────────────┘
                                      │ HTTP (BACKEND_INTERNAL_URL)
                                      ▼
                         ┌─────────────────────────┐
                         │  backend (mavjud)         │
                         │  /appeals/transcribe       │
                         │  /appeals/voice-chat       │
                         │  /appeals/speak            │
                         │  /appeals/call-submit      │
                         └─────────────────────────┘
```

**Nega ARI/AMI emas, AGI?** Dastlabki reja ARI (Stasis app + event stream) edi, lekin bizning Gemini pipeline'imiz to'liq **navbat-navbat (turn-based)** — full-duplex real-time streaming emas. Asterisk'ning `AGI()` dialplan ilovasi bitta qo'ng'iroq uchun bitta TCP ulanish ochadi va oddiy buyruq-javob protokoli bilan ishlaydi (`RECORD FILE` — jimlik aniqlanguncha yozib oladi, `STREAM FILE` — javobni ijro etadi) — bu aynan bizning record→transcribe→chat→speak→play halqamizga mos keladi, ARI+AudioSocket kabi media-bridging murakkabligisiz.

**Fayllar:**

- `infra/asterisk/pjsip.conf` — bitta test SIP extension (`1000`, parol `changeme_demo_password` — **faqat demo uchun**)
- `infra/asterisk/extensions.conf` — dialplan: `600` raqamiga qo'ng'iroq → `Answer()` → `AGI(agi://telephony:4573/appeal)`
- `infra/asterisk/README.md` — softphone bilan ulanish qo'llanmasi
- `backend/app/telephony/agi.py` — minimal FastAGI protokoli (`ANSWER`, `RECORD FILE`, `STREAM FILE`, `HANGUP`)
- `backend/app/telephony/main.py` — har qo'ng'iroq uchun mustaqil handler: audio yozib olish → `/transcribe` → Redis'dagi `call_appeal_chat:{call_id}` tarixiga qo'shish → `/voice-chat` → `/speak` (Gemini 24kHz WAV'ni `ffmpeg` bilan Asterisk kutgan 8kHz mono 16-bit PCM'ga o'giradi) → `STREAM FILE`. `ready_to_submit=true` bo'lsa `/appeals/call-submit` chaqiriladi.
- `compose.override.yml` — `asterisk` va `telephony` xizmatlari **faqat lokal dev uchun** (production `compose.yml`ga qo'shilmagan, `deploy.yml` ham ularni bilmaydi)

## 4. Parallellik modeli

- Asterisk o'zi ko'plab bir vaqtdagi channel/AGI-ulanishlarni tabiiy qo'llab-quvvatlaydi.
- `telephony/main.py`da har bir qo'ng'iroq o'zining asyncio connection handler'ida ishlaydi (`_handle_connection` → `_run_call`), holati (suhbat tarixi) faqat mahalliy o'zgaruvchilarda va Redis'da `call_appeal_chat:{call_id}` kaliti ostida saqlanadi — global/singleton state yo'q. Shuning uchun ikkita qo'ng'iroq bir vaqtda kelsa, suhbatlar aralashmaydi va Faza 2 uchun qo'shimcha o'zgarish talab qilinmaydi.
- Gemini API chaqiruvlari stateless HTTP so'rovlar — bu qatlamda ham cheklov yo'q, faqat Gemini kvota/rate-limit byudjetini production'da hisobga olish kerak bo'ladi.

## 5. Ma'lum cheklovlar / keyingi tekshiruv kerak bo'lgan joylar

- **Sinovdan o'tkazilmagan:** Docker daemon va SIP softphone bo'lmagan muhitda yozilgan. Birinchi marta ishga tushirishda Asterisk image'ining `/etc/asterisk/pjsip.conf` va `/etc/asterisk/extensions.conf` yo'llarini kutishini, RECORD FILE/STREAM FILE uchun absolyut yo'l (`/media/appeal/...`) qo'llab-quvvatlashini tasdiqlash kerak.
- **Audio format:** `RECORD FILE ... wav` — Asterisk odatda 8kHz signed-linear WAV yozadi; Gemini transcribe shu formatni qabul qiladi deb faraz qilingan (test kerak). TTS tomonda `ffmpeg` orqali 24kHz→8kHz konvertatsiya qo'shilgan.
- **Latency:** transcribe→voice-chat→speak zanjiri bir necha soniya davom etishi mumkin; jonli qo'ng'iroqda kutish signali (masalan touch-tone yoki musiqa) hozircha yo'q.
- **DTMF orqali chiqish:** foydalanuvchi `#` bosib turnni erta tugata oladi (`RECORD FILE` escape digit), lekin qo'ng'iroqni butunlay tugatish uchun maxsus tugma yo'q — faqat jimlik/ready_to_submit/max-turns orqali tugaydi.

## 6. Sinovdan o'tkazish (siz qilishingiz kerak)

```bash
# .env faylida GEMINI_API_KEY va TG_WEBHOOK_SECRET o'rnatilganiga ishonch hosil qiling
docker compose up -d db redis backend telephony asterisk
```

Keyin `infra/asterisk/README.md` bo'yicha softphone (Zoiper/Linphone) bilan `1000` extension'iga kirib, `600` raqamiga qo'ng'iroq qiling. Agar biror joyda ishlamasa — eng ehtimoliy joylar shu hujjatning 5-bo'limida sanab o'tilgan.
