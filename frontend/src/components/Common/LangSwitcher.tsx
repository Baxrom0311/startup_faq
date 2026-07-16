import { useTranslation } from "react-i18next"

const LANGS = [
  { code: "uz", label: "O'z" },
  { code: "ru", label: "Ру" },
  { code: "en", label: "En" },
]

export function LangSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.language?.slice(0, 2)

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      {LANGS.map((lang) => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
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
