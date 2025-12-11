import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  return NextResponse.json(
    { error: "Only POST method is allowed" },
    { status: 405 }
  );
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const { error } = await supabase.from("orders").insert([
      {
        name: data.name,
        email: data.email,
        script: data.script,
        language: data.language,
        voice: data.voice,
        photo_url: data.photo_url,
        avatar_id: data.avatar_id,
        video_id: data.video_id,
        video_url: data.video_url,
        status: "new",
      },
    ]);

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: "Invalid request", details: err.message },
      { status: 400 }
    );
  }
}
