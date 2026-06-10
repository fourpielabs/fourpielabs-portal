import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { labelOf, PROGRAMS, CLIENT_STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "active") return "default";
  if (status === "churned") return "outline";
  return "secondary";
}

export default async function ClientsPage() {
  // team workspace list — clients are redirected to /dashboard
  const profile = await requireRole(["admin", "team"]);
  const supabase = await createClient();

  // RLS scopes this: admin sees all, team sees assigned clients only.
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, slug, program, status, industry")
    .order("name");

  const isAdmin = profile.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "All clients." : "Clients you're assigned to."}
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/clients/new">New client</Link>
          </Button>
        )}
      </div>

      {!clients || clients.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          {isAdmin
            ? "No clients yet. Create your first one."
            : "You don't have any assigned clients yet."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/clients/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{c.slug}</div>
                  </TableCell>
                  <TableCell>{labelOf(PROGRAMS, c.program)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>
                      {labelOf(CLIENT_STATUSES, c.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/clients/${c.id}`}>Open</Link>
                    </Button>
                    {isAdmin && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/clients/${c.id}/settings`}>Settings</Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
