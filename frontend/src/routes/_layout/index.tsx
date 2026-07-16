import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Bell,
  CheckCheck,
  CircleDot,
  GitBranch,
  MessageSquare,
  Plus,
  Search,
  ThumbsUp,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { CardSkeleton, EmptyState, StatusBadge } from "@/components/Product/StatusBadge"
import { SubmitProblemDialog } from "@/components/Product/SubmitProblemDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  type AnalyticsOverview,
  apiJson,
  apiMutation,
  fetchSectors,
  type NotificationItem,
  type NotificationsResponse,
  notificationLabel,
  notificationLink,
  type Problem,
  type ProblemsResponse,
  type Project,
  type ProjectsResponse,
  type Sector,
  shortDate,
  statusLabel,
  structuredSummary,
} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [{ title: "Signal board - SignalHub" }],
  }),
})

function Dashboard() {
  const [problems, setProblems] = useState<Problem[]>([])
  const [incomingProjects, setIncomingProjects] = useState<Project[]>([])
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [sectors, setSectors] = useState<Sector[]>([])
  const [activeSector, setActiveSector] = useState<number | null>(null)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    fetchSectors()
      .then(setSectors)
      .catch(() => undefined)
  }, [])

  const loadDashboard = useCallback(async () => {
    const searchParam = query.trim()
      ? `&q=${encodeURIComponent(query.trim())}`
      : ""
    const sectorParam = activeSector != null ? `&sector_id=${activeSector}` : ""
    const [
      problemsData,
      incomingData,
      myProjectsData,
      analyticsData,
      notificationsData,
    ] = await Promise.all([
      apiJson<ProblemsResponse>(`/problems/?status=published${searchParam}${sectorParam}`),
      apiJson<ProjectsResponse>("/projects?owner=true&status=proposed"),
      apiJson<ProjectsResponse>("/projects?mine=true"),
      apiJson<AnalyticsOverview>("/analytics/overview"),
      apiJson<NotificationsResponse>("/notifications?limit=6"),
    ])
    setProblems(problemsData.data)
    setIncomingProjects(incomingData.data)
    setMyProjects(
      myProjectsData.data.filter((project) =>
        ["approved", "in_progress", "piloting"].includes(project.status),
      ),
    )
    setAnalytics(analyticsData)
    setNotifications(notificationsData.data)
    setUnreadNotifications(notificationsData.unread_count)
  }, [query, activeSector])

  useEffect(() => {
    loadDashboard()
      .catch(() => undefined)
      .finally(() => setInitialLoading(false))
  }, [loadDashboard])

  const sectorMap = new Map(sectors.map((s) => [s.id, s]))

  const markAllNotificationsRead = async () => {
    if (unreadNotifications === 0) return
    try {
      await apiMutation("/notifications/read", { notification_ids: [] })
      await loadDashboard()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bildirishnomalarni o'qilgan sifatida belgilab bo'lmadi")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="secondary">Beta</Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Signals</h1>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_auto] lg:w-[540px]">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="bg-background pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
            />
          </div>
          <Button onClick={() => setSubmitOpen(true)}>
            <Plus />
            New
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
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Ochiq"
              value={analytics?.published_problems ?? problems.length}
            />
            <MetricCard
              label="Hal qilinayotgan"
              value={analytics?.piloting_problems ?? 0}
            />
            <MetricCard
              label="Hal qilindi"
              value={analytics?.solved_problems ?? 0}
            />
          </div>

          {sectors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveSector(null)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  activeSector === null
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted/50"
                }`}
              >
                Hammasi
              </button>
              {sectors.map((sector) => (
                <button
                  key={sector.id}
                  onClick={() =>
                    setActiveSector(activeSector === sector.id ? null : sector.id)
                  }
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    activeSector === sector.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  {sector.icon} {sector.name_uz}
                </button>
              ))}
            </div>
          )}

          <section className="overflow-hidden rounded-lg border bg-background shadow-none">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-medium">Feed</h2>
              {!initialLoading && (
                <Badge variant="outline">{problems.length}</Badge>
              )}
            </div>
            {initialLoading ? (
              <CardSkeleton rows={4} />
            ) : problems.length === 0 ? (
              <div className="py-2">
                <EmptyState message="Hozircha muammolar yo'q" />
              </div>
            ) : (
              <div className="divide-y">
                {problems.map((problem) => (
                  <ProblemFeedRow
                    key={problem.id}
                    problem={problem}
                    sectorMap={sectorMap}
                  />
                ))}
              </div>
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
  const sector = problem.sector_id != null ? sectorMap.get(problem.sector_id) : null
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
          {sector && (
            <span className="text-muted-foreground text-xs">
              {sector.icon} {sector.name_uz}
            </span>
          )}
        </div>
        <h3 className="truncate font-medium group-hover:underline">
          {problem.title || problem.raw_text || "Nomsiz muammo"}
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
          View
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
  return (
    <Card className="bg-background shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Bell className="size-4 shrink-0" />
          <span className="truncate">Inbox</span>
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
  return (
    <Card className="bg-background shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <CircleDot className="size-4" />
          Flow
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <PipelineCount label="Inbox" value={incoming.length} />
        <PipelineCount label="Active" value={activeProjects.length} />
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
