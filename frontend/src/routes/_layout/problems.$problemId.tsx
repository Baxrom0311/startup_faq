import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CornerDownRight,
  CornerUpLeft,
  Edit3,
  MessageSquare,
  RefreshCcw,
  Rocket,
  ThumbsUp,
  Volume2,
  X,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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

} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/problems/$problemId")({
  component: ProblemDetail,
  head: () => ({
    meta: [{ title: "Problem detail - SolutionLab" }],
  }),
})

function ProblemDetail() {
  const { t, i18n } = useTranslation()
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
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [projectTitle, setProjectTitle] = useState("")
  const [projectPitch, setProjectPitch] = useState("")
  const [projectRepoUrl, setProjectRepoUrl] = useState("")
  const [claiming, setClaiming] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editText, setEditText] = useState("")
  const [editSectorId, setEditSectorId] = useState<string>("")
  const [editRegionId, setEditRegionId] = useState<string>("")
  const [saving, setSaving] = useState(false)

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
    loadProblem()
      .then(() => {
        // Scroll to a specific comment if the URL hash references one
        const hash = window.location.hash
        if (hash.startsWith("#comment-")) {
          setTimeout(() => {
            document.getElementById(hash.slice(1))?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            })
          }, 100)
        }
      })
      .catch((err: unknown) =>
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
        parent_id: replyTo?.id || null,
      })
      setCommentText("")
      setReplyTo(null)
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
        repo_url: projectRepoUrl.trim() || null,
      })
      setProjectTitle("")
      setProjectPitch("")
      setProjectRepoUrl("")
      toast.success(t("problem_proposal_sent"))
      await loadProblem()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_request"))
    } finally {
      setClaiming(false)
    }
  }

  const openEdit = () => {
    if (!problem) return
    setEditText(problem.raw_text ?? "")
    setEditSectorId(problem.sector_id != null ? String(problem.sector_id) : "")
    setEditRegionId(problem.region_id != null ? String(problem.region_id) : "")
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editText.trim()) return
    setSaving(true)
    try {
      await apiMutation(
        `/problems/${problemId}`,
        {
          raw_text: editText.trim(),
          sector_id: editSectorId ? Number(editSectorId) : null,
          region_id: editRegionId ? Number(editRegionId) : null,
        },
        "PATCH",
      )
      toast.success(t("problem_edit_success"))
      setEditOpen(false)
      await loadProblem()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_generic"))
    } finally {
      setSaving(false)
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

  const rootComments = comments.filter(
    (c) => !c.parent_id || !comments.some((p) => p.id === c.parent_id),
  )
  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parent_id === parentId)

  const renderComment = (comment: Comment, isReply = false) => {
    const replies = getReplies(comment.id)
    return (
      <div
        key={comment.id}
        id={`comment-${comment.id}`}
        className={`p-4 scroll-mt-20 ${
          isReply
            ? "bg-muted/40 rounded-lg border-l-2 border-primary/45 pl-4 ml-6 mt-3"
            : ""
        }`}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="grid gap-1">
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {comment.text}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {comment.author_name && (
                <span className="font-medium text-foreground/70">{comment.author_name} · </span>
              )}
              {shortDate(comment.created_at)}
            </p>
          </div>
          {!isReply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setReplyTo(comment)
                const el = document.getElementById("comment-input")
                el?.focus()
              }}
            >
              <CornerUpLeft className="h-3.5 w-3.5" />
              {t("comment_reply")}
            </Button>
          )}
        </div>

        {replies.length > 0 && (
          <div className="space-y-1">
            {replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    )
  }

  if (!problem) {
    return <LoadingState />
  }

  const canClaim =
    problem.status === "published" && user?.id !== problem.author_id && !!user
  const canEdit =
    !!user &&
    user.id === problem.author_id &&
    ["draft", "needs_review"].includes(problem.status)
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

        {problem.status === "needs_review" && user?.id === problem.author_id && (
          <div className="flex items-center gap-3 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm dark:border-yellow-800 dark:bg-yellow-950">
            <p className="text-yellow-800 dark:text-yellow-200">{t("problem_needs_review_note")}</p>
          </div>
        )}

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
              {problem.author_name && (
                <span className="text-muted-foreground text-xs">
                  · {problem.author_name}
                </span>
              )}
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
            {problem.structured_desc && (
              <StructuredInsights desc={problem.structured_desc} />
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
            {replyTo && (
              <div className="flex items-center justify-between rounded bg-muted/65 px-3 py-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 truncate">
                  <CornerDownRight className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {t("comment_replying_to")} <strong>"{replyTo.text}"</strong>
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 hover:bg-transparent"
                  onClick={() => setReplyTo(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <Textarea
              id="comment-input"
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder={t("problem_comment_placeholder")}
            />
            <div className="flex justify-end">
              <Button onClick={addComment}>{t("problem_send")}</Button>
            </div>
            <div className="divide-y rounded-md border">
              {rootComments.length === 0 ? (
                <div className="p-4">
                  <EmptyState />
                </div>
              ) : (
                rootComments.map((comment) => renderComment(comment))
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("problem_edit_title")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value.slice(0, 5000))}
                rows={6}
                className="resize-none"
              />
              <span className={`text-right text-xs ${editText.length > 4500 ? "text-destructive" : "text-muted-foreground"}`}>
                {editText.length}/5000
              </span>
            </div>
            <Select
              value={editSectorId || "__none"}
              onValueChange={(v) => setEditSectorId(v === "__none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {sectors.map((s) => {
                  const lang = i18n.language?.slice(0, 2)
                  const name = (lang === "ru" ? s.name_ru : lang === "en" ? s.name_en : null) ?? t(`sector_${s.slug}` as any, s.name_uz)
                  return (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.icon} {name}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <Select
              value={editRegionId || "__none"}
              onValueChange={(v) => setEditRegionId(v === "__none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {regions.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={saving}
              >
                {t("cancel")}
              </Button>
              <LoadingButton
                loading={saving}
                disabled={!editText.trim()}
                onClick={saveEdit}
              >
                {t("problem_edit_save")}
              </LoadingButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <aside className="flex flex-col gap-4">
        {canEdit && (
          <Card className="bg-background shadow-none">
            <CardContent className="pt-4">
              <Button variant="outline" className="w-full" onClick={openEdit}>
                <Edit3 className="size-4" />
                {t("problem_edit")}
              </Button>
            </CardContent>
          </Card>
        )}

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
              <Input
                value={projectRepoUrl}
                onChange={(event) => setProjectRepoUrl(event.target.value)}
                placeholder="GitHub / Repository URL (https://github.com/...)"
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

function StructuredInsights({ desc }: { desc: Record<string, unknown> }) {
  const { t } = useTranslation()

  const summary = typeof desc.summary === "string" && desc.summary ? desc.summary : null
  const whoAffected = typeof desc.who_affected === "string" && desc.who_affected ? desc.who_affected : null
  const urgency = typeof desc.urgency === "string" && desc.urgency ? desc.urgency : null
  const impactScope = typeof desc.impact_scope === "string" && desc.impact_scope ? desc.impact_scope : null
  const painLevel = typeof desc.pain_level === "number" ? desc.pain_level : null
  const workaround = typeof desc.current_workaround === "string" && desc.current_workaround ? desc.current_workaround : null
  const tags = Array.isArray(desc.tags) ? (desc.tags as string[]).filter(Boolean) : []

  const urgencyLabel = urgency
    ? (t(`urgency_${urgency}` as any, urgency))
    : null
  const scopeLabel = impactScope
    ? (t(`scope_${impactScope}` as any, impactScope))
    : null

  const urgencyColor: Record<string, string> = {
    low: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
    medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
    high: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800",
    critical: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  }

  if (!summary && !whoAffected && !urgency && !impactScope && !painLevel && tags.length === 0 && !workaround) {
    return null
  }

  return (
    <div className="rounded-md border bg-muted/20 p-4 grid gap-3">
      {summary && (
        <p className="text-sm text-foreground/80 leading-relaxed">{summary}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {urgency && urgencyLabel && (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${urgencyColor[urgency] ?? "bg-muted text-muted-foreground"}`}>
            {t("problem_urgency")}: {urgencyLabel}
          </span>
        )}
        {impactScope && scopeLabel && (
          <span className="inline-flex items-center rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {t("problem_impact_scope")}: {scopeLabel}
          </span>
        )}
        {painLevel !== null && (
          <span className="inline-flex items-center rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {t("problem_pain_level")}: {"●".repeat(painLevel)}{"○".repeat(5 - painLevel)}
          </span>
        )}
      </div>
      {whoAffected && (
        <div>
          <span className="text-xs text-muted-foreground">{t("problem_who_affected")}: </span>
          <span className="text-xs">{whoAffected}</span>
        </div>
      )}
      {workaround && (
        <div>
          <span className="text-xs text-muted-foreground">{t("problem_workaround")}: </span>
          <span className="text-xs">{workaround}</span>
        </div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>
      )}
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
