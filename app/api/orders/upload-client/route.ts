import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const STORAGE_BUCKET = "orders-files-client";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MAX_SIZE = 200 * 1024 * 1024; // 200MB / файл
const MAX_FILES_PER_REQUEST = 5;
const MAX_FILES_TOTAL_PER_ORDER = 5;

const allowedTypes = new Set([
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "image/jpeg",
  "image/png",
]);

function safeName(name: string) {
  return (name || "file")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const orderId = String(formData.get("orderId") || "").trim();
    const email = String(formData.get("email") || "").trim(); // опционально

    // поддержка и single "file", и multi "files"
    const filesAll = formData.getAll("files").filter(Boolean) as File[];
    const single = formData.get("file") as File | null;

    const files: File[] = filesAll.length > 0 ? filesAll : single ? [single] : [];

    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    if (files.length === 0) return NextResponse.json({ error: "No files provided" }, { status: 400 });
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json({ error: `Too many files (max ${MAX_FILES_PER_REQUEST})` }, { status: 400 });
    }

    // 1) проверяем что заявка существует (и по желанию что email совпадает)
    {
      const { data: order, error } = await supabaseAdmin
        .from("orders")
        .select("id,email,created_at")
        .eq("id", orderId)
        .single();

      if (error || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      if (email && String(order.email || "").trim() !== email) {
        return NextResponse.json({ error: "Email does not match this order" }, { status: 403 });
      }
    }

    // 2) лимит файлов на заявку (всего)
    {
      const { count, error } = await supabaseAdmin
        .from("order_files")
        .select("id", { count: "exact", head: true })
        .eq("order_id", orderId)
        .eq("role", "client");

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const already = count ?? 0;
      if (already + files.length > MAX_FILES_TOTAL_PER_ORDER) {
        return NextResponse.json(
          { error: `Files limit exceeded. Already: ${already}, trying: ${files.length}, max: ${MAX_FILES_TOTAL_PER_ORDER}` },
          { status: 400 }
        );
      }
    }

    const uploaded: any[] = [];
    const failed: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file) continue;

      if (!allowedTypes.has(file.type)) {
        failed.push({ name: file.name, error: "Bad file type" });
        continue;
      }

      if (file.size > MAX_SIZE) {
        failed.push({ name: file.name, error: "File too large" });
        continue;
      }

      const originalName = file.name || "file";
      const safe = safeName(originalName);
      const filePath = `${orderId}/${Date.now()}-${i}-${safe}`;

      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        failed.push({ name: originalName, error: uploadError.message });
        continue;
      }

      const { data: row, error: dbError } = await supabaseAdmin
        .from("order_files")
        .insert({
          order_id: orderId,
          bucket: STORAGE_BUCKET,
          path: filePath,
          filename: originalName,
          mime: file.type || "application/octet-stream",
          size: file.size,
          role: "client",
        })
        .select("id,order_id,bucket,path,filename,mime,size,role,created_at")
        .single();

      if (dbError) {
        await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([filePath]);
        failed.push({ name: originalName, error: dbError.message });
        continue;
      }

      uploaded.push(row);
    }

    return NextResponse.json({ ok: true, uploaded, failed });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}