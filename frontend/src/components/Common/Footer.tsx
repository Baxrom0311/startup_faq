export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t px-6 py-4">
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="text-muted-foreground text-sm">
          SignalHub - {currentYear}
        </p>
        <p className="text-muted-foreground text-sm">
          Problems to pilots, pilots to solved outcomes.
        </p>
      </div>
    </footer>
  )
}
