import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function createOrder(payload: Record<string, any>) {
  return supabaseAdmin.from("orders").insert(payload).select("id").single();
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const leadId = params.id;

  const { data: lead, error: leadErr } = await supabaseAdmin
	.from("lead_requests")
	.select("id, name, email, message, converted_order_id")
	.eq("id", leadId)
	.single();

  if (leadErr || !lead) {
	return NextResponse.json({ ok: false, error: leadErr?.message || "Lead not found" }, { status: 404 });
  }

  if (lead.converted_order_id) {
	return NextResponse.json({ ok: true, orderId: lead.converted_order_id });
  }

  const base = {
	name: lead.name,
	email: lead.email,
	is_read: false,
	// можно добавить source если есть: source: "lead"
  };

  // 1) пробуем description
  let orderId: string | null = null;

  {
	const { data, error } = await createOrder({ ...base, description: lead.message });
	if (!error && data?.id) orderId = data.id;

	// если ошибка про колонку — пробуем следующий вариант
	if (error && !String(error.message).toLowerCase().includes("description")) {
	  return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
	}
  }

  // 2) пробуем script
  if (!orderId) {
	const { data, error } = await createOrder({ ...base, script: lead.message });
	if (!error && data?.id) orderId = data.id;

	if (error && !String(error.message).toLowerCase().includes("script")) {
	  return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
	}
  }

  // 3) всё ещё нет — значит у orders другая обязательная схема
  if (!orderId) {
	return NextResponse.json(
	  {
		ok: false,
		error:
		  "Не удалось создать order: в таблице orders нет колонок description/script или есть другие обязательные поля. Скажи какие колонки в orders обязательные — подгоню insert.",
	  },
	  { status: 400 }
	);
  }

  const { error: updErr } = await supabaseAdmin
	.from("lead_requests")
	.update({ converted_order_id: orderId, is_read: true })
	.eq("id", leadId);

  if (updErr) {
	return NextResponse.json({ ok: false, error: updErr.message, orderId }, { status: 500 });
  }

  return NextResponse.json({ ok: true, orderId });
}