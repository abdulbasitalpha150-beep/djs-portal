import jwt, { Secret } from "jsonwebtoken";
import { connectDb } from "./db";
import { User } from "../models/user";

function getJwtSecret(name: string): Secret {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be defined`);
  }
  return value;
}

export type SessionUser = {
  id: string;
  role: string;
  status: string;
  name: string;
  email: string;
  teamId?: string;
};

export function verifyJwt(token: string) {
  try {
    return jwt.verify(token, getJwtSecret("JWT_SECRET")) as unknown as { sub: string; type: string };
  } catch (error) {
    return null;
  }
}

export function signAccessToken(userId: string) {
  return jwt.sign({ sub: userId, type: "access" }, getJwtSecret("JWT_SECRET"), {
    expiresIn: "15m",
  });
}

export function signRefreshToken(userId: string) {
  return jwt.sign({ sub: userId, type: "refresh" }, getJwtSecret("JWT_REFRESH_SECRET"), {
    expiresIn: "7d",
  });
}

async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  await connectDb();
  const user = (await User.findById(userId).lean().exec()) as
    | (typeof User & {
        _id: any;
        role: string;
        status: string;
        name: string;
        email: string;
        teamId?: any;
      })
    | null;
  if (!user || user.status !== "active") {
    return null;
  }
  return {
    id: user._id.toString(),
    role: user.role,
    status: user.status,
    name: user.name,
    email: user.email,
    teamId: user.teamId ? user.teamId.toString() : undefined,
  } as SessionUser;
}

export async function getSessionUserFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const tokenMatch = cookieHeader.match(/(?:^|; )accessToken=([^;]+)/);
  if (tokenMatch) {
    const decoded = verifyJwt(decodeURIComponent(tokenMatch[1]));
    if (decoded && decoded.type === "access") {
      return loadSessionUser(decoded.sub);
    }
  }
  return null;
}

export async function getSessionUserFromRefreshToken(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const tokenMatch = cookieHeader.match(/(?:^|; )refreshToken=([^;]+)/);
  if (!tokenMatch) {
    return null;
  }

  const decoded = jwt.decode(decodeURIComponent(tokenMatch[1])) as
    | { sub?: string; type?: string }
    | null;
  if (!decoded || decoded.type !== "refresh" || !decoded.sub) {
    return null;
  }

  return loadSessionUser(decoded.sub);
}

export function requireAuth(user: SessionUser | null) {
  if (!user) {
    const error = new Error("Authentication required");
    (error as any).status = 401;
    throw error;
  }
  return user;
}

export function hasRole(user: SessionUser, roles: string[]) {
  return roles.includes(user.role);
}

export function requireRole(user: SessionUser | null, roles: string[]) {
  const sessionUser = requireAuth(user);
  if (!hasRole(sessionUser, roles)) {
    const error = new Error("Forbidden");
    (error as any).status = 403;
    throw error;
  }
  return sessionUser;
}
