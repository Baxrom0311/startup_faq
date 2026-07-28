import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { type UserPublic, UsersService } from "@/client"

const API_BASE = import.meta.env.VITE_API_URL as string

const isLoggedIn = () => {
  const token = localStorage.getItem("access_token")
  return !!token && token.trim().length > 0
}

const useAuth = () => {
  const navigate = useNavigate()

  const { data: user, isError } = useQuery<UserPublic | null, Error>({
    queryKey: ["currentUser"],
    queryFn: UsersService.readUserMe,
    enabled: isLoggedIn(),
    retry: false,
  })

  useEffect(() => {
    if (isLoggedIn() && isError) {
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
      localStorage.removeItem("needs_telegram_link")
      navigate({ to: "/login" })
    }
  }, [isError, navigate])

  const logout = async () => {
    const refreshToken = localStorage.getItem("refresh_token")
    if (refreshToken) {
      fetch(`${API_BASE}/api/v1/auth/telegram/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => undefined)
    }
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("needs_telegram_link")
    navigate({ to: "/login" })
  }

  return {
    logout,
    user,
  }
}

export { isLoggedIn }
export default useAuth

