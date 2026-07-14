import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Bell,
  CheckCheck,
  CircleDot,
  MessageSquare,
  Plus,
  Search,
  ThumbsUp,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { SubmitProblemDialog } from "@/components/Product/SubmitProblemDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  type AnalyticsOverview,
  apiJson,
  apiMutation,
  type NotificationItem,
  type NotificationsResponse,
  notificationLabel,
  type Problem,
  type ProblemsResponse,
  type Project,
  type ProjectsResponse,
} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [{ title: "Signal board - SignalHub" }],
  }),
})

function Dashboard() {
  const [problems, setProblems] = useState<Problem[]>([])
  const [myProcessingProblems, setMyProcessingProblems] = useState<Problem[]>(
    [],
  )
  const [incomingProjects, setIncomingProjects] = useState<Project[]>([])
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [query, setQuery] = useState("")

  const loadDashboard = useCallback(async () => {
    const [
      problemsData,
      processingData,
      incomingData,
      myProjectsData,
      analyticsData,
      notificationsData,
    ] = await Promise.all([
      apiJson<ProblemsResponse>("/problems/?status=published"),
      apiJson<ProblemsResponse>("/problems/?status=ai_processing&mine=true"),
      apiJson<ProjectsResponse>("/projects?owner=true&status=proposed"),
      apiJson<ProjectsResponse>("/projects?mine=true"),
      apiJson<AnalyticsOverview>("/analytics/overview"),
      apiJson<NotificationsResponse>("/notifications?limit=6"),
    ])
    setProblems(problemsData.data)
    setMyProcessingProblems(processingData.data)
    setIncomingProjects(incomingData.data)
    setMyProjects(
      myProjectsData.data.filter((project) =>
        ["approved", "in_progress", "piloting"].includes(project.status),
      ),
    )
    setAnalytics(analyticsData)
    setNotifications(notificationsData.data)
    setUnreadNotifications(notificationsData.unread_count)
  }, [])

  useEffect(() => {
    loadDashboard().catch(() => undefined)
  }, [loadDashboard])

  const markAllNotificationsRead = async () => {
    if (unreadNotifications === 0) return
    try {
      await apiMutation("/notifications/read", { notification_ids: [] })
      await loadDashboard()
    } catch {
      toast.error("Bildirishnomalar yangilanmadi.")
    }
  }

  const filteredProblems = problems.filter((problem) => {
    const haystack =
      `${problem.title || ""} ${problem.raw_text || ""}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="secondary">Problem marketplace</Badge>
            <span className="text-muted-foreground text-xs">API-first MVP</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Signal board
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Published muammolar, yangi takliflar va active pilotlar bitta
            operatsion oynada.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_auto] lg:w-[540px]">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="bg-background pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Muammo yoki sektor bo'yicha qidirish"
            />
          </div>
          <Button onClick={() => setSubmitOpen(true)}>
            <Plus />
            Muammo yuborish
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
              label="Published"
              value={analytics?.published_problems ?? problems.length}
            />
            <MetricCard
              label="Claimed"
              value={analytics?.claimed_problems ?? 0}
            />
            <MetricCard
              label="Solved"
              value={analytics?.solved_problems ?? 0}
            />
          </div>

          <section className="overflow-hidden rounded-lg border bg-background">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="font-medium">Live problem feed</h2>
                <p className="text-muted-foreground text-xs">
                  Ovoz, comment va claim alohida detail sahifada.
                </p>
              </div>
              <Badge variant="outline">{filteredProblems.length}</Badge>
            </div>
            {filteredProblems.length === 0 ? (
              <div className="text-muted-foreground flex min-h-56 items-center justify-center px-4 text-center text-sm">
                Hozircha mos published muammo yo'q.
              </div>
            ) : (
              <div className="divide-y">
                {filteredProblems.map((problem) => (
                  <ProblemFeedRow key={problem.id} problem={problem} />
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
            processing={myProcessingProblems}
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
    <Card className="bg-background">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  )
}

function ProblemFeedRow({ problem }: { problem: Problem }) {
  return (
    <Link
      to="/problems/$problemId"
      params={{ problemId: problem.id }}
      className="group grid gap-3 px-4 py-4 transition-colors hover:bg-muted/50 sm:grid-cols-[56px_1fr_auto]"
    >
      <div className="hidden flex-col items-center rounded-md border bg-muted/30 py-2 text-sm sm:flex">
        <ThumbsUp className="mb-1 size-4 text-muted-foreground" />
        <span className="font-medium">{problem.vote_count}</span>
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="secondary">{problem.status}</Badge>
          {problem.severity_score !== null &&
            problem.severity_score !== undefined && (
              <span className="text-muted-foreground text-xs">
                score {problem.severity_score}
              </span>
            )}
        </div>
        <h3 className="truncate font-medium group-hover:underline">
          {problem.title || problem.raw_text || "Nomsiz muammo"}
        </h3>
        {problem.raw_text && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
            {problem.raw_text}
          </p>
        )}
      </div>
      <div className="text-muted-foreground flex items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-1 sm:hidden">
          <ThumbsUp className="size-4" />
          {problem.vote_count}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-4" />0
        </span>
        <span className="rounded-md border px-3 py-1 text-xs font-medium text-foreground">
          Open
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
    <Card className="bg-background">
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
          <p className="text-muted-foreground text-sm">Inbox bo'sh.</p>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {notificationLabel(notification)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {new Date(notification.created_at).toLocaleString()}
                </p>
              </div>
              {!notification.read_at && (
                <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function PipelineCard({
  processing,
  incoming,
  activeProjects,
}: {
  processing: Problem[]
  incoming: Project[]
  activeProjects: Project[]
}) {
  return (
    <Card className="bg-background">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <CircleDot className="size-4" />
          Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <PipelineCount label="AI processing" value={processing.length} />
        <PipelineCount label="Incoming proposals" value={incoming.length} />
        <PipelineCount
          label="My active projects"
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
                Review needed
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
                {project.status}
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
