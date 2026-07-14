# Architecture Decision Records

## ADR-001: Platforma Forum Emas, Solution Pipeline

Feed, vote va comments mexanikasi Reddit/Fiderga o'xshash bo'ladi. Lekin mahsulotning north star metrikasi engagement emas, `solved problems per month`.

Shuning uchun backendda muammo lifecycle'i va project pipeline birinchi darajali domain sifatida quriladi:

```text
submitted -> validated -> claimed -> pilot -> solved
```

## ADR-002: Modular Monolith Before Microservices

Platforma bitta FastAPI backend sifatida boshlanadi. Modullar alohida papka, service va repository chegaralari bilan yoziladi, lekin alohida servisga faqat real yuk yoki ownership ehtiyoji paydo bo'lganda ajratiladi.

## ADR-003: Telegram Auth as Primary Auth

Primary auth SMS OTP emas, Telegram contact verification bo'ladi. Sabablar:

- SMS xarajati yo'q;
- user botga ulanadi va keyingi notification kanali tayyor bo'ladi;
- O'zbekiston auditoriyasi uchun Telegram amaliyroq;
- SMS fallback keyin `AuthProvider` orqali qo'shiladi.

## ADR-004: Template-Based Start

Poydevor sifatida `fastapi/full-stack-fastapi-template` ishlatiladi. Template infra, auth skeleton, frontend, Docker Compose, migration va CI beradi. Product domain esa Platforma arxitekturasiga ko'ra bosqichma-bosqich yoziladi.
