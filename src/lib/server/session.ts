import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "kroove_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12h

type SessionPayload = {
  ldap: string;
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing AUTH_SESSION_SECRET");
  }
  return secret;
}

function toBase64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payloadB64: string) {
  return createHmac("sha256", getSessionSecret()).update(payloadB64).digest("base64url");
}

export function createSessionToken(ldap: string) {
  const payload: SessionPayload = {
    ldap,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(fromBase64Url(payloadB64)) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload.ldap || !payload.exp) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function getSessionMaxAgeSeconds() {
  return SESSION_MAX_AGE_SECONDS;
}
