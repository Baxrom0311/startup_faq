import { Bot, Image, Loader2, Plus, Send, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  apiJson,
  apiMutation,
  fetchRegions,
  type Region,
  shortDate,
  uploadProblemPhoto,
} from "@/lib/product-api"

interface Broadcast {
  id: string
  title: string
  text_uz: string
  text_ru?: string
  text_en?: string
  buttons: Array<{ text: string; url: string }>
  photo_key?: string
  target_region_id?: number
  status: string
  sent_count: number
  failed_count: number
  created_at: string
}

interface BroadcastsResponse {
  data: Broadcast[]
  count: number
}

export default function BroadcastsManager() {
  const { t } = useTranslation()
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Form states
  const [title, setTitle] = useState("")
  const [textUz, setTextUz] = useState("")
  const [textRu, setTextRu] = useState("")
  const [textEn, setTextEn] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [regionId, setRegionId] = useState<string>("all")
  const [buttons, setButtons] = useState<Array<{ text: string; url: string }>>(
    [],
  )
  const [submitting, setSubmitting] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [activePreviewLang, setActivePreviewLang] = useState<
    "uz" | "ru" | "en"
  >("uz")

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiJson<BroadcastsResponse>("/broadcasts/")
      setBroadcasts(response.data)
    } catch {
      toast.error(t("error_generic"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadData()
    fetchRegions()
      .then(setRegions)
      .catch(() => undefined)
  }, [loadData])

  const handleAddButtonRow = () => {
    setButtons([...buttons, { text: "", url: "" }])
  }

  const handleRemoveButtonRow = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index))
  }

  const handleButtonChange = (
    index: number,
    field: "text" | "url",
    value: string,
  ) => {
    const updated = [...buttons]
    updated[index][field] = value
    setButtons(updated)
  }

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !textUz.trim()) {
      toast.error(t("error_generic"))
      return
    }

    setSubmitting(true)
    try {
      let photoKey: string | undefined
      if (photoFile) {
        photoKey = await uploadProblemPhoto(photoFile)
      }

      const payload = {
        title: title.trim(),
        text_uz: textUz.trim(),
        text_ru: textRu.trim() || undefined,
        text_en: textEn.trim() || undefined,
        buttons: buttons.filter((b) => b.text.trim() && b.url.trim()),
        photo_key: photoKey,
        target_region_id: regionId === "all" ? undefined : Number(regionId),
      }

      await apiMutation<Broadcast>("/broadcasts/", payload, "POST")
      toast.success(t("submit_success"))
      setDialogOpen(false)
      loadData()

      // Reset form
      setTitle("")
      setTextUz("")
      setTextRu("")
      setTextEn("")
      setPhotoFile(null)
      setRegionId("all")
      setButtons([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error_generic"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSend = async (id: string) => {
    setSendingId(id)
    try {
      await apiMutation(`/broadcasts/${id}/send`, {}, "POST")
      toast.success(t("problem_action_done"))
      loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error_generic"))
    } finally {
      setSendingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(`${t("settings_delete_confirm")}?`)) return
    try {
      await apiMutation(`/broadcasts/${id}`, {}, "DELETE")
      toast.success(t("settings_delete_success"))
      loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error_generic"))
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">{t("broadcast_status_pending")}</Badge>
      case "sending":
        return (
          <Badge className="bg-amber-500 text-white animate-pulse">
            {t("broadcast_status_sending")}
          </Badge>
        )
      case "completed":
        return (
          <Badge className="bg-green-600 text-white">
            {t("broadcast_status_completed")}
          </Badge>
        )
      default:
        return <Badge variant="destructive">{status}</Badge>
    }
  }

  return (
    <Card className="bg-background shadow-none">
      <CardHeader className="flex flex-row items-center justify-between border-b py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="size-4" />
          {t("admin_tab_broadcasts")}
          {!loading && <Badge variant="secondary">{broadcasts.length}</Badge>}
        </CardTitle>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="size-4" />
              {t("admin_new_broadcast")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto lg:max-w-[950px]">
            <DialogHeader>
              <DialogTitle>{t("admin_new_broadcast")}</DialogTitle>
            </DialogHeader>

            <div className="grid gap-6 lg:grid-cols-[1fr_340px] py-2">
              {/* Form Side */}
              <form onSubmit={handleCreateBroadcast} className="grid gap-4">
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("admin_broadcast_title_label")}
                  </span>
                  <Input
                    required
                    placeholder="masalan: 2.0 yangilanishi"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("submit_region_label")}
                    </span>
                    <Select
                      value={regionId}
                      onValueChange={setRegionId}
                      disabled={submitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("region_all")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("region_all")}</SelectItem>
                        {regions.map((region) => (
                          <SelectItem key={region.id} value={String(region.id)}>
                            {region.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("admin_broadcast_photo")}
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={submitting}
                        className="cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) setPhotoFile(file)
                        }}
                      />
                      {photoFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setPhotoFile(null)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 border-t pt-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("admin_broadcast_texts")}
                  </span>

                  <div className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      O'zbekcha matn (UZ) *
                    </span>
                    <Textarea
                      required
                      placeholder="E'lon matnini kiriting..."
                      value={textUz}
                      onChange={(e) => setTextUz(e.target.value)}
                      disabled={submitting}
                      rows={4}
                    />
                  </div>

                  <div className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Русский текст (RU)
                    </span>
                    <Textarea
                      placeholder="Введите текст объявления..."
                      value={textRu}
                      onChange={(e) => setTextRu(e.target.value)}
                      disabled={submitting}
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      English text (EN)
                    </span>
                    <Textarea
                      placeholder="Enter broadcast text..."
                      value={textEn}
                      onChange={(e) => setTextEn(e.target.value)}
                      disabled={submitting}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="grid gap-2 border-t pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("admin_broadcast_buttons")}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddButtonRow}
                      disabled={submitting}
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      <Plus className="size-3" />
                      {t("add_item")}
                    </Button>
                  </div>

                  {buttons.map((btn, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        required
                        placeholder="Tugma matni (masalan: Batafsil)"
                        value={btn.text}
                        onChange={(e) =>
                          handleButtonChange(idx, "text", e.target.value)
                        }
                        disabled={submitting}
                        className="flex-1"
                      />
                      <Input
                        required
                        type="url"
                        placeholder="Havola (masalan: https://...)"
                        value={btn.url}
                        onChange={(e) =>
                          handleButtonChange(idx, "url", e.target.value)
                        }
                        disabled={submitting}
                        className="flex-[2]"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveButtonRow(idx)}
                        disabled={submitting}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex justify-end gap-2 border-t pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={submitting}
                  >
                    {t("settings_delete_cancel")}
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    {t("broadcast_create")}
                  </Button>
                </div>
              </form>

              {/* Telegram Preview Side */}
              <div className="hidden lg:flex flex-col gap-3 border-l pl-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Telegram Preview
                  </span>
                  <div className="flex gap-1 rounded-md border p-0.5 bg-muted/40">
                    {(["uz", "ru", "en"] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setActivePreviewLang(lang)}
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded-sm uppercase transition-colors ${
                          activePreviewLang === lang
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative flex-1 rounded-lg border bg-[#e7ebf0] dark:bg-[#0e1621] p-4 flex flex-col justify-end min-h-[380px] max-h-[560px] overflow-y-auto">
                  {/* Telegram Message Header */}
                  <div className="absolute top-3 left-4 right-4 flex items-center gap-2 border-b pb-2 border-black/5 dark:border-white/5">
                    <div className="size-7 rounded-full bg-gradient-to-tr from-sky-400 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white uppercase select-none">
                      PB
                    </div>
                    <div className="flex flex-col leading-none">
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                        Platforma Bot
                        <span className="bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 text-[9px] px-1 py-0.25 rounded font-normal uppercase scale-90">
                          bot
                        </span>
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {t("settings_active")}
                      </span>
                    </div>
                  </div>

                  {/* Message Bubble Container */}
                  <div className="flex flex-col gap-1.5 mt-12 max-w-[90%] self-start w-full">
                    <div className="bg-white dark:bg-[#182533] text-black dark:text-white rounded-lg shadow-sm overflow-hidden border border-black/5 dark:border-white/5">
                      {photoPreviewUrl ? (
                        <img
                          src={photoPreviewUrl}
                          alt=""
                          className="w-full aspect-video object-cover"
                        />
                      ) : null}
                      <div className="p-2.5 text-xs whitespace-pre-wrap leading-relaxed break-words">
                        {activePreviewLang === "uz"
                          ? textUz || (
                              <span className="text-muted-foreground/50 italic">
                                [O'zbekcha matn kiritilmagan]
                              </span>
                            )
                          : activePreviewLang === "ru"
                            ? textRu || (
                                <span className="text-muted-foreground/50 italic">
                                  [Русский текст не введен]
                                </span>
                              )
                            : textEn || (
                                <span className="text-muted-foreground/50 italic">
                                  [English text not entered]
                                </span>
                              )}
                      </div>
                    </div>

                    {/* Inline Buttons Preview */}
                    {buttons.length > 0 && (
                      <div className="grid gap-1 mt-1 w-full">
                        {buttons.map((btn, idx) => (
                          <div
                            key={idx}
                            className="bg-[#2f6ea5]/10 dark:bg-[#2f6ea5]/20 text-[#2f6ea5] dark:text-[#64b5f6] hover:bg-[#2f6ea5]/20 text-center py-2 px-3 rounded-md text-[11px] font-medium border border-[#2f6ea5]/20 truncate cursor-default select-none"
                          >
                            {btn.text || (
                              <span className="text-muted-foreground/50 italic">
                                [Tugma matni]
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Send className="size-8 stroke-[1.5] mb-2" />
            <p className="text-sm">{t("no_results")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/20 text-muted-foreground text-xs uppercase">
                  <th className="px-4 py-3">
                    {t("admin_broadcast_title_label")}
                  </th>
                  <th className="px-4 py-3">{t("submit_region_label")}</th>
                  <th className="px-4 py-3">{t("settings_status")}</th>
                  <th className="px-4 py-3">{t("broadcast_results")}</th>
                  <th className="px-4 py-3">{t("broadcast_date")}</th>
                  <th className="px-4 py-3 text-right">
                    {t("broadcast_actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {broadcasts.map((b) => {
                  const regionName =
                    regions.find((r) => r.id === b.target_region_id)?.name ||
                    t("region_all")

                  return (
                    <tr key={b.id} className="hover:bg-muted/10">
                      <td className="px-4 py-3.5 font-medium">
                        <div className="grid">
                          <span>{b.title}</span>
                          {b.photo_key && (
                            <span className="text-muted-foreground flex items-center gap-0.5 text-xs">
                              <Image className="size-3" /> {t("problem_media")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {regionName}
                      </td>
                      <td className="px-4 py-3.5">
                        {getStatusBadge(b.status)}
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        {b.status !== "pending" && (
                          <div className="grid text-muted-foreground font-medium">
                            <span className="text-green-600">
                              ✓ {b.sent_count} yuborildi
                            </span>
                            {b.failed_count > 0 && (
                              <span className="text-destructive">
                                ✗ {b.failed_count} xato
                              </span>
                            )}
                          </div>
                        )}
                        {b.status === "pending" && "—"}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">
                        {shortDate(b.created_at)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          {b.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSend(b.id)}
                              disabled={sendingId === b.id}
                              className="h-7 gap-1 px-2 text-xs"
                            >
                              {sendingId === b.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Send className="size-3 text-primary" />
                              )}
                              {t("broadcast_send")}
                            </Button>
                          )}
                          {b.status !== "sending" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(b.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
