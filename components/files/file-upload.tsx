"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { uploadDocumentAction } from "@/lib/actions/files";
import { FILE_CATEGORIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FileDropzone } from "@/components/ui/file-dropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FileUpload({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("other");
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || file.size === 0) {
      return toast.error("Choose a file to upload.");
    }
    setSubmitting(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    fd.append("visible_to_client", String(visible));
    const res = await uploadDocumentAction(clientId, fd);
    setSubmitting(false);
    if (!res.ok) return toast.error("Upload failed", { description: res.error });
    toast.success("File uploaded.");
    setFile(null);
    setVisible(false);
    setCategory("other");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FileDropzone
        onFile={setFile}
        selectedName={file?.name}
        hint="PDF, image, or document — up to 25 MB"
      />
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Visible to client</Label>
          <div className="flex h-9 items-center">
            <Switch checked={visible} onCheckedChange={setVisible} />
          </div>
        </div>
        <Button type="submit" loading={submitting} className="ml-auto">
          <Upload className="size-4" />
          {submitting ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </form>
  );
}
