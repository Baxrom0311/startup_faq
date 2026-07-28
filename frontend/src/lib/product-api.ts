import i18n from "./i18n"

function _t() {
  return (key: string) => i18n.t(key)
}

export type Sector = {
  id: number
  slug: string
  name_uz: string
  name_ru: string | null
  name_en: string | null
  icon: string | null
}

export type Region = {
  id: number
  name: string
  parent_id: number | null
}

export type Problem = {
  sector_id?: number | null
  region_id?: number | null
  id: string
  author_id: string
  author_name?: string | null
  title?: string | null
  raw_text?: string | null
  raw_audio_key?: string | null
  structured_desc?: Record<string, unknown> | null
  duplicate_of?: string | null
  is_duplicate?: boolean
  status: string
  vote_count: number
  comment_count: number
  project_count: number
  has_voted: boolean
  severity_score?: number | null
  created_at: string
  // Civic-appeal fields (track === "civic")
  track?: string
  agency_id?: number | null
  report_count?: number
  is_emergency?: boolean
  appeal_status?: string | null
  appeal_due_date?: string | null
  appeal_resolved_at?: string | null
}

export type Agency = {
  id: number
  slug: string
  name_uz: string
  name_ru: string | null
  name_en: string | null
  icon: string | null
}

export type AppealActionLog = {
  id: string
  problem_id: string
  agency_id?: number | null
  from_status?: string | null
  to_status: string
  note?: string | null
  actor_id?: string | null
  created_at: string
}

export type AppealStats = {
  total: number
  emergency: number
  open: number
  resolved: number
  resolution_rate: number
  by_status: Record<string, number>
  by_agency: Record<string, number>
  by_region: Record<string, number>
}

export type AppealHistoryResponse = {
  data: AppealActionLog[]
  count: number
}

export type AppealsResponse = {
  data: Problem[]
  count: number
}

export type AppealsQuery = {
  agency_id?: number
  appeal_status?: string
  region_id?: number
  is_emergency?: boolean
  q?: string
  sort?: "urgent" | "reports" | "newest"
  skip?: number
  limit?: number
}

export type AppealStatusUpdate = {
  status: string
  agency_id?: number
  note?: string
  due_date?: string
}

export type AppealRouteUpdate = {
  agency_id?: number
  is_emergency?: boolean
}

export type ProblemsResponse = {
  data: Problem[]
  count: number
}

export type Project = {
  id: string
  problem_id: string
  lead_id: string
  title: string
  pitch?: string | null
  repo_url?: string | null
  status: string
  created_at: string
  updated_at?: string
}

export type ProjectsResponse = {
  data: Project[]
  count: number
}

export type Comment = {
  id: string
  problem_id: string
  user_id: string
  author_name?: string | null
  text: string
  parent_id?: string | null
  created_at: string
}

export type CommentsResponse = {
  data: Comment[]
  count: number
}

export type ProblemMedia = {
  id: string
  problem_id?: string | null
  kind: "audio" | "photo" | string
  object_key: string
  url: string
  created_at: string
}

export type ProblemMediaResponse = {
  data: ProblemMedia[]
  count: number
}

export type AIAnalysis = {
  id: string
  problem_id: string
  model: string
  summary_json: Record<string, unknown>
  created_at: string
}

export type AIAnalysisResponse = {
  data: AIAnalysis[]
  count: number
}

export type ProjectMilestone = {
  id: string
  project_id: string
  title: string
  status: string
  due_date?: string | null
  sort_order: number
  created_at: string
}

export type ProjectMilestonesResponse = {
  data: ProjectMilestone[]
  count: number
}

export type ProjectUpdate = {
  id: string
  project_id: string
  author_id: string
  author_name?: string | null
  text: string
  media_keys: string[]
  media?: {
    object_key: string
    kind: "audio" | "photo" | string
    url: string
  }[]
  created_at: string
}

export type ProjectUpdatesResponse = {
  data: ProjectUpdate[]
  count: number
}

export type Review = {
  id: string
  project_id: string
  reviewer_id: string
  rating: number
  text?: string | null
  created_at: string
}

export type ReviewsResponse = {
  data: Review[]
  count: number
}

export type ProjectIssue = {
  id: string
  project_id: string
  author_id: string
  author_name?: string | null
  title: string
  body?: string | null
  kind: "bug" | "feature" | "task" | "question" | string
  status: "open" | "closed" | string
  comment_count: number
  created_at: string
  updated_at: string
  closed_at?: string | null
}

export type ProjectIssuesResponse = {
  data: ProjectIssue[]
  count: number
}

export type IssueComment = {
  id: string
  issue_id: string
  author_id: string
  author_name?: string | null
  text: string
  created_at: string
}

export type IssueCommentsResponse = {
  data: IssueComment[]
  count: number
}

export type AnalyticsOverview = {
  submitted_problems: number
  ai_processing_problems: number
  needs_review_problems: number
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

export type NotificationItem = {
  id: string
  type: string
  payload: Record<string, unknown>
  read_at?: string | null
  created_at: string
}

export type NotificationsResponse = {
  data: NotificationItem[]
  count: number
  unread_count: number
}

export type PresignResponse = {
  upload_url: string
  object_key: string
  method: string
}

const API_BASE = import.meta.env.VITE_API_URL

export function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
  }
}

// Shared refresh promise — prevents multiple parallel refresh requests.
let _refreshPromise: Promise<boolean> | null = null

async function _tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refresh_token")
  if (!refreshToken) return false
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/telegram/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as {
      access_token?: string
      refresh_token?: string
    }
    if (data.access_token) {
      localStorage.setItem("access_token", data.access_token)
      if (data.refresh_token) {
        localStorage.setItem("refresh_token", data.refresh_token)
      }
      return true
    }
    return false
  } catch {
    return false
  }
}

async function _extractError(response: Response): Promise<string> {
  try {
    const body = await response.json()
    return typeof body?.detail === "string" ? body.detail : JSON.stringify(body)
  } catch {
    return await response.text().catch(() => `HTTP ${response.status}`)
  }
}

export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const doFetch = () =>
    fetch(`${API_BASE}/api/v1${path}`, {
      ...init,
      headers: { ...authHeaders(), ...init.headers },
    })

  let response = await doFetch()

  if (response.status === 401) {
    // Coalesce parallel 401s into a single refresh attempt.
    _refreshPromise ??= _tryRefreshToken().finally(() => {
      _refreshPromise = null
    })
    const refreshed = await _refreshPromise

    if (refreshed) {
      response = await doFetch()
    } else {
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
      window.location.href = "/login"
      throw new Error(i18n.t("login_status_expired"))
    }
  }

  if (!response.ok) {
    throw new Error(await _extractError(response))
  }
  return (await response.json()) as T
}

export async function apiMutation<T>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  return apiJson<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function actionProblem(
  problemId: string,
  action: string,
  body?: unknown,
) {
  return apiMutation<Problem>(`/problems/${problemId}/${action}`, body)
}

export async function uploadProblemMedia(
  file: File,
  kind: "audio" | "photo",
): Promise<string> {
  const presign = await apiMutation<PresignResponse>("/media/presign", {
    kind,
    content_type: file.type,
    size: file.size,
  })
  const uploadResponse = await fetch(presign.upload_url, {
    method: presign.method,
    headers: { "Content-Type": file.type },
    body: file,
  })
  if (!uploadResponse.ok) {
    throw new Error(i18n.t("error_upload"))
  }
  return presign.object_key
}

export function uploadProblemAudio(file: File): Promise<string> {
  return uploadProblemMedia(file, "audio")
}

export function uploadProblemPhoto(file: File): Promise<string> {
  return uploadProblemMedia(file, "photo")
}

export function notificationLabel(notification: NotificationItem) {
  const projectTitle =
    typeof notification.payload.project_title === "string"
      ? notification.payload.project_title
      : "Project"
  const problemTitle =
    typeof notification.payload.title === "string"
      ? notification.payload.title
      : "—"
  const commenterName =
    typeof notification.payload.commenter_name === "string" &&
    notification.payload.commenter_name
      ? notification.payload.commenter_name
      : null
  const t = _t()
  const commentedLabel = commenterName
    ? `${commenterName} — ${t("notif_commented")}`
    : `"${problemTitle}" — ${t("notif_commented")}`
  const labels: Record<string, string> = {
    "project.proposed": `${projectTitle} — ${t("notif_proposed")}`,
    "project.approved": `${projectTitle} — ${t("notif_approved")}`,
    "project.rejected": `${projectTitle} — ${t("notif_rejected")}`,
    "project.piloting_started": `${projectTitle} — ${t("notif_piloting")}`,
    "project.completed": `${projectTitle} — ${t("notif_completed")}`,
    "problem.published": `"${problemTitle}" — ${t("notif_published")}`,
    "problem.archived": `"${problemTitle}" — ${t("notif_archived")}`,
    "problem.merged": `"${problemTitle}" — ${t("notif_merged")}`,
    "problem.commented": commentedLabel,
  }
  return labels[notification.type] || notification.type
}

export function notificationLink(
  notification: NotificationItem,
): { to: string; params?: Record<string, string>; hash?: string } | null {
  const problemId =
    typeof notification.payload.problem_id === "string"
      ? notification.payload.problem_id
      : null
  const commentId =
    typeof notification.payload.comment_id === "string"
      ? notification.payload.comment_id
      : null
  const targetProblemId =
    typeof notification.payload.target_problem_id === "string"
      ? notification.payload.target_problem_id
      : null
  const projectId =
    typeof notification.payload.project_id === "string"
      ? notification.payload.project_id
      : null

  if (notification.type === "problem.merged" && targetProblemId) {
    return {
      to: "/problems/$problemId",
      params: { problemId: targetProblemId },
    }
  }
  if (notification.type === "problem.commented" && problemId) {
    return {
      to: "/problems/$problemId",
      params: { problemId },
      hash: commentId ? `comment-${commentId}` : undefined,
    }
  }
  if (
    notification.type === "problem.published" ||
    notification.type === "problem.archived"
  ) {
    if (problemId) return { to: "/problems/$problemId", params: { problemId } }
  }
  if (projectId) {
    return { to: "/projects/$projectId", params: { projectId } }
  }
  if (problemId) {
    return { to: "/problems/$problemId", params: { problemId } }
  }
  return null
}

export function statusLabel(status: string) {
  const t = _t()
  const labels: Record<string, string> = {
    draft: t("status_draft"),
    ai_processing: t("status_ai_processing"),
    needs_review: t("status_needs_review"),
    published: t("status_published"),
    claimed: t("status_claimed"),
    piloting: t("status_piloting"),
    solved: t("status_solved"),
    archived: t("status_archived"),
    proposed: t("status_proposed"),
    approved: t("status_approved"),
    in_progress: t("status_in_progress"),
    completed: t("status_completed"),
    rejected: t("status_rejected"),
    todo: t("status_todo"),
    done: t("status_done"),
  }
  return labels[status] || status
}

const LOCALE_MAP: Record<string, string> = {
  uz: "uz-UZ",
  ru: "ru-RU",
  en: "en-US",
}

export function shortDate(value: string) {
  const lang = i18n.language?.slice(0, 2) ?? "uz"
  const locale = LOCALE_MAP[lang] ?? "uz-UZ"
  return new Date(value).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  })
}

export function fetchSectors(): Promise<Sector[]> {
  return apiJson<Sector[]>("/sectors/")
}

export function fetchRegions(): Promise<Region[]> {
  return apiJson<Region[]>("/regions/")
}

export function structuredSummary(problem: Problem) {
  const summary = problem.structured_desc?.summary
  return typeof summary === "string" && summary ? summary : null
}

// ── Civic appeals ───────────────────────────────────────────────────────────

// A citizen files a civic appeal via the existing problem endpoint with
// track:"civic". The AI assigns agency + emergency automatically — the citizen
// picks nothing else (no sector, agency or severity).
export function submitCivicAppeal(body: {
  raw_text?: string
  raw_audio_key?: string
  photo_keys?: string[]
  region_id?: number
}): Promise<Problem> {
  return apiMutation<Problem>("/problems/", {
    photo_keys: [],
    ...body,
    track: "civic",
  })
}

export function fetchAgencies(): Promise<Agency[]> {
  return apiJson<Agency[]>("/appeals/agencies")
}

export function fetchAppeals(
  params: AppealsQuery = {},
): Promise<AppealsResponse> {
  const search = new URLSearchParams()
  if (params.agency_id != null)
    search.set("agency_id", String(params.agency_id))
  if (params.appeal_status) search.set("appeal_status", params.appeal_status)
  if (params.region_id != null)
    search.set("region_id", String(params.region_id))
  if (params.is_emergency != null)
    search.set("is_emergency", String(params.is_emergency))
  if (params.q) search.set("q", params.q)
  if (params.sort) search.set("sort", params.sort)
  if (params.skip != null) search.set("skip", String(params.skip))
  if (params.limit != null) search.set("limit", String(params.limit))
  const qs = search.toString()
  return apiJson<AppealsResponse>(`/appeals${qs ? `?${qs}` : ""}`)
}

export function fetchAppealStats(): Promise<AppealStats> {
  return apiJson<AppealStats>("/appeals/stats")
}

export function fetchAppealHistory(
  problemId: string,
): Promise<AppealHistoryResponse> {
  return apiJson<AppealHistoryResponse>(`/appeals/${problemId}/history`)
}

export function updateAppealStatus(
  problemId: string,
  body: AppealStatusUpdate,
): Promise<Problem> {
  return apiMutation<Problem>(`/appeals/${problemId}/status`, body)
}

export function rerouteAppeal(
  problemId: string,
  body: AppealRouteUpdate,
): Promise<Problem> {
  return apiMutation<Problem>(`/appeals/${problemId}/route`, body)
}

export function appealStatusLabel(status: string) {
  const t = _t()
  const labels: Record<string, string> = {
    routed: t("appeal_status_routed"),
    accepted: t("appeal_status_accepted"),
    in_progress: t("appeal_status_in_progress"),
    resolved: t("appeal_status_resolved"),
    rejected: t("appeal_status_rejected"),
  }
  return labels[status] || status
}

export function agencyName(agency: Agency, lang?: string) {
  const l = (lang ?? i18n.language?.slice(0, 2) ?? "uz") as string
  return (
    (l === "ru" ? agency.name_ru : l === "en" ? agency.name_en : null) ??
    agency.name_uz
  )
}

export type VoiceChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type VoiceChatResponse = {
  reply_text: string
  ready_to_submit: boolean
  collected_data?: {
    citizen_name?: string
    phone?: string
    location?: string
    problem_description?: string
    suggested_agency_slug?: string
    is_emergency?: boolean
  }
}

export function voiceChatAppeal(
  messages: VoiceChatMessage[],
  language = "uz",
): Promise<VoiceChatResponse> {
  return apiMutation<VoiceChatResponse>("/appeals/voice-chat", {
    messages,
    language,
  })
}

export async function speakAppeal(text: string): Promise<Blob> {
  const token = localStorage.getItem("access_token")
  const res = await fetch(`${API_BASE}/api/v1/appeals/speak`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error("TTS failed")
  return res.blob()
}


export async function transcribeAppeal(
  audioBase64: string,
  mimeType = "audio/webm",
): Promise<string> {
  const data = await apiMutation<{ text: string }>("/appeals/transcribe", {
    audio: audioBase64,
    mime_type: mimeType,
  })
  return data.text || ""
}


