import { useNavigate } from "@tanstack/react-router"
import { FileText, FolderKanban, Loader2, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  apiJson,
  type Problem,
  type ProblemsResponse,
  type Project,
  type ProjectsResponse,
} from "@/lib/product-api"

type SearchDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Results = {
  problems: Problem[]
  projects: Project[]
}

type FlatResult =
  | { type: "problem"; item: Problem }
  | { type: "project"; item: Project }

const LISTBOX_ID = "search-results-listbox"

export default function SearchDialog({
  open,
  onOpenChange,
}: SearchDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
    setQuery("")
    setResults(null)
    setActiveIndex(-1)
  }, [open])

  useEffect(() => {
    setActiveIndex(-1)
  }, [results])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const q = query.trim()
    if (!q) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const controller = new AbortController()
    timerRef.current = setTimeout(async () => {
      try {
        const [problemsRes, projectsRes] = await Promise.all([
          apiJson<ProblemsResponse>(
            `/problems/?q=${encodeURIComponent(q)}&limit=5`,
            { signal: controller.signal },
          ),
          apiJson<ProjectsResponse>(
            `/projects/projects?q=${encodeURIComponent(q)}&limit=5`,
            { signal: controller.signal },
          ),
        ])
        setResults({ problems: problemsRes.data, projects: projectsRes.data })
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults({ problems: [], projects: [] })
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, 350)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      controller.abort()
    }
  }, [query])

  const flatResults: FlatResult[] = results
    ? [
        ...results.problems.map((item) => ({ type: "problem" as const, item })),
        ...results.projects.map((item) => ({ type: "project" as const, item })),
      ]
    : []

  const goTo = (path: string, params: Record<string, string>) => {
    onOpenChange(false)
    navigate({ to: path as any, params: params as any })
  }

  const activateItem = (entry: FlatResult) => {
    if (entry.type === "problem") {
      goTo("/problems/$problemId", { problemId: entry.item.id })
    } else {
      goTo("/projects/$projectId", { projectId: entry.item.id })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatResults.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      activateItem(flatResults[activeIndex])
    }
  }

  const hasResults =
    results && (results.problems.length > 0 || results.projects.length > 0)
  const problemOffset = 0
  const projectOffset = results?.problems.length ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 p-0 sm:max-w-lg"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t("layout_search")}</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3 py-3">
          <Search
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("layout_search_placeholder")}
            className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm"
            role="combobox"
            aria-expanded={!!hasResults}
            aria-autocomplete="list"
            aria-controls={hasResults ? LISTBOX_ID : undefined}
            aria-activedescendant={
              activeIndex >= 0 ? `search-result-${activeIndex}` : undefined
            }
          />
          {loading && (
            <Loader2
              className="size-4 shrink-0 animate-spin text-muted-foreground"
              aria-hidden
            />
          )}
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
          <div
            id={LISTBOX_ID}
            role="listbox"
            aria-label={t("layout_search")}
            className="max-h-80 overflow-y-auto py-2"
          >
            {results.problems.length > 0 && (
              <div>
                <div
                  className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  aria-hidden
                >
                  {t("layout_search_problems")}
                </div>
                {results.problems.map((p, i) => {
                  const idx = problemOffset + i
                  return (
                    <Button
                      key={p.id}
                      id={`search-result-${idx}`}
                      role="option"
                      aria-selected={activeIndex === idx}
                      variant="ghost"
                      className={`w-full justify-start gap-3 rounded-none px-3 py-2 h-auto font-normal${
                        activeIndex === idx ? " bg-accent" : ""
                      }`}
                      onClick={() =>
                        goTo("/problems/$problemId", { problemId: p.id })
                      }
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <FileText
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="truncate text-sm">
                        {p.title || p.raw_text || t("unnamed_problem")}
                      </span>
                    </Button>
                  )
                })}
              </div>
            )}

            {results.projects.length > 0 && (
              <div>
                <div
                  className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  aria-hidden
                >
                  {t("layout_search_projects")}
                </div>
                {results.projects.map((proj, i) => {
                  const idx = projectOffset + i
                  return (
                    <Button
                      key={proj.id}
                      id={`search-result-${idx}`}
                      role="option"
                      aria-selected={activeIndex === idx}
                      variant="ghost"
                      className={`w-full justify-start gap-3 rounded-none px-3 py-2 h-auto font-normal${
                        activeIndex === idx ? " bg-accent" : ""
                      }`}
                      onClick={() =>
                        goTo("/projects/$projectId", { projectId: proj.id })
                      }
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <FolderKanban
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="truncate text-sm">{proj.title}</span>
                    </Button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
