import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function GET(
  _req: Request,
  { params }: { params: { orderId: string } }
) {
  try {
	const orderId = String(params.orderId || "").trim();
	if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

	const { data, error } = await supabaseAdmin
	  .from("order_files")
	  .select("id,order_id,bucket,path,filename,mime,size,role,created_at")
	  .eq("order_id", orderId)
	  .eq("role", "client")
	  .order("created_at", { ascending: false });

	if (error) return NextResponse.json({ error: error.message }, { status: 400 });

	// подписанные ссылки
	const withUrls = await Promise.all(
	  (data || []).map(async (f: any) => {
		const { data: s, error: se } = await supabaseAdmin.storage
		  .from(f.bucket)
		  .createSignedUrl(f.path, 60 * 60);

		return { ...f, url: se ? null : s?.signedUrl || null };
	  })
	);

	return NextResponse.json(withUrls);
  } catch (e: any) {
	return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}