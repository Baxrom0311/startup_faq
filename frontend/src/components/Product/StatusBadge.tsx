import { Inbox } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Skeleton } from "@/components/ui/skeleton"
import { statusLabel } from "@/lib/product-api"

const STATUS_COLORS: Record<string, string> = {
  published:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  claimed:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800",
  piloting:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  solved:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-800",
  needs_review:
    "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800",
  archived: "bg-muted text-muted-foreground border-transparent",
  ai_processing: "bg-muted text-muted-foreground border-transparent",
  draft: "bg-muted text-muted-foreground border-transparent",
}

export function StatusBadge({ status }: { status: string }) {
  const color =
    STATUS_COLORS[status] ?? "bg-muted text-muted-foreground border-transparent"
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {statusLabel(status)}
    </span>
  )
}

export function EmptyState({ message }: { message?: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <Inbox className="text-muted-foreground size-8" strokeWidth={1.5} />
      <p className="text-muted-foreground text-sm">
        {message ?? t("empty_state")}
      </p>
    </div>
  )
}

export function LoadingState() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  )
}
