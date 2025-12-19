"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function FileUpload({ orderId }: { orderId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async () => {
    if (!file) return;

    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${orderId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("orders-files-client")
      .upload(path, file);

    setUploading(false);

    if (error) {
      alert("Ошибка загрузки");
      return;
    }

    alert("Файл загружен!");
  };

  return (
    <div className="mt-4 p-4 border rounded">
      <h3 className="font-bold mb-2">Прикрепить файл</h3>

      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-2"
      />

      <button
        onClick={upload}
        disabled={uploading}
        className="px-4 py-2 bg-black text-white rounded"
      >
        {uploading ? "Загрузка..." : "Загрузить"}
      </button>
    </div>
  );
}