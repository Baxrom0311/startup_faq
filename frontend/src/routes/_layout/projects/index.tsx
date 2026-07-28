import { createFileRoute, Link } from "@tanstack/react-router"
import { Briefcase, Inbox, LayoutGrid, Search } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  CardSkeleton,
  EmptyState,
  StatusBadge,
} from "@/components/Product/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  apiJson,
  type Project,
  type ProjectsResponse,
  shortDate,
} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/projects/")({
  component: Projects,
  head: () => ({
    meta: [{ title: "Projects - SolutionLab" }],
  }),
})

type Tab = "all" | "mine" | "inbox"
const PAGE_SIZE = 20

function Projects() {
  const { t } = useTranslation()
  const [all, setAll] = useState<Project[] | null>(null)
  const [allTotal, setAllTotal] = useState(0)
  const [allSkip, setAllSkip] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [incoming, setIncoming] = useState<Project[] | null>(null)
  const [mine, setMine] = useState<Project[] | null>(null)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [tab, setTab] = useState<Tab>("all")
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350)
    return () => clearTimeout(timer)
  }, [query])

  const loadAll = useCallback(
    async (currentSkip = 0) => {
      const q = debouncedQuery.trim()
        ? `&q=${encodeURIComponent(debouncedQuery.trim())}`
        : ""
      const s = statusFilter ? `&status=${statusFilter}` : ""
      const res = await apiJson<ProjectsResponse>(
        `/projects?limit=${PAGE_SIZE}&skip=${currentSkip}${q}${s}`,
      )
      if (currentSkip === 0) {
        setAll(res.data)
      } else {
        setAll((prev) => [...(prev ?? []), ...res.data])
      }
      setAllTotal(res.count)
    },
    [debouncedQuery, statusFilter],
  )

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const q = debouncedQuery.trim()
      ? `&q=${encodeURIComponent(debouncedQuery.trim())}`
      : ""

    setAllSkip(0)
    setAll(null)

    async function load() {
      try {
        await loadAll(0)
      } catch {
        setAll([])
      }
      try {
        const res = await apiJson<ProjectsResponse>(
          `/projects?owner=true&status=proposed${q}`,
        )
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
  }, [debouncedQuery, statusFilter, loadAll])

  const handleLoadMore = async () => {
    const nextSkip = allSkip + PAGE_SIZE
    setAllSkip(nextSkip)
    setLoadingMore(true)
    try {
      await loadAll(nextSkip)
    } finally {
      setLoadingMore(false)
    }
  }

  const tabs: {
    id: Tab
    label: string
    icon: React.ReactNode
    count: number | null
  }[] = [
    {
      id: "all",
      label: t("projects_all"),
      icon: <LayoutGrid className="size-4" />,
      count: allTotal > 0 ? allTotal : (all?.length ?? null),
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
        <div className="flex flex-col sm:flex-row gap-2 lg:w-auto">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v === "_all" ? "" : v)
              setAllSkip(0)
            }}
          >
            <SelectTrigger className="bg-background h-9 text-sm sm:w-[180px]">
              <SelectValue placeholder={t("project_filter_all_statuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">
                {t("project_filter_all_statuses")}
              </SelectItem>
              <SelectItem value="proposed">{t("status_proposed")}</SelectItem>
              <SelectItem value="approved">{t("status_approved")}</SelectItem>
              <SelectItem value="in_progress">
                {t("status_in_progress")}
              </SelectItem>
              <SelectItem value="piloting">{t("status_piloting")}</SelectItem>
              <SelectItem value="completed">{t("status_completed")}</SelectItem>
              <SelectItem value="rejected">{t("status_rejected")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative lg:w-[300px]">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="bg-background pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("dashboard_search")}
            />
          </div>
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
            <>
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
              {tab === "all" && all !== null && all.length < allTotal && (
                <div className="flex justify-center border-t p-4">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? t("loading") : t("load_more")}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
