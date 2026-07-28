import { createFileRoute, Link } from "@tanstack/react-router"
import { AlertTriangle, Search, ShieldAlert, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { CardSkeleton, EmptyState } from "@/components/Product/StatusBadge"
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
import useAuth from "@/hooks/useAuth"
import {
  type Agency,
  type AppealStats,
  type AppealsQuery,
  agencyName,
  appealStatusLabel,
  fetchAgencies,
  fetchAppealStats,
  fetchAppeals,
  fetchRegions,
  type Problem,
  type Region,
  shortDate,
} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/appeals/")({
  component: AppealsDashboard,
  head: () => ({
    meta: [{ title: "Appeals - SolutionLab" }],
  }),
})

const PAGE_SIZE = 20
const APPEAL_STATUSES = [
  "routed",
  "accepted",
  "in_progress",
  "resolved",
  "rejected",
] as const
const SORTS = ["urgent", "reports", "newest"] as const

const ALL = "all"

function AppealsDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const isOfficial =
    !!user &&
    (user.is_superuser ||
      (user.roles ?? []).some((role) =>
        ["official", "gov", "moderator"].includes(role),
      ))

  if (user && !isOfficial) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <ShieldAlert
          className="text-muted-foreground size-10"
          strokeWidth={1.5}
        />
        <h1 className="text-xl font-semibold">{t("appeals_title")}</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          {t("error_generic")}
        </p>
      </div>
    )
  }

  return <AppealsDashboardInner />
}

function AppealsDashboardInner() {
  const { t } = useTranslation()

  const [stats, setStats] = useState<AppealStats | null>(null)
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [regions, setRegions] = useState<Region[]>([])

  const [agencyId, setAgencyId] = useState<string>(ALL)
  const [status, setStatus] = useState<string>(ALL)
  const [regionId, setRegionId] = useState<string>(ALL)
  const [emergencyOnly, setEmergencyOnly] = useState(false)
  const [sort, setSort] = useState<(typeof SORTS)[number]>("urgent")
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  const [appeals, setAppeals] = useState<Problem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [skip, setSkip] = useState(0)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    fetchAgencies()
      .then(setAgencies)
      .catch(() => undefined)
    fetchRegions()
      .then(setRegions)
      .catch(() => undefined)
    fetchAppealStats()
      .then(setStats)
      .catch(() => undefined)
  }, [])

  const buildParams = useCallback(
    (currentSkip: number): AppealsQuery => ({
      agency_id: agencyId !== ALL ? Number(agencyId) : undefined,
      appeal_status: status !== ALL ? status : undefined,
      region_id: regionId !== ALL ? Number(regionId) : undefined,
      is_emergency: emergencyOnly ? true : undefined,
      q: debouncedQuery.trim() || undefined,
      sort,
      skip: currentSkip,
      limit: PAGE_SIZE,
    }),
    [agencyId, status, regionId, emergencyOnly, debouncedQuery, sort],
  )

  const load = useCallback(
    async (currentSkip: number) => {
      const res = await fetchAppeals(buildParams(currentSkip))
      if (currentSkip === 0) {
        setAppeals(res.data)
      } else {
        setAppeals((prev) => [...prev, ...res.data])
      }
      setTotalCount(res.count)
    },
    [buildParams],
  )

  useEffect(() => {
    setSkip(0)
    setInitialLoading(true)
    load(0)
      .catch(() => undefined)
      .finally(() => setInitialLoading(false))
  }, [load])

  const handleLoadMore = async () => {
    const nextSkip = skip + PAGE_SIZE
    setSkip(nextSkip)
    setLoadingMore(true)
    try {
      await load(nextSkip)
    } finally {
      setLoadingMore(false)
    }
  }

  const agencyMap = useMemo(
    () => new Map(agencies.map((a) => [a.id, a])),
    [agencies],
  )
  const regionMap = useMemo(
    () => new Map(regions.map((r) => [r.id, r])),
    [regions],
  )

  const hasActiveFilters =
    agencyId !== ALL ||
    status !== ALL ||
    regionId !== ALL ||
    emergencyOnly ||
    query.trim() !== ""

  const clearFilters = () => {
    setAgencyId(ALL)
    setStatus(ALL)
    setRegionId(ALL)
    setEmergencyOnly(false)
    setQuery("")
  }

  const resolutionRate = stats
    ? `${Math.round(stats.resolution_rate * 100)}%`
    : "—"

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("appeals_title")}
        </h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard label={t("appeals_stat_total")} value={stats?.total ?? 0} />
        <MetricCard
          label={t("appeals_stat_emergency")}
          value={stats?.emergency ?? 0}
          accent
        />
        <MetricCard label={t("appeals_stat_open")} value={stats?.open ?? 0} />
        <MetricCard
          label={t("appeals_stat_resolved")}
          value={stats?.resolved ?? 0}
        />
        <MetricCard label={t("appeals_stat_rate")} value={resolutionRate} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={agencyId} onValueChange={setAgencyId}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder={t("appeals_filter_agency")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("appeals_filter_all")}</SelectItem>
              {agencies.map((agency) => (
                <SelectItem key={agency.id} value={String(agency.id)}>
                  {agency.icon ? `${agency.icon} ` : ""}
                  {agencyName(agency)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder={t("appeals_filter_status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("appeals_filter_all")}</SelectItem>
              {APPEAL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {appealStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={regionId} onValueChange={setRegionId}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder={t("appeals_filter_region")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("appeals_filter_all")}</SelectItem>
              {regions.map((region) => (
                <SelectItem key={region.id} value={String(region.id)}>
                  {region.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="bg-background pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("dashboard_search")}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Emergency toggle */}
          <button
            type="button"
            onClick={() => setEmergencyOnly((v) => !v)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
              emergencyOnly
                ? "border-red-600 bg-red-600 text-white"
                : "bg-background hover:bg-muted/50"
            }`}
          >
            <AlertTriangle className="size-3" />
            {t("appeals_filter_emergency")}
          </button>

          <span className="bg-border mx-1 h-5 w-px" />

          {/* Sort chips */}
          {SORTS.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setSort(s)}
              className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                sort === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted/50"
              }`}
            >
              {s === "urgent"
                ? t("appeals_sort_urgent")
                : s === "reports"
                  ? t("appeals_sort_reports")
                  : t("appeals_sort_newest")}
            </button>
          ))}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-muted-foreground hover:border-destructive hover:text-destructive inline-flex h-8 items-center gap-1 rounded-full border border-dashed px-3 text-xs transition-colors"
            >
              <X className="size-3" />
              {t("clear_filters")}
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <section className="bg-background overflow-hidden rounded-lg border shadow-none">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <h2 className="font-medium">{t("appeals_title")}</h2>
          {!initialLoading && <Badge variant="outline">{totalCount}</Badge>}
        </div>

        {initialLoading ? (
          <CardSkeleton rows={5} />
        ) : appeals.length === 0 ? (
          <div className="py-2">
            <EmptyState message={t("appeals_empty")} />
          </div>
        ) : (
          <>
            <div className="divide-y">
              {appeals.map((appeal) => (
                <AppealRow
                  key={appeal.id}
                  appeal={appeal}
                  agency={
                    appeal.agency_id != null
                      ? agencyMap.get(appeal.agency_id)
                      : undefined
                  }
                  region={
                    appeal.region_id != null
                      ? regionMap.get(appeal.region_id)
                      : undefined
                  }
                />
              ))}
            </div>
            {appeals.length < totalCount && (
              <div className="flex justify-center border-t p-4">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? t("loading") : t("load_more")}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent?: boolean
}) {
  return (
    <Card className="bg-background shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent
        className={`text-2xl font-semibold ${accent ? "text-red-600 dark:text-red-500" : ""}`}
      >
        {value}
      </CardContent>
    </Card>
  )
}

function AppealRow({
  appeal,
  agency,
  region,
}: {
  appeal: Problem
  agency?: Agency
  region?: Region
}) {
  const { t } = useTranslation()

  return (
    <Link
      to="/appeals/$appealId"
      params={{ appealId: appeal.id }}
      className="group hover:bg-muted/50 flex flex-col gap-2 px-4 py-4 transition-colors"
    >
      <div className="flex flex-wrap items-center gap-2">
        {appeal.is_emergency && (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            <AlertTriangle className="size-3" />
            {t("appeal_emergency")}
          </span>
        )}
        {appeal.appeal_status && (
          <span className="bg-muted text-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">
            {appealStatusLabel(appeal.appeal_status)}
          </span>
        )}
        {agency && (
          <span className="text-muted-foreground text-xs">
            {agency.icon ? `${agency.icon} ` : ""}
            {agencyName(agency)}
          </span>
        )}
        {region && (
          <span className="text-muted-foreground text-xs">
            📍 {region.name}
          </span>
        )}
      </div>

      <h3 className="font-medium group-hover:underline">
        {appeal.title || appeal.raw_text || t("unnamed_problem")}
      </h3>
      {appeal.raw_text && (
        <p className="text-muted-foreground line-clamp-2 text-sm">
          {appeal.raw_text}
        </p>
      )}

      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
        {typeof appeal.report_count === "number" && appeal.report_count > 0 && (
          <span className="text-foreground font-medium">
            {appeal.report_count} {t("appeals_report_count")}
          </span>
        )}
        <span>{shortDate(appeal.created_at)}</span>
      </div>
    </Link>
  )
}
