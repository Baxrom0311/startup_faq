import { Inbox } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { statusLabel } from "@/lib/product-api"

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant="secondary">{statusLabel(status)}</Badge>
}

export function EmptyState({ message = "Hali hech narsa yo'q" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <Inbox className="text-muted-foreground size-8" strokeWidth={1.5} />
      <p className="text-muted-foreground text-sm">{message}</p>
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
