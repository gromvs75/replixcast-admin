"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Lang = "ru" | "de";

type Order = {
  id: string;
  name: string | null;
  email: string | null;
  script: string | null;
  language: string | null;
  voice: string | null;
  avatar_id: string | null;
  status: string | null;
  created_at: string;
};

const TEXTS: Record<Lang, Record<string, string>> = {
  ru: {
    title: "Заявки",
    all: "Все",
    new: "Новые",
    processing: "В обработке",
    done: "Готово",
    empty: "Заявок пока нет",
    script: "Скрипт",
    language: "Язык",
    voice: "Голос",
    avatar: "Аватар",
    created: "Создано",
    open: "Открыть",
    status_new: "Новая",
    status_processing: "В обработке",
    status_done: "Готово",
    logout: "Выйти",
  },
  de: {
    title: "Bestellungen",
    all: "Alle",
    new: "Neu",
    processing: "In Bearbeitung",
    done: "Fertig",
    empty: "Noch keine Bestellungen",
    script: "Skript",
    language: "Sprache",
    voice: "Stimme",
    avatar: "Avatar",
    created: "Erstellt",
    open: "Öffnen",
    status_new: "Neu",
    status_processing: "In Bearbeitung",
    status_done: "Fertig",
    logout: "Abmelden",
  },
};

const STATUS_ORDER = ["new", "processing", "done"] as const;
type StatusFilter = "all" | (typeof STATUS_ORDER)[number];

export default function OrdersPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("ru");
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Проверка авторизации
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/admin/login");
      } else {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, [router]);

  // Загрузка заявок
  useEffect(() => {
    const loadOrders = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, name, email, script, language, voice, avatar_id, status, created_at"
        )
        .order("created_at", { ascending: false });

      if (!error && data) {
        setOrders(data as Order[]);
      } else {
        console.error("Error loading orders", error);
      }
      setLoading(false);
    };

    if (!checkingAuth) {
      loadOrders();
    }
  }, [checkingAuth]);

  const t = useMemo(() => TEXTS[lang], [lang]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((o) => (o.status || "new") === statusFilter);
  }, [orders, statusFilter]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(lang === "ru" ? "ru-RU" : "de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAvatarId = (id: string | null) => {
    if (!id) return "—";
    if (id.length <= 8) return `#${id}`;
    return `#${id.slice(0, 4)}…${id.slice(-4)}`;
  };

  const formatStatusLabel = (status: string | null) => {
    const s = (status || "new") as StatusFilter;
    if (s === "new") return t.status_new;
    if (s === "processing") return t.status_processing;
    if (s === "done") return t.status_done;
    return s;
  };

  const statusBadgeClass = (status: string | null) => {
    const s = status || "new";
    if (s === "new")
      return "bg-blue-100 text-blue-700 border border-blue-200";
    if (s === "processing")
      return "bg-amber-100 text-amber-700 border border-amber-200";
    if (s === "done")
      return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    return "bg-zinc-100 text-zinc-700 border border-zinc-200";
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <div className="text-sm">Проверка доступа…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* top bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-black text-center text-sm font-bold leading-8 text-white">
            R
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">
              ReplixCast Admin
            </div>
            <div className="text-xs text-slate-500">{t.title}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* language switch */}
          <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs">
            <button
              onClick={() => setLang("ru")}
              className={`rounded-full px-3 py-1 ${
                lang === "ru"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500"
              }`}
            >
              🇷🇺 RU
            </button>
            <button
              onClick={() => setLang("de")}
              className={`rounded-full px-3 py-1 ${
                lang === "de"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500"
              }`}
            >
              🇩🇪 DE
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            {t.logout}
          </button>
        </div>
      </header>

      {/* content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* filters */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{t.title}</h1>

          <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs">
            {(["all", "new", "processing", "done"] as StatusFilter[]).map(
              (key) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`rounded-full px-3 py-1 capitalize ${
                    statusFilter === key
                      ? "bg-white shadow-sm text-slate-900"
                      : "text-slate-500"
                  }`}
                >
                  {key === "all"
                    ? t.all
                    : key === "new"
                    ? t.status_new
                    : key === "processing"
                    ? t.status_processing
                    : t.status_done}
                </button>
              )
            )}
          </div>
        </div>

        {/* list */}
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Загрузка заявок…
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
            {t.empty}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => router.push(`/admin/orders/${order.id}`)}
                className="group flex flex-col items-stretch rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      {order.name || "Без имени"}
                    </div>
                    {order.email && (
                      <div className="text-xs text-slate-500">
                        {order.email}
                      </div>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                      order.status
                    )}`}
                  >
                    {formatStatusLabel(order.status)}
                  </span>
                </div>

                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    {t.language}: {order.language || "—"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    {t.voice}: {order.voice || "—"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    {t.avatar}: {formatAvatarId(order.avatar_id)}
                  </span>
                </div>

                {order.script && (
                  <div className="mb-3 line-clamp-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                    {order.script}
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between pt-2 text-xs text-slate-400">
                  <span>{t.created}: {formatDate(order.created_at)}</span>
                  <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900">
                    {t.open} →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
