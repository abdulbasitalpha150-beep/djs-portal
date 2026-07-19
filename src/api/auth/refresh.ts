import jwt, { Secret } from "jsonwebtoken";
import { connectDb } from "../../lib/db";
import { User } from "../../models/user";
import { signAccessToken } from "../../lib/auth";
import { errorResponse } from "../../lib/api";

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const jwtRefreshSecret: Secret = JWT_REFRESH_SECRET ?? "";

export async function refreshHandler(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const tokenMatch = cookieHeader.match(/(?:^|; )refreshToken=([^;]+)/);
  if (!tokenMatch) {
    return errorResponse("Refresh token missing", 401);
  }

  if (!JWT_REFRESH_SECRET) {
    return errorResponse("JWT_REFRESH_SECRET must be configured", 500);
  }

  let payload: { sub: string; type: string };
  try {
    payload = jwt.verify(decodeURIComponent(tokenMatch[1]), jwtRefreshSecret) as unknown as {
      sub: string;
      type: string;
    };
  } catch (error) {
    return errorResponse("Invalid refresh token", 401);
  }

  if (payload.type !== "refresh") {
    return errorResponse("Invalid token type", 401);
  }

  await connectDb();
  const user = await User.findById(payload.sub);
  if (!user || user.status !== "active") {
    return errorResponse("User not found or inactive", 401);
  }

  const accessToken = signAccessToken(user._id.toString());

  const headers = new Headers();
  const secure = process.env.NODE_ENV === "production";
  headers.append(
    "Set-Cookie",
    `accessToken=${encodeURIComponent(accessToken)}; HttpOnly; Path=/; Max-Age=${15 * 60}; SameSite=Strict;${secure ? " Secure;" : ""}`,
  );

  return new Response(JSON.stringify({ success: true, data: { accessToken }, error: null }), {
    status: 200,
    headers,
  });
}
