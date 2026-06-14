"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Trash2 } from "lucide-react";

import { setFileVisibilityAction, deleteFileAction } from "@/lib/actions/files";
import { FILE_CATEGORIES, labelOf } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DownloadButton } from "./download-button";

export type FileRow = {
  id: string;
  name: string;
  category: string;
  storage_path: string;
  size_bytes: number | null;
  visible_to_client: boolean;
};

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FilesList({
  clientId,
  files,
}: {
  clientId: string;
  files: FileRow[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (!res.ok) return toast.error("Action failed", { description: res.error });
    router.refresh();
  }

  if (files.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
        No documents yet. Upload agreements, invoices, brand assets, and more.
      </div>
    );
  }

  const categories = FILE_CATEGORIES.map((c) => c.value).filter((cat) =>
    files.some((f) => f.category === cat),
  );

  return (
    <div className="space-y-5">
      {categories.map((cat) => (
        <div key={cat} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {labelOf(FILE_CATEGORIES, cat)}
          </h3>
          <ul className="space-y-2">
            {files
              .filter((f) => f.category === cat)
              .map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3 shadow-e1 transition-shadow hover:shadow-e2 sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{f.name}</div>
                    <div className="flex items-center gap-2 pt-0.5">
                      {f.size_bytes && (
                        <span className="text-xs text-muted-foreground">
                          {fmtSize(f.size_bytes)}
                        </span>
                      )}
                      {!f.visible_to_client && (
                        <Badge variant="outline" className="text-[10px]">
                          hidden
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <DownloadButton
                      clientId={clientId}
                      path={f.storage_path}
                      variant="outline"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      onClick={() =>
                        run(
                          setFileVisibilityAction(
                            clientId,
                            f.id,
                            !f.visible_to_client,
                          ),
                        )
                      }
                      aria-label="Toggle visibility"
                    >
                      {f.visible_to_client ? (
                        <Eye className="size-4" />
                      ) : (
                        <EyeOff className="size-4" />
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Delete">
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete file?</AlertDialogTitle>
                          <AlertDialogDescription>
                            &ldquo;{f.name}&rdquo; will be removed from storage.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => run(deleteFileAction(clientId, f.id))}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
