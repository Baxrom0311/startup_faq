import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Send } from "lucide-react"
import { useEffect, useState } from "react"
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
}

const API_BASE = import.meta.env.VITE_API_URL

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
  head: () => ({
    meta: [
      {
        title: "Kirish - Platforma",
      },
    ],
  }),
})

function Login() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState("")
  const [session, setSession] = useState<TelegramStartResponse | null>(null)
  const [status, setStatus] = useState<string>("idle")
  const [loading, setLoading] = useState(false)

  const startTelegramAuth = async () => {
    if (loading) return
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/telegram/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, client: "web" }),
      })
      if (!response.ok) {
        throw new Error("Telefon raqamni tekshirib qaytadan urinib ko'ring.")
      }
      const data = (await response.json()) as TelegramStartResponse
      setSession(data)
      setStatus("pending")
      window.location.href = data.deep_link
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kirishda xatolik bo'ldi.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!session || status === "verified" || status === "expired") return

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/v1/auth/telegram/status/${session.session_id}`,
        )
        if (!response.ok) return
        const data = (await response.json()) as TelegramStatusResponse
        setStatus(data.status)
        if (data.status === "verified" && data.access_token) {
          localStorage.setItem("access_token", data.access_token)
          navigate({ to: "/" })
        }
        if (data.status === "expired") {
          toast.error("Sessiya muddati tugadi. Qaytadan urinib ko'ring.")
        }
        if (data.status === "phone_mismatch") {
          toast.error("Kiritilgan raqam Telegram raqamingizga mos kelmadi.")
        }
      } catch {
        // Keep polling; short connection drops should not break the login flow.
      }
    }, 2000)

    return () => window.clearInterval(interval)
  }, [navigate, session, status])

  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Platformaga kirish</h1>
          <p className="text-muted-foreground text-sm">
            Telefon raqamingizni kiriting va Telegram orqali tasdiqlang.
          </p>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="phone">
              Telefon raqam
            </label>
            <Input
              id="phone"
              inputMode="tel"
              placeholder="+998 90 123 45 67"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>

          <LoadingButton
            type="button"
            loading={loading}
            disabled={phone.trim().length < 9}
            onClick={startTelegramAuth}
          >
            <Send />
            Telegram orqali davom etish
          </LoadingButton>

          {session && (
            <a
              className="text-center text-sm underline underline-offset-4"
              href={session.deep_link}
            >
              Telegram ochilmasa, shu linkni bosing
            </a>
          )}

          {status !== "idle" && (
            <p className="text-muted-foreground text-center text-sm">
              Holat: {status}
            </p>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
