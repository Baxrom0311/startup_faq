import { createFileRoute, Link } from "@tanstack/react-router"
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  MapPin,
  Users,
  Volume2,
  XCircle,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { EmptyState, LoadingState } from "@/components/Product/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import useAuth from "@/hooks/useAuth"
import {
  type Agency,
  type AppealActionLog,
  agencyName,
  apiJson,
  appealStatusLabel,
  fetchAgencies,
  fetchAppealHistory,
  fetchRegions,
  type Problem,
  type ProblemMedia,
  type ProblemMediaResponse,
  type Region,
  rerouteAppeal,
  shortDate,
  updateAppealStatus,
} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/appeals/$appealId")({
  component: AppealDetail,
  head: () => ({
    meta: [{ title: "Murojaat - SolutionLab" }],
  }),
})

// Ordered lifecycle for the stepper. `rejected` is a terminal side-branch.
const FLOW: string[] = ["routed", "accepted", "in_progress", "resolved"]

const STATUS_STYLES: Record<string, string> = {
  routed:
    "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
  accepted:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  in_progress:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  resolved:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  rejected:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
}

function AppealStatusPill({ status }: { status: string }) {
  const style =
    STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-transparent"
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {appealStatusLabel(status)}
    </span>
  )
}

function AppealDetail() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { appealId } = Route.useParams()

  const isOfficial =
    !!user &&
    (user.is_superuser ||
      (user.roles ?? []).some((role) =>
        ["official", "gov", "moderator"].includes(role),
      ))

  const [appeal, setAppeal] = useState<Problem | null>(null)
  const [media, setMedia] = useState<ProblemMedia[]>([])
  const [history, setHistory] = useState<AppealActionLog[]>([])
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)

  const [note, setNote] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [agencyId, setAgencyId] = useState<string>("")
  const [routing, setRouting] = useState(false)

  const load = useCallback(async () => {
    const [appealData, mediaData, historyData] = await Promise.all([
      apiJson<Problem>(`/problems/${appealId}`),
      apiJson<ProblemMediaResponse>(`/problems/${appealId}/media`),
      fetchAppealHistory(appealId),
    ])
    setAppeal(appealData)
    setMedia(mediaData.data)
    setHistory(historyData.data)
    setAgencyId(
      appealData.agency_id != null ? String(appealData.agency_id) : "",
    )
    setDueDate(
      appealData.appeal_due_date ? appealData.appeal_due_date.slice(0, 10) : "",
    )
  }, [appealId])

  useEffect(() => {
    if (!isOfficial) return
    fetchAgencies()
      .then(setAgencies)
      .catch(() => undefined)
    fetchRegions()
      .then(setRegions)
      .catch(() => undefined)
  }, [isOfficial])

  useEffect(() => {
    if (!isOfficial) {
      setLoading(false)
      return
    }
    load()
      .catch((err: unknown) =>
        toast.error(
          err instanceof Error ? err.message : t("error_load_problem"),
        ),
      )
      .finally(() => setLoading(false))
  }, [isOfficial, load, t])

  const changeStatus = async (status: string) => {
    setPendingStatus(status)
    try {
      const updated = await updateAppealStatus(appealId, {
        status,
        note: note.trim() || undefined,
        due_date: dueDate || undefined,
      })
      setAppeal(updated)
      setNote("")
      toast.success(t("appeal_status_update"))
      const historyData = await fetchAppealHistory(appealId)
      setHistory(historyData.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_generic"))
    } finally {
      setPendingStatus(null)
    }
  }

  const applyRoute = async (override?: { is_emergency?: boolean }) => {
    setRouting(true)
    try {
      const updated = await rerouteAppeal(appealId, {
        agency_id: agencyId ? Number(agencyId) : undefined,
        is_emergency: override?.is_emergency,
      })
      setAppeal(updated)
      toast.success(t("appeal_route_title"))
      const historyData = await fetchAppealHistory(appealId)
      setHistory(historyData.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_generic"))
    } finally {
      setRouting(false)
    }
  }

  const agencyById = useMemo(() => {
    const map = new Map<number, Agency>()
    for (const a of agencies) map.set(a.id, a)
    return map
  }, [agencies])

  if (!isOfficial) {
    return (
      <div className="mx-auto max-w-md py-16">
        <EmptyState message={t("appeals_empty")} />
      </div>
    )
  }

  if (loading || !appeal) {
    return <LoadingState />
  }

  const currentStatus = appeal.appeal_status ?? "routed"
  const currentAgency =
    appeal.agency_id != null ? agencyById.get(appeal.agency_id) : undefined
  const region =
    appeal.region_id != null
      ? regions.find((r) => r.id === appeal.region_id)
      : undefined
  const photos = media.filter((m) => m.kind === "photo")
  const audio = media.filter((m) => m.kind === "audio")
  const transcript =
    typeof appeal.structured_desc?.transcript === "string"
      ? appeal.structured_desc.transcript
      : null

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <main className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit" asChild>
          <Link to="/appeals">
            <ArrowLeft />
            {t("appeals_title")}
          </Link>
        </Button>

        <Card className="bg-background shadow-none">
          <CardHeader className="border-b">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <AppealStatusPill status={currentStatus} />
              {appeal.is_emergency && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                  <AlertTriangle className="size-3" />
                  {t("appeal_emergency")}
                </span>
              )}
              {currentAgency && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium">
                  <Building2 className="size-3" />
                  {agencyName(currentAgency)}
                </span>
              )}
              {region && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium">
                  <MapPin className="size-3" />
                  {region.name}
                </span>
              )}
              {typeof appeal.report_count === "number" &&
                appeal.report_count > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium">
                    <Users className="size-3" />
                    {appeal.report_count} {t("appeals_report_count")}
                  </span>
                )}
              <span className="text-muted-foreground text-xs">
                {shortDate(appeal.created_at)}
              </span>
              {appeal.author_name && (
                <span className="text-muted-foreground text-xs">
                  · {appeal.author_name}
                </span>
              )}
            </div>
            <CardTitle className="break-words text-2xl">
              {appeal.title || appeal.raw_text || t("unnamed_problem")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 p-5">
            {appeal.raw_text && (
              <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-6">
                {appeal.raw_text}
              </p>
            )}
            {transcript && transcript !== appeal.raw_text && (
              <div className="rounded-md border bg-muted/20 p-4">
                <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-6">
                  {transcript}
                </p>
              </div>
            )}
            {media.length > 0 && (
              <div className="grid gap-3">
                <h3 className="text-sm font-medium">{t("problem_media")}</h3>
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {photos.map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group overflow-hidden rounded-md border bg-muted"
                      >
                        <img
                          src={item.url}
                          alt=""
                          className="aspect-square w-full object-cover transition group-hover:scale-[1.02]"
                        />
                      </a>
                    ))}
                  </div>
                )}
                {audio.length > 0 && (
                  <div className="grid gap-2">
                    {audio.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-md border p-3"
                      >
                        <Volume2 className="text-muted-foreground size-4 shrink-0" />
                        <audio controls src={item.url} className="h-9 w-full">
                          <track kind="captions" />
                        </audio>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-background shadow-none">
          <CardHeader>
            <CardTitle className="text-base">
              {t("appeal_history_title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <EmptyState />
            ) : (
              <ol className="relative ml-2 border-l pl-6">
                {history.map((log) => (
                  <li key={log.id} className="relative pb-5 last:pb-0">
                    <span className="bg-primary absolute -left-[1.85rem] top-1 size-3 rounded-full ring-4 ring-background" />
                    <div className="flex flex-wrap items-center gap-2">
                      {log.from_status && (
                        <>
                          <AppealStatusPill status={log.from_status} />
                          <span className="text-muted-foreground text-xs">
                            →
                          </span>
                        </>
                      )}
                      <AppealStatusPill status={log.to_status} />
                      {log.agency_id != null &&
                        agencyById.get(log.agency_id) && (
                          <span className="text-muted-foreground text-xs">
                            {agencyName(
                              agencyById.get(log.agency_id) as Agency,
                            )}
                          </span>
                        )}
                    </div>
                    {log.note && (
                      <p className="mt-1.5 whitespace-pre-wrap text-sm">
                        {log.note}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-1 text-xs">
                      {shortDate(log.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </main>

      <aside className="flex flex-col gap-4">
        <Card className="bg-background shadow-none">
          <CardHeader>
            <CardTitle className="text-base">
              {t("appeal_status_update")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              {FLOW.map((status, idx) => {
                const isCurrent = status === currentStatus
                const currentIdx = FLOW.indexOf(currentStatus)
                const done = currentIdx >= idx && currentStatus !== "rejected"
                return (
                  <Button
                    key={status}
                    variant={isCurrent ? "default" : "outline"}
                    className="justify-start"
                    disabled={isCurrent || pendingStatus !== null}
                    onClick={() => changeStatus(status)}
                  >
                    {done ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <span className="text-muted-foreground text-xs font-semibold">
                        {idx + 1}
                      </span>
                    )}
                    {appealStatusLabel(status)}
                  </Button>
                )
              })}
              <Button
                variant="outline"
                className="justify-start text-red-600 hover:text-red-700 dark:text-red-400"
                disabled={
                  currentStatus === "rejected" || pendingStatus !== null
                }
                onClick={() => changeStatus("rejected")}
              >
                <XCircle className="size-4" />
                {appealStatusLabel("rejected")}
              </Button>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="appeal-due-date">{t("appeal_due_date")}</Label>
              <Input
                id="appeal-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="appeal-note">{t("appeal_add_note")}</Label>
              <Textarea
                id="appeal-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("appeal_add_note")}
                rows={3}
              />
            </div>
            {pendingStatus !== null && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <CalendarClock className="size-3.5" />
                {t("loading")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-background shadow-none">
          <CardHeader>
            <CardTitle className="text-base">
              {t("appeal_route_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>{t("appeal_reassign_agency")}</Label>
              <Select value={agencyId} onValueChange={setAgencyId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("appeals_filter_agency")} />
                </SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {agencyName(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <LoadingButton
              loading={routing}
              onClick={() => applyRoute()}
              disabled={
                !agencyId ||
                (appeal.agency_id != null &&
                  String(appeal.agency_id) === agencyId)
              }
            >
              {t("appeal_reassign_agency")}
            </LoadingButton>

            <Button
              variant={appeal.is_emergency ? "default" : "outline"}
              onClick={() => applyRoute({ is_emergency: !appeal.is_emergency })}
              disabled={routing}
              className={
                appeal.is_emergency
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : ""
              }
            >
              <AlertTriangle className="size-4" />
              {t("appeal_mark_emergency")}
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
