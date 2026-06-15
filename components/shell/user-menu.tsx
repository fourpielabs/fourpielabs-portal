"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/ui/person-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Avatar that opens a real user menu (Profile & settings · Sign out).
 *
 * `bubble` makes the WHOLE identity card (avatar + name + role) the trigger —
 * not just the avatar — so the entire bubble is the click target. `collapsed`
 * (icon rail) shows the avatar only; `tone="dark"` styles it for a dark sidebar.
 */
export function UserMenu({
  name,
  email,
  avatarUrl = null,
  size = "md",
  bubble = false,
  role,
  collapsed = false,
  tone = "light",
}: {
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md";
  bubble?: boolean;
  role?: string | null;
  collapsed?: boolean;
  tone?: "light" | "dark";
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const dark = tone === "dark";

  const trigger = bubble ? (
    <button
      type="button"
      aria-label="Account menu"
      className={cn(
        "motion-micro flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left",
        collapsed && "justify-center",
        dark
          ? "border-dark-border hover:bg-white/[0.06]"
          : "border-border hover:bg-surface-2",
      )}
    >
      <PersonAvatar name={name} email={email} src={avatarUrl} size={size} />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block truncate text-[13px] font-semibold",
                dark && "text-dark-ink",
              )}
            >
              {name ?? email}
            </span>
            {role && (
              <span
                className={cn(
                  "block truncate text-[11px] capitalize",
                  dark ? "text-dark-ink-2" : "text-ink-3",
                )}
              >
                {role}
              </span>
            )}
          </span>
          <ChevronsUpDown
            className={cn("size-4 shrink-0", dark ? "text-dark-ink-2" : "text-ink-3")}
          />
        </>
      )}
    </button>
  ) : (
    <button type="button" aria-label="Account menu" className="rounded-full">
      <PersonAvatar name={name} email={email} src={avatarUrl} size={size} />
    </button>
  );

  return (
    <>
      <form ref={formRef} action="/auth/signout" method="post" className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <div className="truncate text-sm font-semibold">{name ?? email}</div>
            {name && email && <div className="truncate text-xs text-ink-3">{email}</div>}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings className="size-4" /> Profile &amp; settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }}
          >
            <LogOut className="size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
