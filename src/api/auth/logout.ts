import { connectDb } from "../../lib/db";
import { getSessionUserFromRefreshToken, getSessionUserFromRequest } from "../../lib/auth";
import { jsonResponse, errorResponse } from "../../lib/api";
import { User } from "../../models/user";
import { recordAudit } from "../../lib/audit";

function buildCookie(name: string, value: string, maxAge: number, path = "/") {
  const secure = process.env.NODE_ENV === "production";
  return `${name}=${encodeURIComponent(value)}; HttpOnly; Path=${path}; Max-Age=${maxAge}; SameSite=Strict;${secure ? " Secure;" : ""}`;
}

function getClientIp(request: Request) {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }
  return "127.0.0.1";
}

export async function logoutHandler(request: Request) {
  const user = (await getSessionUserFromRequest(request)) ?? (await getSessionUserFromRefreshToken(request));
  if (user) {
    await connectDb();
    const dbUser = await User.findById(user.id).exec();
    if (dbUser) {
      dbUser.lastLogoutAt = new Date();
      dbUser.lastAuthAction = "Logout";
      dbUser.lastIpAddress = getClientIp(request);
      await dbUser.save();

      await recordAudit({
        actorId: dbUser._id.toString(),
        actionType: "logout",
        metadata: { email: dbUser.email, ip: dbUser.lastIpAddress },
      });
    }
  }

  const headers = new Headers();
  headers.append("Set-Cookie", buildCookie("accessToken", "", 0));
  headers.append("Set-Cookie", buildCookie("refreshToken", "", 0, "/api/auth/refresh"));
  return new Response(
    JSON.stringify({ success: true, data: { message: "Logged out" }, error: null }),
    {
      status: 200,
      headers,
    },
  );
}
