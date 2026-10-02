# Telephony PoC — mahalliy test

Bu papka faqat `docs/TELEPHONY_VOICE_AI.md` Faza 1 (PoC) uchun: haqiqiy telekom
shartnomasi yoki qisqa raqam kerak emas, faqat softphone.

## Ishga tushirish

```bash
docker compose up -d asterisk telephony backend redis
```

`asterisk` xizmati 5060/udp (SIP) va 10000-10100/udp (RTP media) portlarini
ochadi; `telephony` xizmati esa 4573 portda ichki FastAGI serverini eshitadi
(faqat `asterisk` konteyneridan yetadigan, tashqariga ochilmagan).

## Softphone bilan ulanish

Zoiper, Linphone yoki boshqa istalgan SIP softphone bilan:

- **Server:** kompyuteringiz IP manzili (yoki `localhost`, agar softphone shu
  mashinada bo'lsa)
- **Port:** 5060
- **Username:** `1000`
- **Password:** `changeme_demo_password` (`infra/asterisk/pjsip.conf` da)
- **Transport:** UDP

Ro'yxatdan o'tgandan so'ng **600** raqamiga qo'ng'iroq qiling — Gemini Voice
AI javob beradi va murojaat qabul qilish oqimi (`docs/TELEPHONY_VOICE_AI.md`
3-bo'lim) boshlanadi.

## Diqqat

- Parolni production'da hech qachon ishlatmang — bu faqat demo uchun.
- `GEMINI_API_KEY` va `TG_WEBHOOK_SECRET` `.env`da o'rnatilgan bo'lishi shart
  (`backend/app/telephony/main.py` ikkalasisiz ham ishga tushadi, lekin AI
  javob bermaydi / murojaat yubora olmaydi).
- Ovoz konvertatsiyasi uchun `telephony` konteynerida `ffmpeg` o'rnatilgan
  bo'lishi kerak (`backend/Dockerfile`ga qo'shilgan).
