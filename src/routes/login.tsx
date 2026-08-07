import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth, AuthProvider } from "@/lib/auth-context";
import {
  AlertCircle,
  LockKeyhole,
  ArrowUpRight,
  MapPin,
  Navigation,
  Eye,
  EyeOff,
} from "lucide-react";
export const Route = createFileRoute("/login")({
  component: () => (
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  ),
});

function LoginPage() {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [session, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="mb-7">
        <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-surface-2)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand)]">
          <Navigation className="size-3" />
          Agent access
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign in to the portal</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Loads, lanes, and carriers — all in one place.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
            placeholder="Enter your email"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {/* <Link
              to="/forgot-password"
              className="text-xs font-medium text-[var(--color-brand)] hover:underline"
            >
              Forgot password?
            </Link> */}
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="h-11 pr-10"
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="h-11 w-full bg-[var(--color-cta-bg)] text-[var(--color-cta-text)] hover:bg-[var(--color-cta-bg-hover)]"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Internal use only. Unauthorized access is prohibited.
        </p>
      </form>
    </AuthLayout>
  );
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / route panel — hidden on small screens */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[var(--color-bg-sidebar)] p-10 text-[var(--color-text-primary)] lg:flex">
        <div className="theme-grid-pattern pointer-events-none absolute inset-0 opacity-[0.07]" />

        <div className="relative flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-md bg-[var(--color-cta-bg)] text-[var(--color-cta-text)]">
            <LockKeyhole className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">DJ's Freight Broker LLC</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
              Secure Agent Portal - TMS
            </div>
          </div>
        </div>

        <div className="relative">
          <h2 className="max-w-sm text-3xl font-bold leading-tight tracking-tight">
            Every lane, every load, tracked door to door.
          </h2>
          <p className="mt-3 max-w-xs text-sm text-[var(--color-text-secondary)]">
            The dispatch desk for agents moving freight across the network.
          </p>

          {/* Signature: animated route line, origin to destination */}
          <div className="mt-10 flex items-center gap-3">
            <MapPin className="size-4 shrink-0 text-[var(--color-cta-bg)]" />
            <svg
              viewBox="0 0 240 16"
              className="h-4 w-full max-w-[220px] overflow-visible"
              aria-hidden="true"
            >
              <line x1="2" y1="8" x2="238" y2="8" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
              <line
                x1="2"
                y1="8"
                x2="238"
                y2="8"
                stroke="var(--color-cta-bg)"
                strokeWidth="2"
                strokeDasharray="6 8"
                className="dj-route-line"
              />
              <circle cx="2" cy="8" r="3.5" fill="var(--color-cta-bg)" />
              <circle cx="238" cy="8" r="3.5" fill="var(--color-cta-bg)" />
            </svg>
            <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
              Live lanes
            </span>
          </div>
        </div>

        <a
          href="https://djsfreightbroker.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="relative inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          Visit djsfreightbroker.com
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Compact brand header — mobile only */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="grid size-9 place-items-center rounded-md bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-cta-bg)] text-[var(--color-cta-text)]">
              <LockKeyhole className="size-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">DJ's Freight Broker LLC</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Secure Agent Portal
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">{children}</div>

          <a
            href="https://djsfreightbroker.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            Visit djsfreightbroker.com
            <ArrowUpRight className="size-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
