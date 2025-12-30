"use client";

import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/authedFetch";

export default function LeadActions({
  lead,
  onChanged,
}: {
  lead: { id: string; converted_order_id?: string | null };
  onChanged: () => void;
}) {
  const router = useRouter();

  const markRead = async () => {
	try {
	  const res = await authedFetch(`/api/admin/leads/${lead.id}/read`, { method: "POST" });
	  const json = await res.json().catch(() => ({}));
	  if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
	  toast.success("Помечено как прочитанное");
	  onChanged();
	} catch (e: any) {
	  toast.error(e?.message || "Не удалось пометить");
	}
  };

  const convert = async () => {
	if (lead.converted_order_id) {
	  router.push(`/admin/orders/${lead.converted_order_id}`);
	  return;
	}

	try {
	  const res = await authedFetch(`/api/admin/leads/${lead.id}/convert`, { method: "POST" });
	  const json = await res.json().catch(() => ({}));
	  if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);

	  toast.success("Создана заявка из лида");
	  const orderId = json.orderId as string;
	  router.push(`/admin/orders/${orderId}`);
	  router.refresh();
	} catch (e: any) {
	  toast.error(e?.message || "Конвертация не удалась");
	}
  };

  return (
	<div className="flex items-center gap-2">
	  <button
		onClick={markRead}
		className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
	  >
		Mark read
	  </button>

	  <button
		onClick={convert}
		className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-black"
	  >
		{lead.converted_order_id ? "Открыть заявку" : "Конвертировать в заявку"}
	  </button>
	</div>
  );
}