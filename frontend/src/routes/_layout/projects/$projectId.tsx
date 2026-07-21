import { createFileRoute, Link } from "@tanstack/react-router"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Code2,
  Edit3,
  ExternalLink,
  GitBranch,
  GitMerge,
  ImagePlus,
  Lock,
  MessageSquare,
  Plus,
  Send,
  Star,
  Users,
  XCircle,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
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
  apiJson,
  apiMutation,
  type IssueComment,
  type IssueCommentsResponse,
  type Problem,
  type Project,
  type ProjectIssue,
  type ProjectIssuesResponse,
  type ProjectMilestone,
  type ProjectMilestonesResponse,
  type ProjectUpdate,
  type ProjectUpdatesResponse,
  type Review,
  type ReviewsResponse,
  shortDate,
  statusLabel,
  uploadProblemPhoto,
} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/projects/$projectId")({
  component: ProjectDetail,
  head: () => ({
    meta: [{ title: "Project detail - SolutionLab" }],
  }),
})

const OPEN_STATUSES = new Set(["proposed", "approved", "in_progress", "piloting"])

type IssueFilter = "all" | "open" | "closed" | "bug" | "feature" | "task" | "question"

function kindBadgeClass(kind: string): string {
  const map: Record<string, string> = {
    bug: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    feature: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    task: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    question: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  }
  return map[kind] ?? "bg-muted text-muted-foreground"
}

// ─── Issue Detail Panel ──────────────────────────────────────────────────────
interface IssueDetailProps {
  issue: ProjectIssue
  projectId: string
  currentUserId: string | undefined
  isLead: boolean
  onUpdated: () => void
}

function IssueDetail({ issue, projectId, currentUserId, isLead, onUpdated }: IssueDetailProps) {
  const { t } = useTranslation()
  const [comments, setComments] = useState<IssueComment[]>([])
  const [commentText, setCommentText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadComments = useCallback(async () => {
    try {
      const res = await apiJson<IssueCommentsResponse>(
        `/projects/${projectId}/issues/${issue.id}/comments`
      )
      setComments(res.data)
    } catch {
      // ignore
    }
  }, [projectId, issue.id])

  useEffect(() => {
    loadComments().catch(() => undefined)
  }, [loadComments])

  const submitComment = async () => {
    if (!commentText.trim()) return
    setIsSubmitting(true)
    try {
      await apiMutation(`/projects/${projectId}/issues/${issue.id}/comments`, {
        text: commentText.trim(),
      })
      setCommentText("")
      await loadComments()
      onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_comment_add"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleStatus = async () => {
    const newStatus = issue.status === "open" ? "closed" : "open"
    try {
      await apiMutation(
        `/projects/${projectId}/issues/${issue.id}`,
        { status: newStatus },
        "PATCH"
      )
      onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_action"))
    }
  }

  const canToggle = currentUserId === issue.author_id || isLead

  return (
    <div className="border-t bg-muted/20 p-4 grid gap-4">
      {issue.body && (
        <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/80">
          {issue.body}
        </p>
      )}

      {/* Comments */}
      {comments.length > 0 && (
        <div className="flex flex-col gap-2">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                {c.author_name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2">
                <p className="text-sm whitespace-pre-wrap">{c.text}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {c.author_name && <span className="font-medium text-foreground/70">{c.author_name} · </span>}
                  {shortDate(c.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add comment + status toggle */}
      {currentUserId && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={t("issue_comment_placeholder")}
            className="min-h-[70px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment()
            }}
          />
          <div className="flex items-center justify-between gap-2">
            {canToggle && (
              <Button variant="outline" size="sm" onClick={toggleStatus}>
                {issue.status === "open" ? (
                  <><XCircle className="size-3.5" /> {t("issue_close")}</>
                ) : (
                  <><CheckCircle2 className="size-3.5" /> {t("issue_reopen")}</>
                )}
              </Button>
            )}
            <Button
              size="sm"
              className="ml-auto"
              onClick={submitComment}
              disabled={isSubmitting || !commentText.trim()}
            >
              <Send className="size-3.5" />
              {t("issue_add_comment")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── New Issue Dialog ─────────────────────────────────────────────────────────
interface NewIssueFormProps {
  projectId: string
  onCreated: () => void
  onCancel: () => void
}

function NewIssueForm({ projectId, onCreated, onCancel }: NewIssueFormProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [kind, setKind] = useState("task")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async () => {
    if (!title.trim()) return
    setIsSubmitting(true)
    try {
      await apiMutation(`/projects/${projectId}/issues`, { title: title.trim(), body: body.trim() || null, kind })
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_action"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="bg-background shadow-none">
      <CardContent className="p-4 grid gap-3">
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t("issue_title_label")}</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("issue_title_label")}
            onKeyDown={(e) => { if (e.key === "Enter") submit() }}
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t("issue_body_label")}</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("issue_body_label")}
            className="min-h-[80px] resize-none"
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t("issue_kind_label")}</label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bug">{t("issue_kind_bug")}</SelectItem>
              <SelectItem value="feature">{t("issue_kind_feature")}</SelectItem>
              <SelectItem value="task">{t("issue_kind_task")}</SelectItem>
              <SelectItem value="question">{t("issue_kind_question")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>{t("cancel")}</Button>
          <Button size="sm" onClick={submit} disabled={isSubmitting || !title.trim()}>
            {t("issue_submit")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Issues Tab ───────────────────────────────────────────────────────────────
interface IssuesTabProps {
  projectId: string
  currentUserId: string | undefined
  isLead: boolean
}

function IssuesTab({ projectId, currentUserId, isLead }: IssuesTabProps) {
  const { t } = useTranslation()
  const [issues, setIssues] = useState<ProjectIssue[]>([])
  const [filter, setFilter] = useState<IssueFilter>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const loadIssues = useCallback(async () => {
    try {
      const res = await apiJson<ProjectIssuesResponse>(`/projects/${projectId}/issues`)
      setIssues(res.data)
    } catch {
      // ignore
    }
  }, [projectId])

  useEffect(() => {
    loadIssues().catch(() => undefined)
  }, [loadIssues])

  const filtered = useMemo(() => {
    if (filter === "all") return issues
    if (filter === "open") return issues.filter((i) => i.status === "open")
    if (filter === "closed") return issues.filter((i) => i.status === "closed")
    return issues.filter((i) => i.kind === filter)
  }, [issues, filter])

  const kindLabel = (kind: string) => {
    const map: Record<string, string> = {
      bug: t("issue_kind_bug"),
      feature: t("issue_kind_feature"),
      task: t("issue_kind_task"),
      question: t("issue_kind_question"),
    }
    return map[kind] ?? kind
  }

  const filterButtons: { key: IssueFilter; label: string }[] = [
    { key: "all", label: t("issue_all") },
    { key: "open", label: t("issue_open") },
    { key: "closed", label: t("issue_closed") },
    { key: "bug", label: t("issue_kind_bug") },
    { key: "feature", label: t("issue_kind_feature") },
    { key: "task", label: t("issue_kind_task") },
    { key: "question", label: t("issue_kind_question") },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1">
          {filterButtons.map((fb) => (
            <button
              key={fb.key}
              type="button"
              onClick={() => setFilter(fb.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === fb.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {fb.label}
            </button>
          ))}
        </div>
        {currentUserId && !showNew && (
          <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>
            <Plus className="size-3.5" />
            {t("issue_new")}
          </Button>
        )}
      </div>

      {/* New issue form */}
      {showNew && (
        <NewIssueForm
          projectId={projectId}
          onCreated={async () => {
            setShowNew(false)
            await loadIssues()
          }}
          onCancel={() => setShowNew(false)}
        />
      )}

      {/* Issue list */}
      {filtered.length === 0 ? (
        <Card className="bg-background shadow-none">
          <CardContent className="p-8">
            <EmptyState message={t("issue_no_items")} />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-background overflow-hidden">
          {filtered.map((issue, idx) => (
            <div key={issue.id}>
              {/* Issue row */}
              <div
                className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors ${
                  idx < filtered.length - 1 && expandedId !== issue.id ? "border-b" : ""
                }`}
                onClick={() =>
                  setExpandedId(expandedId === issue.id ? null : issue.id)
                }
              >
                {/* Status icon */}
                <div className="mt-0.5 shrink-0">
                  {issue.status === "open" ? (
                    <AlertCircle className="size-4 text-green-600" />
                  ) : (
                    <CheckCircle2 className="size-4 text-muted-foreground" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${kindBadgeClass(issue.kind)}`}
                    >
                      {kindLabel(issue.kind)}
                    </span>
                    <span className="text-sm font-medium truncate">{issue.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {shortDate(issue.created_at)}
                  </p>
                </div>

                {/* Comment count */}
                {issue.comment_count > 0 && (
                  <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
                    <MessageSquare className="size-3.5" />
                    {issue.comment_count}
                  </div>
                )}

                {/* Expand indicator */}
                <div className="shrink-0 text-muted-foreground">
                  {expandedId === issue.id ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === issue.id && (
                <IssueDetail
                  issue={issue}
                  projectId={projectId}
                  currentUserId={currentUserId}
                  isLead={isLead}
                  onUpdated={loadIssues}
                />
              )}

              {/* Bottom border after expanded block */}
              {expandedId === issue.id && idx < filtered.length - 1 && (
                <div className="border-b" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Project Chat & Discussions Tab ──────────────────────────────────────────
interface ProjectChatTabProps {
  projectId: string
  currentUserId: string | undefined
}

function ProjectChatTab({ projectId, currentUserId }: ProjectChatTabProps) {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<ProjectIssue[]>([])
  const [text, setText] = useState("")
  const [isSending, setIsSending] = useState(false)

  const loadChat = useCallback(async () => {
    try {
      const res = await apiJson<ProjectIssuesResponse>(`/projects/${projectId}/issues`)
      setMessages(res.data)
    } catch {
      // ignore
    }
  }, [projectId])

  useEffect(() => {
    loadChat().catch(() => undefined)
  }, [loadChat])

  const sendChatMessage = async () => {
    if (!text.trim()) return
    setIsSending(true)
    try {
      await apiMutation(`/projects/${projectId}/issues`, {
        title: text.trim().slice(0, 100),
        body: text.trim(),
        kind: "question",
      })
      setText("")
      await loadChat()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_action"))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-background shadow-none border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <MessageSquare className="size-5 text-primary" />
            {t("project_chat_title")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("project_chat_subtitle")}
          </p>
        </CardHeader>
        <CardContent className="p-4 grid gap-4">
          {/* Messages list */}
          {messages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm border rounded-lg bg-muted/20">
              <MessageSquare className="size-8 mx-auto mb-2 opacity-50" />
              {t("project_chat_empty")}
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    msg.author_id === currentUserId
                      ? "bg-primary/5 border-primary/20 ml-4"
                      : "bg-muted/30 mr-4"
                  }`}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                    {msg.author_id === currentUserId ? t("project_chat_me")[0] : "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {msg.author_id === currentUserId ? t("project_chat_me") : t("project_chat_user")}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {shortDate(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap text-foreground/90">
                      {msg.body || msg.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Send Box */}
          {currentUserId ? (
            <div className="flex gap-2 pt-2 border-t">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("project_chat_placeholder")}
                className="min-h-[60px] resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendChatMessage()
                }}
              />
              <Button
                className="self-end shrink-0"
                onClick={sendChatMessage}
                disabled={isSending || !text.trim()}
              >
                <Send className="size-4" />
                {t("project_send")}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              {t("project_chat_login_hint")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
function ProjectDetail() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { projectId } = Route.useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([])
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [milestoneTitle, setMilestoneTitle] = useState("")
  const [updateText, setUpdateText] = useState("")
  const [updatePhotos, setUpdatePhotos] = useState<File[]>([])
  const [isSendingUpdate, setIsSendingUpdate] = useState(false)
  const [reviewRating, setReviewRating] = useState("5")
  const [reviewText, setReviewText] = useState("")
  const [tab, setTab] = useState<"overview" | "chat" | "issues" | "milestones" | "activity">("overview")
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editPitch, setEditPitch] = useState("")
  const [editRepoUrl, setEditRepoUrl] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)

  const updatePhotoPreviews = useMemo(
    () =>
      updatePhotos.map((file) => ({
        id: `${file.name}-${file.lastModified}`,
        url: URL.createObjectURL(file),
      })),
    [updatePhotos],
  )

  const loadProject = useCallback(async () => {
    const projectData = await apiJson<Project>(`/projects/${projectId}`)
    const [problemData, milestonesData, updatesData, reviewsData] =
      await Promise.all([
        apiJson<Problem>(`/problems/${projectData.problem_id}`),
        apiJson<ProjectMilestonesResponse>(`/projects/${projectId}/milestones`),
        apiJson<ProjectUpdatesResponse>(`/projects/${projectId}/updates`),
        apiJson<ReviewsResponse>(`/projects/${projectId}/reviews`),
      ])
    setProject(projectData)
    setProblem(problemData)
    setMilestones(milestonesData.data)
    setUpdates(updatesData.data)
    setReviews(reviewsData.data)
  }, [projectId])

  useEffect(() => {
    loadProject().catch((err: unknown) =>
      toast.error(err instanceof Error ? err.message : t("error_load_project")),
    )
  }, [loadProject, t])

  useEffect(() => {
    return () => {
      for (const preview of updatePhotoPreviews) {
        URL.revokeObjectURL(preview.url)
      }
    }
  }, [updatePhotoPreviews])

  const openEditModal = () => {
    if (!project) return
    setEditTitle(project.title)
    setEditPitch(project.pitch || "")
    setEditRepoUrl(project.repo_url || "")
    setShowEditDialog(true)
  }

  const handleSaveProject = async () => {
    if (!editTitle.trim()) return
    setIsUpdating(true)
    try {
      await apiMutation(
        `/projects/${projectId}`,
        {
          title: editTitle.trim(),
          pitch: editPitch.trim() || null,
          repo_url: editRepoUrl.trim() || null,
        },
        "PATCH",
      )
      toast.success(t("project_done_toast"))
      setShowEditDialog(false)
      await loadProject()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_action"))
    } finally {
      setIsUpdating(false)
    }
  }

  const mutateProject = async (path: string) => {
    try {
      await apiMutation(path)
      toast.success(t("project_done_toast"))
      await loadProject()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_action"))
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_milestone_add"))
    }
  }

  const toggleMilestone = async (milestone: ProjectMilestone) => {
    try {
      await apiMutation(
        `/milestones/${milestone.id}`,
        { status: milestone.status === "done" ? "todo" : "done" },
        "PATCH",
      )
      await loadProject()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_milestone_toggle"))
    }
  }

  const addUpdate = async () => {
    if (!updateText.trim()) return
    try {
      setIsSendingUpdate(true)
      const mediaKeys = await Promise.all(updatePhotos.map(uploadProblemPhoto))
      await apiMutation(`/projects/${projectId}/updates`, {
        text: updateText.trim(),
        media_keys: mediaKeys,
      })
      setUpdateText("")
      setUpdatePhotos([])
      await loadProject()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_update_add"))
    } finally {
      setIsSendingUpdate(false)
    }
  }

  const complete = async () => {
    try {
      await apiMutation(`/projects/${projectId}/complete`, {
        rating: Number(reviewRating),
        text: reviewText.trim() || null,
      })
      toast.success(t("project_complete_toast"))
      await loadProject()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_complete"))
    }
  }

  if (!project) return <LoadingState />

  const isLead = user?.id === project.lead_id || !!user?.is_superuser
  const isOwner = user?.id === problem?.author_id || !!user?.is_superuser
  const isOpen = OPEN_STATUSES.has(project.status)

  const canReview = isOwner && project.status === "proposed"
  const canPilot = isLead && ["approved", "in_progress"].includes(project.status)
  const canManage = isLead && ["approved", "in_progress", "piloting"].includes(project.status)
  const canSolve = isOwner && project.status === "piloting"
  const canPostUpdate = (isLead || isOwner) && isOpen

  const doneCount = milestones.filter((m) => m.status === "done").length
  const progressPct = milestones.length > 0 ? Math.round((doneCount / milestones.length) * 100) : 0

  const tabs: { key: typeof tab; label: string; icon?: React.ReactNode }[] = [
    { key: "overview", label: t("project_tab_overview"), icon: <Code2 className="size-3.5" /> },
    { key: "chat", label: t("project_tab_chat"), icon: <MessageSquare className="size-3.5" /> },
    { key: "issues", label: t("project_tab_issues"), icon: <AlertCircle className="size-3.5" /> },
    { key: "milestones", label: t("project_tab_milestones"), icon: <CheckCircle2 className="size-3.5" /> },
    { key: "activity", label: t("project_tab_activity"), icon: <GitBranch className="size-3.5" /> },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <main className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit" asChild>
          <Link to="/projects">
            <ArrowLeft />
            {t("nav_projects")}
          </Link>
        </Button>

        {/* Header card */}
        <Card className="bg-background shadow-none">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${isOpen ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {isOpen ? <GitBranch className="size-4" /> : <GitMerge className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold">{project.title}</h1>
                    <StatusBadge status={project.status} />
                    <Badge variant="outline" className="gap-1 text-xs">
                      {isOpen ? <GitBranch className="size-3" /> : <Lock className="size-3" />}
                      {isOpen ? t("project_open") : t("project_closed")}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t("project_created")} {shortDate(project.created_at)}
                  </p>
                </div>
              </div>

              {/* Edit / GitHub header actions */}
              <div className="flex items-center gap-2 shrink-0">
                {project.repo_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={project.repo_url} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                      <Code2 className="size-4 text-primary" />
                      <span className="hidden sm:inline">GitHub</span>
                      <ExternalLink className="size-3 text-muted-foreground" />
                    </a>
                  </Button>
                )}
                {isLead && (
                  <Button variant="outline" size="sm" onClick={openEditModal} className="gap-1.5">
                    <Edit3 className="size-3.5" />
                    <span className="hidden sm:inline">{t("problem_edit")}</span>
                  </Button>
                )}
              </div>
            </div>

            {project.pitch && (
              <p className="text-muted-foreground mt-4 whitespace-pre-wrap text-sm leading-6 border-t pt-4">
                {project.pitch}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 border-b overflow-x-auto">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors shrink-0 ${
                tab === tb.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tb.icon}
              {tb.label}
              {tb.key === "activity" && updates.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{updates.length}</Badge>
              )}
              {tb.key === "milestones" && milestones.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{doneCount}/{milestones.length}</Badge>
              )}
            </button>
          ))}
        </div>

        {/* ── Overview tab ── */}
        {tab === "overview" && (
          <div className="flex flex-col gap-4">
            {/* GitHub Repo Card */}
            {project.repo_url ? (
              <Card className="bg-background shadow-none border-primary/20">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Code2 className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">{t("project_repo_label")}</p>
                      <a
                        href={project.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm font-semibold text-primary hover:underline flex items-center gap-1 mt-0.5"
                      >
                        {project.repo_url}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <a href={project.repo_url} target="_blank" rel="noopener noreferrer">
                      {t("project_repo_open")}
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ) : isLead ? (
              <Card className="bg-muted/30 border-dashed shadow-none">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Code2 className="size-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{t("project_repo_missing")}</p>
                      <p className="text-xs text-muted-foreground">{t("project_repo_missing_hint")}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={openEditModal}>
                    <Plus className="size-3.5" /> {t("project_repo_add")}
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {/* Linked signal */}
            {problem && (
              <Link
                to="/problems/$problemId"
                params={{ problemId: problem.id }}
                className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{t("project_problem_label")}</p>
                  <p className="mt-0.5 truncate text-sm font-medium">
                    {problem.title || problem.raw_text || t("unnamed_problem")}
                  </p>
                </div>
              </Link>
            )}

            {/* Summary Progress Card */}
            <Card className="bg-background shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t("project_overview_title")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {/* Milestones progress */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("project_progress")} ({doneCount}/{milestones.length} {t("project_milestones_count")})</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 text-center border-t">
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <p className="text-xl font-bold text-primary">{milestones.length}</p>
                    <p className="text-xs text-muted-foreground">{t("project_tab_milestones")}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <p className="text-xl font-bold text-primary">{updates.length}</p>
                    <p className="text-xs text-muted-foreground">{t("project_activity_count")}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <p className="text-xl font-bold text-primary">{reviews.length}</p>
                    <p className="text-xs text-muted-foreground">{t("project_reviews_count")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action buttons */}
            {(canReview || canPilot || canSolve) && (
              <Card className="bg-background shadow-none">
                <CardContent className="p-4 flex flex-wrap gap-2">
                  {canReview && (
                    <>
                      <Button variant="outline" onClick={() => mutateProject(`/projects/${projectId}/approve`)}>
                        <CheckCircle2 className="size-4" />
                        {t("project_approve")}
                      </Button>
                      <Button variant="outline" onClick={() => mutateProject(`/projects/${projectId}/reject`)}>
                        <XCircle className="size-4" />
                        {t("project_reject")}
                      </Button>
                    </>
                  )}
                  {canPilot && (
                    <Button onClick={() => mutateProject(`/projects/${projectId}/start-piloting`)}>
                      <GitBranch className="size-4" />
                      {t("project_start_pilot")}
                    </Button>
                  )}
                  {canSolve && (
                    <div className="w-full grid gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground mr-1">{t("project_rating")}:</span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} type="button" onClick={() => setReviewRating(String(star))}>
                            <Star className={`size-5 transition-colors cursor-pointer ${star <= Number(reviewRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground hover:text-amber-300"}`} />
                          </button>
                        ))}
                      </div>
                      <Textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder={t("project_review_placeholder")}
                      />
                      <Button onClick={complete}>{t("project_mark_solved")}</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <Card className="bg-background shadow-none">
                <CardHeader>
                  <CardTitle className="text-sm">{t("project_reviews_title")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={`size-3.5 ${star <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                        <span className="text-muted-foreground text-xs">{shortDate(review.created_at)}</span>
                      </div>
                      {review.text && (
                        <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-sm">{review.text}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Chat tab ── */}
        {tab === "chat" && (
          <ProjectChatTab
            projectId={projectId}
            currentUserId={user?.id}
          />
        )}

        {/* ── Issues tab ── */}
        {tab === "issues" && (
          <IssuesTab
            projectId={projectId}
            currentUserId={user?.id}
            isLead={isLead}
          />
        )}

        {/* ── Milestones tab ── */}
        {tab === "milestones" && (
          <Card className="bg-background shadow-none">
            <CardContent className="p-4 grid gap-4">
              {milestones.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("project_progress")}</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}
              {canManage && (
                <div className="flex gap-2">
                  <Input
                    value={milestoneTitle}
                    onChange={(e) => setMilestoneTitle(e.target.value)}
                    placeholder={t("project_milestone_placeholder")}
                    onKeyDown={(e) => { if (e.key === "Enter") addMilestone() }}
                  />
                  <Button variant="outline" onClick={addMilestone} className="shrink-0">
                    {t("project_milestone_add")}
                  </Button>
                </div>
              )}
              {milestones.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid gap-2">
                  {milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                        milestone.status === "done" ? "bg-muted/40" : "bg-background"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => canManage && toggleMilestone(milestone)}
                        className={canManage ? "cursor-pointer text-primary" : "cursor-default text-muted-foreground"}
                      >
                        {milestone.status === "done" ? (
                          <CheckCircle2 className="size-4 text-green-600" />
                        ) : (
                          <Circle className="size-4" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm ${milestone.status === "done" ? "line-through text-muted-foreground" : "font-medium"}`}>
                          {milestone.title}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{statusLabel(milestone.status)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Activity tab ── */}
        {tab === "activity" && (
          <div className="flex flex-col gap-3">
            {canPostUpdate && (
              <Card className="bg-background shadow-none">
                <CardContent className="p-4 grid gap-3">
                  <Textarea
                    value={updateText}
                    onChange={(e) => setUpdateText(e.target.value)}
                    placeholder={t("project_update_placeholder")}
                    className="min-h-[80px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addUpdate()
                    }}
                  />
                  {updatePhotos.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {updatePhotoPreviews.map((p) => (
                        <img key={p.id} src={p.url} alt="" className="aspect-square rounded-md border object-cover" />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <label className="cursor-pointer">
                        <ImagePlus className="size-4" />
                        {t("project_photo")}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="hidden"
                          onChange={(e) => setUpdatePhotos(Array.from(e.target.files || []).slice(0, 5))}
                        />
                      </label>
                    </Button>
                    <Button size="sm" onClick={addUpdate} disabled={isSendingUpdate || !updateText.trim()}>
                      <Send className="size-4" />
                      {t("project_send")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {updates.length === 0 ? (
              <Card className="bg-background shadow-none">
                <CardContent className="p-8">
                  <EmptyState message={t("project_no_updates")} />
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-0 rounded-lg border bg-background overflow-hidden">
                {updates.map((update, idx) => (
                  <div key={update.id} className={`p-4 ${idx < updates.length - 1 ? "border-b" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {update.author_name?.charAt(0).toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{update.text}</p>
                        {update.media && update.media.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {update.media.map((media) =>
                              media.kind === "photo" ? (
                                <img
                                  key={media.object_key}
                                  src={media.url}
                                  alt=""
                                  className="aspect-square rounded-md border object-cover"
                                />
                              ) : null,
                            )}
                          </div>
                        )}
                        <p className="text-muted-foreground mt-2 text-xs">
                          {update.author_name && <span className="font-medium text-foreground/70">{update.author_name} · </span>}
                          {shortDate(update.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Sidebar */}
      <aside className="flex flex-col gap-4">
        {/* GitHub / Repo Sidebar Card */}
        <Card className="bg-background shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <Code2 className="size-4 text-primary" />
                {t("project_repo_label")}
              </span>
              {isLead && (
                <button
                  type="button"
                  onClick={openEditModal}
                  className="text-xs text-primary hover:underline"
                >
                  {t("problem_edit")}
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {project.repo_url ? (
              <a
                href={project.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-medium text-primary hover:underline break-all"
              >
                <ExternalLink className="size-3 shrink-0" />
                {project.repo_url}
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">{t("project_repo_none")}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-background shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="size-4" />
              {t("project_team")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("project_status_label")}</span>
              <StatusBadge status={project.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("project_visibility")}</span>
              <Badge variant="outline" className="gap-1 text-xs">
                {isOpen ? <GitBranch className="size-3" /> : <Lock className="size-3" />}
                {isOpen ? t("project_open") : t("project_closed")}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("project_created")}</span>
              <span className="text-xs">{shortDate(project.created_at)}</span>
            </div>
          </CardContent>
        </Card>
      </aside>

      {/* Edit Project Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("project_edit_title")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("project_edit_name_label")}</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={t("project_edit_name_placeholder")}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("project_edit_pitch_label")}</label>
              <Textarea
                value={editPitch}
                onChange={(e) => setEditPitch(e.target.value)}
                placeholder={t("project_edit_pitch_placeholder")}
                className="min-h-[100px] resize-none"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("project_repo_label")} URL</label>
              <Input
                value={editRepoUrl}
                onChange={(e) => setEditRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(false)}>
                {t("cancel")}
              </Button>
              <Button size="sm" onClick={handleSaveProject} disabled={isUpdating || !editTitle.trim()}>
                {t("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
