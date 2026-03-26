"use client"

import * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function ModeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className={cn("flex gap-0.5", className)}>
        <Button variant="ghost" size="icon-sm" className="size-8" disabled aria-hidden />
        <Button variant="ghost" size="icon-sm" className="size-8" disabled aria-hidden />
        <Button variant="ghost" size="icon-sm" className="size-8" disabled aria-hidden />
      </div>
    )
  }

  return (
    <div className={cn("flex gap-0.5", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={theme === "light" ? "secondary" : "ghost"}
            size="icon-sm"
            className="size-8"
            onClick={() => setTheme("light")}
            aria-label="Light theme"
          >
            <Sun className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Light</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={theme === "dark" ? "secondary" : "ghost"}
            size="icon-sm"
            className="size-8"
            onClick={() => setTheme("dark")}
            aria-label="Dark theme"
          >
            <Moon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Dark</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={theme === "system" ? "secondary" : "ghost"}
            size="icon-sm"
            className="size-8"
            onClick={() => setTheme("system")}
            aria-label="System theme"
          >
            <Monitor className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>System</TooltipContent>
      </Tooltip>
    </div>
  )
}
