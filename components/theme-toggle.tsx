"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  // next-themes can't know the persisted theme during SSR, so resolvedTheme
  // is undefined on the server and briefly on the client's first paint —
  // rendering off it directly causes a hydration mismatch. Gate on mount so
  // server and the initial client paint always agree (both render "light"),
  // then swap to the real value once mounted.
  const [mounted, setMounted] = React.useState(false)
  // next-themes' own documented pattern for this exact SSR/client mismatch —
  // a one-time mount flag, not a state sync loop, so it doesn't cascade.
  React.useEffect(() => setMounted(true), []) // eslint-disable-line react-hooks/set-state-in-effect

  const isDark = mounted && resolvedTheme !== "light"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={className}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
