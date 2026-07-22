import { errorResponse, jsonResponse } from "../lib/api";
import { loginHandler } from "./auth/login";
import { logoutHandler } from "./auth/logout";
import { refreshHandler } from "./auth/refresh";
import { sessionHandler } from "./auth/session";
import { changePasswordHandler } from "./auth/change-password";
import { profileHandler } from "./profile";
import { usersHandler } from "./users";
import { teamsHandler } from "./teams";
import { carriersListHandler } from "./carriers/list";
import { commissionsListHandler } from "./commissions/list";
import { quoteApproveHandler } from "./quotes/approve";
import { quotesListHandler } from "./quotes/list";
import { activityLogHandler } from "./activity/log";
import { activityLogsHandler } from "./activity/logs";
import { clockInHandler } from "./activity/clock-in";
import { clockOutHandler } from "./activity/clock-out";
import { leadsListHandler } from "./leads/list";
import { customersListHandler } from "./customers/list";
import { loadsListHandler } from "./loads/list";
import { resetSystemHandler } from "./admin/reset-system";
import { cleanupHandler } from "./admin/cleanup";
import { auditLogsHandler } from "./audit-logs";
import { notificationsHandler } from "./notifications";
import { kpiSummaryHandler } from "./notifications/kpi";
import { invoicesHandler } from "./invoices";
import { approvalsHandler } from "./approvals";
import { followUpsListHandler } from "./followups/list";
import { dashboardHandler } from "./dashboard";

interface ApiRoute {
  method: string;
  pattern: RegExp;
  handler: (request: Request, params: Record<string, string>) => Promise<Response>;
}

const routes: ApiRoute[] = [
  { method: "POST", pattern: /^\/api\/auth\/login$/, handler: loginHandler },
  { method: "POST", pattern: /^\/api\/auth\/logout$/, handler: logoutHandler },
  { method: "POST", pattern: /^\/api\/auth\/refresh$/, handler: refreshHandler },
  { method: "GET", pattern: /^\/api\/auth\/session$/, handler: sessionHandler },
  { method: "POST", pattern: /^\/api\/auth\/change-password$/, handler: changePasswordHandler },
  { method: "GET", pattern: /^\/api\/profile$/, handler: profileHandler },
  { method: "PATCH", pattern: /^\/api\/profile$/, handler: profileHandler },
  { method: "GET", pattern: /^\/api\/users$/, handler: usersHandler },
  { method: "POST", pattern: /^\/api\/users$/, handler: usersHandler },
  { method: "PATCH", pattern: /^\/api\/users$/, handler: usersHandler },
  { method: "DELETE", pattern: /^\/api\/users$/, handler: usersHandler },
  { method: "GET", pattern: /^\/api\/teams$/, handler: teamsHandler },
  { method: "POST", pattern: /^\/api\/teams$/, handler: teamsHandler },
  { method: "PATCH", pattern: /^\/api\/teams$/, handler: teamsHandler },
  { method: "DELETE", pattern: /^\/api\/teams$/, handler: teamsHandler },
  { method: "GET", pattern: /^\/api\/carriers$/, handler: carriersListHandler },
  { method: "POST", pattern: /^\/api\/carriers$/, handler: carriersListHandler },
  { method: "PATCH", pattern: /^\/api\/carriers$/, handler: carriersListHandler },
  { method: "DELETE", pattern: /^\/api\/carriers$/, handler: carriersListHandler },
  { method: "GET", pattern: /^\/api\/commissions$/, handler: commissionsListHandler },
  { method: "POST", pattern: /^\/api\/commissions$/, handler: commissionsListHandler },
  { method: "PATCH", pattern: /^\/api\/commissions$/, handler: commissionsListHandler },
  { method: "GET", pattern: /^\/api\/activity\/logs$/, handler: activityLogsHandler },
  { method: "POST", pattern: /^\/api\/activity\/log$/, handler: activityLogHandler },
  { method: "POST", pattern: /^\/api\/activity\/clock-in$/, handler: clockInHandler },
  { method: "POST", pattern: /^\/api\/activity\/clock-out$/, handler: clockOutHandler },
  { method: "GET", pattern: /^\/api\/leads$/, handler: leadsListHandler },
  { method: "POST", pattern: /^\/api\/leads$/, handler: leadsListHandler },
  { method: "PATCH", pattern: /^\/api\/leads$/, handler: leadsListHandler },
  { method: "DELETE", pattern: /^\/api\/leads$/, handler: leadsListHandler },
  { method: "GET", pattern: /^\/api\/customers$/, handler: customersListHandler },
  { method: "POST", pattern: /^\/api\/customers$/, handler: customersListHandler },
  { method: "PATCH", pattern: /^\/api\/customers$/, handler: customersListHandler },
  { method: "DELETE", pattern: /^\/api\/customers$/, handler: customersListHandler },
  { method: "GET", pattern: /^\/api\/loads$/, handler: loadsListHandler },
  { method: "POST", pattern: /^\/api\/loads$/, handler: loadsListHandler },
  { method: "PATCH", pattern: /^\/api\/loads$/, handler: loadsListHandler },
  { method: "DELETE", pattern: /^\/api\/loads$/, handler: loadsListHandler },
  { method: "GET", pattern: /^\/api\/quotes$/, handler: quotesListHandler },
  { method: "POST", pattern: /^\/api\/quotes$/, handler: quotesListHandler },
  { method: "PATCH", pattern: /^\/api\/quotes$/, handler: quotesListHandler },
  { method: "POST", pattern: /^\/api\/admin\/reset-system$/, handler: resetSystemHandler },
  { method: "POST", pattern: /^\/api\/admin\/cleanup$/, handler: cleanupHandler },
  { method: "POST", pattern: /^\/api\/quotes\/([^/]+)\/approve$/, handler: quoteApproveHandler },
  { method: "GET", pattern: /^\/api\/audit-logs$/, handler: auditLogsHandler },
  { method: "GET", pattern: /^\/api\/dashboard$/, handler: dashboardHandler },
  { method: "GET", pattern: /^\/api\/notifications\/kpi-summary$/, handler: kpiSummaryHandler },
  { method: "GET", pattern: /^\/api\/notifications$/, handler: notificationsHandler },
  { method: "POST", pattern: /^\/api\/notifications$/, handler: notificationsHandler },
  { method: "GET", pattern: /^\/api\/approvals$/, handler: approvalsHandler },
  { method: "POST", pattern: /^\/api\/approvals$/, handler: approvalsHandler },
  { method: "PATCH", pattern: /^\/api\/approvals$/, handler: approvalsHandler },
  { method: "GET", pattern: /^\/api\/invoices$/, handler: invoicesHandler },
  { method: "POST", pattern: /^\/api\/invoices$/, handler: invoicesHandler },
  { method: "PATCH", pattern: /^\/api\/invoices$/, handler: invoicesHandler },
  { method: "DELETE", pattern: /^\/api\/invoices$/, handler: invoicesHandler },
  { method: "GET", pattern: /^\/api\/followups$/, handler: followUpsListHandler },
  { method: "POST", pattern: /^\/api\/followups$/, handler: followUpsListHandler },
  { method: "PATCH", pattern: /^\/api\/followups$/, handler: followUpsListHandler },
  { method: "DELETE", pattern: /^\/api\/followups$/, handler: followUpsListHandler },
];

function matchRoute(pathname: string, method: string) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = pathname.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      if (match.length > 1) {
        params.id = match[1];
      }
      return { route, params };
    }
  }
  return null;
}

export async function handleApiRequest(request: Request) {
  const url = new URL(request.url);
  const matched = matchRoute(url.pathname, request.method);
  if (!matched) {
    return errorResponse(`No API route for ${request.method} ${url.pathname}`, 404);
  }

  try {
    return await matched.route.handler(request, matched.params);
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as any).status ?? 500;
      return errorResponse(error.message, status);
    }
    return errorResponse("Unexpected server error", 500);
  }
}
