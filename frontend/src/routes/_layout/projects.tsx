import { createFileRoute, Link } from "@tanstack/react-router"
import { Briefcase, Inbox } from "lucide-react"
import { useEffect, useState } from "react"

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
  const [incoming, setIncoming] = useState<Project[]>([])
  const [mine, setMine] = useState<Project[]>([])

  useEffect(() => {
    Promise.all([
      apiJson<ProjectsResponse>("/projects?owner=true&status=proposed"),
      apiJson<ProjectsResponse>("/projects?mine=true"),
    ])
      .then(([incomingData, mineData]) => {
        setIncoming(incomingData.data)
        setMine(mineData.data)
      })
      .catch(() => undefined)
  }, [])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ProjectColumn
        title="Incoming proposals"
        icon={<Inbox className="size-4" />}
        projects={incoming}
        empty="Tasdiqlash kutayotgan takliflar yo'q."
      />
      <ProjectColumn
        title="My projects"
        icon={<Briefcase className="size-4" />}
        projects={mine}
        empty="Siz yuritayotgan loyiha yo'q."
      />
    </div>
  )
}

function ProjectColumn({
  title,
  icon,
  projects,
  empty,
}: {
  title: string
  icon: React.ReactNode
  projects: Project[]
  empty: string
}) {
  return (
    <Card className="bg-background">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
          <Badge variant="secondary">{projects.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {projects.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm">{empty}</p>
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
                  <Badge variant="outline">{project.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
