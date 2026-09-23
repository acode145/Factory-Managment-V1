import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE_NAME = "fm_session_token";
const SECRET_KEY = process.env.SESSION_SECRET || "fallback-factory-management-secret-key-2026";

export interface SessionData {
  userId: string;
  username: string;
  role: "ADMIN" | "STOREKEEPER" | "FLOOR_SUPERVISOR" | "GATE_CLERK" | "FABRIC_PROCESSING_INCHARGE";
  department?: string | null;
  fullName: string;
  createdAt: number;
}

function signPayload(payload: string): string {
  const hmac = crypto.createHmac("sha256", SECRET_KEY);
  hmac.update(payload);
  return hmac.digest("hex");
}

export async function createSession(user: {
  id: string;
  username: string;
  role: string;
  department?: string | null;
  fullName: string;
}) {
  const sessionData: SessionData = {
    userId: user.id,
    username: user.username,
    role: user.role as SessionData["role"],
    department: user.department || null,
    fullName: user.fullName,
    createdAt: Date.now(),
  };

  const payload = Buffer.from(JSON.stringify(sessionData)).toString("base64url");
  const signature = signPayload(payload);
  const token = `${payload}.${signature}`;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const expectedSignature = signPayload(payload);

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(payload, "base64url").toString("utf-8");
    const session = JSON.parse(jsonStr) as SessionData;
    return session;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
