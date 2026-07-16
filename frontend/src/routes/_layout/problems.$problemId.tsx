import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  MessageSquare,
  RefreshCcw,
  Rocket,
  ThumbsUp,
  Volume2,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  EmptyState,
  LoadingState,
  StatusBadge,
} from "@/components/Product/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import useAuth from "@/hooks/useAuth"
import {
  type AIAnalysis,
  type AIAnalysisResponse,
  actionProblem,
  apiJson,
  apiMutation,
  type Comment,
  type CommentsResponse,
  fetchRegions,
  fetchSectors,
  type Problem,
  type ProblemMedia,
  type ProblemMediaResponse,
  type Project,
  type ProjectsResponse,
  type Region,
  type Sector,
  shortDate,
  statusLabel,
  structuredSummary,
} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/problems/$problemId")({
  component: ProblemDetail,
  head: () => ({
    meta: [{ title: "Problem detail - SignalHub" }],
  }),
})

function ProblemDetail() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { problemId } = Route.useParams()
  const [problem, setProblem] = useState<Problem | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [media, setMedia] = useState<ProblemMedia[]>([])
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)
  const [sectors, setSectors] = useState<Sector[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [commentText, setCommentText] = useState("")
  const [projectTitle, setProjectTitle] = useState("")
  const [projectPitch, setProjectPitch] = useState("")
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    fetchSectors()
      .then(setSectors)
      .catch(() => undefined)
    fetchRegions()
      .then(setRegions)
      .catch(() => undefined)
  }, [])

  const loadProblem = useCallback(async () => {
    const [problemData, commentsData, projectsData, mediaData] =
      await Promise.all([
        apiJson<Problem>(`/problems/${problemId}`),
        apiJson<CommentsResponse>(`/problems/${problemId}/comments`),
        apiJson<ProjectsResponse>(`/projects?problem_id=${problemId}`),
        apiJson<ProblemMediaResponse>(`/problems/${problemId}/media`),
      ])
    setProblem(problemData)
    setComments(commentsData.data)
    setProjects(projectsData.data)
    setMedia(mediaData.data)
    if (user?.is_superuser) {
      try {
        const analysisData = await apiJson<AIAnalysisResponse>(
          `/problems/${problemId}/analyses`,
        )
        setAnalysis(analysisData.data[0] || null)
      } catch {
        setAnalysis(null)
      }
    }
  }, [problemId, user?.is_superuser])

  useEffect(() => {
    loadProblem().catch((err: unknown) =>
      toast.error(err instanceof Error ? err.message : t("error_load_problem")),
    )
  }, [loadProblem, t])

  const vote = async () => {
    if (!problem) return
    try {
      await apiJson(`/problems/${problemId}/vote`, {
        method: problem.has_voted ? "DELETE" : "PUT",
      })
      await loadProblem()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_vote"))
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_comment_add"))
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
      toast.success(t("problem_proposal_sent"))
      await loadProblem()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_request"))
    } finally {
      setClaiming(false)
    }
  }

  const runProblemAction = async (
    action: "publish" | "archive" | "solve" | "reanalyze",
  ) => {
    try {
      await actionProblem(problemId, action)
      toast.success(t("problem_action_done"))
      await loadProblem()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error_generic"))
    }
  }

  if (!problem) {
    return <LoadingState />
  }

  const canClaim =
    problem.status === "published" && user?.id !== problem.author_id && !!user
  const canSolve =
    !!user &&
    (user.is_superuser || user.id === problem.author_id) &&
    problem.status !== "solved" &&
    problem.status !== "archived"
  const canPublish =
    !!user?.is_superuser &&
    ["draft", "needs_review", "ai_processing"].includes(problem.status)
  const canArchive = !!user?.is_superuser && problem.status !== "archived"
  const canReanalyze =
    !!user?.is_superuser &&
    problem.status !== "archived" &&
    problem.status !== "solved" &&
    problem.status !== "ai_processing"
  const sector =
    problem.sector_id != null
      ? (sectors.find((s) => s.id === problem.sector_id) ?? null)
      : null
  const region =
    problem.region_id != null
      ? (regions.find((r) => r.id === problem.region_id) ?? null)
      : null
  const audio = media.filter((item) => item.kind === "audio")
  const photos = media.filter((item) => item.kind === "photo")

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <main className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit" asChild>
          <Link to="/">
            <ArrowLeft />
            {t("problem_back")}
          </Link>
        </Button>

        {problem.duplicate_of && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
            <p className="font-medium">{t("problem_merged_note")}</p>
            <Link
              to="/problems/$problemId"
              params={{ problemId: problem.duplicate_of }}
              className="flex shrink-0 items-center gap-1 text-sm font-medium hover:underline"
            >
              {t("problem_merged_link")}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}

        <Card className="bg-background shadow-none">
          <CardHeader className="border-b">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={problem.status} />
              {sector && (
                <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
                  {sector.icon}{" "}
                  {t(`sector_${sector.slug}` as any, sector.name_uz)}
                </span>
              )}
              {region && (
                <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
                  📍 {region.name}
                </span>
              )}
              <span className="text-muted-foreground text-xs">
                {shortDate(problem.created_at)}
              </span>
            </div>
            <CardTitle className="break-words text-2xl">
              {problem.title || problem.raw_text || t("unnamed_problem")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 p-5">
            {problem.raw_text && (
              <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-6">
                {problem.raw_text}
              </p>
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
            {structuredSummary(problem) && (
              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 text-sm font-medium">AI</h3>
                <p className="text-muted-foreground text-sm">
                  {structuredSummary(problem)}
                </p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={problem.has_voted ? "default" : "outline"}
                onClick={vote}
              >
                <ThumbsUp />
                {problem.vote_count}
              </Button>
              <Badge variant="outline">{problem.severity_score ?? 0}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4" />
              {t("problem_discuss")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder={t("problem_comment_placeholder")}
            />
            <div className="flex justify-end">
              <Button onClick={addComment}>{t("problem_send")}</Button>
            </div>
            <div className="divide-y rounded-md border">
              {comments.length === 0 ? (
                <div className="p-4">
                  <EmptyState />
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="p-4">
                    <p className="text-sm">{comment.text}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {shortDate(comment.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <aside className="flex flex-col gap-4">
        {(canPublish || canArchive || canSolve || canReanalyze) && (
          <Card className="bg-background shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                {t("problem_actions")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {canPublish && (
                <Button onClick={() => runProblemAction("publish")}>
                  <Check />
                  {t("problem_publish")}
                </Button>
              )}
              {canSolve && (
                <Button
                  variant="outline"
                  onClick={() => runProblemAction("solve")}
                >
                  <CheckCircle2 />
                  {t("problem_solve")}
                </Button>
              )}
              {canReanalyze && (
                <Button
                  variant="outline"
                  onClick={() => runProblemAction("reanalyze")}
                >
                  <RefreshCcw />
                  {t("problem_reanalyze")}
                </Button>
              )}
              {canArchive && (
                <Button
                  variant="outline"
                  onClick={() => runProblemAction("archive")}
                >
                  <Archive />
                  {t("problem_archive")}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {user?.is_superuser && analysis && <AIPanel analysis={analysis} />}

        {canClaim && (
          <Card className="bg-background shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Rocket className="size-4" />
                {t("problem_claim_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input
                value={projectTitle}
                onChange={(event) => setProjectTitle(event.target.value)}
                placeholder={t("problem_claim_name")}
              />
              <Textarea
                value={projectPitch}
                onChange={(event) => setProjectPitch(event.target.value)}
                placeholder={t("problem_claim_pitch")}
              />
              <LoadingButton
                loading={claiming}
                disabled={!projectTitle.trim()}
                onClick={claim}
              >
                {t("problem_send_proposal")}
              </LoadingButton>
            </CardContent>
          </Card>
        )}

        <Card className="bg-background shadow-none">
          <CardHeader>
            <CardTitle className="text-base">
              {t("problem_projects_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {projects.length === 0 ? (
              <EmptyState />
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
                    {statusLabel(project.status)}
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

function AIPanel({ analysis }: { analysis: AIAnalysis }) {
  const { t } = useTranslation()
  const structured = analysis.summary_json.structured
  const duplicateOf =
    typeof analysis.summary_json.duplicate_of === "string"
      ? analysis.summary_json.duplicate_of
      : null
  const promptVersion =
    typeof analysis.summary_json.prompt_version === "string"
      ? analysis.summary_json.prompt_version
      : null
  if (!structured || typeof structured !== "object") return null
  const record = structured as Record<string, unknown>
  const flags =
    typeof record.flags === "object" && record.flags
      ? (record.flags as Record<string, unknown>)
      : {}
  const activeFlags = Object.entries(flags).filter(
    ([, value]) => value === true,
  )

  return (
    <Card className="bg-background shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{t("ai_panel_title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <Info label={t("ai_label_model")} value={analysis.model} />
        {promptVersion && (
          <Info label={t("ai_label_prompt")} value={promptVersion} />
        )}
        {typeof record.confidence === "number" && (
          <Info
            label={t("ai_label_trust")}
            value={`${Math.round(record.confidence * 100)}%`}
          />
        )}
        {typeof record.urgency === "string" && (
          <Info label={t("ai_label_urgency")} value={record.urgency} />
        )}
        {typeof record.impact_scope === "string" && (
          <Info label={t("ai_label_scope")} value={record.impact_scope} />
        )}
        {duplicateOf && (
          <Info label={t("ai_label_duplicate")} value={duplicateOf} />
        )}
        {typeof record.moderation_reason === "string" && (
          <Info label={t("ai_label_reason")} value={record.moderation_reason} />
        )}
        {activeFlags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {activeFlags.map(([flag]) => (
              <Badge key={flag} variant="outline">
                {flag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="break-words text-sm font-medium">{value}</span>
    </div>
  )
}
