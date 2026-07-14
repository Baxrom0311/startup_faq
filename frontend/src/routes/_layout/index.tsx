import { createFileRoute } from "@tanstack/react-router"
import {
  Bell,
  CheckCheck,
  MessageSquare,
  Plus,
  Search,
  Target,
  ThumbsUp,
  TrendingUp,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import useAuth from "@/hooks/useAuth"

type Problem = {
  id: string
  title?: string | null
  raw_text?: string | null
  status: string
  vote_count: number
  severity_score?: number | null
  created_at: string
}

type ProblemsResponse = {
  data: Problem[]
  count: number
}

type Project = {
  id: string
  problem_id: string
  lead_id: string
  title: string
  pitch?: string | null
  repo_url?: string | null
  status: string
  created_at: string
}

type ProjectsResponse = {
  data: Project[]
  count: number
}

type AnalyticsOverview = {
  submitted_problems: number
  published_problems: number
  claimed_problems: number
  piloting_problems: number
  solved_problems: number
  proposed_projects: number
  active_projects: number
  completed_projects: number
  problem_to_claim_rate: number
  claim_to_solved_rate: number
}

type NotificationItem = {
  id: string
  type: string
  payload: Record<string, unknown>
  read_at?: string | null
  created_at: string
}

type NotificationsResponse = {
  data: NotificationItem[]
  count: number
  unread_count: number
}

type PresignResponse = {
  upload_url: string
  object_key: string
  method: string
}

const API_BASE = import.meta.env.VITE_API_URL

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "Muammolar - Platforma",
      },
    ],
  }),
})

function Dashboard() {
  const { user: currentUser } = useAuth()
  const [problems, setProblems] = useState<Problem[]>([])
  const [myProcessingProblems, setMyProcessingProblems] = useState<Problem[]>(
    [],
  )
  const [incomingProjects, setIncomingProjects] = useState<Project[]>([])
  const [pilotingProjectsForReview, setPilotingProjectsForReview] = useState<
    Project[]
  >([])
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [count, setCount] = useState(0)
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [claimProblem, setClaimProblem] = useState<Problem | null>(null)
  const [rawText, setRawText] = useState("")
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [projectTitle, setProjectTitle] = useState("")
  const [projectPitch, setProjectPitch] = useState("")
  const [completeProject, setCompleteProject] = useState<Project | null>(null)
  const [reviewRating, setReviewRating] = useState("5")
  const [reviewText, setReviewText] = useState("")
  const [milestoneTitleByProject, setMilestoneTitleByProject] = useState<
    Record<string, string>
  >({})
  const [updateTextByProject, setUpdateTextByProject] = useState<
    Record<string, string>
  >({})
  const [submitting, setSubmitting] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [reviewingProjectId, setReviewingProjectId] = useState<string | null>(
    null,
  )

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
    }),
    [],
  )

  const loadProblems = useCallback(async () => {
    const response = await fetch(
      `${API_BASE}/api/v1/problems/?status=published`,
      {
        headers: authHeaders(),
      },
    )
    if (!response.ok) return
    const data = (await response.json()) as ProblemsResponse
    setProblems(data.data)
    setCount(data.count)
  }, [authHeaders])

  const loadMyProcessingProblems = useCallback(async () => {
    const response = await fetch(
      `${API_BASE}/api/v1/problems/?status=ai_processing&mine=true`,
      { headers: authHeaders() },
    )
    if (!response.ok) return
    const data = (await response.json()) as ProblemsResponse
    setMyProcessingProblems(data.data)
  }, [authHeaders])

  const loadIncomingProjects = useCallback(async () => {
    const response = await fetch(
      `${API_BASE}/api/v1/projects?owner=true&status=proposed`,
      { headers: authHeaders() },
    )
    if (!response.ok) return
    const data = (await response.json()) as ProjectsResponse
    setIncomingProjects(data.data)
  }, [authHeaders])

  const loadPilotingProjectsForReview = useCallback(async () => {
    const response = await fetch(
      `${API_BASE}/api/v1/projects?owner=true&status=piloting`,
      { headers: authHeaders() },
    )
    if (!response.ok) return
    const data = (await response.json()) as ProjectsResponse
    setPilotingProjectsForReview(data.data)
  }, [authHeaders])

  const loadMyProjects = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/v1/projects?mine=true`, {
      headers: authHeaders(),
    })
    if (!response.ok) return
    const data = (await response.json()) as ProjectsResponse
    setMyProjects(
      data.data.filter((project) =>
        ["approved", "in_progress", "piloting"].includes(project.status),
      ),
    )
  }, [authHeaders])

  const loadAnalytics = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/v1/analytics/overview`, {
      headers: authHeaders(),
    })
    if (!response.ok) return
    const data = (await response.json()) as AnalyticsOverview
    setAnalytics(data)
  }, [authHeaders])

  const loadNotifications = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/v1/notifications?limit=5`, {
      headers: authHeaders(),
    })
    if (!response.ok) return
    const data = (await response.json()) as NotificationsResponse
    setNotifications(data.data)
    setUnreadNotifications(data.unread_count)
  }, [authHeaders])

  useEffect(() => {
    loadProblems()
    loadMyProcessingProblems()
    loadIncomingProjects()
    loadPilotingProjectsForReview()
    loadMyProjects()
    loadAnalytics()
    loadNotifications()
  }, [
    loadPilotingProjectsForReview,
    loadMyProjects,
    loadProblems,
    loadIncomingProjects,
    loadMyProcessingProblems,
    loadAnalytics,
    loadNotifications,
  ])

  const markAllNotificationsRead = async () => {
    if (unreadNotifications === 0) return
    const response = await fetch(`${API_BASE}/api/v1/notifications/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ notification_ids: [] }),
    })
    if (!response.ok) {
      toast.error("Bildirishnomalar yangilanmadi.")
      return
    }
    await loadNotifications()
  }

  const uploadAudio = async (file: File): Promise<string> => {
    const presignResponse = await fetch(`${API_BASE}/api/v1/media/presign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        kind: "audio",
        content_type: file.type,
        size: file.size,
      }),
    })
    if (!presignResponse.ok) {
      throw new Error("Audio yuklashga tayyorlab bo'lmadi.")
    }
    const presign = (await presignResponse.json()) as PresignResponse
    const uploadResponse = await fetch(presign.upload_url, {
      method: presign.method,
      headers: { "Content-Type": file.type },
      body: file,
    })
    if (!uploadResponse.ok) {
      throw new Error("Audio fayl yuklanmadi.")
    }
    return presign.object_key
  }

  const submitProblem = async () => {
    if (submitting || (rawText.trim().length === 0 && !audioFile)) return
    setSubmitting(true)
    try {
      const rawAudioKey = audioFile ? await uploadAudio(audioFile) : null
      const response = await fetch(`${API_BASE}/api/v1/problems/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          raw_text: rawText.trim() || null,
          raw_audio_key: rawAudioKey,
        }),
      })
      if (!response.ok) {
        throw new Error("Muammo yuborilmadi. Qaytadan urinib ko'ring.")
      }
      setRawText("")
      setAudioFile(null)
      setSubmitOpen(false)
      toast.success("Muammo qabul qilindi va AI tekshiruvga yuborildi.")
      await Promise.all([loadMyProcessingProblems(), loadAnalytics()])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xatolik yuz berdi.")
    } finally {
      setSubmitting(false)
    }
  }

  const submitClaim = async () => {
    if (!claimProblem || claiming || projectTitle.trim().length === 0) return
    setClaiming(true)
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/problems/${claimProblem.id}/claim`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({
            title: projectTitle.trim(),
            pitch: projectPitch.trim() || null,
          }),
        },
      )
      if (!response.ok) {
        throw new Error("Loyiha taklifi yuborilmadi.")
      }
      setClaimProblem(null)
      setProjectTitle("")
      setProjectPitch("")
      toast.success("Loyiha taklifi yuborildi. Muammo egasi tasdiqlashi kerak.")
      await Promise.all([loadMyProjects(), loadNotifications()])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xatolik yuz berdi.")
    } finally {
      setClaiming(false)
    }
  }

  const reviewProject = async (
    projectId: string,
    action: "approve" | "reject",
  ) => {
    if (reviewingProjectId) return
    setReviewingProjectId(projectId)
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/projects/${projectId}/${action}`,
        {
          method: "POST",
          headers: authHeaders(),
        },
      )
      if (!response.ok) {
        throw new Error("Taklif holatini o'zgartirib bo'lmadi.")
      }
      toast.success(
        action === "approve" ? "Loyiha tasdiqlandi." : "Loyiha rad etildi.",
      )
      await Promise.all([
        loadIncomingProjects(),
        loadProblems(),
        loadAnalytics(),
        loadNotifications(),
      ])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xatolik yuz berdi.")
    } finally {
      setReviewingProjectId(null)
    }
  }

  const startPiloting = async (projectId: string) => {
    const response = await fetch(
      `${API_BASE}/api/v1/projects/${projectId}/start-piloting`,
      {
        method: "POST",
        headers: authHeaders(),
      },
    )
    if (!response.ok) {
      toast.error("Pilot boshlanmadi.")
      return
    }
    toast.success("Pilot bosqichi boshlandi.")
    await Promise.all([loadMyProjects(), loadNotifications()])
  }

  const submitCompletionReview = async () => {
    if (!completeProject) return
    const response = await fetch(
      `${API_BASE}/api/v1/projects/${completeProject.id}/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          rating: Number(reviewRating),
          text: reviewText.trim() || null,
        }),
      },
    )
    if (!response.ok) {
      toast.error("Review yuborilmadi.")
      return
    }
    setCompleteProject(null)
    setReviewRating("5")
    setReviewText("")
    toast.success("Loyiha yakunlandi va muammo solved bo'ldi.")
    await Promise.all([
      loadPilotingProjectsForReview(),
      loadProblems(),
      loadAnalytics(),
      loadNotifications(),
    ])
  }

  const addMilestone = async (projectId: string) => {
    const title = milestoneTitleByProject[projectId]?.trim()
    if (!title) return
    const response = await fetch(
      `${API_BASE}/api/v1/projects/${projectId}/milestones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ title, status: "todo" }),
      },
    )
    if (!response.ok) {
      toast.error("Milestone qo'shilmadi.")
      return
    }
    setMilestoneTitleByProject((current) => ({ ...current, [projectId]: "" }))
    toast.success("Milestone qo'shildi.")
  }

  const addProjectUpdate = async (projectId: string) => {
    const text = updateTextByProject[projectId]?.trim()
    if (!text) return
    const response = await fetch(
      `${API_BASE}/api/v1/projects/${projectId}/updates`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ text, media_keys: [] }),
      },
    )
    if (!response.ok) {
      toast.error("Update qo'shilmadi.")
      return
    }
    setUpdateTextByProject((current) => ({ ...current, [projectId]: "" }))
    toast.success("Update qo'shildi.")
  }

  const notificationLabel = (notification: NotificationItem) => {
    const title =
      typeof notification.payload.project_title === "string"
        ? notification.payload.project_title
        : "Loyiha"
    const labels: Record<string, string> = {
      "project.proposed": `${title} bo'yicha yangi taklif`,
      "project.approved": `${title} tasdiqlandi`,
      "project.rejected": `${title} rad etildi`,
      "project.piloting_started": `${title} pilotga o'tdi`,
      "project.completed": `${title} yakunlandi`,
    }
    return labels[notification.type] || notification.type
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="secondary">Problem marketplace</Badge>
            <span className="text-muted-foreground text-xs">
              {currentUser?.full_name || currentUser?.email}
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Signal board
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Tasdiqlangan muammolar, loyiha takliflari va pilot jarayonlari bitta
            operatsion oynada.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_auto] lg:w-[520px]">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="bg-background pl-9"
              placeholder="Muammo, sektor yoki hudud"
            />
          </div>
          <Button onClick={() => setSubmitOpen(true)}>
            <Plus />
            Muammo yuborish
          </Button>
        </div>
      </div>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Muammo yuborish</DialogTitle>
            <DialogDescription>
              Real vaziyatni aniq yozing. AI keyin uni sarlavha, sektor va
              signalga ajratadi.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="raw-text">
              Muammo matni
            </label>
            <Textarea
              id="raw-text"
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder="Masalan: issiqxonada namlikni doimiy kuzatish qiyin, uskunalar qimmat..."
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="audio-file">
              Audio
            </label>
            <Input
              id="audio-file"
              accept="audio/*"
              type="file"
              onChange={(event) =>
                setAudioFile(event.target.files?.[0] || null)
              }
            />
            {audioFile && (
              <p className="text-muted-foreground truncate text-xs">
                {audioFile.name}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubmitOpen(false)}
            >
              Bekor qilish
            </Button>
            <LoadingButton
              type="button"
              loading={submitting}
              disabled={rawText.trim().length === 0 && !audioFile}
              onClick={submitProblem}
            >
              Yuborish
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={completeProject !== null}
        onOpenChange={(open) => {
          if (!open) setCompleteProject(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loyihani baholash</DialogTitle>
            <DialogDescription>
              Pilot natijasini baholang. Tasdiqlangach muammo solved bo'ladi.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="review-rating">
                Baho
              </label>
              <Input
                id="review-rating"
                min="1"
                max="5"
                type="number"
                value={reviewRating}
                onChange={(event) => setReviewRating(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="review-text">
                Izoh
              </label>
              <Textarea
                id="review-text"
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                placeholder="Pilot natijasi, foydasi va kamchiliklari"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCompleteProject(null)}
            >
              Bekor qilish
            </Button>
            <Button type="button" onClick={submitCompletionReview}>
              Solved qilish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={claimProblem !== null}
        onOpenChange={(open) => {
          if (!open) setClaimProblem(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loyiha taklif qilish</DialogTitle>
            <DialogDescription>
              Qanday yechim qurishingizni va pilotni qanday boshlashingizni
              yozing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="project-title">
                Loyiha nomi
              </label>
              <Input
                id="project-title"
                value={projectTitle}
                onChange={(event) => setProjectTitle(event.target.value)}
                placeholder="Masalan: Aqlli namlik monitoringi"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="project-pitch">
                Pitch
              </label>
              <Textarea
                id="project-pitch"
                value={projectPitch}
                onChange={(event) => setProjectPitch(event.target.value)}
                placeholder="Yechim, birinchi pilot va kerakli yordam haqida qisqa yozing."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setClaimProblem(null)}
            >
              Bekor qilish
            </Button>
            <LoadingButton
              type="button"
              loading={claiming}
              disabled={projectTitle.trim().length === 0}
              onClick={submitClaim}
            >
              Taklif yuborish
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="bg-background">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Target className="text-muted-foreground size-4" />
              Published
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {analytics?.published_problems ?? count}
          </CardContent>
        </Card>
        <Card className="bg-background">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="text-muted-foreground size-4" />
              Claimed
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {analytics?.claimed_problems ?? 0}
          </CardContent>
        </Card>
        <Card className="bg-background">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CheckCheck className="text-muted-foreground size-4" />
              Solved
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {analytics?.solved_problems ?? 0}
          </CardContent>
        </Card>
      </div>

      {analytics && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Submitted</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {analytics.submitted_problems}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Active projects
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {analytics.active_projects}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Claim rate</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {Math.round(analytics.problem_to_claim_rate * 100)}%
            </CardContent>
          </Card>
        </div>
      )}

      {notifications.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Bell className="size-4 shrink-0" />
              <span className="truncate">Bildirishnomalar</span>
              {unreadNotifications > 0 && (
                <Badge variant="secondary">{unreadNotifications}</Badge>
              )}
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              disabled={unreadNotifications === 0}
              onClick={markAllNotificationsRead}
            >
              <CheckCheck />
              O'qildi
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {notifications.map((notification) => (
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
                  <span className="bg-primary mt-1 size-2 shrink-0 rounded-full" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {myProcessingProblems.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">AI tekshiruvdagi muammolarim</h2>
          {myProcessingProblems.map((problem) => (
            <Card key={problem.id}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <h3 className="truncate font-medium">
                    {problem.raw_text || "Nomsiz muammo"}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    AI strukturalash, dedup va scoring navbatida.
                  </p>
                </div>
                <Badge variant="secondary">{problem.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {incomingProjects.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            Menga kelgan loyiha takliflari
          </h2>
          {incomingProjects.map((project) => (
            <Card key={project.id}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{project.title}</h3>
                    {project.pitch && (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                        {project.pitch}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary">{project.status}</Badge>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reviewingProjectId === project.id}
                    onClick={() => reviewProject(project.id, "reject")}
                  >
                    Rad etish
                  </Button>
                  <LoadingButton
                    size="sm"
                    loading={reviewingProjectId === project.id}
                    onClick={() => reviewProject(project.id, "approve")}
                  >
                    Tasdiqlash
                  </LoadingButton>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pilotingProjectsForReview.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Pilotdagi loyihalar</h2>
          {pilotingProjectsForReview.map((project) => (
            <Card key={project.id}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <h3 className="truncate font-medium">{project.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Pilot tugagan bo'lsa review qoldiring.
                  </p>
                </div>
                <Button size="sm" onClick={() => setCompleteProject(project)}>
                  Review
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {myProjects.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Yuritayotgan loyihalarim</h2>
          {myProjects.map((project) => (
            <Card key={project.id}>
              <CardContent className="flex flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{project.title}</h3>
                    {project.pitch && (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                        {project.pitch}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary">{project.status}</Badge>
                </div>

                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <Input
                    value={milestoneTitleByProject[project.id] || ""}
                    onChange={(event) =>
                      setMilestoneTitleByProject((current) => ({
                        ...current,
                        [project.id]: event.target.value,
                      }))
                    }
                    placeholder="Keyingi milestone"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addMilestone(project.id)}
                  >
                    Milestone qo'shish
                  </Button>
                </div>

                <div className="grid gap-2">
                  <Textarea
                    value={updateTextByProject[project.id] || ""}
                    onChange={(event) =>
                      setUpdateTextByProject((current) => ({
                        ...current,
                        [project.id]: event.target.value,
                      }))
                    }
                    placeholder="Bugun loyiha bo'yicha nima o'zgardi?"
                  />
                  <div className="flex justify-end">
                    {project.status !== "piloting" && (
                      <Button
                        className="mr-2"
                        type="button"
                        variant="outline"
                        onClick={() => startPiloting(project.id)}
                      >
                        Pilot boshlash
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={() => addProjectUpdate(project.id)}
                    >
                      Update yozish
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {problems.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground flex min-h-40 items-center justify-center text-center text-sm">
              Hozircha published muammo yo'q. Birinchi muammo AI tekshiruvdan
              o'tgach shu yerda ko'rinadi.
            </CardContent>
          </Card>
        ) : (
          problems.map((problem) => (
            <Card key={problem.id}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate font-medium">
                      {problem.title || problem.raw_text || "Nomsiz muammo"}
                    </h2>
                    {problem.raw_text && (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                        {problem.raw_text}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary">{problem.status}</Badge>
                </div>
                <div className="text-muted-foreground flex items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="size-4" />
                    {problem.vote_count}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="size-4" />0
                  </span>
                  <Button
                    className="ml-auto"
                    size="sm"
                    variant="outline"
                    onClick={() => setClaimProblem(problem)}
                  >
                    Claim
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
