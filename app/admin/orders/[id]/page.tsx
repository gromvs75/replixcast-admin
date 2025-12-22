"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import OrderFiles from "@/app/admin/orders/components/files/OrderFiles";

export default function OrderDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = String((params as any)?.id || "");

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).single();
    if (!error && data) setOrder(data);
  };

  useEffect(() => {
    if (!orderId) return;

    const loadAndMarkRead = async () => {
      setLoading(true);

      const { data } = await supabase.from("orders").select("*").eq("id", orderId).single();

      if (data) {
        setOrder(data);

        if (!data.is_read) {
          await supabase.from("orders").update({ is_read: true }).eq("id", orderId).select();
        }
      }

      setLoading(false);
    };

    loadAndMarkRead();
  }, [orderId]);

  const updateStatus = async (newStatus: string) => {
    await supabase.from("orders").update({ status: newStatus }).eq("id", orderId).select();
    setOrder((prev: any) => (prev ? { ...prev, status: newStatus } : prev));
  };

  const moveToTrash = async () => {
    await supabase
      .from("orders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", orderId)
      .select();
    await reload();
  };

  const restoreFromTrash = async () => {
    await supabase.from("orders").update({ deleted_at: null }).eq("id", orderId).select();
    await reload();
  };

  const deleteForever = async () => {
    const ok = prompt("Удалить НАВСЕГДА? Введи DELETE:") === "DELETE";
    if (!ok) return;

    await supabase.from("orders").delete().eq("id", orderId).select();
    router.push("/admin/orders");
  };

  if (!orderId) return <div className="p-6">Нет ID заявки</div>;
  if (loading) return <div className="p-6">Загрузка...</div>;
  if (!order) return <div className="p-6">Заявка не найдена</div>;

  const inTrash = !!order.deleted_at;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <button onClick={() => router.push("/admin/orders")} className="text-sm text-blue-600">
        ← Назад к списку
      </button>

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Заявка</h1>
          <p className="text-sm text-slate-500">ID: {orderId}</p>
        </div>

        <div className="text-right flex items-center gap-2">
          {inTrash ? (
            <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-red-700">В корзине</span>
          ) : (
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-slate-700">{order.status}</span>
          )}
        </div>
      </div>

      <div className="bg-white p-5 shadow rounded-xl space-y-2">
        <p>
          <b>Имя:</b> {order.name}
        </p>
        <p>
          <b>Email:</b> {order.email}
        </p>
        <p className="whitespace-pre-wrap">
          <b>Запрос:</b> {order.script}
        </p>
      </div>

      {/* ✅ Один компонент, который сам показывает клиентские и админские файлы + upload */}
      <OrderFiles orderId={orderId} />

      {/* ✅ Действия */}
      {!inTrash ? (
        <div className="flex flex-wrap gap-3">
          <button onClick={() => updateStatus("in_progress")} className="px-4 py-2 bg-yellow-500 text-white rounded">
            В обработке
          </button>

          <button onClick={() => updateStatus("done")} className="px-4 py-2 bg-green-600 text-white rounded">
            Готово
          </button>

          <button onClick={() => updateStatus("archived")} className="px-4 py-2 bg-slate-700 text-white rounded">
            Архив
          </button>

          <button onClick={moveToTrash} className="px-4 py-2 bg-slate-900 text-white rounded">
            В корзину
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button onClick={restoreFromTrash} className="px-4 py-2 bg-slate-900 text-white rounded">
            Восстановить
          </button>

          <button onClick={deleteForever} className="px-4 py-2 bg-red-600 text-white rounded">
            Удалить навсегда
          </button>
        </div>
      )}
    </div>
  );
}