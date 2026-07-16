import { createFileRoute, Link } from "@tanstack/react-router"
import { Briefcase, Inbox } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  CardSkeleton,
  EmptyState,
  StatusBadge,
} from "@/components/Product/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

  useEffect(() => {
    Promise.all([
      apiJson<ProjectsResponse>("/projects?owner=true&status=proposed"),
      apiJson<ProjectsResponse>("/projects?mine=true"),
    ])
      .then(([incomingData, mineData]) => {
        setIncoming(incomingData.data)
        setMine(mineData.data)
      })
      .catch(() => {
        setIncoming([])
        setMine([])
      })
  }, [])

  return (
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
