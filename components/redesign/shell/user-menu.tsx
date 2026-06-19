"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import {
  Avatar,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuDivider,
  tokens,
} from "@fluentui/react-components";
import { cn } from "@/lib/utils";

/**
 * R1 ember-glass user menu. Wiring preserved: the hidden POST form to /auth/signout
 * (submitted via requestSubmit) and the /settings link; only rendering swaps to a
 * Fluent Menu + Avatar (themed by the surrounding FluentScope).
 */
export function UserMenu({
  name,
  email,
  avatarUrl = null,
  bubble = false,
  role,
  collapsed = false,
  tone = "light",
}: {
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  bubble?: boolean;
  role?: string | null;
  collapsed?: boolean;
  tone?: "light" | "dark";
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const dark = tone === "dark";
  const display = name ?? email ?? "Account";
  const avatar = (
    <Avatar
      name={display}
      image={avatarUrl ? { src: avatarUrl } : undefined}
      color="brand"
      size={collapsed ? 32 : 36}
    />
  );

  const trigger = bubble ? (
    <button
      type="button"
      aria-label="Account menu"
      className={cn(
        "rd-focus flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition-colors",
        collapsed && "justify-center",
        dark
          ? "border-white/10 hover:bg-white/[0.06]"
          : "border-border hover:bg-surface-2",
      )}
    >
      {avatar}
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-[13px] font-semibold", dark ? "text-[#f3efe7]" : "text-ink")}>
              {display}
            </span>
            {role && (
              <span className={cn("block truncate text-[11px] capitalize", dark ? "text-[#b3aca0]" : "text-ink-3")}>
                {role}
              </span>
            )}
          </span>
          <ChevronsUpDown className={cn("size-4 shrink-0", dark ? "text-[#b3aca0]" : "text-ink-3")} />
        </>
      )}
    </button>
  ) : (
    <button type="button" aria-label="Account menu" className="rd-focus rounded-full">
      {avatar}
    </button>
  );

  return (
    <>
      <form ref={formRef} action="/auth/signout" method="post" className="hidden" />
      <Menu positioning="below-end">
        <MenuTrigger disableButtonEnhancement>{trigger}</MenuTrigger>
        <MenuPopover>
          <div style={{ padding: "6px 10px 8px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: tokens.colorNeutralForeground1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {display}
            </div>
            {name && email && (
              <div style={{ fontSize: 12, color: tokens.colorNeutralForeground3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {email}
              </div>
            )}
          </div>
          <MenuDivider />
          <MenuList>
            <MenuItem icon={<Settings size={16} />} onClick={() => router.push("/settings")}>
              Profile &amp; settings
            </MenuItem>
            <MenuItem icon={<LogOut size={16} />} onClick={() => formRef.current?.requestSubmit()}>
              Sign out
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
    </>
  );
}
