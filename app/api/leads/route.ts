import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Если будешь дергать с Strato → понадобится CORS (см. ниже)
export async function OPTIONS() {
  return new NextResponse(null, {
	status: 204,
	headers: corsHeaders(),
  });
}

export async function POST(req: Request) {
  try {
	const form = await req.formData();

	const name = String(form.get("name") || "");
	const email = String(form.get("email") || "");
	const message = String(form.get("message") || "");

	// 1) создаём лид
	const { data: lead, error: leadErr } = await supabaseAdmin
	  .from("lead_requests")
	  .insert({ name, email, message })
	  .select("id")
	  .single();

	if (leadErr) throw leadErr;

	// 2) файл → Storage + lead_files
	const file = form.get("file");
	if (file && file instanceof File && file.size > 0) {
	  const ab = await file.arrayBuffer();
	  const buffer = Buffer.from(ab);

	  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
	  const path = `leads/${lead.id}/${Date.now()}_${safeName}`;

	  const { error: upErr } = await supabaseAdmin.storage
		.from("leads") // ✅ bucket leads
		.upload(path, buffer, { contentType: file.type, upsert: false });

	  if (upErr) throw upErr;

	  // ⚠️ подстрой названия колонок под твою lead_files
	  const { error: fileErr } = await supabaseAdmin.from("lead_files").insert({
		lead_id: lead.id,
		bucket: "leads",
		path,
		original_name: file.name,
		mime_type: file.type,
		size: file.size,
	  });

	  if (fileErr) throw fileErr;
	}

	return NextResponse.json({ ok: true, lead_id: lead.id }, { headers: corsHeaders() });
  } catch (e: any) {
	return NextResponse.json(
	  { ok: false, error: e?.message || "Unknown error" },
	  { status: 400, headers: corsHeaders() }
	);
  }
}

function corsHeaders() {
  // на локалке можно "*", на прод лучше конкретный домен Strato
  return {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST,OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
  };
}