import Link from "next/link";
import { requireProfile } from "@/lib/auth/guards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const isStaff = profile.role === "admin" || profile.role === "team";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{profile.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-muted-foreground">
          {isStaff
            ? "Your 4Pie Labs workspace. Pick a client to get started."
            : "Your 4Pie Labs portal home."}
        </p>
      </div>

      {isStaff ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Clients</CardTitle>
              <CardDescription>
                Your assigned clients and their workspaces.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/clients" className="text-sm text-primary underline">
                Go to clients
              </Link>
            </CardContent>
          </Card>
          {profile.role === "admin" && (
            <Card>
              <CardHeader>
                <CardTitle>Admin</CardTitle>
                <CardDescription>
                  Users, invitations, assignments, and the audit log.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/admin/users"
                  className="text-sm text-primary underline"
                >
                  Manage users
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>You&apos;re all set</CardTitle>
            <CardDescription>
              Your dashboard fills in as your program gets underway — onboarding
              checklist, performance, deliverables, and reports. The full client
              experience lands in P5.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
