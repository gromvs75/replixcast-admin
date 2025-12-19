import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const allowedTypes = [
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "image/jpeg",
  "image/png",
];

const MAX_SIZE = 200 * 1024 * 1024;

export async function POST(req: Request) {
  try {
	const formData = await req.formData();
	const file = formData.get("file");
	const orderId = formData.get("orderId");

	if (!(file instanceof File) || typeof orderId !== "string") {
	  return NextResponse.json({ error: "Missing file or orderId" }, { status: 400 });
	}

	if (!allowedTypes.includes(file.type)) {
	  return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
	}

	if (file.size > MAX_SIZE) {
	  return NextResponse.json({ error: "File too large" }, { status: 400 });
	}

	const filePath = `${orderId}/${Date.now()}-${file.name}`;

	// В Node надо грузить Buffer
	const buffer = Buffer.from(await file.arrayBuffer());

	const { error: uploadError } = await supabaseAdmin.storage
	  .from("orders-files-client")
	  .upload(filePath, buffer, {
		contentType: file.type,
		upsert: false,
	  });

	if (uploadError) {
	  console.error("storage upload error:", uploadError);
	  return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
	}

	const { error: dbError } = await supabaseAdmin.from("order_files").insert({
	  order_id: orderId,
	  bucket: "orders-files-client",
	  path: filePath,
	  filename: file.name,
	  mime: file.type,
	  size: file.size,
	  role: "client",
	});

	if (dbError) {
	  console.error("db insert error:", dbError);
	  return NextResponse.json(
		{ error: "File uploaded but DB insert failed" },
		{ status: 500 }
	  );
	}

	return NextResponse.json({ success: true });
  } catch (e) {
	console.error("upload-client route error:", e);
	return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}