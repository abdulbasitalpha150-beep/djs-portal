import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "./login";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
    toast.success("Reset link sent", { description: `Check ${email} for instructions.` });
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Forgot password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your work email and we'll send a reset link.
        </p>
      </div>
      {sent ? (
        <div className="space-y-4 text-sm">
          <p>
            If <span className="font-medium">{email}</span> matches an account, a reset link is on
            the way. Check your inbox.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Send reset link
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
