// lib/apiAuth.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function supabaseAnon() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
	auth: { persistSession: false, autoRefreshToken: false },
  });
}

function adminUidsSet() {
  const raw = process.env.ADMIN_UIDS || "";
  return new Set(
	raw
	  .split(",")
	  .map((s) => s.trim())
	  .filter(Boolean)
  );
}

export async function requireUser(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
	return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const sb = supabaseAnon();
  const { data, error } = await sb.auth.getUser(token);

  if (error || !data?.user) {
	return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { ok: true as const, user: data.user, token };
}

export async function requireAdmin(req: Request) {
  const u = await requireUser(req);
  if (!u.ok) return u;

  const admins = adminUidsSet();
  if (!admins.has(u.user.id)) {
	return { ok: false as const, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const, user: u.user, token: u.token };
}