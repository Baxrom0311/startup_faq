import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Edit, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { UsersService } from "@/client"
import { CardSkeleton } from "@/components/Product/StatusBadge"
import DeleteConfirmation from "@/components/UserSettings/DeleteConfirmation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import useAuth from "@/hooks/useAuth"
import { fetchRegions, type Region } from "@/lib/product-api"

export const Route = createFileRoute("/_layout/settings")({
  component: Settings,
  head: () => ({
    meta: [{ title: "Settings - SignalHub" }],
  }),
})

function Settings() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Form edit states
  const [isEditing, setIsEditing] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [bio, setBio] = useState("")
  const [regionId, setRegionId] = useState<string>("none")
  const [regions, setRegions] = useState<Region[]>([])
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "")
      setEmail(user.email || "")
      setBio(user.bio || "")
      setRegionId(user.region_id ? String(user.region_id) : "none")
    }
  }, [user])

  useEffect(() => {
    fetchRegions()
      .then(setRegions)
      .catch(() => undefined)
  }, [])

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpdating(true)
    try {
      await UsersService.updateUserMe({
        requestBody: {
          full_name: fullName.trim() || null,
          email: email.trim() || null,
          bio: bio.trim() || null,
          region_id: regionId === "none" ? null : Number(regionId),
        },
      })
      toast.success(t("settings_success_update"))
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
      setIsEditing(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error_generic"))
    } finally {
      setUpdating(false)
    }
  }

  const userRegionName = user.region_id
    ? regions.find((r) => r.id === user.region_id)?.name ||
      `Region #${user.region_id}`
    : "—"

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <main className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("settings_title")}
        </h1>
        <Card className="bg-background shadow-none">
          <CardHeader className="border-b flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base">{t("settings_profile")}</CardTitle>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="size-3.5" />
                {t("settings_edit_profile")}
              </Button>
            )}
          </CardHeader>

          {isEditing ? (
            <form onSubmit={handleSave} className="grid gap-4 p-4">
              <div className="grid gap-1">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="fullName"
                >
                  {t("settings_name")}
                </label>
                <Input
                  id="fullName"
                  placeholder={t("settings_name")}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={updating}
                />
              </div>

              <div className="grid gap-1">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="email"
                >
                  {t("settings_email")}
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("settings_email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={updating}
                />
              </div>

              <div className="grid gap-1">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="regionId"
                >
                  {t("settings_region")}
                </label>
                <Select
                  value={regionId}
                  onValueChange={setRegionId}
                  disabled={updating}
                >
                  <SelectTrigger id="regionId">
                    <SelectValue placeholder={t("settings_region")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("region_all")}
                    </SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={region.id} value={String(region.id)}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="bio"
                >
                  {t("settings_bio")}
                </label>
                <Textarea
                  id="bio"
                  placeholder={t("settings_bio")}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={updating}
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  disabled={updating}
                >
                  {t("settings_cancel")}
                </Button>
                <Button type="submit" size="sm" disabled={updating}>
                  {updating && (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  )}
                  {t("settings_save")}
                </Button>
              </div>
            </form>
          ) : (
            <CardContent className="grid gap-3 p-4">
              <Info label={t("settings_name")} value={user.full_name || "—"} />
              <Info label={t("settings_phone")} value={user.phone || "—"} />
              <Info
                label={t("settings_telegram")}
                value={user.telegram_username || "—"}
              />
              <Info label={t("settings_email")} value={user.email || "—"} />
              <Info
                label={t("settings_region")}
                value={userRegionName}
              />
              <Info
                label={t("settings_bio")}
                value={user.bio || "—"}
              />
            </CardContent>
          )}
        </Card>
      </main>

      <aside>
        <Card className="bg-background shadow-none">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              {t("settings_access")}
              {user.is_superuser && (
                <Badge variant="outline">{t("settings_admin")}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4">
            <Info
              label={t("settings_status")}
              value={
                user.is_active ? t("settings_active") : t("settings_inactive")
              }
            />
            <Info
              label={t("settings_roles")}
              value={user.roles?.join(", ") || t("settings_user")}
            />
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
      <span className="text-sm font-medium break-words">{value}</span>
    </div>
  )
}
