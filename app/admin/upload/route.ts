// app/api/admin/upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const STORAGE_BUCKET = "orders-files-admin";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function safeName(name: string) {
  return (name || "file")
	.normalize("NFD")
	.replace(/[\u0300-\u036f]/g, "")
	.replace(/[^\w.\-() ]+/g, "_");
}

export async function POST(req: Request) {
  // ✅ защита: только админ с Bearer токеном
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
	const formData = await req.formData();
	const file = formData.get("file") as File | null;
	const orderId = String(formData.get("orderId") || "");

	if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
	if (!orderId) return NextResponse.json({ error: "No orderId" }, { status: 400 });

	const clean = safeName(file.name);
	const path = `${orderId}/admin/${Date.now()}_${clean}`;

	// supabase-js в node надёжнее грузит Buffer
	const ab = await file.arrayBuffer();
	const buf = Buffer.from(ab);

	const { error: uploadError } = await supabaseAdmin.storage
	  .from(STORAGE_BUCKET)
	  .upload(path, buf, {
		contentType: file.type || "application/octet-stream",
		upsert: false,
	  });

	if (uploadError) {
	  return NextResponse.json({ error: uploadError.message }, { status: 400 });
	}

	const { error: dbError } = await supabaseAdmin.from("order_files").insert({
	  order_id: orderId,
	  bucket: STORAGE_BUCKET,
	  path,
	  filename: file.name || clean,
	  mime: file.type || "application/octet-stream",
	  size: file.size,
	  role: "admin",
	});

	if (dbError) {
	  await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([path]);
	  return NextResponse.json({ error: dbError.message }, { status: 400 });
	}

	return NextResponse.json({ ok: true });
  } catch (e: any) {
	return NextResponse.json({ error: e?.message || "Upload failed" }, { status: 500 });
  }
}