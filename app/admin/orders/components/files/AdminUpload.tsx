"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  orderId: string;
};

export default function AdminUpload({ orderId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  const upload = async () => {
    if (!file) return;
    if (!orderId) return toast.error("Нет orderId");

    setLoading(true);
    setProgress(0);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setLoading(false);
      return toast.error("Нет сессии. Перезайди в админку.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("orderId", orderId);

    const t = toast.loading("Загружаю…");

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setProgress(percent);
        }
      };

      xhr.onload = () => {
        setLoading(false);
        toast.dismiss(t);

        if (xhr.status >= 200 && xhr.status < 300) {
          setFile(null);
          setProgress(100);
          toast.success("Файл загружен");
        } else {
          let msg = "Ошибка загрузки файла";
          try {
            const j = JSON.parse(xhr.responseText || "{}");
            msg = j?.error || msg;
          } catch {}
          toast.error(msg);
        }
      };

      xhr.onerror = () => {
        setLoading(false);
        toast.dismiss(t);
        toast.error("Ошибка сети");
      };

      xhr.open("POST", "/api/admin/upload");
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.send(formData);
    } catch (e: any) {
      console.error(e);
      setLoading(false);
      toast.dismiss(t);
      toast.error(e?.message || "Ошибка загрузки");
    }
  };

  return (
    <div className="space-y-3">
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />

      {loading && (
        <div className="w-full bg-slate-200 rounded h-2 overflow-hidden">
          <div className="h-full bg-green-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      <button
        onClick={upload}
        disabled={!file || loading}
        className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
      >
        {loading ? "Загрузка..." : "Загрузить результат"}
      </button>
    </div>
  );
}