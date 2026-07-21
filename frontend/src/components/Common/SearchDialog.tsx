import { useNavigate } from "@tanstack/react-router"
import { FileText, FolderKanban, Loader2, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { type Problem, type Project, apiJson, type ProblemsResponse, type ProjectsResponse } from "@/lib/product-api"

type SearchDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Results = {
  problems: Problem[]
  projects: Project[]
}

export default function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery("")
      setResults(null)
    }
  }, [open])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const q = query.trim()
    if (!q) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    timerRef.current = setTimeout(async () => {
      try {
        const [problemsRes, projectsRes] = await Promise.all([
          apiJson<ProblemsResponse>(`/problems/?q=${encodeURIComponent(q)}&limit=5`),
          apiJson<ProjectsResponse>(`/projects/projects?q=${encodeURIComponent(q)}&limit=5`),
        ])
        setResults({ problems: problemsRes.data, projects: projectsRes.data })
      } catch {
        setResults({ problems: [], projects: [] })
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  const goTo = (path: string, params: Record<string, string>) => {
    onOpenChange(false)
    navigate({ to: path as any, params })
  }

  const hasResults = results && (results.problems.length > 0 || results.projects.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{t("layout_search")}</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("layout_search_placeholder")}
            className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm"
          />
          {loading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
        </div>

        {!query.trim() && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("layout_search_hint")}
          </div>
        )}

        {query.trim() && !loading && !hasResults && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("layout_search_empty")}
          </div>
        )}

        {hasResults && (
          <div className="max-h-80 overflow-y-auto py-2">
            {results.problems.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("layout_search_problems")}
                </div>
                {results.problems.map((p) => (
                  <Button
                    key={p.id}
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-none px-3 py-2 h-auto font-normal"
                    onClick={() => goTo("/problems/$problemId", { problemId: p.id })}
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm">
                      {p.title || p.raw_text || t("unnamed_problem")}
                    </span>
                  </Button>
                ))}
              </div>
            )}

            {results.projects.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("layout_search_projects")}
                </div>
                {results.projects.map((proj) => (
                  <Button
                    key={proj.id}
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-none px-3 py-2 h-auto font-normal"
                    onClick={() => goTo("/projects/$projectId", { projectId: proj.id })}
                  >
                    <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm">{proj.title}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
