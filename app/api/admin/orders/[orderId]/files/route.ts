import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type OrderFile = {
  id: string;
  order_id: string;
  bucket: string;
  path: string;
  filename: string;
  mime: string;
  size: number;
  role: "client" | "admin";
  created_at: string;
  url?: string | null;
};

export async function GET(req: Request, { params }: { params: { orderId: string } }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const orderId = String(params.orderId || "").trim();
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const url = new URL(req.url);
    const role = (url.searchParams.get("role") || "all").trim(); // client | admin | all

    let q = supabaseAdmin
      .from("order_files")
      .select("id,order_id,bucket,path,filename,mime,size,role,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    if (role === "client" || role === "admin") {
      q = q.eq("role", role);
    } else {
      q = q.in("role", ["client", "admin"]);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const files = (data || []) as OrderFile[];

    const withUrls: OrderFile[] = await Promise.all(
      files.map(async (f) => {
        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from(String(f.bucket))
          .createSignedUrl(String(f.path), 60 * 60); // 1 час

        return { ...f, url: signErr ? null : signed?.signedUrl ?? null };
      })
    );

    // backward/удобный формат
    if (role === "client" || role === "admin") {
      return NextResponse.json({ files: withUrls });
    }

    return NextResponse.json({
      clientFiles: withUrls.filter((x) => x.role === "client"),
      adminFiles: withUrls.filter((x) => x.role === "admin"),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}