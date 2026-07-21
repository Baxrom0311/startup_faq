import { createFileRoute, Link } from "@tanstack/react-router"
import { Bell, CheckCheck } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { CardSkeleton, EmptyState } from "@/components/Product/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  apiJson,
  apiMutation,
  type NotificationItem,
  type NotificationsResponse,
  notificationLabel,
  notificationLink,
  shortDate,
} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/notifications")({
  component: NotificationsPage,
  head: () => ({
    meta: [{ title: "Notifications - SolutionLab" }],
  }),
})

const PAGE_SIZE = 20

function NotificationsPage() {
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState<NotificationItem[] | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [skip, setSkip] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [marking, setMarking] = useState(false)

  const load = useCallback(
    async (currentSkip = 0) => {
      const unreadParam = unreadOnly ? "&unread_only=true" : ""
      const res = await apiJson<NotificationsResponse>(
        `/notifications?skip=${currentSkip}&limit=${PAGE_SIZE}${unreadParam}`,
      )
      if (currentSkip === 0) {
        setNotifications(res.data)
      } else {
        setNotifications((prev) => [...(prev ?? []), ...res.data])
      }
      setTotalCount(res.count)
      setUnreadCount(res.unread_count)
    },
    [unreadOnly],
  )

  useEffect(() => {
    setSkip(0)
    setNotifications(null)
    load(0).catch(() => setNotifications([]))
  }, [load])

  const handleLoadMore = async () => {
    const nextSkip = skip + PAGE_SIZE
    setSkip(nextSkip)
    setLoadingMore(true)
    try {
      await load(nextSkip)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return
    setMarking(true)
    try {
      await apiMutation("/notifications/read", { notification_ids: [] })
      await load(0)
      setSkip(0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_mark_read"))
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Bell className="size-7" />
            {t("notif_page_title")}
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-sm">
                {unreadCount}
              </Badge>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setUnreadOnly(false)}
              className={`px-4 py-1.5 font-medium transition-colors ${
                !unreadOnly ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
              }`}
            >
              {t("notif_page_all")}
            </button>
            <button
              type="button"
              onClick={() => setUnreadOnly(true)}
              className={`px-4 py-1.5 font-medium transition-colors ${
                unreadOnly ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
              }`}
            >
              {t("notif_page_unread_only")}
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={unreadCount === 0 || marking}
            onClick={handleMarkAllRead}
          >
            <CheckCheck className="size-4" />
            {t("notif_mark_all_read")}
          </Button>
        </div>
      </div>

      <Card className="bg-background shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {notifications !== null && (
              <span>{totalCount} {t("notif_page_title").toLowerCase()}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {notifications === null ? (
            <CardSkeleton rows={6} />
          ) : notifications.length === 0 ? (
            <div className="py-10">
              <EmptyState message={t("notif_page_empty")} />
            </div>
          ) : (
            <>
              <div className="divide-y">
                {notifications.map((notification) => {
                  const link = notificationLink(notification)
                  const inner = (
                    <div className="flex items-start justify-between gap-3 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {notificationLabel(notification)}
                        </p>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {shortDate(notification.created_at)}
                        </p>
                      </div>
                      {!notification.read_at && (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                  )
                  return link ? (
                    <Link
                      key={notification.id}
                      to={link.to as string}
                      params={link.params}
                      className={`block transition-colors hover:bg-muted/40 ${!notification.read_at ? "bg-primary/5" : ""}`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div
                      key={notification.id}
                      className={!notification.read_at ? "bg-primary/5" : ""}
                    >
                      {inner}
                    </div>
                  )
                })}
              </div>
              {notifications.length < totalCount && (
                <div className="flex justify-center border-t p-4">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? t("loading") : t("load_more")}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
