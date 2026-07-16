import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { type UserPublic, UsersService } from "@/client"

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

  const logout = () => {
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
