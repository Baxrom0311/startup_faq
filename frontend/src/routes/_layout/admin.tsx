import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { Archive, Bot, GitMerge, RefreshCcw, Users } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { type UserPublic, UsersService } from "@/client"
import { EmptyState, LoadingState } from "@/components/Product/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
    meta: [{ title: "Admin - SignalHub" }],
  }),
})

function Admin() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<UserPublic[] | null>(null)
  const [problems, setProblems] = useState<Problem[] | null>(null)
  const [analyses, setAnalyses] = useState<Record<string, AIAnalysis | null>>(
    {},
  )

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

  useEffect(() => {
    UsersService.readUsers({ skip: 0, limit: 100 })
      .then((response) => setUsers(response.data))
      .catch(() => setUsers([]))
    loadReview().catch(() => {
      toast.error("Error")
      setProblems([])
    })
  }, [loadReview])

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
      toast.success("Done")
      await loadReview()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error")
    }
  }

  if (!users || !problems) return <LoadingState />

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <main className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin_title")}</h1>

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
                        {problem.title || problem.raw_text || "Problem"}
                      </Link>
                      <div className="text-muted-foreground mt-1 flex flex-wrap gap-2 text-xs">
                        <span>{shortDate(problem.created_at)}</span>
                        {problem.severity_score != null && (
                          <span>score: {problem.severity_score}</span>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                        {structuredSummary(problem) ||
                          problem.raw_text ||
                          "Audio"}
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
                        <Badge variant="outline">Admin</Badge>
                      )}
                      <Badge variant={user.is_active ? "secondary" : "outline"}>
                        {user.is_active ? "Active" : "Off"}
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
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Problem[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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
          <span className="text-muted-foreground text-xs">AI:</span>
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
            Merge
          </Button>
        </div>
      )}
      <div
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
            placeholder="Search or paste ID..."
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
                  {p.title || p.raw_text || "Problem"}
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  {p.id.slice(0, 8)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

