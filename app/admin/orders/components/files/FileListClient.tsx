"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { authedFetch } from "@/lib/authedFetch";

type Props = { orderId: string };

type OrderFile = {
  id: string;
  order_id: string;
  bucket: string;
  path: string;
  filename: string;
  mime: string;
  size: number;
  role: string;
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

  const [text, setText] = useState<string>("");
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

export default function FileListClient({ orderId }: Props) {
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<OrderFile | null>(null);
  const [activeUrl, setActiveUrl] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await authedFetch(`/api/orders/${orderId}/files`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      const arr: OrderFile[] = Array.isArray(json) ? json : json.files || [];
      setFiles(arr);
    } catch (e: any) {
      toast.error(e?.message || "Не удалось загрузить файлы клиента");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const getUrl = (f: OrderFile) => {
    if (f.url) return f.url;
    throw new Error("API /files не вернул url для просмотра/скачивания");
  };

  const openPreview = (f: OrderFile) => {
    try {
      const url = getUrl(f);
      setActive(f);
      setActiveUrl(url);
      setOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Не удалось открыть просмотр");
    }
  };

  const deleteFile = async (f: OrderFile) => {
    if (!confirm(`Удалить файл навсегда?\n\n${f.filename}`)) return;
  
    const t = toast.loading("Удаляю файл…");
    try {
      const res = await authedFetch(`/api/admin/order-files/${f.id}`, {
        method: "DELETE",
      });
  
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  
      toast.dismiss(t);
      toast.success("Файл удалён");
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
  
      if (active?.id === f.id) {
        setOpen(false);
        setActive(null);
        setActiveUrl("");
      }
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || "Не удалось удалить файл");
    }
  };

  if (loading) return <div className="text-sm text-slate-500">Загрузка…</div>;
  if (files.length === 0) return <div className="text-sm text-slate-500">Файлов нет</div>;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50" onClick={load}>
          Обновить
        </button>
      </div>

      {files.map((f) => (
        <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3">
          <div className="min-w-0">
            <button
              className="text-left font-medium underline underline-offset-2 truncate"
              onClick={() => openPreview(f)}
              title="Открыть просмотр"
            >
              {f.filename}
            </button>
            <div className="text-xs text-slate-500">
              {formatBytes(Number(f.size))} • {f.mime}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50" onClick={() => openPreview(f)}>
              Просмотр
            </button>

            <button
              className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
              onClick={() => downloadDirect(getUrl(f), f.filename)}
            >
              Скачать
            </button>

            <button
              className="rounded-lg border px-3 py-1 text-sm hover:bg-red-50 hover:border-red-300"
              onClick={() => deleteFile(f)}
              title="Удалит и файл из Storage, и запись из order_files"
            >
              Удалить
            </button>
          </div>
        </div>
      ))}

      <Modal
        open={open}
        title={active ? active.filename : "Просмотр"}
        onClose={() => {
          setOpen(false);
          setActive(null);
          setActiveUrl("");
        }}
      >
        {active ? (
          <div className="space-y-3">
            <FileViewer mime={active.mime} url={activeUrl} />
            <div className="flex items-center justify-between gap-2 pt-2">
              <div className="text-xs text-slate-500">{active.mime}</div>
              <button className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50" onClick={() => downloadDirect(activeUrl, active.filename)}>
                Скачать
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}