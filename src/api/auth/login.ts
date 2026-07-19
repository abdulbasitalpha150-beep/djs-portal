import { connectDb } from "../../lib/db";
import { authLoginSchema } from "../../lib/validation";
import { User } from "../../models/user";
import { signAccessToken, signRefreshToken } from "../../lib/auth";
import { jsonResponse, parseJson, parseZod, errorResponse } from "../../lib/api";
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

export async function loginHandler(request: Request) {
  const body = await parseJson(request);
  const payload = parseZod(authLoginSchema, body);

  await connectDb();

  const user = await User.findOne({ email: payload.email.toLowerCase().trim() });
  if (!user) {
    return errorResponse("Invalid credentials", 401);
  }

  const validPassword = await user.comparePassword(payload.password);
  if (!validPassword) {
    return errorResponse("Invalid credentials", 401);
  }

  if (user.status !== "active") {
    return errorResponse("Account is not active", 403);
  }

  if (user.role === "suspended") {
    return errorResponse("Account is suspended", 403);
  }

  // Update authentication activity
  user.lastLoginAt = new Date();
  user.lastAuthAction = "Login";
  user.lastIpAddress = getClientIp(request);
  await user.save();

  const accessToken = signAccessToken(user._id.toString());
  const refreshToken = signRefreshToken(user._id.toString());

  const headers = new Headers();
  headers.append("Set-Cookie", buildCookie("accessToken", accessToken, 15 * 60));
  headers.append(
    "Set-Cookie",
    buildCookie("refreshToken", refreshToken, 7 * 24 * 60 * 60, "/api/auth/refresh"),
  );

  await recordAudit({
    actorId: user._id.toString(),
    actionType: "login",
    metadata: { email: user.email, ip: user.lastIpAddress },
  });

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          isTemporaryPassword: user.isTemporaryPassword,
        },
      },
      error: null,
    }),
    { status: 200, headers },
  );
}
