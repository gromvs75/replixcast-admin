import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ⬇️ Загружаем серверные ключи из переменных окружения
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Проверяем, что запрос корректный
    if (!body) {
      return NextResponse.json(
        { error: "Empty request body" },
        { status: 400 }
      );
    }

    // Добавляем новую заявку в таблицу orders
    const { data, error } = await supabase
      .from("orders")
      .insert([
        {
          name: body.name,
          email: body.email,
          script: body.script,
          language: body.language,
          voice: body.voice,
          photo_url: body.photo_url,
          avatar_id: body.avatar_id, // ⬅️ Добавлено
          video_id: body.video_id,
          video_url: body.video_url,
          status: "new",
        },
      ])
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to insert order", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: any) {
    console.error("API route error:", err);
    return NextResponse.json(
      { error: "Server error", details: err.message },
      { status: 500 }
    );
  }
}

// ⛔ Блокируем GET-запросы
export function GET() {
  return NextResponse.json(
    { error: "Only POST method is allowed" },
    { status: 405 }
  );
}
