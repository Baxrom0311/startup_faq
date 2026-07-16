import { Appearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="bg-muted/20 grid min-h-svh p-4">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
        <div className="flex h-16 items-center justify-between">
          <Logo variant="full" asLink={false} />
          <Appearance />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full rounded-lg border bg-background p-6 shadow-none">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
