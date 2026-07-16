import { Briefcase, LayoutDashboard, Shield } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { LangSwitcher } from "@/components/Common/LangSwitcher"
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
  const { t, i18n } = useTranslation()
  const { user: currentUser } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    apiJson<NotificationsResponse>("/notifications?limit=1")
      .then((r) => setUnreadCount(r.unread_count))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const lang = currentUser?.language
    if (lang && i18n.language?.slice(0, 2) !== lang) {
      i18n.changeLanguage(lang)
    }
  }, [currentUser?.language, i18n])

  const baseItems: Item[] = [
    {
      icon: LayoutDashboard,
      title: t("nav_signals"),
      path: "/",
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { icon: Briefcase, title: t("nav_projects"), path: "/projects" },
  ]

  const items = currentUser?.is_superuser
    ? [...baseItems, { icon: Shield, title: t("nav_admin"), path: "/admin" }]
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
        <LangSwitcher />
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
