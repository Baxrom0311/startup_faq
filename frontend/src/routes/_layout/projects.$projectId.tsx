import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  GitBranch,
  ImagePlus,
  Send,
  Star,
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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import useAuth from "@/hooks/useAuth"
import {
  apiJson,
  apiMutation,
  type Problem,
  type Project,
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
    meta: [{ title: "Project detail - SignalHub" }],
  }),
})

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
        {
          status: milestone.status === "done" ? "todo" : "done",
        },
        "PATCH",
      )
      await loadProject()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("error_milestone_toggle"),
      )
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

  if (!project) {
    return <LoadingState />
  }

  const isLead = user?.id === project.lead_id || !!user?.is_superuser
  const isOwner = user?.id === problem?.author_id || !!user?.is_superuser
  const canReview = isOwner && project.status === "proposed"
  const canPilot =
    isLead && ["approved", "in_progress"].includes(project.status)
  const canManage =
    isLead && ["approved", "in_progress", "piloting"].includes(project.status)
  const canSolve = isOwner && project.status === "piloting"

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <main className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit" asChild>
          <Link to="/">
            <ArrowLeft />
            {t("project_back")}
          </Link>
        </Button>

        <Card className="bg-background shadow-none">
          <CardHeader className="border-b">
            <div className="mb-3 flex items-center gap-2">
              <StatusBadge status={project.status} />
              <span className="text-muted-foreground text-xs">
                {shortDate(project.created_at)}
              </span>
            </div>
            <CardTitle className="break-words text-2xl">
              {project.title}
            </CardTitle>
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
                  {t("project_problem_label")}
                </span>
                <span className="text-muted-foreground mt-1 block truncate text-sm">
                  {problem.title || problem.raw_text || t("unnamed_problem")}
                </span>
              </Link>
            )}
            {(canReview || canPilot) && (
              <div className="flex flex-wrap gap-2">
                {canReview && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        mutateProject(`/projects/${projectId}/approve`)
                      }
                    >
                      <CheckCircle2 />
                      {t("project_approve")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        mutateProject(`/projects/${projectId}/reject`)
                      }
                    >
                      <XCircle />
                      {t("project_reject")}
                    </Button>
                  </>
                )}
                {canPilot && (
                  <Button
                    onClick={() =>
                      mutateProject(`/projects/${projectId}/start-piloting`)
                    }
                  >
                    <GitBranch />
                    {t("project_start_pilot")}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-background shadow-none">
          <CardHeader>
            <CardTitle className="text-base">
              {t("project_updates_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {canManage && (
              <>
                <Textarea
                  value={updateText}
                  onChange={(event) => setUpdateText(event.target.value)}
                  placeholder={t("project_update_placeholder")}
                />
                {updatePhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {updatePhotoPreviews.map((preview) => (
                      <img
                        key={preview.id}
                        src={preview.url}
                        alt=""
                        className="aspect-square rounded-md border object-cover"
                      />
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" asChild>
                    <label>
                      <ImagePlus />
                      {t("project_photo")}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={(event) =>
                          setUpdatePhotos(
                            Array.from(event.target.files || []).slice(0, 5),
                          )
                        }
                      />
                    </label>
                  </Button>
                  <Button onClick={addUpdate} disabled={isSendingUpdate}>
                    <Send />
                    {t("project_send")}
                  </Button>
                </div>
              </>
            )}
            <div className="divide-y rounded-md border">
              {updates.length === 0 ? (
                <div className="p-4">
                  <EmptyState />
                </div>
              ) : (
                updates.map((update) => (
                  <div key={update.id} className="p-4">
                    <p className="text-sm">{update.text}</p>
                    {update.media && update.media.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                    <p className="text-muted-foreground mt-1 text-xs">
                      {shortDate(update.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <aside className="flex flex-col gap-4">
        <Card className="bg-background shadow-none">
          <CardHeader>
            <CardTitle className="text-base">
              {t("project_plan_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {canManage && (
              <div className="grid gap-2">
                <Input
                  value={milestoneTitle}
                  onChange={(event) => setMilestoneTitle(event.target.value)}
                  placeholder={t("project_milestone_placeholder")}
                />
                <Button variant="outline" onClick={addMilestone}>
                  {t("project_milestone_add")}
                </Button>
              </div>
            )}
            <div className="grid gap-2">
              {milestones.length === 0 ? (
                <EmptyState />
              ) : (
                milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex items-center gap-2 rounded-md border px-3 py-2"
                  >
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleMilestone(milestone)}
                      >
                        {milestone.status === "done" ? (
                          <CheckCircle2 />
                        ) : (
                          <Circle />
                        )}
                      </Button>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {milestone.title}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {statusLabel(milestone.status)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {canSolve && (
          <Card className="bg-background shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                {t("project_complete_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-center gap-1.5 py-1">
                <span className="text-sm font-medium text-muted-foreground mr-1">
                  {t("project_rating") || "Baho"}:
                </span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(String(star))}
                    className="focus:outline-none cursor-pointer"
                  >
                    <Star
                      className={`size-5 transition-colors ${
                        star <= Number(reviewRating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground hover:text-amber-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                placeholder={t("project_review_placeholder")}
              />
              <Button onClick={complete}>{t("project_mark_solved")}</Button>
            </CardContent>
          </Card>
        )}

        {reviews.length > 0 && (
          <Card className="bg-background shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                {t("project_reviews_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`size-3.5 ${
                            star <= review.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {shortDate(review.created_at)}
                    </span>
                  </div>
                  {review.text && (
                    <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-sm">
                      {review.text}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </aside>
    </div>
  )
}
