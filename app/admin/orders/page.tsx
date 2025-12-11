"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    const { data, error } = await supabase.from("orders").select("*");

    if (!error && data) setOrders(data);
    setLoading(false);
  }

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Заявки</h1>

      <ul className="space-y-4">
        {orders.map((o) => (
          <li key={o.id} className="p-4 bg-white shadow rounded">
            <p><strong>Имя:</strong> {o.name}</p>
            <p><strong>Email:</strong> {o.email}</p>
            <p><strong>Статус:</strong> {o.status}</p>
            <p><strong>Avatar ID:</strong> {o.avatar_id}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
