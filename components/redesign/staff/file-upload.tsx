"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { uploadDocumentAction } from "@/lib/actions/files";
import { FILE_CATEGORIES } from "@/lib/constants";
import { Select, Switch, EmberButton } from "@/components/redesign/ui";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Field } from "./ui";

/** R3 staff document upload form (re-skinned). uploadDocumentAction wiring verbatim. */
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
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <FileDropzone
        onFile={setFile}
        selectedName={file?.name}
        hint="PDF, image, or document — up to 25 MB"
      />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "1rem" }}>
        <div style={{ minWidth: "11rem" }}>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {FILE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Visible to client">
          <div style={{ display: "flex", height: 32, alignItems: "center" }}>
            <Switch checked={visible} onChange={(_, d) => setVisible(d.checked)} />
          </div>
        </Field>
        <div style={{ marginLeft: "auto" }}>
          <EmberButton type="submit" loading={submitting} icon={<Upload size={16} />}>
            {submitting ? "Uploading…" : "Upload"}
          </EmberButton>
        </div>
      </div>
    </form>
  );
}
