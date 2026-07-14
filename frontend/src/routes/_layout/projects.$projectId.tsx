import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, CheckCircle2, GitBranch, Send, XCircle } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  apiJson,
  apiMutation,
  type Problem,
  type Project,
  type ProjectMilestone,
  type ProjectMilestonesResponse,
  type ProjectUpdate,
  type ProjectUpdatesResponse,
} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/projects/$projectId")({
  component: ProjectDetail,
  head: () => ({
    meta: [{ title: "Project detail - SignalHub" }],
  }),
})

function ProjectDetail() {
  const { projectId } = Route.useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([])
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [milestoneTitle, setMilestoneTitle] = useState("")
  const [updateText, setUpdateText] = useState("")
  const [reviewRating, setReviewRating] = useState("5")
  const [reviewText, setReviewText] = useState("")

  const loadProject = useCallback(async () => {
    const projectData = await apiJson<Project>(`/projects/${projectId}`)
    const [problemData, milestonesData, updatesData] = await Promise.all([
      apiJson<Problem>(`/problems/${projectData.problem_id}`),
      apiJson<ProjectMilestonesResponse>(`/projects/${projectId}/milestones`),
      apiJson<ProjectUpdatesResponse>(`/projects/${projectId}/updates`),
    ])
    setProject(projectData)
    setProblem(problemData)
    setMilestones(milestonesData.data)
    setUpdates(updatesData.data)
  }, [projectId])

  useEffect(() => {
    loadProject().catch(() => toast.error("Loyiha yuklanmadi."))
  }, [loadProject])

  const mutateProject = async (path: string, success: string) => {
    try {
      await apiMutation(path)
      toast.success(success)
      await loadProject()
    } catch {
      toast.error("Amal bajarilmadi.")
    }
  }

  const addMilestone = async () => {
    if (!milestoneTitle.trim()) return
    try {
      await apiMutation(`/projects/${projectId}/milestones`, {
        title: milestoneTitle.trim(),
        status: "todo",
      })
      setMilestoneTitle("")
      await loadProject()
    } catch {
      toast.error("Milestone qo'shilmadi.")
    }
  }

  const addUpdate = async () => {
    if (!updateText.trim()) return
    try {
      await apiMutation(`/projects/${projectId}/updates`, {
        text: updateText.trim(),
        media_keys: [],
      })
      setUpdateText("")
      await loadProject()
    } catch {
      toast.error("Update qo'shilmadi.")
    }
  }

  const complete = async () => {
    try {
      await apiMutation(`/projects/${projectId}/complete`, {
        rating: Number(reviewRating),
        text: reviewText.trim() || null,
      })
      toast.success("Loyiha yakunlandi.")
      await loadProject()
    } catch {
      toast.error("Review yuborilmadi.")
    }
  }

  if (!project) {
    return (
      <div className="text-muted-foreground flex min-h-96 items-center justify-center text-sm">
        Yuklanmoqda...
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <main className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit" asChild>
          <Link to="/">
            <ArrowLeft />
            Signal board
          </Link>
        </Button>

        <Card className="bg-background">
          <CardHeader className="border-b">
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="secondary">{project.status}</Badge>
              <span className="text-muted-foreground text-xs">
                {new Date(project.created_at).toLocaleString()}
              </span>
            </div>
            <CardTitle className="text-2xl">{project.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 p-5">
            {project.pitch && (
              <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-6">
                {project.pitch}
              </p>
            )}
            {problem && (
              <Link
                to="/problems/$problemId"
                params={{ problemId: problem.id }}
                className="rounded-md border bg-muted/30 p-4 hover:bg-muted/50"
              >
                <span className="block text-sm font-medium">
                  Linked problem
                </span>
                <span className="text-muted-foreground mt-1 block truncate text-sm">
                  {problem.title || problem.raw_text || "Nomsiz muammo"}
                </span>
              </Link>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  mutateProject(
                    `/projects/${projectId}/approve`,
                    "Loyiha tasdiqlandi.",
                  )
                }
              >
                <CheckCircle2 />
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  mutateProject(
                    `/projects/${projectId}/reject`,
                    "Loyiha rad etildi.",
                  )
                }
              >
                <XCircle />
                Reject
              </Button>
              <Button
                onClick={() =>
                  mutateProject(
                    `/projects/${projectId}/start-piloting`,
                    "Pilot boshlandi.",
                  )
                }
              >
                <GitBranch />
                Start pilot
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardHeader>
            <CardTitle className="text-base">Updates</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Textarea
              value={updateText}
              onChange={(event) => setUpdateText(event.target.value)}
              placeholder="Bugun loyiha bo'yicha nima o'zgardi?"
            />
            <div className="flex justify-end">
              <Button onClick={addUpdate}>
                <Send />
                Update yozish
              </Button>
            </div>
            <div className="divide-y rounded-md border">
              {updates.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">
                  Hozircha update yo'q.
                </p>
              ) : (
                updates.map((update) => (
                  <div key={update.id} className="p-4">
                    <p className="text-sm">{update.text}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {new Date(update.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <aside className="flex flex-col gap-4">
        <Card className="bg-background">
          <CardHeader>
            <CardTitle className="text-base">Milestones</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              <Input
                value={milestoneTitle}
                onChange={(event) => setMilestoneTitle(event.target.value)}
                placeholder="Keyingi milestone"
              />
              <Button variant="outline" onClick={addMilestone}>
                Milestone qo'shish
              </Button>
            </div>
            <div className="grid gap-2">
              {milestones.length === 0 ? (
                <p className="text-muted-foreground text-sm">Milestone yo'q.</p>
              ) : (
                milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="rounded-md border px-3 py-2"
                  >
                    <p className="truncate text-sm font-medium">
                      {milestone.title}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {milestone.status}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardHeader>
            <CardTitle className="text-base">Complete pilot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input
              min="1"
              max="5"
              type="number"
              value={reviewRating}
              onChange={(event) => setReviewRating(event.target.value)}
            />
            <Textarea
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              placeholder="Pilot natijasi, foydasi va kamchiliklari"
            />
            <Button disabled={project.status !== "piloting"} onClick={complete}>
              Solved qilish
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
