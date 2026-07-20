import { createFileRoute, Link } from "@tanstack/react-router"
import { Briefcase, Inbox, LayoutGrid, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  CardSkeleton,
  EmptyState,
  StatusBadge,
} from "@/components/Product/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { apiJson, shortDate, type Project, type ProjectsResponse } from "@/lib/product-api"

export const Route = createFileRoute("/_layout/projects/")({
  component: Projects,
  head: () => ({
    meta: [{ title: "Projects - SolutionLab" }],
  }),
})

type Tab = "all" | "mine" | "inbox"

function Projects() {
  const { t } = useTranslation()
  const [all, setAll] = useState<Project[] | null>(null)
  const [incoming, setIncoming] = useState<Project[] | null>(null)
  const [mine, setMine] = useState<Project[] | null>(null)
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<Tab>("all")
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Cancel previous inflight requests
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const q = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""

    async function load() {
      try {
        const res = await apiJson<ProjectsResponse>(`/projects?limit=100${q}`)
        setAll(res.data)
      } catch {
        setAll([])
      }
      try {
        const res = await apiJson<ProjectsResponse>(`/projects?owner=true&status=proposed${q}`)
        setIncoming(res.data)
      } catch {
        setIncoming([])
      }
      try {
        const res = await apiJson<ProjectsResponse>(`/projects?mine=true${q}`)
        setMine(res.data)
      } catch {
        setMine([])
      }
    }

    load()
  }, [query])

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number | null }[] = [
    {
      id: "all",
      label: t("projects_all"),
      icon: <LayoutGrid className="size-4" />,
      count: all?.length ?? null,
    },
    {
      id: "mine",
      label: t("projects_mine"),
      icon: <Briefcase className="size-4" />,
      count: mine?.length ?? null,
    },
    {
      id: "inbox",
      label: t("projects_inbox"),
      icon: <Inbox className="size-4" />,
      count: incoming?.length ?? null,
    },
  ]

  const activeProjects = tab === "all" ? all : tab === "mine" ? mine : incoming

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
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("dashboard_search")}
          />
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-0 border-b">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === tb.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tb.icon}
            {tb.label}
            {tb.count !== null && (
              <Badge
                variant={tab === tb.id ? "default" : "secondary"}
                className="ml-0.5 text-xs"
              >
                {tb.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      <Card className="bg-background shadow-none">
        <CardContent className="p-0">
          {activeProjects === null ? (
            <CardSkeleton rows={4} />
          ) : activeProjects.length === 0 ? (
            <div className="p-10">
              <EmptyState />
            </div>
          ) : (
            <div className="divide-y">
              {activeProjects.map((project) => (
                <Link
                  key={project.id}
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Briefcase className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        {project.title}
                      </span>
                      <StatusBadge status={project.status} />
                    </div>
                    {project.pitch && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                        {project.pitch}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-1 text-xs">
                      {shortDate(project.created_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
