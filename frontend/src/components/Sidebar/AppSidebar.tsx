import { Briefcase, LayoutDashboard, Shield } from "lucide-react"
import { useEffect, useState } from "react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { apiJson, type NotificationsResponse } from "@/lib/product-api"
import { type Item, Main } from "./Main"
import { User } from "./User"

export function AppSidebar() {
  const { user: currentUser } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    apiJson<NotificationsResponse>("/notifications?limit=1")
      .then((r) => setUnreadCount(r.unread_count))
      .catch(() => {})
  }, [])

  const baseItems: Item[] = [
    {
      icon: LayoutDashboard,
      title: "Signals",
      path: "/",
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { icon: Briefcase, title: "Projects", path: "/projects" },
  ]

  const items = currentUser?.is_superuser
    ? [...baseItems, { icon: Shield, title: "Admin", path: "/admin" }]
    : baseItems

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
