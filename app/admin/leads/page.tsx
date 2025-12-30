"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { authedFetch } from "@/lib/authedFetch";

type LeadRow = {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  message: string | null;
  is_read?: boolean | null;
  ip?: string | null;
  referer?: string | null;
};

function fmtDate(iso: string) {
  try {
	return new Date(iso).toLocaleString();
  } catch {
	return iso;
  }
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
	setLoading(true);
	try {
	  const res = await authedFetch("/api/admin/leads?limit=100", { cache: "no-store" });
	  const json = await res.json().catch(() => ({}));

	  if (!res.ok || !json.ok) {
		throw new Error(json.error || `HTTP ${res.status}`);
	  }

	  setLeads(json.leads || []);
	} catch (e: any) {
	  setLeads([]);
	  toast.error(e?.message || "Не удалось загрузить лиды");
	} finally {
	  setLoading(false);
	}
  };

  useEffect(() => {
	load();
  }, []);

  return (
	<div className="p-6 space-y-4">
	  <div className="flex items-center justify-between gap-3">
		<h1 className="text-xl font-semibold">Leads (лендинг)</h1>
		<div className="flex items-center gap-3">
		  <button
			onClick={load}
			className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
			disabled={loading}
			title="Перезагрузить"
		  >
			Обновить
		  </button>
		  <div className="text-sm text-slate-500">
			{loading ? "Загрузка…" : `${leads.length} записей`}
		  </div>
		</div>
	  </div>

	  <div className="border rounded-lg overflow-hidden bg-white">
		<table className="w-full text-sm">
		  <thead className="bg-slate-50 text-slate-600">
			<tr>
			  <th className="p-3 text-left">Дата</th>
			  <th className="p-3 text-left">Имя</th>
			  <th className="p-3 text-left">Email</th>
			  <th className="p-3 text-left">Сообщение</th>
			  <th className="p-3 text-left">Статус</th>
			</tr>
		  </thead>
		  <tbody>
			{!loading &&
			  leads.map((l) => {
				const snippet = (l.message || "").slice(0, 80);
				const isNew = l.is_read === false || l.is_read === null || typeof l.is_read === "undefined";

				return (
				  <tr key={l.id} className="border-t hover:bg-slate-50">
					<td className="p-3 whitespace-nowrap">{fmtDate(l.created_at)}</td>
					<td className="p-3">
					  <Link className="text-blue-600 hover:underline" href={`/admin/leads/${l.id}`}>
						{l.name || "—"}
					  </Link>
					</td>
					<td className="p-3">{l.email || "—"}</td>
					<td className="p-3">
					  {snippet}
					  {(l.message || "").length > 80 ? "…" : ""}
					</td>
					<td className="p-3">
					  {isNew ? (
						<span className="px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs">NEW</span>
					  ) : (
						<span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs">read</span>
					  )}
					</td>
				  </tr>
				);
			  })}

			{!loading && leads.length === 0 && (
			  <tr>
				<td className="p-6 text-center text-slate-500" colSpan={5}>
				  Пока пусто. Отправь заявку с replixcast.de и нажми “Обновить”.
				</td>
			  </tr>
			)}

			{loading && (
			  <tr>
				<td className="p-6 text-center text-slate-500" colSpan={5}>
				  Загрузка…
				</td>
			  </tr>
			)}
		  </tbody>
		</table>
	  </div>
	</div>
  );
}