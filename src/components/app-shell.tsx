import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  Truck,
  Package,
  DollarSign,
  ClipboardCheck,
  BarChart3,
  Bell,
  Shield,
  FolderOpen,
  CalendarClock,
  UserCheck,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  CircleUser,
  Search,
  Check,
  AlertTriangle,
  Inbox,
  MoonStar,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  Clock3,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { can, ROLE_LABELS, type Role } from "@/lib/roles";
import { useNotifications, type NotificationItem } from "@/hooks/use-notifications";
import { recordUrl } from "@/lib/notification-ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { relative } from "@/lib/format";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  cap: Parameters<typeof can>[1];
  section: "Operate" | "Records" | "Admin";
};

const NAV: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    cap: "dashboard",
    section: "Operate",
  },
  {
    to: "/approvals",
    label: "Approvals",
    icon: ClipboardCheck,
    cap: "approvals",
    section: "Operate",
  },
  {
    to: "/activity",
    label: "Daily Activity",
    icon: CalendarClock,
    cap: "activity",
    section: "Operate",
  },
  {
    to: "/notifications",
    label: "Notifications",
    icon: Bell,
    cap: "notifications",
    section: "Operate",
  },

  { to: "/leads", label: "Leads", icon: UserCheck, cap: "leads", section: "Records" },
  {
    to: "/followups",
    label: "Follow-ups",
    icon: ClipboardCheck,
    cap: "followups",
    section: "Records",
  },
  { to: "/customers", label: "Customers", icon: Building2, cap: "customers", section: "Records" },
  { to: "/quotes", label: "Quotes", icon: FileText, cap: "quotes", section: "Records" },
  { to: "/carriers", label: "Carriers", icon: Truck, cap: "carriers", section: "Records" },
  { to: "/loads", label: "Loads", icon: Package, cap: "loads", section: "Records" },
  {
    to: "/commissions",
    label: "Commissions",
    icon: DollarSign,
    cap: "commissions",
    section: "Records",
  },
  { to: "/invoices", label: "Invoices", icon: FileText, cap: "invoices", section: "Records" },
  // { to: "/documents", label: "Documents", icon: FolderOpen, cap: "documents", section: "Records" },
  // { to: "/onboarding", label: "Onboarding", icon: Check, cap: "onboarding", section: "Records" },
  // { to: "/reports", label: "Reports(Working on it)", icon: BarChart3, cap: "reports", section: "Records" },

  { to: "/users", label: "Users", icon: Users, cap: "users", section: "Admin" },
  { to: "/teams", label: "Teams", icon: Users, cap: "teams", section: "Admin" },
  { to: "/audit", label: "Session Log", icon: Shield, cap: "audit", section: "Admin" },
  { to: "/admin", label: "Admin Panel", icon: Settings, cap: "admin", section: "Admin" },
];

const ROLE_OPTIONS: Role[] = [
  "owner",
  "admin",
  "ops_manager",
  "team_manager",
  "leadagent",
  "agent",
  "trainee",
  "accounting",
  "suspended",
];
type ThemeMode = "dark" | "light";

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";

  const stored = window.localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;

  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem("theme", theme);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, setRole, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [globalSearchValue, setGlobalSearchValue] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("sidebar-collapsed") === "true";
  });
  // Lifted here (rather than living inside ThemeToggle) so the desktop toggle
  // and the mobile "more" menu's theme item always agree on current state.
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sidebar-collapsed", String(sidebarCollapsed));
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const role = session?.role ?? "agent";

  const { notifications: notifItems, unreadCount, markRead, markAllRead } = useNotifications();

  function handleGlobalSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;

    setMobileSearchOpen(false);
    setGlobalSearchValue(trimmed);

    if (typeof window !== "undefined") {
      const nextUrl = new URL("/search", window.location.origin);
      nextUrl.searchParams.set("q", trimmed);
      window.location.assign(nextUrl.toString());
    }
  }

  async function handleSignOut(force = false) {
    try {
      await signOut(force);
      navigate({ to: "/login" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign out.");
    }
  }
  const visibleNav = useMemo(() => NAV.filter((n) => can(role, n.cap)), [role]);

  if (role === "suspended") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-destructive/40 bg-card p-8 text-center">
          <AlertTriangle className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">Account suspended</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This account has no access to the portal. Historical records may still exist but are
            unreachable from this role. Contact an administrator.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <RoleSwitcher inline />
            <Button
              variant="outline"
              onClick={() => {
                void handleSignOut(true);
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const grouped = {
    Operate: visibleNav.filter((n) => n.section === "Operate"),
    Records: visibleNav.filter((n) => n.section === "Records"),
    Admin: visibleNav.filter((n) => n.section === "Admin"),
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar — desktop */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex",
          sidebarCollapsed ? "w-16" : "w-60",
        )}
      >
        <SidebarBrand
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((current) => !current)}
        />
        <SidebarNav
          grouped={grouped}
          pathname={pathname}
          unreadCount={unreadCount}
          collapsed={sidebarCollapsed}
        />
      </aside>

      {/* Sidebar — mobile */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-0">
          {/* Mobile overlay always shows the full brand mark — the desktop
              collapse toggle doesn't apply here, so it's simply not rendered
              (previously this reused the desktop toggle with a no-op handler). */}
          <SidebarBrand collapsed={false} showToggle={false} />
          <SidebarNav
            grouped={grouped}
            pathname={pathname}
            unreadCount={unreadCount}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur sm:gap-3 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
          </div>
          <div className="min-w-0">
            <div className="relative hidden max-w-md md:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={globalSearchValue}
                onChange={(event) => setGlobalSearchValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleGlobalSearch(globalSearchValue);
                  }
                }}
                placeholder="Search loads, customers, carriers, agents…"
                className="h-9 pl-8"
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {/* Mobile-only search trigger — the search bar itself is desktop-only
                (md:block above), so this gives mobile users an equivalent entry
                point. It's the same non-wired placeholder input as desktop. */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Search"
              onClick={() => setMobileSearchOpen(true)}
            >
              <Search className="size-5" />
            </Button>

            {/* Desktop: theme, session status, and role switcher inline */}
            <div className="hidden items-center gap-1.5 md:flex">
              <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} />
              <SessionMonitor />
              <RoleSwitcher />
            </div>

            {/* Mobile: same three controls collapsed into one menu */}
            <MobileMoreMenu theme={theme} onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} />

            <NotificationsBell
              notifications={notifItems}
              unreadCount={unreadCount}
              onMarkRead={(id) => void markRead(id)}
              onMarkAllRead={() => void markAllRead()}
            />
            <UserMenu />
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6">{children}</div>
        </main>
      </div>

      {/* Mobile search dialog — mirrors the desktop search box */}
      <Dialog open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
        <DialogContent className="top-[10%] translate-y-0 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Search</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              type="search"
              value={globalSearchValue}
              onChange={(event) => setGlobalSearchValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleGlobalSearch(globalSearchValue);
                }
              }}
              placeholder="Search loads, customers, carriers, agents…"
              className="h-10 pl-8"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: ThemeMode; onToggle: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 px-2.5"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      onClick={onToggle}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <MoonStar className="size-4" />}
      <span className="hidden text-xs lg:inline">{theme === "dark" ? "Dark" : "Light"}</span>
    </Button>
  );
}

/**
 * Consolidates Theme toggle + Session status + Role switcher into a single
 * menu on narrow screens, where the header otherwise doesn't have room for
 * all three as separate controls. A small status dot on the trigger keeps
 * session state visible at a glance without needing the full pill.
 */
function MobileMoreMenu({ theme, onToggleTheme }: { theme: ThemeMode; onToggleTheme: () => void }) {
  const { session, setRole, sessionStatus, loading } = useAuth();
  const role = session?.role ?? "agent";
  const canSwitchRole = (["admin", "owner"] as Role[]).includes(role);

  const dotClass = {
    active: "bg-success",
    paused: "bg-warning",
    expired: "bg-destructive",
  }[sessionStatus ?? "active"];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative md:hidden" aria-label="More options">
          <MoreVertical className="size-5" />
          {!loading && session && (
            <span className={cn("absolute right-1 top-1 size-2 rounded-full", dotClass)} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={onToggleTheme}>
          {theme === "dark" ? <Sun className="mr-2 size-4" /> : <MoonStar className="mr-2 size-4" />}
          Switch to {theme === "dark" ? "light" : "dark"} mode
        </DropdownMenuItem>
        {!loading && session && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              <span className={cn("size-2 rounded-full", dotClass)} />
              Session: {sessionStatus}
            </DropdownMenuLabel>
          </>
        )}
        {canSwitchRole && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Preview as role</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
              {ROLE_OPTIONS.map((r) => (
                <DropdownMenuRadioItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarBrand({
  collapsed,
  onToggle,
  showToggle = true,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  showToggle?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-14 items-center border-b border-sidebar-border",
        collapsed ? "justify-center px-2" : "gap-2.5 px-4",
      )}
    >
      {showToggle && (
        <Button
          variant="ghost"
          size="icon"
          className={cn("shrink-0", collapsed ? "size-8" : "size-9")}
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      )}
     {!collapsed && (
  <div className="flex min-w-0 items-center gap-2.5">
    {/* <div className="grid size-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
      <span className="font-mono text-xs font-bold">DJF</span>
    </div> */}
    <div className="min-w-0">
      <div className="truncate text-sm font-semibold text-sidebar-foreground">
        DJ's Panel
      </div>
      <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
        Agent Portal - TMS
      </div>
    </div>
  </div>
)}
    </div>
  );
}

function SidebarNav({
  grouped,
  pathname,
  unreadCount = 0,
  onNavigate,
  collapsed = false,
}: {
  grouped: Record<string, NavItem[]>;
  pathname: string;
  unreadCount?: number;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  return (
    <nav className="scrollbar-thin flex-1 overflow-y-auto p-2">
      {Object.entries(grouped).map(([section, items]) =>
        items.length === 0 ? null : (
          <div key={section} className="mb-4">
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section}
              </div>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group relative flex items-center rounded-md py-1.5 text-sm transition-colors",
                        collapsed ? "justify-center px-2" : "gap-2.5 px-2.5",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {item.to === "/notifications" && unreadCount > 0 && (
                        <span
                          className={cn(
                            "grid shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground",
                            collapsed ? "absolute right-0 top-0 size-4" : "ml-auto size-4",
                          )}
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ),
      )}
    </nav>
  );
}

function SessionMonitor() {
  const { session, loading, sessionStatus } = useAuth();

  if (loading || !session) {
    return null;
  }

  const statusConfig = {
    active: {
      label: "Active",
      dotClass: "bg-success",
      borderClass: "border-success/20 bg-success/10",
      textClass: "text-success",
    },
    paused: {
      label: "Paused",
      dotClass: "bg-warning",
      borderClass: "border-warning/20 bg-warning/10",
      textClass: "text-warning",
    },
    expired: {
      label: "Expired",
      dotClass: "bg-destructive",
      borderClass: "border-destructive/20 bg-destructive/10",
      textClass: "text-destructive",
    },
  }[sessionStatus];

  return (
    <div className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-sm", statusConfig.borderClass)}>
      <div className="flex size-7 items-center justify-center rounded-full bg-background/80">
        <Clock3 className={cn("size-3.5", statusConfig.textClass)} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", statusConfig.dotClass)} />
        <span className={cn("text-sm font-semibold", statusConfig.textClass)}>{statusConfig.label}</span>
      </div>
    </div>
  );
}

function RoleSwitcher({ inline }: { inline?: boolean } = {}) {
  const { session, setRole } = useAuth();
  const role = session?.role ?? "agent";

  if (!(["admin", "owner"] as Role[]).includes(role)) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1.5 font-normal", inline && "w-full sm:w-auto")}>
          <CircleUser className="size-4 text-primary" />
          <span className="hidden text-xs lg:inline">Viewing as</span>
          <span className="text-xs font-medium">{ROLE_LABELS[role]}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Preview as role</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
          {ROLE_OPTIONS.map((r) => (
            <DropdownMenuRadioItem key={r} value={r}>
              {ROLE_LABELS[r]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationsBell({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkRead: (id?: string) => void;
  onMarkAllRead: () => void;
}) {
  const navigate = useNavigate();
  const top5 = notifications.slice(0, 5);

  function handleClick(n: NotificationItem) {
    if (!n.isRead) {
      onMarkRead(n.id);
    }
    const url = n.actionUrl ?? recordUrl(n.recordType, n.recordId);
    if (url) {
      navigate({ to: url });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[calc(100vw-1.5rem)] max-w-80 sm:w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={onMarkAllRead}
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {top5.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              <Inbox className="mx-auto mb-2 size-5" />
              You're all caught up.
            </div>
          ) : (
            top5.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    n.isRead ? "bg-transparent" : "bg-primary",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{n.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{n.message}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{relative(n.createdAt)}</div>
                </div>
              </button>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/notifications" className="w-full text-center text-xs">
            View all
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { session, signOut, clockedIn } = useAuth();
  const navigate = useNavigate();
  const [showClockOutRequiredDialog, setShowClockOutRequiredDialog] = useState(false);
  const initials = (session?.name ?? "AG")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    if (clockedIn) {
      setShowClockOutRequiredDialog(true);
      return;
    }

    try {
      await signOut();
      navigate({ to: "/login" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign out.");
    }
  }

  function handleGoToActivity() {
    setShowClockOutRequiredDialog(false);
    navigate({ to: "/activity" });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="User menu">
            <div className="grid size-7 place-items-center rounded-full bg-secondary text-xs font-semibold">
              {initials}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="truncate text-sm font-medium">{session?.name}</div>
            <div className="truncate text-xs text-muted-foreground">{session?.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="/profile">
              <CircleUser className="mr-2 size-4" />
              My profile
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/admin">
              <Settings className="mr-2 size-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* <DropdownMenuItem
            onClick={() => {
              void handleSignOut();
            }}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 size-4" />
            Sign out
          </DropdownMenuItem> */}
          <DropdownMenuItem
  onClick={() => {
    void handleSignOut();
  }}
  className="text-destructive hover:text-black focus:text-black"
>
  <LogOut className="mr-2 size-4" />
  Sign out
</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showClockOutRequiredDialog} onOpenChange={setShowClockOutRequiredDialog}>
        <DialogContent className="sm:max-w-md border-border/70 bg-background/95 shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
              <AlertTriangle className="size-6" />
            </div>
            <DialogTitle className="text-xl font-semibold">Clock out first</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              You&apos;re still checked in. Please end your session from Daily Activity before sign-out so your activity is recorded correctly.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border/70 bg-card/70 p-4">
            <div className="text-sm font-medium text-foreground">Why this matters</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Finishing your session before you leave keeps your daily log accurate and prevents gaps in your activity history.
            </p>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowClockOutRequiredDialog(false)}>
              Cancel
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleGoToActivity}>
              Go to Daily Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}