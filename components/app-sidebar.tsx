"use client"

import * as React from "react"

import { ModeToggle } from "@/components/mode-toggle"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarRail,
} from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import UploadPdf from "@/src/components/UploadPdf"
import FileList from "@/src/components/FileList"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [refreshKey, setRefreshKey] = React.useState(0)

  return (
    <Sidebar {...props}>
      <SidebarContent className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
        {/* Top: only as tall as upload UI (removes huge empty gap from 50% flex split) */}
        <div className="shrink-0 border-b border-sidebar-border">
          <SidebarGroup className="gap-1 p-2 pb-2">
            <SidebarGroupLabel>Upload</SidebarGroupLabel>
            <SidebarGroupContent className="px-0">
              <UploadPdf
                variant="sidebar"
                onUploadComplete={() => setRefreshKey((k) => k + 1)}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        {/* Bottom: fills remaining sidebar height */}
        <div className="flex min-h-0 flex-1 flex-col">
          <SidebarGroup className="flex min-h-0 flex-1 flex-col gap-1 p-2 pt-2">
            <SidebarGroupLabel>Files</SidebarGroupLabel>
            <SidebarGroupContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-0">
              <ScrollArea className="min-h-0 flex-1">
                <FileList
                  refreshKey={refreshKey}
                  showGenerateAndSpecs={false}
                  variant="sidebar"
                  className="max-w-none pb-2 pr-3"
                />
              </ScrollArea>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <div className="flex items-center justify-center">
          <ModeToggle />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
