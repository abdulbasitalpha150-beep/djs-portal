import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/roles";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Lock,
  User,
  Building2,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  X,
  Mail,
  Phone,
  Clock,
  CalendarDays,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: () => (
    <AuthProvider>
      <ProfilePage />
    </AuthProvider>
  ),
});

type Profile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string;
  username: string | null;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  team: string | null;
  employmentType: string | null;
  ownerName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  isTemporaryPassword: boolean;
  passwordLastChangedAt: string | null;
  passwordChangeCount: number;
  passwordChangeCountMax: number;
};

/** Reusable label/value pair — keeps the info grids consistent and DRY. */
function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-sm text-foreground">{children}</div>
    </div>
  );
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2);
  return initials.toUpperCase();
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-28 animate-pulse rounded-lg border border-border bg-muted/40" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-muted/40" />
      ))}
    </div>
  );
}

function ProfilePage() {
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);

  // UI-only state — visibility toggles do not touch auth/session logic.
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadProfile = async () => {
    try {
      const payload = await apiFetch<{ profile: Profile }>("/api/profile");
      setProfile(payload.data.profile);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      loadProfile();
    }
  }, [session]);

  if (typeof window !== "undefined") {
    if (!authLoading && !loading && !session) {
      window.location.replace("/login");
      return null;
    }
  }

  const changePassword = async () => {
    setChangingPassword(true);
    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(changePasswordForm),
      });
      setChangePasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      loadProfile();
      toast.success("Password changed successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error changing password");
    } finally {
      setChangingPassword(false);
    }
  };

  const passwordLimitReached =
    !!profile && profile.passwordChangeCount >= profile.passwordChangeCountMax;

  const passwordsMatch =
    changePasswordForm.newPassword.length > 0 &&
    changePasswordForm.newPassword === changePasswordForm.confirmPassword;
  const hasMinLength = changePasswordForm.newPassword.length >= 6;

  const isButtonDisabled =
    !profile ||
    passwordLimitReached ||
    !changePasswordForm.currentPassword ||
    !changePasswordForm.newPassword ||
    !changePasswordForm.confirmPassword ||
    changePasswordForm.newPassword !== changePasswordForm.confirmPassword ||
    changePasswordForm.newPassword.length < 6;

  const isInputsDisabled = !profile || passwordLimitReached;

  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : "—";

  const showPasswordHints =
    changePasswordForm.newPassword.length > 0 || changePasswordForm.confirmPassword.length > 0;

  return (
    <>
      <AppShell>
        <div className="space-y-6">
          <PageHeader title="My Profile" description="View your account information" />

          {authLoading || loading ? (
            <ProfileSkeleton />
          ) : (
            <div className="space-y-6">
              {/* Identity header — quick-glance summary before the detail cards */}
              <Card>
                <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                      {getInitials(profile?.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold text-foreground">
                        {profile?.name || "—"}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className="truncate">{profile?.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Badge variant="outline">
                      {ROLE_LABELS[(profile?.role || "agent") as keyof typeof ROLE_LABELS]}
                    </Badge>
                    <StatusBadge value={profile?.status || "active"} />
                  </div>
                </CardContent>
              </Card>

              {/* Personal Information */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                  <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Your personal details</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoField label="First Name">{profile?.firstName || "—"}</InfoField>
                  <InfoField label="Last Name">{profile?.lastName || "—"}</InfoField>
                  <InfoField label="Full Name">{profile?.name || "—"}</InfoField>
                  <InfoField label="Username">{profile?.username || "—"}</InfoField>
                  <InfoField label="Email">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {profile?.email || "—"}
                    </span>
                  </InfoField>
                  <InfoField label="Phone">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {profile?.phone || "—"}
                    </span>
                  </InfoField>
                </CardContent>
              </Card>

              {/* Organization */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                  <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <CardTitle>Organization</CardTitle>
                    <CardDescription>Your role and team information</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoField label="Role">
                    <Badge variant="outline">
                      {ROLE_LABELS[(profile?.role || "agent") as keyof typeof ROLE_LABELS]}
                    </Badge>
                  </InfoField>
                  <InfoField label="Team">{profile?.team || "—"}</InfoField>
                  <InfoField label="Owner">{profile?.ownerName || "—"}</InfoField>
                  <InfoField label="Employment Type">
                    {profile?.employmentType ? (
                      <Badge variant="outline">{profile.employmentType}</Badge>
                    ) : (
                      "—"
                    )}
                  </InfoField>
                </CardContent>
              </Card>

              {/* Account Details */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <CardTitle>Account Details</CardTitle>
                    <CardDescription>Account status and creation information</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoField label="Status">
                    <StatusBadge value={profile?.status || "active"} />
                  </InfoField>
                  <InfoField label="Last Login">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {formatDate(profile?.lastLoginAt ?? null)}
                    </span>
                  </InfoField>
                  <InfoField label="Account Created">
                    {formatDate(profile?.createdAt ?? null)}
                  </InfoField>
                  <InfoField label="Last Updated">
                    {formatDate(profile?.updatedAt ?? null)}
                  </InfoField>
                </CardContent>
              </Card>

              {/* Security */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <CardTitle>Security</CardTitle>
                    <CardDescription>Password management</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Password Status
                    </div>
                    {profile?.isTemporaryPassword ? (
                      <Badge variant="destructive" className="gap-1">
                        <Lock className="h-3 w-3" aria-hidden="true" /> Temporary Password
                      </Badge>
                    ) : (
                      <Badge variant="success">Permanent Password</Badge>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoField label="Password Last Changed">
                      {formatDate(profile?.passwordLastChangedAt ?? null)}
                    </InfoField>
                    <InfoField label="Password Changes This Month">
                      {profile?.passwordChangeCount ?? 0} / {profile?.passwordChangeCountMax ?? 0}
                    </InfoField>
                  </div>

                  {passwordLimitReached && (
                    <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                      <span>
                        You have reached your monthly password change limit. Please contact your
                        account owner or administrator.
                      </span>
                    </p>
                  )}

                  <div className="space-y-4 border-t border-border pt-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <div className="relative mt-1.5">
                          <Input
                            type={showCurrent ? "text" : "password"}
                            id="currentPassword"
                            autoComplete="current-password"
                            value={changePasswordForm.currentPassword}
                            onChange={(e) =>
                              setChangePasswordForm((p) => ({
                                ...p,
                                currentPassword: e.target.value,
                              }))
                            }
                            disabled={isInputsDisabled}
                            className="pr-9"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrent((v) => !v)}
                            disabled={isInputsDisabled}
                            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
                            aria-label={
                              showCurrent ? "Hide current password" : "Show current password"
                            }
                          >
                            {showCurrent ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="newPassword">New Password</Label>
                        <div className="relative mt-1.5">
                          <Input
                            type={showNew ? "text" : "password"}
                            id="newPassword"
                            autoComplete="new-password"
                            value={changePasswordForm.newPassword}
                            onChange={(e) =>
                              setChangePasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                            }
                            disabled={isInputsDisabled}
                            className="pr-9"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNew((v) => !v)}
                            disabled={isInputsDisabled}
                            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
                            aria-label={showNew ? "Hide new password" : "Show new password"}
                          >
                            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <div className="relative mt-1.5">
                          <Input
                            type={showConfirm ? "text" : "password"}
                            id="confirmPassword"
                            autoComplete="new-password"
                            value={changePasswordForm.confirmPassword}
                            onChange={(e) =>
                              setChangePasswordForm((p) => ({
                                ...p,
                                confirmPassword: e.target.value,
                              }))
                            }
                            disabled={isInputsDisabled}
                            className="pr-9"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm((v) => !v)}
                            disabled={isInputsDisabled}
                            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
                            aria-label={
                              showConfirm ? "Hide confirm password" : "Show confirm password"
                            }
                          >
                            {showConfirm ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {showPasswordHints && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 ${
                            hasMinLength ? "text-success" : "text-muted-foreground"
                          }`}
                        >
                          {hasMinLength ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                          At least 6 characters
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 ${
                            passwordsMatch ? "text-success" : "text-muted-foreground"
                          }`}
                        >
                          {passwordsMatch ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                          Passwords match
                        </span>
                      </div>
                    )}

                    <Button
                      className="w-full gap-2 sm:w-auto"
                      onClick={changePassword}
                      disabled={isButtonDisabled || changingPassword}
                    >
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                      {changingPassword ? "Changing Password..." : "Change Password"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </AppShell>
      <Toaster richColors position="top-right" />
    </>
  );
}
