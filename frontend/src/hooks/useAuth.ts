import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { type UserPublic, UsersService } from "@/client"

const API_BASE = import.meta.env.VITE_API_URL as string

const isLoggedIn = () => {
  return localStorage.getItem("access_token") !== null
}

const useAuth = () => {
  const navigate = useNavigate()

  const { data: user } = useQuery<UserPublic | null, Error>({
    queryKey: ["currentUser"],
    queryFn: UsersService.readUserMe,
    enabled: isLoggedIn(),
  })

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
    navigate({ to: "/login" })
  }

  return {
    logout,
    user,
  }
}

export { isLoggedIn }
export default useAuth
