import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const SIZE = { sm: "sm", md: "default", lg: "lg" } as const;

/**
 * Photo-ready avatar: renders the uploaded image when `src` is present and
 * falls back to initials when it isn't. `square` for client/logo tiles
 * (rounded-xl) vs the default circle for people. D2 sizes: sm/md/lg.
 */
export function PersonAvatar({
  name = null,
  email = null,
  src = null,
  size = "md",
  square = false,
  className,
}: {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  square?: boolean;
  className?: string;
}) {
  return (
    <Avatar size={SIZE[size]} className={cn(square && "rounded-xl", className)}>
      {src ? <AvatarImage src={src} alt={name ?? email ?? "Avatar"} /> : null}
      <AvatarFallback>{initials(name, email)}</AvatarFallback>
    </Avatar>
  );
}
