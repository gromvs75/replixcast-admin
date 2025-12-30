"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import LeadActions from "./LeadActions";
import { authedFetch } from "@/lib/authedFetch";

type Lead = {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  message: string | null;
  ip?: string | null;
  referer?: string | null;
  is_read?: boolean | null;
  converted_order_id?: string | null;

  file_path?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
};

export default function LeadPage({ params }: { params: { id: string } }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
	setLoading(true);
	try {
	  const res = await authedFetch(`/api/admin/leads/${params.id}`, { cache: "no-store" });
	  const json = await res.json().catch(() => ({}));
	  if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);

	  setLead(json.lead);

	  // ✅ отмечаем прочитанным через PATCH (у тебя PATCH уже есть)
	  await authedFetch(`/api/admin/leads/${params.id}`, { method: "PATCH" }).catch(() => null);
	} catch (e: any) {
	  setLead(null);
	  toast.error(e?.message || "Лид не найден / нет доступа");
	} finally {
	  setLoading(false);
	}
  };

  useEffect(() => {
	load();
	// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (loading) return <div className="p-6 text-slate-500">Загрузка…</div>;
  if (!lead) return <div className="p-6 text-slate-600">Лид не найден</div>;

  const prettySize = (n?: number | null) => {
	if (!n) return "";
	const kb = n / 1024;
	if (kb < 1024) return `${Math.round(kb)} KB`;
	return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
	<div className="p-6 space-y-4">
	  <div className="flex items-center justify-between gap-3">
		<div>
		  <h1 className="text-xl font-semibold">Лид</h1>
		  <div className="text-sm text-slate-500">
			{new Date(lead.created_at).toLocaleString()}
		  </div>
		</div>

		<LeadActions lead={lead} onChanged={load} />
	  </div>

	  <div className="rounded-lg border bg-white p-4 space-y-2 text-sm">
		<div>
		  <b>Имя:</b> {lead.name || "—"}
		</div>
		<div>
		  <b>Email:</b> {lead.email || "—"}
		</div>
		<div>
		  <b>Сообщение:</b>
		  <div className="mt-1 whitespace-pre-wrap">{lead.message || "—"}</div>
		</div>

		<hr className="my-2" />

		<div className="text-slate-500">
		  <div>
			<b>IP:</b> {lead.ip || "—"}
		  </div>
		  <div>
			<b>Referer:</b> {lead.referer || "—"}
		  </div>

		  {/* ✅ Файл */}
		  {lead.file_path ? (
			<div className="mt-3">
			  <b>Файл:</b>{" "}
			  <button
				className="text-blue-600 hover:underline"
				onClick={async () => {
				  try {
					const res = await authedFetch(`/api/admin/leads/${lead.id}/file`);
					const j = await res.json().catch(() => ({}));
					if (!res.ok || !j.ok) return toast.error(j.error || "Не удалось получить файл");

					// лучше сразу открыть ссылку
					window.open(j.url, "_blank", "noopener,noreferrer");
				  } catch {
					toast.error("Не удалось получить файл");
				  }
				}}
			  >
				{lead.file_name ? `Скачать (${lead.file_name}${lead.file_size ? `, ${prettySize(lead.file_size)}` : ""})` : "Скачать"}
			  </button>
			</div>
		  ) : (
			<div className="mt-3">Файл не прикреплён</div>
		  )}
		</div>

		{lead.converted_order_id && (
		  <div className="mt-3 rounded bg-emerald-50 p-2 text-emerald-800">
			Уже переведён в заявку:{" "}
			<b className="font-mono">{lead.converted_order_id}</b>
		  </div>
		)}
	  </div>
	</div>
  );
}