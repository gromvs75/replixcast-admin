import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const id = ctx.params.id;

  const { data: lead, error } = await supabaseAdmin
	.from("lead_requests")
	.select("id,file_path,file_name,file_type,file_size")
	.eq("id", id)
	.maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!lead) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (!lead.file_path) {
	return NextResponse.json({ ok: false, error: "File is not attached" }, { status: 404 });
  }

  // ВАЖНО: bucket name = "leads"
  const { data: signed, error: signErr } = await supabaseAdmin.storage
	.from("leads")
	.createSignedUrl(lead.file_path, 60 * 10); // 10 минут

  if (signErr || !signed?.signedUrl) {
	return NextResponse.json(
	  { ok: false, error: signErr?.message || "Failed to sign url" },
	  { status: 500 }
	);
  }

  return NextResponse.json({
	ok: true,
	url: signed.signedUrl,
	fileName: lead.file_name,
	fileType: lead.file_type,
	fileSize: lead.file_size,
  });
}