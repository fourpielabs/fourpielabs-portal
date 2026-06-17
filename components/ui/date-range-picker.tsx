"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ISO = "yyyy-MM-dd";
const asDate = (v: string | null | undefined) => (v ? parseISO(v) : undefined);

/** Token-matched date-RANGE picker (Popover + shadcn Calendar, mode="range") — for a
 * date WINDOW. Binds two existing string fields: `from`/`to` are ISO strings, `onChange`
 * emits both (either may be "" while picking). No schema/action change. */
export function DateRangePicker({
  from,
  to,
  onChange,
  id,
  placeholder = "Pick a range",
  disabled,
  className,
}: {
  from: string | null | undefined;
  to: string | null | undefined;
  onChange: (from: string, to: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const fromD = asDate(from);
  const toD = asDate(to);
  const range = fromD || toD ? { from: fromD, to: toD } : undefined;
  const label = fromD
    ? toD
      ? `${format(fromD, "MMM d, yyyy")} – ${format(toD, "MMM d, yyyy")}`
      : format(fromD, "MMM d, yyyy")
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start gap-2 font-normal", !fromD && "text-ink-3", className)}
        >
          <CalendarIcon className="size-4 shrink-0 text-ink-3" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          defaultMonth={fromD}
          onSelect={(r) =>
            onChange(r?.from ? format(r.from, ISO) : "", r?.to ? format(r.to, ISO) : "")
          }
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
