"use client";

import { useAuth } from "@/src/hooks/useAuth";
import { useChatSessions } from "@/src/hooks/useChatSessions";
import { useDocumentsContext } from "@/src/contexts/documents-context";
import { useSidebar } from "@/src/contexts/sidebar-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeftRight,
  Ellipsis,
  LayoutDashboard,
  Loader2,
  PanelLeftClose,
  PenSquare,
  Settings,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import UserProfileV2 from "./UserProfileV2";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  match: (pathname: string) => boolean;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "New Chat",
    icon: PenSquare,
    href: "/",
    match: (p) => p === "/",
  },
  {
    label: "Overview",
    icon: LayoutDashboard,
    href: "/overview",
    match: (p) => p.startsWith("/overview"),
  },
];

const SIDEBAR_EXPANDED = 261;
const SIDEBAR_COLLAPSED = 70;

const CHAT_ITEM_HEIGHT = 34;
const MAX_VISIBLE_CHATS = 5;
const CHAT_LIST_HEIGHT = CHAT_ITEM_HEIGHT * MAX_VISIBLE_CHATS;
const TRACK_HEIGHT = CHAT_LIST_HEIGHT;

const sidebarTransition = { type: "spring" as const, stiffness: 300, damping: 30 };
const fadeTransition = { duration: 0.15 };

function stripUuidPrefix(raw: string): string {
  const uuidPrefix =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;
  const match = raw.match(uuidPrefix);
  return match ? match[2] : raw;
}

function NavItemLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  const inner = active ? (
    <div
      className={`flex w-full items-center rounded-lg border-l-[3px] border-[var(--v2-primary)] bg-[rgba(3,134,253,0.15)] py-2 ${
        collapsed ? "justify-center px-0" : "gap-3 px-3"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            key="label"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={fadeTransition}
            className="flex-1 overflow-hidden whitespace-nowrap text-base"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {!collapsed && item.badge !== undefined && (
          <motion.span
            key="badge"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={fadeTransition}
            className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#0f83ed] text-[10px]"
          >
            {item.badge}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  ) : (
    <div
      className={`flex w-full items-center rounded-lg py-2 text-white/95 transition-colors hover:bg-white/5 ${
        collapsed ? "justify-center px-0" : "gap-3 px-3"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            key="label"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={fadeTransition}
            className="flex-1 overflow-hidden whitespace-nowrap text-base"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {!collapsed && item.badge !== undefined && (
          <motion.span
            key="badge"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={fadeTransition}
            className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#0f83ed] text-[10px]"
          >
            {item.badge}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );

  const link = (
    <Link href={item.href} className="flex items-center py-1">
      {inner}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export default function SidebarV2() {
  const pathname = usePathname();
  const router = useRouter();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { user, loading: authLoading, signOut } = useAuth();
  const {
    sessions,
    deleteSession,
    refetch: refetchSessions,
  } = useChatSessions(user?.id);

  useEffect(() => {
    refetchSessions();
  }, [pathname, refetchSessions]);
  const { documents, loading: docsLoading } = useDocumentsContext();

  const [scrollThumbTop, setScrollThumbTop] = useState(0);
  const [scrollThumbHeight, setScrollThumbHeight] = useState(TRACK_HEIGHT);
  const chatListRef = useRef<HTMLDivElement>(null);

  const userEmail = user?.email ?? "";
  const userName =
    user?.user_metadata?.full_name ?? userEmail.split("@")[0] ?? "User";

  const handleChatScroll = useCallback(() => {
    const el = chatListRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const scrollableDistance = scrollHeight - clientHeight;

    if (scrollableDistance <= 0) {
      setScrollThumbTop(0);
      setScrollThumbHeight(TRACK_HEIGHT);
      return;
    }

    const thumbRatio = clientHeight / scrollHeight;
    const thumbH = Math.max(thumbRatio * TRACK_HEIGHT, 20);
    const maxThumbTop = TRACK_HEIGHT - thumbH;
    const thumbTop = (scrollTop / scrollableDistance) * maxThumbTop;

    setScrollThumbHeight(thumbH);
    setScrollThumbTop(thumbTop);
  }, []);

  const recentChats = sessions.slice(0, 20);

  return (
    <motion.aside
      role="navigation"
      aria-label="Main sidebar"
      aria-expanded={!isCollapsed}
      animate={{ width: isCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED }}
      transition={sidebarTransition}
      className="flex h-full shrink-0 flex-col overflow-hidden bg-[var(--v2-sidebar-bg)] text-white"
    >
      {/* Logo */}
      <div
        className={`relative flex h-14 items-center border-b border-white/20 ${
          isCollapsed ? "justify-center px-2" : "justify-between px-5"
        }`}
      >
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Expand sidebar"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--v2-primary)] transition-transform hover:scale-110"
              >
                <span className="text-[9px] font-bold text-white">S</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Expand sidebar
            </TooltipContent>
          </Tooltip>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--v2-primary)]">
                <span className="text-[8px] font-bold text-white">S</span>
              </div>
              <span className="whitespace-nowrap text-xl font-semibold leading-none">
                Synthetix
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="h-5 w-5 text-white/80 transition-colors hover:text-white" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Collapse
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Navigation & Content */}
      <div className="scrollbar-none mt-6 min-h-0 flex-1 overflow-y-auto">
        <nav className={isCollapsed ? "px-2" : "px-5"}>
          {NAV_ITEMS.map((item) => (
            <NavItemLink
              key={item.href}
              item={item}
              active={item.match(pathname)}
              collapsed={isCollapsed}
            />
          ))}

          {/* Recent Chats — hidden when collapsed */}
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                key="recent-chats"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="mt-8 text-xs uppercase tracking-wide text-white/50">
                  Recent Chats
                </p>

                {recentChats.length > 0 ? (
                  <div className="relative mt-4 flex">
                    <div
                      className="relative w-[3px] shrink-0 rounded-full bg-[rgba(3,134,253,0.25)]"
                      style={{ height: TRACK_HEIGHT }}
                    >
                      <div
                        className="absolute left-0 w-full rounded-full bg-[var(--v2-primary)] transition-all duration-150"
                        style={{
                          height: scrollThumbHeight,
                          top: scrollThumbTop,
                        }}
                      />
                    </div>

                    <div
                      ref={chatListRef}
                      onScroll={handleChatScroll}
                      className="scrollbar-none relative min-w-0 flex-1 overflow-y-auto pl-3 pr-1"
                      style={{ maxHeight: CHAT_LIST_HEIGHT }}
                    >
                      <div className="space-y-1">
                        {recentChats.map((session) => (
                          <div
                            key={session.id}
                            className="group flex min-w-0 items-center gap-1 rounded-md px-1 py-1 transition-colors hover:bg-white/5"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/chat?id=${session.id}`)
                              }
                              className="min-w-0 flex-1 truncate text-left text-xs font-medium leading-5 text-white transition-colors hover:text-white/70"
                            >
                              {session.title}
                            </button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-all group-hover:opacity-100 text-white/50 hover:bg-white/10 hover:text-white/80"
                                >
                                  <Ellipsis className="h-3.5 w-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                side="right"
                                align="start"
                                sideOffset={4}
                                className="w-36"
                              >
                                <DropdownMenuItem
                                  onClick={() => deleteSession(session.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-white/40">No chats yet</p>
                )}

                {/* Files Uploaded */}
                <p className="mt-5 text-xs text-white/50">Files Uploaded</p>

                {authLoading || docsLoading ? (
                  <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading...
                  </div>
                ) : documents.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {documents.slice(0, 8).map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 text-xs text-white/70"
                      >
                        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-white/10">
                          <span className="text-[8px] text-white/60">F</span>
                        </div>
                        <span className="min-w-0 truncate">
                          {stripUuidPrefix(doc.filename)}
                        </span>
                        {doc.category && (
                          <span className="ml-auto shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white/50">
                            {doc.category}
                          </span>
                        )}
                      </div>
                    ))}
                    {documents.length > 8 && (
                      <Link
                        href="/overview"
                        className="block text-xs text-[var(--v2-primary)] hover:underline"
                      >
                        +{documents.length - 8} more
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-white/40">
                    No files uploaded
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </div>

      {/* Bottom: Settings + Old Version + Profile */}
      <div className={isCollapsed ? "px-2 pb-4 pt-2" : "px-5 pb-5 pt-2"}>
        {/* Settings */}
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                className={`mb-3 flex w-full items-center justify-center py-2 transition-colors ${
                  pathname.startsWith("/settings")
                    ? "text-white"
                    : "text-white/80 hover:text-white"
                }`}
              >
                <Settings className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Settings
            </TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href="/settings"
            className={`mb-3 flex w-full items-center gap-3 pb-3 text-left text-base transition-colors ${
              pathname.startsWith("/settings")
                ? "text-white"
                : "text-white/80 hover:text-white"
            }`}
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
        )}

        {/* Switch to Old Version — hidden when collapsed */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key="old-version"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <Link
                href="/v1"
                className="mb-3 flex w-full items-center gap-3 border-b border-white/20 pb-3 text-left text-xs text-white/50 transition-colors hover:text-white/80"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Switch to Old Version
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        <UserProfileV2
          name={userName}
          email={userEmail}
          onSignOut={signOut}
          isCollapsed={isCollapsed}
        />
      </div>
    </motion.aside>
  );
}
