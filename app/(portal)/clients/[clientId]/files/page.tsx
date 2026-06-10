import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { FileUpload } from "@/components/files/file-upload";
import { FilesList, type FileRow } from "@/components/files/files-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function FilesPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();

  const { data: files } = await supabase
    .from("files")
    .select("id, name, category, storage_path, size_bytes, visible_to_client, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload a document</CardTitle>
          <CardDescription>
            Files stay private unless &ldquo;Visible to client&rdquo; is on.
            Downloads are short-lived signed links.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload clientId={clientId} />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Documents</h2>
        <FilesList clientId={clientId} files={(files ?? []) as FileRow[]} />
      </div>
    </div>
  );
}
