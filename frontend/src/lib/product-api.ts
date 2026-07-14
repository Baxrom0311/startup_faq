export type Problem = {
  id: string
  author_id: string
  title?: string | null
  raw_text?: string | null
  raw_audio_key?: string | null
  structured_desc?: Record<string, unknown> | null
  status: string
  vote_count: number
  severity_score?: number | null
  created_at: string
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
  text: string
  parent_id?: string | null
  created_at: string
}

export type CommentsResponse = {
  data: Comment[]
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
  text: string
  media_keys: string[]
  created_at: string
}

export type ProjectUpdatesResponse = {
  data: ProjectUpdate[]
  count: number
}

export type AnalyticsOverview = {
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

export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...init.headers,
    },
  })
  if (!response.ok) {
    throw new Error(await response.text())
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

export async function uploadProblemAudio(file: File): Promise<string> {
  const presign = await apiMutation<PresignResponse>("/media/presign", {
    kind: "audio",
    content_type: file.type,
    size: file.size,
  })
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

export function notificationLabel(notification: NotificationItem) {
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

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ai_processing: "AI",
    needs_review: "Review",
    published: "Open",
    proposed: "New",
    approved: "Approved",
    claimed: "Claimed",
    in_progress: "Active",
    piloting: "Pilot",
    completed: "Done",
    solved: "Solved",
    rejected: "Rejected",
  }
  return labels[status] || status
}

export function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export function structuredSummary(problem: Problem) {
  const summary = problem.structured_desc?.summary
  return typeof summary === "string" && summary ? summary : null
}
