// app/api/admin/leads/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function toInt(v: string | null, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

export async function GET(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const limit = Math.min(toInt(url.searchParams.get("limit"), 50), 200);

  const { data, error } = await supabaseAdmin
	.from("lead_requests")
	.select("id,created_at,name,email,message,ip,user_agent,referer,is_read,converted_order_id,converted_at,file_path,file_name,file_type,file_size")
	.order("created_at", { ascending: false })
	.limit(limit);

  if (error) {
	return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, leads: data ?? [] });
}