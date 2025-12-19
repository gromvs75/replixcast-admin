import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const orderId = formData.get("orderId") as string;
    const file = formData.get("file") as File;

    if (!orderId || !file) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // имя файла уникальное
    const fileName = `${orderId}/${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from("orders-files")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error(error);
      return NextResponse.json({ error }, { status: 500 });
    }

    const fileUrl = supabase.storage.from("orders-files").getPublicUrl(fileName).data.publicUrl;

    return NextResponse.json({ url: fileUrl }, { status: 200 });
  } catch (e) {
    console.error("UPLOAD ERROR", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}