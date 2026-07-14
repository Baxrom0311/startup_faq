import { Link } from "@tanstack/react-router"
import { Network } from "lucide-react"

import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  const content =
    variant === "responsive" ? (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
          <Network className="size-4" />
        </span>
        <span className="min-w-0 font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
          SignalHub
        </span>
      </div>
    ) : (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
          <Network className="size-4" />
        </span>
        {variant === "full" && <span className="font-semibold">SignalHub</span>}
      </div>
    )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
