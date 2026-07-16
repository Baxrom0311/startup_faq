import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import DeleteConfirmation from "@/components/UserSettings/DeleteConfirmation"
import { CardSkeleton } from "@/components/Product/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/settings")({
  component: Settings,
  head: () => ({
    meta: [{ title: "Settings - SignalHub" }],
  }),
})

function Settings() {
  const { t } = useTranslation()
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="bg-background shadow-none">
          <CardHeader className="border-b">
            <CardTitle className="text-base">{t("settings_profile")}</CardTitle>
          </CardHeader>
          <CardSkeleton rows={4} />
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <main className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings_title")}</h1>
        <Card className="bg-background shadow-none">
          <CardHeader className="border-b">
            <CardTitle className="text-base">{t("settings_profile")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4">
            <Info label={t("settings_name")} value={user.full_name || "—"} />
            <Info label={t("settings_phone")} value={user.phone || "—"} />
            <Info label={t("settings_telegram")} value={user.telegram_username || "—"} />
            <Info label={t("settings_email")} value={user.email} />
          </CardContent>
        </Card>
      </main>

      <aside>
        <Card className="bg-background shadow-none">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              {t("settings_access")}
              {user.is_superuser && <Badge variant="outline">{t("settings_admin")}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4">
            <Info label={t("settings_status")} value={user.is_active ? t("settings_active") : t("settings_inactive")} />
            <Info label={t("settings_roles")} value={user.roles?.join(", ") || t("settings_user")} />
            <div className="pt-2">
              <DeleteConfirmation />
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  )
}
