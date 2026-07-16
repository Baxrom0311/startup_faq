import { useTranslation } from "react-i18next"

import { apiMutation } from "@/lib/product-api"

const LANGS = [
  { code: "uz", label: "O'z" },
  { code: "ru", label: "Ру" },
  { code: "en", label: "En" },
]

export function LangSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.language?.slice(0, 2)

  const handleChange = async (code: string) => {
    await i18n.changeLanguage(code)
    apiMutation("/users/me", { language: code }, "PATCH").catch(() => undefined)
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      {LANGS.map((lang) => (
        <button
          type="button"
          key={lang.code}
          onClick={() => handleChange(lang.code)}
          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            current === lang.code
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  )
}
