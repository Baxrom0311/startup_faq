import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Send } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { AuthLayout } from "@/components/Common/AuthLayout"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { isLoggedIn } from "@/hooks/useAuth"

type TelegramStartResponse = {
  session_id: string
  deep_link: string
  expires_at: string
}

type TelegramStatusResponse = {
  status: string
  access_token?: string | null
  refresh_token?: string | null
}

const API_BASE = import.meta.env.VITE_API_URL
const MAX_POLL_RETRIES = 60 // 60 × 2s = 2 daqiqa

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({ to: "/" })
    }
  },
  head: () => ({
    meta: [{ title: "Login - SignalHub" }],
  }),
})

function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [phone, setPhone] = useState("")
  const [session, setSession] = useState<TelegramStartResponse | null>(null)
  const [status, setStatus] = useState<string>("idle")
  const [loading, setLoading] = useState(false)
  const retryCount = useRef(0)

  const startTelegramAuth = async () => {
    if (loading) return
    setLoading(true)
    retryCount.current = 0
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/telegram/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, client: "web" }),
      })
      if (!response.ok) {
        let message: string
        try {
          const body = await response.json()
          message =
            typeof body?.detail === "string"
              ? body.detail
              : `HTTP ${response.status}`
        } catch {
          message = `HTTP ${response.status}`
        }
        throw new Error(message)
      }
      const data = (await response.json()) as TelegramStartResponse
      setSession(data)
      setStatus("pending")
      window.location.href = data.deep_link
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("error_generic"),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const terminalStatuses = new Set([
      "verified",
      "expired",
      "phone_mismatch",
      "timed_out",
    ])
    if (!session || terminalStatuses.has(status)) return

    const interval = window.setInterval(async () => {
      retryCount.current += 1

      if (retryCount.current > MAX_POLL_RETRIES) {
        window.clearInterval(interval)
        setStatus("timed_out")
        toast.error(t("login_status_timed_out"))
        return
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/v1/auth/telegram/status/${session.session_id}`,
        )
        if (!response.ok) return
        const data = (await response.json()) as TelegramStatusResponse
        setStatus(data.status)

        if (data.status === "verified" && data.access_token) {
          localStorage.setItem("access_token", data.access_token)
          if (data.refresh_token) {
            localStorage.setItem("refresh_token", data.refresh_token)
          }
          navigate({ to: "/" })
        }
        if (data.status === "expired") {
          toast.error(t("login_status_expired"))
        }
        if (data.status === "phone_mismatch") {
          toast.error(t("login_status_phone_mismatch"))
        }
      } catch {
        // Short connection drops should not break the login flow
      }
    }, 2000)

    return () => window.clearInterval(interval)
  }, [navigate, session, status])

  const handleRetry = () => {
    setSession(null)
    setStatus("idle")
    retryCount.current = 0
  }

  const isTerminal = ["expired", "phone_mismatch", "timed_out"].includes(status)

  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold">{t("login_title")}</h1>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="phone">
              {t("login_phone_label")}
            </label>
            <Input
              id="phone"
              inputMode="tel"
              placeholder="+998 90 123 45 67"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={!!session && !isTerminal}
            />
          </div>

          {isTerminal ? (
            <LoadingButton type="button" loading={false} onClick={handleRetry}>
              {t("login_retry")}
            </LoadingButton>
          ) : (
            <LoadingButton
              type="button"
              loading={loading}
              disabled={
                phone.trim().length < 9 || (!!session && status === "pending")
              }
              onClick={startTelegramAuth}
            >
              <Send />
              {t("login_send")}
            </LoadingButton>
          )}

          {session && !isTerminal && (
            <a
              className="text-center text-sm underline underline-offset-4"
              href={session.deep_link}
            >
              {t("login_open_telegram")}
            </a>
          )}

          {status !== "idle" && (
            <p
              className={`text-center text-sm ${isTerminal ? "text-destructive" : "text-muted-foreground"}`}
            >
              {t(`login_status_${status}` as never) || status}
            </p>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
