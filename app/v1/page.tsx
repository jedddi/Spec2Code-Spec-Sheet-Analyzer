"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/src/lib/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import DocumentChat from "@/src/components/DocumentChat";
import { DocumentChatProvider } from "@/src/contexts/document-chat-context";

export default function Home() {
  const router = useRouter();
  const supabase = createBrowserSupabase();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <SidebarProvider className="min-h-svh">
      <DocumentChatProvider>
        <AppSidebar />
        <SidebarInset className="flex min-h-svh flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <div className="flex flex-1 items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="line-clamp-1 font-medium">
                      Spec2Code
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ModeToggle />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSignOut}
              >
                Sign out
              </Button>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:p-6">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <DocumentChat className="min-h-0" />
            </div>
          </div>
        </SidebarInset>
      </DocumentChatProvider>
    </SidebarProvider>
  );
}
