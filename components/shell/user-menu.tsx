"use client";

import { useRef } from "react";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Avatar that opens a real user menu (Profile & settings · Sign out). */
export function UserMenu({
  name,
  email,
  avatarUrl = null,
  size = "md",
}: {
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md";
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={formRef} action="/auth/signout" method="post" className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Account menu" className="rounded-full">
            <PersonAvatar name={name} email={email} src={avatarUrl} size={size} />
          </button>
        </DropdownMenuTrigger>
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
