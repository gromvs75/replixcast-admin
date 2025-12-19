import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function DELETE(
  req: Request,
  { params }: { params: { fileId: string } }
) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const fileId = String(params.fileId || "").trim();
  if (!fileId) return NextResponse.json({ error: "Missing fileId" }, { status: 400 });

  const { data: file, error: fetchError } = await supabaseAdmin
    .from("order_files")
    .select("id,bucket,path,filename")
    .eq("id", fileId)
    .single();

  if (fetchError || !file) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const { error: storageError } = await supabaseAdmin.storage
    .from(String(file.bucket))
    .remove([String(file.path)]);

  if (storageError) {
    return NextResponse.json(
      { error: storageError.message || "Storage delete failed" },
      { status: 500 }
    );
  }

  const { error: dbError } = await supabaseAdmin
    .from("order_files")
    .delete()
    .eq("id", fileId);

  if (dbError) {
    return NextResponse.json(
      { error: dbError.message || "DB delete failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: fileId });
}