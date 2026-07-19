import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "./login";

export const Route = createFileRoute("/locked")({
  component: Locked,
});

function Locked() {
  return (
    <AuthLayout>
      <div className="space-y-4 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert className="size-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Account locked</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Too many failed sign-in attempts. For security, this account is temporarily locked.
            Contact an administrator to restore access.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
