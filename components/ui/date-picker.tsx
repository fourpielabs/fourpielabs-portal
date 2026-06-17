"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Date values round-trip as the native "YYYY-MM-DD" string (parsed/formatted with
// date-fns, date-only → no timezone drift), so this is a 1:1 swap for the form's
// existing string field — no schema/action change.
const ISO = "yyyy-MM-dd";
const asDate = (v: string | null | undefined) => (v ? parseISO(v) : undefined);

/** Token-matched single-date picker (Popover + shadcn Calendar) — replaces a native
 * <input type="date">. Controlled: `value` is the ISO string, `onChange` emits the ISO
 * string (or "" when cleared). */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder = "Pick a date",
  disabled,
  className,
}: {
  value: string | null | undefined;
  onChange: (iso: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = asDate(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start gap-2 font-normal", !date && "text-ink-3", className)}
        >
          <CalendarIcon className="size-4 text-ink-3" />
          {date ? format(date, "MMM d, yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(d) => {
            onChange(d ? format(d, ISO) : "");
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
