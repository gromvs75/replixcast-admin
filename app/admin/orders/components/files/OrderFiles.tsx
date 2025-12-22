"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { authedFetch } from "@/lib/authedFetch";
import AdminUpload from "@/app/admin/orders/components/files/AdminUpload";

type Props = { orderId: string };

type OrderFile = {
  id: string;
  order_id: string;
  bucket: string;
  path: string;
  filename: string;
  mime: string;
  size: number;
  role: "client" | "admin" | string;
  created_at: string;
  url?: string | null;
};

function formatBytes(bytes: number) {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
	v /= 1024;
	i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function uniqById(files: OrderFile[]) {
  const m = new Map<string, OrderFile>();
  for (const f of files) m.set(f.id, f);
  return Array.from(m.values());
}

async function downloadDirect(url: string, filename: string) {
  const t = toast.loading("Скачиваю…");
  try {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const blob = await res.blob();
	const blobUrl = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = blobUrl;
	a.download = filename || "file";
	document.body.appendChild(a);
	a.click();
	a.remove();

	URL.revokeObjectURL(blobUrl);
	toast.dismiss(t);
	toast.success("Скачано");
  } catch (e: any) {
	toast.dismiss(t);
	toast.error(e?.message || "Не удалось скачать");
  }
}

function FileViewer({ mime, url }: { mime: string; url: string }) {
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");

  const isOffice =
	mime === "application/msword" ||
	mime === "application/vnd.ms-excel" ||
	mime === "application/vnd.ms-powerpoint" ||
	mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
	mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
	mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation";

  const isTextLike =
	mime.startsWith("text/") ||
	mime === "application/json" ||
	mime === "application/xml" ||
	mime === "application/xhtml+xml";

  const [text, setText] = useState("");
  const [textLoading, setTextLoading] = useState(false);
  const [textErr, setTextErr] = useState<string | null>(null);

  useEffect(() => {
	let cancelled = false;

	async function loadText() {
	  if (!isTextLike) return;
	  setText("");
	  setTextErr(null);
	  setTextLoading(true);

	  try {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const t = await res.text();
		if (!cancelled) setText(t);
	  } catch (e: any) {
		if (!cancelled) setTextErr(e?.message || "Не удалось загрузить текст");
	  } finally {
		if (!cancelled) setTextLoading(false);
	  }
	}

	loadText();
	return () => {
	  cancelled = true;
	};
  }, [url, isTextLike]);

  if (isImage) {
	return (
	  <div className="flex justify-center">
		{/* eslint-disable-next-line @next/next/no-img-element */}
		<img src={url} alt="preview" className="max-h-[70vh] w-auto rounded-xl border" />
	  </div>
	);
  }

  if (isPdf) return <iframe src={url} className="w-full h-[70vh] rounded-xl border" title="PDF Preview" />;
  if (isVideo) return <video src={url} controls className="w-full max-h-[70vh] rounded-xl border" />;
  if (isAudio) return <audio src={url} controls className="w-full" />;

  if (isOffice) {
	const gview = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
	return <iframe src={gview} className="w-full h-[70vh] rounded-xl border" title="Office Preview" />;
  }

  if (isTextLike) {
	if (textLoading) return <div className="text-sm text-slate-500">Загружаю текст…</div>;
	if (textErr) return <div className="text-sm text-red-600">Ошибка: {textErr}</div>;
	return (
	  <pre className="w-full h-[70vh] overflow-auto rounded-xl border bg-slate-50 p-3 text-xs">
		{text || "Пусто"}
	  </pre>
	);
  }

  return <div className="text-sm text-slate-600">Этот тип файла покажем только скачиванием.</div>;
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
	<div className="fixed inset-0 z-50">
	  <div className="absolute inset-0 bg-black/50" onClick={onClose} />
	  <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-4 shadow-xl">
		<div className="flex items-center justify-between gap-3 pb-3">
		  <div className="font-semibold truncate">{title}</div>
		  <button className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50" onClick={onClose}>
			Закрыть
		  </button>
		</div>
		{children}
	  </div>
	</div>
  );
}

function FilesSection({
  title,
  files,
  onPreview,
  onDownload,
  onDelete,
  onRefresh,
  topContent,
}: {
  title: string;
  files: OrderFile[];
  onPreview: (f: OrderFile) => void;
  onDownload: (f: OrderFile) => void;
  onDelete: (f: OrderFile) => void;
  onRefresh: () => void;
  topContent?: React.ReactNode;
}) {
  return (
	<div className="space-y-2">
	  <div className="flex items-center justify-between gap-2">
		<div className="font-semibold">{title}</div>
		<button className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50" onClick={onRefresh}>
		  Обновить
		</button>
	  </div>

	  {topContent ? <div className="rounded-xl border bg-white p-3">{topContent}</div> : null}

	  {files.length === 0 ? (
		<div className="text-sm text-slate-500">Файлов нет</div>
	  ) : (
		files.map((f) => (
		  <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3">
			<div className="min-w-0">
			  <button
				className="text-left font-medium underline underline-offset-2 truncate"
				onClick={() => onPreview(f)}
				title="Открыть просмотр"
			  >
				{f.filename}
			  </button>
			  <div className="text-xs text-slate-500">
				{formatBytes(Number(f.size))} • {f.mime}
			  </div>
			</div>

			<div className="flex items-center gap-2">
			  <button className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50" onClick={() => onPreview(f)}>
				Просмотр
			  </button>

			  <button className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50" onClick={() => onDownload(f)}>
				Скачать
			  </button>

			  <button
				className="rounded-lg border px-3 py-1 text-sm hover:bg-red-50 hover:border-red-300"
				onClick={() => onDelete(f)}
				title="Удалит и файл из Storage, и запись из order_files"
			  >
				Удалить
			  </button>
			</div>
		  </div>
		))
	  )}
	</div>
  );
}

export default function OrderFiles({ orderId }: Props) {
  const [loading, setLoading] = useState(true);

  const [clientFiles, setClientFiles] = useState<OrderFile[]>([]);
  const [adminFiles, setAdminFiles] = useState<OrderFile[]>([]);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<OrderFile | null>(null);

  const activeUrl = useMemo(() => (active?.url ? String(active.url) : ""), [active]);

  const load = async () => {
	setLoading(true);
	try {
	  // Важно: берём ВСЕ файлы через admin endpoint (там уже signedUrl)
	  const res = await authedFetch(`/api/admin/orders/${orderId}/files?role=all`, { cache: "no-store" as any });
	  const json = await res.json().catch(() => ({}));
	  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

	  // Поддержим разные формы ответа, и всегда разложим по role сами.
	  let all: OrderFile[] = [];

	  if (Array.isArray(json)) {
		all = json;
	  } else if (Array.isArray(json?.files)) {
		all = json.files;
	  } else if (Array.isArray(json?.clientFiles) || Array.isArray(json?.adminFiles)) {
		all = [...(json.clientFiles || []), ...(json.adminFiles || [])];
	  }

	  all = uniqById(all);

	  const c = all.filter((f) => f.role === "client");
	  const a = all.filter((f) => f.role === "admin");

	  setClientFiles(c);
	  setAdminFiles(a);
	} catch (e: any) {
	  toast.error(e?.message || "Не удалось загрузить файлы");
	  setClientFiles([]);
	  setAdminFiles([]);
	} finally {
	  setLoading(false);
	}
  };

  useEffect(() => {
	if (!orderId) return;
	load();
	// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const ensureUrl = (f: OrderFile) => {
	if (f.url) return f.url;
	throw new Error("API не вернул url для просмотра/скачивания (signedUrl)");
  };

  const openPreview = (f: OrderFile) => {
	try {
	  ensureUrl(f);
	  setActive(f);
	  setOpen(true);
	} catch (e: any) {
	  toast.error(e?.message || "Не удалось открыть просмотр");
	}
  };

  const download = (f: OrderFile) => {
	try {
	  const url = ensureUrl(f);
	  downloadDirect(url, f.filename);
	} catch (e: any) {
	  toast.error(e?.message || "Не удалось скачать");
	}
  };

  const deleteFile = async (f: OrderFile) => {
	if (!confirm(`Удалить файл навсегда?\n\n${f.filename}`)) return;

	const t = toast.loading("Удаляю файл…");
	try {
	  const res = await authedFetch(`/api/admin/order-files/${f.id}`, { method: "DELETE" });
	  const json = await res.json().catch(() => ({}));
	  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

	  toast.dismiss(t);
	  toast.success("Файл удалён");

	  if (f.role === "client") setClientFiles((p) => p.filter((x) => x.id !== f.id));
	  else setAdminFiles((p) => p.filter((x) => x.id !== f.id));

	  if (active?.id === f.id) {
		setOpen(false);
		setActive(null);
	  }
	} catch (e: any) {
	  toast.dismiss(t);
	  toast.error(e?.message || "Не удалось удалить файл");
	}
  };

  if (loading) return <div className="text-sm text-slate-500">Загрузка…</div>;

  return (
	<div className="space-y-6">
	  <FilesSection
		title="📎 Файлы клиента"
		files={clientFiles}
		onPreview={openPreview}
		onDownload={download}
		onDelete={deleteFile}
		onRefresh={load}
	  />

	  <FilesSection
		title="✅ Файлы админа (результат)"
		files={adminFiles}
		onPreview={openPreview}
		onDownload={download}
		onDelete={deleteFile}
		onRefresh={load}
		topContent={
		  <div className="space-y-2">
			<AdminUpload orderId={orderId} />
			<div className="text-xs text-slate-500">
			  После загрузки нажми <b>Обновить</b> (справа), если список не обновился автоматически.
			</div>
		  </div>
		}
	  />

	  <Modal
		open={open}
		title={active ? active.filename : "Просмотр"}
		onClose={() => {
		  setOpen(false);
		  setActive(null);
		}}
	  >
		{active ? (
		  <div className="space-y-3">
			<FileViewer mime={active.mime} url={activeUrl} />
			<div className="flex items-center justify-between gap-2 pt-2">
			  <div className="text-xs text-slate-500">{active.mime}</div>
			  <button
				className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
				onClick={() => downloadDirect(activeUrl, active.filename)}
			  >
				Скачать
			  </button>
			</div>
		  </div>
		) : null}
	  </Modal>
	</div>
  );
}