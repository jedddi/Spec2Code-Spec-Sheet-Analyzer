"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronsUpDown, LogOut } from "lucide-react";
import Link from "next/link";

interface UserProfileV2Props {
  name: string;
  email: string;
  avatarUrl?: string;
  onSignOut?: () => void;
  isCollapsed?: boolean;
}

export default function UserProfileV2({
  name,
  email,
  avatarUrl,
  onSignOut,
  isCollapsed = false,
}: UserProfileV2Props) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  const avatar = (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/90">
      {avatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-xs font-medium text-black">
          {initials || "U"}
        </span>
      )}
    </div>
  );

  const trigger = isCollapsed ? (
    <button
      type="button"
      className="flex w-full items-center justify-center rounded-xl py-2 transition-colors hover:bg-white/15 focus:outline-none"
      aria-label={`${name} profile menu`}
    >
      {avatar}
    </button>
  ) : (
    <button
      type="button"
      className="flex h-16 w-full items-center rounded-xl border border-white/20 bg-white/10 px-3 transition-colors hover:bg-white/15 focus:outline-none"
    >
      {avatar}
      <div className="ml-3 min-w-0 flex-1 text-left">
        <p className="truncate text-base leading-6 text-white">{name}</p>
        <p className="truncate text-sm leading-5 text-white/50">{email}</p>
      </div>
      <ChevronsUpDown className="ml-2 h-5 w-5 shrink-0 text-white/60" />
    </button>
  );

  const dropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        side={isCollapsed ? "right" : "top"}
        align="start"
        sideOffset={8}
        className="w-[229px]"
      >
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/">Switch to Old Version</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onSignOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{dropdown}</div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {name}
        </TooltipContent>
      </Tooltip>
    );
  }

  return dropdown;
}
