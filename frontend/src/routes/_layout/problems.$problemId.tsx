import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, MessageSquare, Rocket, ThumbsUp } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import {
  apiJson,
  apiMutation,
  type Comment,
  type CommentsResponse,
  type Problem,
  type Project,
  type ProjectsResponse,
} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/problems/$problemId")({
  component: ProblemDetail,
  head: () => ({
    meta: [{ title: "Problem detail - SignalHub" }],
  }),
})

function ProblemDetail() {
  const { problemId } = Route.useParams()
  const [problem, setProblem] = useState<Problem | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [commentText, setCommentText] = useState("")
  const [projectTitle, setProjectTitle] = useState("")
  const [projectPitch, setProjectPitch] = useState("")
  const [claiming, setClaiming] = useState(false)

  const loadProblem = useCallback(async () => {
    const [problemData, commentsData, projectsData] = await Promise.all([
      apiJson<Problem>(`/problems/${problemId}`),
      apiJson<CommentsResponse>(`/problems/${problemId}/comments`),
      apiJson<ProjectsResponse>(`/projects?problem_id=${problemId}`),
    ])
    setProblem(problemData)
    setComments(commentsData.data)
    setProjects(projectsData.data)
  }, [problemId])

  useEffect(() => {
    loadProblem().catch(() => toast.error("Muammo yuklanmadi."))
  }, [loadProblem])

  const vote = async () => {
    try {
      await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/problems/${problemId}/vote`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
        },
      )
      await loadProblem()
    } catch {
      toast.error("Ovoz berilmadi.")
    }
  }

  const addComment = async () => {
    if (!commentText.trim()) return
    try {
      await apiMutation(`/problems/${problemId}/comments`, {
        text: commentText.trim(),
      })
      setCommentText("")
      await loadProblem()
    } catch {
      toast.error("Comment yuborilmadi.")
    }
  }

  const claim = async () => {
    if (!projectTitle.trim()) return
    setClaiming(true)
    try {
      await apiMutation(`/problems/${problemId}/claim`, {
        title: projectTitle.trim(),
        pitch: projectPitch.trim() || null,
      })
      setProjectTitle("")
      setProjectPitch("")
      toast.success("Loyiha taklifi yuborildi.")
      await loadProblem()
    } catch {
      toast.error("Claim yuborilmadi.")
    } finally {
      setClaiming(false)
    }
  }

  if (!problem) {
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
              <Badge variant="secondary">{problem.status}</Badge>
              <span className="text-muted-foreground text-xs">
                {new Date(problem.created_at).toLocaleString()}
              </span>
            </div>
            <CardTitle className="text-2xl">
              {problem.title || problem.raw_text || "Nomsiz muammo"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 p-5">
            <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-6">
              {problem.raw_text ||
                "Matn kiritilmagan. Audio yoki AI transcript kutilmoqda."}
            </p>
            {problem.structured_desc && (
              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 text-sm font-medium">
                  AI structured signal
                </h3>
                <pre className="text-muted-foreground whitespace-pre-wrap text-xs">
                  {JSON.stringify(problem.structured_desc, null, 2)}
                </pre>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={vote}>
                <ThumbsUp />
                Menda ham bor · {problem.vote_count}
              </Button>
              <Badge variant="outline">
                score {problem.severity_score ?? 0}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4" />
              Comments
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="Aniqlik kiriting, tajriba qo'shing yoki savol bering."
            />
            <div className="flex justify-end">
              <Button onClick={addComment}>Comment yozish</Button>
            </div>
            <div className="divide-y rounded-md border">
              {comments.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">
                  Hozircha comment yo'q.
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="p-4">
                    <p className="text-sm">{comment.text}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {new Date(comment.created_at).toLocaleString()}
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
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket className="size-4" />
              Claim problem
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input
              value={projectTitle}
              onChange={(event) => setProjectTitle(event.target.value)}
              placeholder="Loyiha nomi"
            />
            <Textarea
              value={projectPitch}
              onChange={(event) => setProjectPitch(event.target.value)}
              placeholder="Yechim, pilot rejasi va kerakli yordam"
            />
            <LoadingButton
              loading={claiming}
              disabled={!projectTitle.trim() || problem.status !== "published"}
              onClick={claim}
            >
              Taklif yuborish
            </LoadingButton>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardHeader>
            <CardTitle className="text-base">Project proposals</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {projects.length === 0 ? (
              <p className="text-muted-foreground text-sm">Takliflar yo'q.</p>
            ) : (
              projects.map((project) => (
                <Link
                  key={project.id}
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  className="rounded-md border px-3 py-2 hover:bg-muted/50"
                >
                  <span className="block truncate text-sm font-medium">
                    {project.title}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {project.status}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
