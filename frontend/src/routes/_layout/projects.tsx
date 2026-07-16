import { createFileRoute, Link } from "@tanstack/react-router"
import { Briefcase, Inbox, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  CardSkeleton,
  EmptyState,
  StatusBadge,
} from "@/components/Product/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { apiJson, type Project, type ProjectsResponse } from "@/lib/product-api"

export const Route = createFileRoute("/_layout/projects")({
  component: Projects,
  head: () => ({
    meta: [{ title: "Projects - SignalHub" }],
  }),
})

function Projects() {
  const { t } = useTranslation()
  const [incoming, setIncoming] = useState<Project[] | null>(null)
  const [mine, setMine] = useState<Project[] | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const qParam = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""
    Promise.all([
      apiJson<ProjectsResponse>(
        `/projects?owner=true&status=proposed${qParam}`,
      ),
      apiJson<ProjectsResponse>(`/projects?mine=true${qParam}`),
    ])
      .then(([incomingData, mineData]) => {
        setIncoming(incomingData.data)
        setMine(mineData.data)
      })
      .catch(() => {
        setIncoming([])
        setMine([])
      })
  }, [query])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("nav_projects")}
          </h1>
        </div>
        <div className="relative lg:w-[360px]">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="bg-background pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("dashboard_search")}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProjectColumn
          title={t("projects_inbox")}
          icon={<Inbox className="size-4" />}
          projects={incoming}
        />
        <ProjectColumn
          title={t("projects_mine")}
          icon={<Briefcase className="size-4" />}
          projects={mine}
        />
      </div>
    </div>
  )
}

function ProjectColumn({
  title,
  icon,
  projects,
}: {
  title: string
  icon: React.ReactNode
  projects: Project[] | null
}) {
  return (
    <Card className="bg-background shadow-none">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
          {projects !== null && (
            <Badge variant="secondary">{projects.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {projects === null ? (
          <CardSkeleton rows={3} />
        ) : projects.length === 0 ? (
          <div className="p-6">
            <EmptyState />
          </div>
        ) : (
          <div className="divide-y">
            {projects.map((project) => (
              <Link
                key={project.id}
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                className="block px-4 py-3 hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">
                      {project.title}
                    </h3>
                    {project.pitch && (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                        {project.pitch}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={project.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
