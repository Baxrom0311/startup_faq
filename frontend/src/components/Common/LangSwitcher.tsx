import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSidebar } from "@/components/ui/sidebar"
import { apiMutation } from "@/lib/product-api"

const LANGS = [
  { code: "uz", label: "O'zbek", short: "O'z", flag: "🇺🇿" },
  { code: "ru", label: "Русский", short: "Ру", flag: "🇷🇺" },
  { code: "en", label: "English", short: "En", flag: "🇬🇧" },
]

export function LangSwitcher() {
  const { i18n } = useTranslation()
  const { state } = useSidebar()
  const queryClient = useQueryClient()
  const current = i18n.language?.slice(0, 2)
  const currentLang = LANGS.find((l) => l.code === current) ?? LANGS[0]

  const handleChange = async (code: string) => {
    // Update i18n immediately so UI responds at once
    await i18n.changeLanguage(code)
    // Optimistically patch the cached user so AppSidebar's useEffect doesn't revert
    queryClient.setQueryData(["currentUser"], (old: any) =>
      old ? { ...old, language: code } : old,
    )
    // Persist to backend (fire-and-forget)
    apiMutation("/users/me", { language: code }, "PATCH").catch(() => undefined)
  }

  if (state === "collapsed") {
    return (
      <div className="flex justify-center py-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded p-1.5 text-base leading-none hover:bg-muted/60 transition-colors"
              title={currentLang.label}
            >
              {currentLang.flag}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-36">
            {LANGS.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => handleChange(lang.code)}
                className={current === lang.code ? "font-semibold" : ""}
              >
                <span className="mr-2">{lang.flag}</span>
                {lang.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      {LANGS.map((lang) => (
        <button
          type="button"
          key={lang.code}
          onClick={() => handleChange(lang.code)}
          title={lang.label}
          className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            current === lang.code
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {lang.flag} {lang.short}
        </button>
      ))}
    </div>
  )
}
