import { createFileRoute, Link } from "@tanstack/react-router"
import { CalendarDays, FolderKanban, Star, ThumbsUp } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { EmptyState, LoadingState, StatusBadge } from "@/components/Product/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  apiJson,
  type Problem,
  type ProblemsResponse,
  type Project,
  type ProjectsResponse,
  shortDate,
} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/users/$userId")({
  component: UserProfile,
  head: () => ({
    meta: [{ title: "Profile - SolutionLab" }],
  }),
})

type UserProfilePublic = {
  id: string
  full_name: string | null
  bio: string | null
  reputation: number
  created_at: string | null
}

function UserProfile() {
  const { t } = useTranslation()
  const { userId } = Route.useParams()

  const [profile, setProfile] = useState<UserProfilePublic | null>(null)
  const [problems, setProblems] = useState<Problem[] | null>(null)
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    apiJson<UserProfilePublic>(`/users/${userId}/profile`)
      .then(setProfile)
      .catch(() => setNotFound(true))

    apiJson<ProblemsResponse>(`/problems/?author_id=${userId}&limit=20`)
      .then((r) => setProblems(r.data))
      .catch(() => setProblems([]))

    apiJson<ProjectsResponse>(`/projects/projects?limit=20`)
      .then((r) => {
        // filter by lead_id client-side since backend doesn't expose lead_id filter publicly
        setProjects(r.data.filter((p) => p.lead_id === userId))
      })
      .catch(() => setProjects([]))
  }, [userId])

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-muted-foreground text-sm">Foydalanuvchi topilmadi.</p>
      </div>
    )
  }

  if (!profile) return <LoadingState />

  const initials = profile.full_name
    ? profile.full_name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("")
    : "?"

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-6">
      {/* Profile header */}
      <Card className="bg-background shadow-none">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold truncate">
                {profile.full_name || "—"}
              </h1>
              {profile.bio && (
                <p className="text-muted-foreground mt-1 text-sm line-clamp-3">
                  {profile.bio}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {profile.created_at && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3.5" />
                    {t("profile_joined")}: {shortDate(profile.created_at)}
                  </span>
                )}
                {profile.reputation > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="size-3.5" />
                    {t("profile_reputation")}: {profile.reputation}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="problems">
        <TabsList className="mr-auto">
          <TabsTrigger value="problems" className="gap-1.5">
            {t("profile_problems")}
            {problems !== null && (
              <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] leading-none">
                {problems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5">
            {t("profile_projects")}
            {projects !== null && (
              <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] leading-none">
                {projects.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="problems" className="mt-4">
          <Card className="bg-background shadow-none">
            <CardContent className="p-0">
              {problems === null ? (
                <LoadingState />
              ) : problems.length === 0 ? (
                <div className="p-6">
                  <EmptyState message={t("profile_no_problems")} />
                </div>
              ) : (
                <div className="divide-y">
                  {problems.map((p) => (
                    <Link
                      key={p.id}
                      to="/problems/$problemId"
                      params={{ problemId: p.id }}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {p.title || p.raw_text || t("unnamed_problem")}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusBadge status={p.status} />
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <ThumbsUp className="size-3" />
                            {p.vote_count}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {shortDate(p.created_at)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <Card className="bg-background shadow-none">
            <CardContent className="p-0">
              {projects === null ? (
                <LoadingState />
              ) : projects.length === 0 ? (
                <div className="p-6">
                  <EmptyState message={t("profile_no_projects")} />
                </div>
              ) : (
                <div className="divide-y">
                  {projects.map((proj) => (
                    <Link
                      key={proj.id}
                      to="/projects/$projectId"
                      params={{ projectId: proj.id }}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <FolderKanban className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{proj.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusBadge status={proj.status} />
                          <span className="text-xs text-muted-foreground">
                            {shortDate(proj.created_at)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
