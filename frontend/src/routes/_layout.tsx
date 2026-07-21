import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { AlertCircle, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import SearchDialog from "@/components/Common/SearchDialog"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { isLoggedIn } from "@/hooks/useAuth"

function LayoutError({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertCircle
        className="text-muted-foreground size-10"
        strokeWidth={1.5}
      />
      <div className="grid gap-1">
        <p className="text-sm font-medium">{t("layout_error")}</p>
        <p className="text-muted-foreground text-xs">{error.message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={reset}>
        {t("layout_retry")}
      </Button>
    </div>
  )
}

export const Route = createFileRoute("/_layout")({
  component: Layout,
  errorComponent: ({ error, reset }) => (
    <LayoutError error={error as Error} reset={reset} />
  ),
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  const { t } = useTranslation()
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background/95 sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
          <button
            onClick={() => setSearchOpen(true)}
            className="bg-muted/60 text-muted-foreground hidden h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm md:flex hover:bg-muted/80 transition-colors"
          >
            <Search className="size-4 shrink-0" />
            <span className="flex-1 text-left truncate">{t("layout_search")}</span>
            <kbd className="pointer-events-none hidden select-none items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[11px] font-mono opacity-60 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </header>
        <main className="bg-muted/20 flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </SidebarProvider>
  )
}
