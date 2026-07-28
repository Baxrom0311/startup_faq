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

type GoogleVerifyResponse = {
  access_token: string
  refresh_token?: string | null
  telegram_linked: boolean
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
          }) => void
          prompt: () => void
        }
      }
    }
  }
}

const API_BASE = import.meta.env.VITE_API_URL
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined
const MAX_POLL_RETRIES = 60 // 60 × 2s = 2 daqiqa

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({ to: "/" })
    }
  },
  head: () => ({
    meta: [{ title: "Login - SolutionLab" }],
  }),
})

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}

function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [phone, setPhone] = useState("")
  const [session, setSession] = useState<TelegramStartResponse | null>(null)
  const [status, setStatus] = useState<string>("idle")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [gsiReady, setGsiReady] = useState(false)
  const retryCount = useRef(0)

  // Inject Google Identity Services script
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    if (document.getElementById("gsi-script")) {
      setGsiReady(true)
      return
    }
    const script = document.createElement("script")
    script.id = "gsi-script"
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = () => setGsiReady(true)
    document.head.appendChild(script)
    return () => {
      // Don't remove the script on unmount — it may be shared
    }
  }, [])

  const handleGoogleSignIn = () => {
    if (!GOOGLE_CLIENT_ID || !window.google || !gsiReady) return
    setGoogleLoading(true)
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          const res = await fetch(`${API_BASE}/api/v1/auth/google/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: response.credential }),
          })
          if (!res.ok) {
            let message: string
            try {
              const body = await res.json()
              message =
                typeof body?.detail === "string"
                  ? body.detail
                  : `HTTP ${res.status}`
            } catch {
              message = `HTTP ${res.status}`
            }
            throw new Error(message)
          }
          const data = (await res.json()) as GoogleVerifyResponse
          localStorage.setItem("access_token", data.access_token)
          if (data.refresh_token) {
            localStorage.setItem("refresh_token", data.refresh_token)
          }
          if (data.telegram_linked) {
            localStorage.removeItem("needs_telegram_link")
            navigate({ to: "/" })
          } else {
            localStorage.setItem("needs_telegram_link", "1")
            navigate({ to: "/connect-telegram" })
          }
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : t("error_generic"),
          )
        } finally {
          setGoogleLoading(false)
        }
      },
    })
    window.google.accounts.id.prompt()
  }

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
      window.open(data.deep_link, "_blank", "noopener,noreferrer")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error_generic"))
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
          localStorage.removeItem("needs_telegram_link")
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
  }, [navigate, session, status, t])

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
          {/* Google Sign In */}
          {GOOGLE_CLIENT_ID && (
            <>
              <button
                type="button"
                disabled={googleLoading || !gsiReady}
                onClick={handleGoogleSignIn}
                className="flex w-full items-center justify-center gap-3 rounded-md border bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50"
              >
                <GoogleIcon />
                {googleLoading ? t("loading") : t("login_google")}
              </button>

              <div className="relative flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">
                  {t("login_or")}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          {/* Telegram Sign In */}
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
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <Send className="size-5 text-primary" />
              </div>
              <p className="text-sm font-medium">{t("login_status_pending")}</p>
              <p className="text-xs text-muted-foreground">
                {t("login_tg_instruction")}
              </p>
              <a
                href={session.deep_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                <Send className="size-4" />
                {t("login_open_telegram")}
              </a>
            </div>
          )}

          {status !== "idle" && isTerminal && (
            <p className="text-center text-sm text-destructive">
              {t(`login_status_${status}` as never) || status}
            </p>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
