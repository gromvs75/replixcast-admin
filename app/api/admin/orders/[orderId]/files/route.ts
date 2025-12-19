import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export async function GET(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  // ✅ только админ
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const orderId = String(params.orderId || "");
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("order_files")
    .select("id,order_id,bucket,path,filename,mime,size,role,created_at")
    .eq("order_id", orderId)
    .eq("role", "admin")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const files = data ?? [];

  const withUrls = await Promise.all(
    files.map(async (f) => {
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from(f.bucket)
        .createSignedUrl(f.path, 60 * 15);

      return {
        ...f,
        url: signErr ? null : signed?.signedUrl ?? null,
        sign_error: signErr ? signErr.message : null,
      };
    })
  );

  return NextResponse.json({ files: withUrls });
}