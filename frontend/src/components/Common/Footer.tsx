export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t px-6 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          SolutionLab - {currentYear}
        </p>
      </div>
    </footer>
  )
}
