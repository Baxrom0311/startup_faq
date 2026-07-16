import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { AlertCircle, Search } from "lucide-react"

import AppSidebar from "@/components/Sidebar/AppSidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { isLoggedIn } from "@/hooks/useAuth"

function LayoutError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertCircle className="text-muted-foreground size-10" strokeWidth={1.5} />
      <div className="grid gap-1">
        <p className="text-sm font-medium">Xatolik yuz berdi</p>
        <p className="text-muted-foreground text-xs">{error.message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={reset}>
        Qayta urinish
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
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background/95 sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
          <div className="bg-muted/60 text-muted-foreground hidden h-9 min-w-0 flex-1 items-center gap-2 rounded-md border px-3 text-sm md:flex">
            <Search className="size-4 shrink-0" />
            <span className="truncate">Search</span>
          </div>
          <Badge variant="secondary" className="ml-auto hidden sm:inline-flex">
            Beta
          </Badge>
        </header>
        <main className="bg-muted/20 flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
