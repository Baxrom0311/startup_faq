import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/recover-password")({
  beforeLoad: () => {
    throw redirect({ to: "/login" })
  },
})
