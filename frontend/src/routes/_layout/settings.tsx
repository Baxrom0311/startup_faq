import { createFileRoute } from "@tanstack/react-router"

import DeleteConfirmation from "@/components/UserSettings/DeleteConfirmation"
import { CardSkeleton } from "@/components/Product/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/settings")({
  component: Settings,
  head: () => ({
    meta: [{ title: "Settings - SignalHub" }],
  }),
})

function Settings() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="bg-background shadow-none">
          <CardHeader className="border-b">
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardSkeleton rows={4} />
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <main className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <Card className="bg-background shadow-none">
          <CardHeader className="border-b">
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4">
            <Info label="Name" value={user.full_name || "Empty"} />
            <Info label="Phone" value={user.phone || "Empty"} />
            <Info label="Telegram" value={user.telegram_username || "Empty"} />
            <Info label="Email" value={user.email} />
          </CardContent>
        </Card>
      </main>

      <aside>
        <Card className="bg-background shadow-none">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              Access
              {user.is_superuser && <Badge variant="outline">Admin</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4">
            <Info label="Status" value={user.is_active ? "Active" : "Off"} />
            <Info label="Roles" value={user.roles?.join(", ") || "User"} />
            <div className="pt-2">
              <DeleteConfirmation />
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  )
}
