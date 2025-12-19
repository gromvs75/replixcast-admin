"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const allowedTypes = [
  "application/pdf",
  "video/mp4",
  "video/quicktime", // mov
  "image/jpeg",
  "image/png",
];

const MAX_SIZE = 200 * 1024 * 1024; // 200 MB на файл
const MAX_FILES = 5;

export default function OrderPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const totalSize = useMemo(() => files.reduce((acc, f) => acc + f.size, 0), [files]);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;

    const arr = Array.from(incoming);

    // фильтры
    const badType = arr.find((f) => !allowedTypes.includes(f.type));
    if (badType) {
      alert(`Недопустимый тип файла: ${badType.name}`);
      return;
    }

    const tooBig = arr.find((f) => f.size > MAX_SIZE);
    if (tooBig) {
      alert(`Файл больше 200 МБ: ${tooBig.name}`);
      return;
    }

    // добавляем, но не больше MAX_FILES
    setFiles((prev) => {
      const next = [...prev, ...arr];

      // уберём дубликаты по (name+size+lastModified) на всякий
      const uniq = new Map<string, File>();
      for (const f of next) {
        const key = `${f.name}:${f.size}:${f.lastModified}`;
        if (!uniq.has(key)) uniq.set(key, f);
      }

      const out = Array.from(uniq.values()).slice(0, MAX_FILES);
      if (out.length < Array.from(uniq.values()).length) {
        alert(`Можно загрузить максимум ${MAX_FILES} файлов`);
      }
      return out;
    });
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (loading) return;

    if (!name.trim()) return alert("Заполни имя");
    if (!email.trim()) return alert("Заполни email");

    // простая проверка email
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOk) return alert("Email выглядит неверно");

    if (files.length > MAX_FILES) return alert(`Максимум ${MAX_FILES} файлов`);
    if (files.some((f) => !allowedTypes.includes(f.type))) return alert("Есть файл недопустимого типа");
    if (files.some((f) => f.size > MAX_SIZE)) return alert("Есть файл больше 200 МБ");

    setLoading(true);

    try {
      // 1) создаём заявку
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          description: message,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Ошибка создания заявки");

      // поддержка обеих форм ответа
      const orderId: string = json?.order?.id || json?.orderId;
      if (!orderId) throw new Error("Нет orderId в ответе /api/orders/create");

      // 2) грузим файлы (если есть)
      if (files.length > 0) {
        const fd = new FormData();
        fd.append("orderId", orderId);
        fd.append("email", email.trim()); // доп. проверка на сервере (не обязательна, но полезна)

        for (const f of files) {
          fd.append("files", f); // важно: именно getAll("files") на сервере
        }

        const uploadRes = await fetch("/api/orders/upload-client", {
          method: "POST",
          body: fd,
        });

        // если аплоад упал — заявка всё равно создана
        if (!uploadRes.ok) {
          console.warn("Файлы не загрузились, но заявка создана");
        }
      }

      router.push("/order/thanks");
    } catch (e) {
      console.error(e);
      alert("Ошибка отправки заявки");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Оставить заявку</h1>

      <input
        placeholder="Имя"
        className="w-full border p-2 rounded"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={loading}
      />

      <input
        placeholder="Email"
        type="email"
        className="w-full border p-2 rounded"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
      />

      <textarea
        placeholder="Опиши задачу"
        className="w-full border p-2 rounded"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={loading}
      />

      <input
        type="file"
        multiple
        accept=".pdf,.mp4,.mov,.jpg,.jpeg,.png"
        disabled={loading}
        onChange={(e) => {
          addFiles(e.target.files);
          // чтобы можно было выбрать те же файлы повторно
          e.currentTarget.value = "";
        }}
      />

      {files.length > 0 && (
        <div className="text-sm border p-2 rounded bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <b>Файлы ({files.length}/{MAX_FILES})</b>
            <span className="text-xs text-slate-500">{(totalSize / 1024 / 1024).toFixed(1)} MB</span>
          </div>

          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate">{f.name}</div>
                  <div className="text-xs text-slate-500">{(f.size / 1024 / 1024).toFixed(1)} MB • {f.type}</div>
                </div>
                <button
                  className="border rounded px-2 py-1 text-xs hover:bg-white"
                  type="button"
                  onClick={() => removeFile(i)}
                  disabled={loading}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={submit}
        disabled={loading}
        className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
      >
        {loading ? "Отправка…" : "Отправить заявку"}
      </button>
    </div>
  );
}