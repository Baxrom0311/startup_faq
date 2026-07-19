import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Bell,
  CheckCheck,
  ChevronDown,
  CircleDot,
  GitBranch,
  MessageSquare,
  Plus,
  Search,
  ThumbsUp,
  X,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  CardSkeleton,
  EmptyState,
  StatusBadge,
} from "@/components/Product/StatusBadge"
import { SubmitProblemDialog } from "@/components/Product/SubmitProblemDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  type AnalyticsOverview,
  apiJson,
  apiMutation,
  fetchRegions,
  fetchSectors,
  type NotificationItem,
  type NotificationsResponse,
  notificationLabel,
  notificationLink,
  type Problem,
  type ProblemsResponse,
  type Project,
  type ProjectsResponse,
  type Region,
  type Sector,
  shortDate,
  statusLabel,
  structuredSummary,
} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [{ title: "Signal board - SolutionLab" }],
  }),
})

function Dashboard() {
  const { t, i18n } = useTranslation()
  const [problems, setProblems] = useState<Problem[]>([])
  const [incomingProjects, setIncomingProjects] = useState<Project[]>([])
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [sectors, setSectors] = useState<Sector[]>([])
  const [activeSector, setActiveSector] = useState<number | null>(null)
  const [regions, setRegions] = useState<Region[]>([])
  const [activeRegion, setActiveRegion] = useState<number | null>(null)
  const [mineOnly, setMineOnly] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [initialLoading, setInitialLoading] = useState(true)
  const [skip, setSkip] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    fetchSectors()
      .then(setSectors)
      .catch(() => undefined)
    fetchRegions()
      .then(setRegions)
      .catch(() => undefined)
  }, [])

  const loadDashboard = useCallback(
    async (currentSkip = 0) => {
      const searchParam = query.trim()
        ? `&q=${encodeURIComponent(query.trim())}`
        : ""
      const sectorParam =
        activeSector != null ? `&sector_id=${activeSector}` : ""
      const regionParam =
        activeRegion != null ? `&region_id=${activeRegion}` : ""
      const mineParam = mineOnly ? "&mine=true" : ""
      const statusParam = mineOnly ? "all" : "published"
      const [
        problemsData,
        incomingData,
        myProjectsData,
        analyticsData,
        notificationsData,
      ] = await Promise.all([
        apiJson<ProblemsResponse>(
          `/problems/?status=${statusParam}${searchParam}${sectorParam}${regionParam}${mineParam}&skip=${currentSkip}&limit=20`,
        ),
        apiJson<ProjectsResponse>("/projects?owner=true&status=proposed"),
        apiJson<ProjectsResponse>("/projects?mine=true"),
        apiJson<AnalyticsOverview>("/analytics/overview"),
        apiJson<NotificationsResponse>("/notifications?limit=6"),
      ])
      if (currentSkip === 0) {
        setProblems(problemsData.data)
      } else {
        setProblems((prev) => [...prev, ...problemsData.data])
      }
      setTotalCount(problemsData.count)
      setIncomingProjects(incomingData.data)
      setMyProjects(
        myProjectsData.data.filter((project) =>
          ["approved", "in_progress", "piloting"].includes(project.status),
        ),
      )
      setAnalytics(analyticsData)
      setNotifications(notificationsData.data)
      setUnreadNotifications(notificationsData.unread_count)
    },
    [query, activeSector, activeRegion, mineOnly],
  )

  useEffect(() => {
    setSkip(0)
    loadDashboard(0)
      .catch(() => undefined)
      .finally(() => setInitialLoading(false))
  }, [loadDashboard])

  const sectorMap = new Map(sectors.map((s) => [s.id, s]))

  const markAllNotificationsRead = async () => {
    if (unreadNotifications === 0) return
    try {
      await apiMutation("/notifications/read", { notification_ids: [] })
      await loadDashboard(0)
      setSkip(0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_mark_read"))
    }
  }

  const handleLoadMore = async () => {
    const nextSkip = skip + 20
    setSkip(nextSkip)
    setLoadingMore(true)
    try {
      await loadDashboard(nextSkip)
    } finally {
      setLoadingMore(false)
    }
  }

  const lang = i18n.language?.slice(0, 2) as "uz" | "ru" | "en"
  const sectorName = (s: Sector) =>
    (lang === "ru" ? s.name_ru : lang === "en" ? s.name_en : null) ??
    t(`sector_${s.slug}` as any, s.name_uz)

  const activeSectorObj = activeSector != null ? sectorMap.get(activeSector) : null
  const activeRegionObj = activeRegion != null ? regions.find((r) => r.id === activeRegion) : null
  const hasActiveFilters = activeSector != null || activeRegion != null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("dashboard_title")}
          </h1>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_auto] lg:w-[540px]">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="bg-background pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("dashboard_search")}
            />
          </div>
          <Button onClick={() => setSubmitOpen(true)}>
            <Plus />
            {t("dashboard_new")}
          </Button>
        </div>
      </div>

      <SubmitProblemDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        onCreated={loadDashboard}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="flex flex-col gap-3">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <MetricCard
              label={t("metric_open")}
              value={analytics?.published_problems ?? problems.length}
            />
            <MetricCard
              label={t("metric_active_projects")}
              value={analytics?.active_projects ?? 0}
            />
            <MetricCard
              label={t("metric_completed_projects")}
              value={analytics?.completed_projects ?? 0}
            />
            <MetricCard
              label={t("metric_solved")}
              value={analytics?.solved_problems ?? 0}
            />
          </div>

          {/* Telegram-style compact filter bar */}
          {(sectors.length > 0 || regions.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Sector filter dropdown */}
              {sectors.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                        activeSectorObj
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted/50"
                      }`}
                    >
                      <span>{activeSectorObj?.icon ?? "🗂️"}</span>
                      <span className="max-w-[110px] truncate">
                        {activeSectorObj
                          ? sectorName(activeSectorObj)
                          : t("dashboard_all_sectors")}
                      </span>
                      <ChevronDown className="size-3 shrink-0 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-[320px] p-2"
                    align="start"
                    sideOffset={6}
                  >
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveSector(null)}
                        className={`col-span-3 flex items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                          activeSector === null
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        <span>🗂️</span>
                        <span>{t("dashboard_all_sectors")}</span>
                      </button>
                      {sectors.map((sector) => (
                        <button
                          type="button"
                          key={sector.id}
                          onClick={() =>
                            setActiveSector(
                              activeSector === sector.id ? null : sector.id,
                            )
                          }
                          className={`flex items-center gap-1 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                            activeSector === sector.id
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          }`}
                        >
                          <span className="shrink-0">{sector.icon}</span>
                          <span className="truncate">{sectorName(sector)}</span>
                        </button>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Region filter dropdown */}
              {regions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                        activeRegionObj
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted/50"
                      }`}
                    >
                      <span>📍</span>
                      <span className="max-w-[110px] truncate">
                        {activeRegionObj?.name ?? t("dashboard_all_regions")}
                      </span>
                      <ChevronDown className="size-3 shrink-0 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-[280px] p-2"
                    align="start"
                    sideOffset={6}
                  >
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveRegion(null)}
                        className={`col-span-2 flex items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                          activeRegion === null
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        <span>📍</span>
                        <span>{t("dashboard_all_regions")}</span>
                      </button>
                      {regions.map((region) => (
                        <button
                          type="button"
                          key={region.id}
                          onClick={() =>
                            setActiveRegion(
                              activeRegion === region.id ? null : region.id,
                            )
                          }
                          className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                            activeRegion === region.id
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          }`}
                        >
                          <span>📍</span>
                          <span className="truncate">{region.name}</span>
                        </button>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSector(null)
                    setActiveRegion(null)
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed px-3 text-xs text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                >
                  <X className="size-3" />
                  {t("clear_filters")}
                </button>
              )}
            </div>
          )}

          <section className="overflow-hidden rounded-lg border bg-background shadow-none">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="font-medium">{t("dashboard_feed_title")}</h2>
                {!initialLoading && (
                  <Badge variant="outline">{totalCount}</Badge>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMineOnly((v) => !v)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  mineOnly
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted/50"
                }`}
              >
                {t("dashboard_mine")}
              </button>
            </div>
            {initialLoading ? (
              <CardSkeleton rows={4} />
            ) : problems.length === 0 ? (
              <div className="py-2">
                <EmptyState message={t("empty_problems")} />
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {problems.map((problem) => (
                    <ProblemFeedRow
                      key={problem.id}
                      problem={problem}
                      sectorMap={sectorMap}
                    />
                  ))}
                </div>
                {problems.length < totalCount && (
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
        </main>

        <aside className="flex flex-col gap-4">
          <InboxCard
            notifications={notifications}
            unreadCount={unreadNotifications}
            onMarkAllRead={markAllNotificationsRead}
          />
          <PipelineCard
            incoming={incomingProjects}
            activeProjects={myProjects}
          />
        </aside>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="bg-background shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  )
}

function ProblemFeedRow({
  problem,
  sectorMap,
}: {
  problem: Problem
  sectorMap: Map<number, Sector>
}) {
  const { t, i18n } = useTranslation()
  const sector =
    problem.sector_id != null ? sectorMap.get(problem.sector_id) : null
  const lang = i18n.language?.slice(0, 2) as "uz" | "ru" | "en"
  const sectorLabel = sector
    ? (lang === "ru" ? sector.name_ru : lang === "en" ? sector.name_en : null) ??
      t(`sector_${sector.slug}` as any, sector.name_uz)
    : null

  return (
    <Link
      to="/problems/$problemId"
      params={{ problemId: problem.id }}
      className="group grid gap-3 px-4 py-4 transition-colors hover:bg-muted/50 sm:grid-cols-[48px_1fr_auto]"
    >
      <div className="hidden flex-col items-center rounded-md bg-muted/40 py-2 text-sm sm:flex">
        <ThumbsUp className="mb-1 size-4 text-muted-foreground" />
        <span className="font-medium">{problem.vote_count}</span>
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={problem.status} />
          {sector && sectorLabel && (
            <span className="text-muted-foreground text-xs">
              {sector.icon} {sectorLabel}
            </span>
          )}
        </div>
        <h3 className="truncate font-medium group-hover:underline">
          {problem.title || problem.raw_text || t("unnamed_problem")}
        </h3>
        {problem.raw_text && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
            {structuredSummary(problem) || problem.raw_text}
          </p>
        )}
      </div>
      <div className="text-muted-foreground flex items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-1 sm:hidden">
          <ThumbsUp className="size-4" />
          {problem.vote_count}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-4" />
          {problem.comment_count}
        </span>
        <span className="inline-flex items-center gap-1">
          <GitBranch className="size-4" />
          {problem.project_count}
        </span>
        <span className="rounded-md border px-3 py-1 text-xs font-medium text-foreground">
          {t("view")}
        </span>
      </div>
    </Link>
  )
}

function InboxCard({
  notifications,
  unreadCount,
  onMarkAllRead,
}: {
  notifications: NotificationItem[]
  unreadCount: number
  onMarkAllRead: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card className="bg-background shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Bell className="size-4 shrink-0" />
          <span className="truncate">{t("dashboard_inbox")}</span>
          {unreadCount > 0 && <Badge variant="secondary">{unreadCount}</Badge>}
        </CardTitle>
        <Button
          size="sm"
          variant="ghost"
          disabled={unreadCount === 0}
          onClick={onMarkAllRead}
        >
          <CheckCheck />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-2">
        {notifications.length === 0 ? (
          <EmptyState />
        ) : (
          notifications.map((notification) => {
            const link = notificationLink(notification)
            const inner = (
              <>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {notificationLabel(notification)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {shortDate(notification.created_at)}
                  </p>
                </div>
                {!notification.read_at && (
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                )}
              </>
            )
            return link ? (
              <Link
                key={notification.id}
                to={link.to as string}
                params={link.params}
                className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-muted/50"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={notification.id}
                className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
              >
                {inner}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function PipelineCard({
  incoming,
  activeProjects,
}: {
  incoming: Project[]
  activeProjects: Project[]
}) {
  const { t } = useTranslation()
  return (
    <Card className="bg-background shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <CircleDot className="size-4" />
          {t("dashboard_pipeline")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <PipelineCount
          label={t("dashboard_pipeline_inbox")}
          value={incoming.length}
        />
        <PipelineCount
          label={t("dashboard_pipeline_active")}
          value={activeProjects.length}
        />
        <div className="grid gap-2 pt-2">
          {incoming.slice(0, 3).map((project) => (
            <Link
              key={project.id}
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
            >
              <span className="block truncate font-medium">
                {project.title}
              </span>
              <span className="text-muted-foreground text-xs">
                {statusLabel(project.status)}
              </span>
            </Link>
          ))}
          {activeProjects.slice(0, 3).map((project) => (
            <Link
              key={project.id}
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
            >
              <span className="block truncate font-medium">
                {project.title}
              </span>
              <span className="text-muted-foreground text-xs">
                {statusLabel(project.status)}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PipelineCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
