import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import {
  Archive,
  BarChart3,
  Bot,
  Download,
  GitMerge,
  PieChart,
  RefreshCcw,
  Users,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { type UserPublic, UsersService } from "@/client"
import BroadcastsManager from "@/components/Admin/BroadcastsManager"
import { EmptyState, LoadingState } from "@/components/Product/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  type AIAnalysis,
  type AIAnalysisResponse,
  actionProblem,
  apiJson,
  type Problem,
  type ProblemsResponse,
  shortDate,
  structuredSummary,
} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/admin")({
  component: Admin,
  beforeLoad: async () => {
    const user = await UsersService.readUserMe()
    if (!user.is_superuser) {
      throw redirect({ to: "/" })
    }
  },
  head: () => ({
    meta: [{ title: "Admin - SolutionLab" }],
  }),
})

function Admin() {
  const { t, i18n } = useTranslation()
  const [users, setUsers] = useState<UserPublic[] | null>(null)
  const [problems, setProblems] = useState<Problem[] | null>(null)
  const [analyses, setAnalyses] = useState<Record<string, AIAnalysis | null>>(
    {},
  )
  const [sectorAnalytics, setSectorAnalytics] = useState<any[] | null>(null)
  const [trendAnalytics, setTrendAnalytics] = useState<any[] | null>(null)
  const [overviewAnalytics, setOverviewAnalytics] = useState<any | null>(null)

  const loadReview = useCallback(async () => {
    const response = await apiJson<ProblemsResponse>(
      "/problems/?status=published&limit=50",
    )
    setProblems(response.data)
    const analysisPairs = await Promise.all(
      response.data.map(async (problem) => {
        try {
          const analysis = await apiJson<AIAnalysisResponse>(
            `/problems/${problem.id}/analyses`,
          )
          return [problem.id, analysis.data[0] || null] as const
        } catch {
          return [problem.id, null] as const
        }
      }),
    )
    setAnalyses(Object.fromEntries(analysisPairs))
  }, [])

  const loadAnalytics = useCallback(async () => {
    try {
      const [sectorsData, trendData, overviewData] = await Promise.all([
        apiJson<any[]>("/analytics/by-sector"),
        apiJson<any[]>("/analytics/trend?days=30"),
        apiJson<any>("/analytics/overview"),
      ])
      setSectorAnalytics(sectorsData)
      setTrendAnalytics(trendData)
      setOverviewAnalytics(overviewData)
    } catch {
      setSectorAnalytics([])
      setTrendAnalytics([])
      setOverviewAnalytics(null)
    }
  }, [])

  useEffect(() => {
    UsersService.readUsers({ skip: 0, limit: 100 })
      .then((response) => setUsers(response.data))
      .catch(() => setUsers([]))
    loadReview().catch(() => {
      toast.error(t("error_generic"))
      setProblems([])
    })
    loadAnalytics().catch(() => undefined)
  }, [loadReview, loadAnalytics, t])

  const runAction = async (
    problemId: string,
    action: "publish" | "archive" | "merge" | "reanalyze",
    mergeTargetId?: string,
  ) => {
    try {
      if (action === "merge") {
        if (!mergeTargetId?.trim()) return
        await actionProblem(problemId, "merge", {
          target_problem_id: mergeTargetId.trim(),
        })
      } else {
        await actionProblem(problemId, action)
      }
      toast.success(t("problem_action_done"))
      await loadReview()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error_generic"))
    }
  }

  const exportCsv = () => {
    const token = localStorage.getItem("access_token")
    if (!token) return
    const apiBase = import.meta.env.VITE_API_URL || ""
    const downloadUrl = `${apiBase}/problems/export/csv?token=${token}`
    window.open(downloadUrl, "_blank")
  }

  if (!users || !problems) return <LoadingState />

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <main className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("admin_title")}
        </h1>

        <Tabs defaultValue="moderation" className="w-full flex flex-col gap-4">
          <TabsList className="mr-auto">
            <TabsTrigger value="moderation">
              {t("admin_tab_moderation")}
            </TabsTrigger>
            <TabsTrigger value="broadcasts">
              {t("admin_tab_broadcasts")}
            </TabsTrigger>
            <TabsTrigger value="analytics">
              {t("admin_tab_analytics")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="moderation" className="mt-0 flex flex-col gap-4">
            <Card className="bg-background shadow-none">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="size-4" />
                  {t("admin_feed_title")}
                  <Badge variant="secondary">{problems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {problems.length === 0 ? (
                  <div className="p-6">
                    <EmptyState />
                  </div>
                ) : (
                  <div className="divide-y">
                    {problems.map((problem) => (
                      <div key={problem.id} className="grid gap-3 px-4 py-4">
                        <div className="min-w-0">
                          <Link
                            to="/problems/$problemId"
                            params={{ problemId: problem.id }}
                            className="block truncate text-sm font-medium hover:underline"
                          >
                            {problem.title ||
                              problem.raw_text ||
                              t("unnamed_problem")}
                          </Link>
                          <div className="text-muted-foreground mt-1 flex flex-wrap gap-2 text-xs">
                            <span>{shortDate(problem.created_at)}</span>
                            {problem.severity_score != null && (
                              <span>
                                {t("admin_score")}: {problem.severity_score}
                              </span>
                            )}
                          </div>
                          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                            {structuredSummary(problem) ||
                              problem.raw_text ||
                              t("audio_only")}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => runAction(problem.id, "reanalyze")}
                          >
                            <RefreshCcw />
                            {t("admin_reanalyze")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => runAction(problem.id, "archive")}
                          >
                            <Archive />
                            {t("admin_archive")}
                          </Button>
                        </div>
                        <MergeTargetPicker
                          aiSuggestedId={
                            typeof analyses[problem.id]?.summary_json
                              .duplicate_of === "string"
                              ? (analyses[problem.id]!.summary_json
                                  .duplicate_of as string)
                              : null
                          }
                          onMerge={(targetId) =>
                            runAction(problem.id, "merge", targetId)
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="broadcasts" className="mt-0">
            <BroadcastsManager />
          </TabsContent>

          <TabsContent value="analytics" className="mt-0 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium tracking-tight">
                {t("admin_tab_analytics")}
              </h2>
              <Button onClick={exportCsv} className="flex items-center gap-1.5">
                <Download className="size-4" />
                {t("admin_export_problems")}
              </Button>
            </div>

            {overviewAnalytics && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-background shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                      {t("analytics_total_problems")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {overviewAnalytics.submitted_problems}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-background shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                      {t("problem_solve")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {overviewAnalytics.solved_problems}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-background shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                      {t("nav_projects")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {overviewAnalytics.active_projects}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-background shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                      {t("analytics_claim_solve_rate")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {Math.round(overviewAnalytics.claim_to_solved_rate * 100)}
                      %
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Sector Breakdown */}
              <Card className="bg-background shadow-none">
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PieChart className="size-4" />
                    {t("analytics_sector_breakdown")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {sectorAnalytics && sectorAnalytics.length > 0 ? (
                    <div className="space-y-4">
                      {sectorAnalytics.map((sect) => {
                        const total = sectorAnalytics.reduce(
                          (acc, curr) => acc + curr.problem_count,
                          0,
                        )
                        const pct =
                          total > 0
                            ? Math.round((sect.problem_count / total) * 100)
                            : 0
                        return (
                          <div key={sect.sector_id} className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span>
                                {sect[`name_${i18n.language.slice(0, 2)}`] ??
                                  sect.name_uz}
                              </span>
                              <span className="text-muted-foreground">
                                {sect.problem_count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      {t("analytics_no_data")}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Trend dynamics */}
              <Card className="bg-background shadow-none">
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="size-4" />
                    {t("analytics_trend")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {trendAnalytics && trendAnalytics.length > 0 ? (
                    <div className="flex items-end justify-between gap-1 h-48 pt-6">
                      {trendAnalytics.map((trend, idx) => {
                        const maxCount = Math.max(
                          ...trendAnalytics.map((t) => t.count),
                          1,
                        )
                        const heightPct = Math.min(
                          Math.max((trend.count / maxCount) * 100, 4),
                          100,
                        )
                        return (
                          <div
                            key={trend.date || idx}
                            className="flex-1 flex flex-col items-center group relative h-full justify-end"
                          >
                            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-popover border text-popover-foreground text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap shadow-sm z-10">
                              {trend.date}: <strong>{trend.count}</strong>
                            </div>
                            <div
                              className="w-full bg-primary/70 hover:bg-primary rounded-t-sm transition-all duration-300 cursor-pointer"
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      {t("analytics_no_data")}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <aside>
        <Card className="bg-background shadow-none">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              {t("admin_users_title")}
              <Badge variant="secondary">{users.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {users.length === 0 ? (
              <div className="p-6">
                <EmptyState />
              </div>
            ) : (
              <div className="divide-y">
                {users.map((user) => (
                  <div key={user.id} className="grid gap-2 px-4 py-3">
                    <p className="truncate text-sm font-medium">
                      {user.full_name || user.phone || user.email}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {user.is_superuser && (
                        <Badge variant="outline">{t("settings_admin")}</Badge>
                      )}
                      <Badge variant={user.is_active ? "secondary" : "outline"}>
                        {user.is_active
                          ? t("settings_active")
                          : t("settings_inactive")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}

function MergeTargetPicker({
  aiSuggestedId,
  onMerge,
}: {
  aiSuggestedId?: string | null
  onMerge: (targetId: string) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Problem[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLFieldSetElement>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      try {
        const response = await apiJson<ProblemsResponse>(
          `/problems/?status=published&q=${encodeURIComponent(query)}&limit=8`,
        )
        setResults(response.data)
        setOpen(true)
      } catch {
        setResults([])
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  const handleSelect = (problem: Problem) => {
    setSelectedId(problem.id)
    setQuery(problem.title || problem.raw_text || problem.id)
    setResults([])
    setOpen(false)
  }

  const handleMerge = () => {
    const targetId = selectedId || query.trim()
    if (!targetId) return
    onMerge(targetId)
    setSelectedId("")
    setQuery("")
    setResults([])
  }

  return (
    <div className="grid gap-2">
      {aiSuggestedId && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950">
          <Bot className="text-muted-foreground size-3.5 shrink-0" />
          <span className="text-muted-foreground text-xs">
            {t("ai_panel_title")}:
          </span>
          <Link
            to="/problems/$problemId"
            params={{ problemId: aiSuggestedId }}
            className="min-w-0 flex-1 truncate font-mono text-xs hover:underline"
            target="_blank"
          >
            {aiSuggestedId.slice(0, 8)}
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            onClick={() => onMerge(aiSuggestedId)}
          >
            <GitMerge className="size-3" />
            {t("admin_merge")}
          </Button>
        </div>
      )}
      <fieldset
        ref={containerRef}
        className="relative"
        onBlur={(e) => {
          if (!containerRef.current?.contains(e.relatedTarget as Node)) {
            setOpen(false)
          }
        }}
      >
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => {
              setSelectedId("")
              setQuery(e.target.value)
            }}
            onFocus={() => {
              if (results.length > 0) setOpen(true)
            }}
            placeholder={t("admin_merge_placeholder")}
          />
          <Button
            variant="outline"
            size="icon"
            disabled={!selectedId && !query.trim()}
            onClick={handleMerge}
          >
            <GitMerge />
          </Button>
        </div>
        {open && results.length > 0 && (
          <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-52 overflow-y-auto rounded-md border bg-background shadow-md">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted/50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(p)}
              >
                <span className="truncate text-sm font-medium">
                  {p.title || p.raw_text || t("unnamed_problem")}
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  {p.id.slice(0, 8)}
                </span>
              </button>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  )
}
