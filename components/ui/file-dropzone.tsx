"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Styled drag-and-drop file picker (D2 dropzone). Wraps a hidden native input
 * and reports the chosen File via `onFile`. The consumer keeps its own upload /
 * validation / preview logic — this only replaces the unstyled OS file control.
 */
export function FileDropzone({
  onFile,
  accept,
  hint,
  disabled,
  selectedName,
  className,
}: {
  onFile: (file: File | null) => void;
  accept?: string;
  hint?: string;
  disabled?: boolean;
  selectedName?: string | null;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (disabled) return;
        const f = e.dataTransfer.files?.[0] ?? null;
        if (f) onFile(f);
      }}
      className={cn(
        "motion-micro flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border-strong bg-surface px-6 py-8 text-center hover:border-ink hover:bg-surface-2",
        drag && "border-amber-600 bg-amber-50",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <UploadCloud className="size-6 text-ink-3" aria-hidden />
      <div className="text-sm font-medium text-ink">
        {selectedName ? (
          selectedName
        ) : (
          <>
            Drag a file here, or <span className="text-amber-700">browse</span>
          </>
        )}
      </div>
      {hint && <div className="text-xs text-ink-3">{hint}</div>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
