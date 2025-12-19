// app/admin/orders/page.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { authedFetch } from "@/lib/authedFetch";
import toast from "react-hot-toast";

type OrderStatus = "new" | "in_progress" | "done" | "archived" | string;

type Order = {
  id: string;
  name: string;
  email: string;
  status: OrderStatus;
  created_at: string;
  is_read: boolean;
  deleted_at: string | null;
  script?: string | null;
};

type TabKey = "all" | "unread" | "in_progress" | "done" | "archived" | "trash";

type OrderFile = {
  id: string;
  order_id: string;
  bucket: string;
  path: string;
  filename: string;
  mime: string;
  size: number;
  role: string; // "client" | "admin"
  created_at: string;
  url?: string;
};

function formatDate(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

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

function toInFilter(ids: string[]) {
  const escaped = ids.map((id) => `"${id}"`).join(",");
  return `(${escaped})`;
}

function askTypeDELETE(title: string) {
  const typed = prompt(`${title}\n\nВведи DELETE чтобы подтвердить:`);
  return typed === "DELETE";
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

  if (isPdf) {
    return <iframe src={url} className="w-full h-[70vh] rounded-xl border" title="PDF Preview" />;
  }

  if (isVideo) {
    return <video src={url} controls className="w-full max-h-[70vh] rounded-xl border" />;
  }

  if (isAudio) {
    return <audio src={url} controls className="w-full" />;
  }

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

  return (
    <div className="text-sm text-slate-600">
      Этот тип файла браузер не умеет показывать внутри окна. Нажми <b>Скачать</b>.
    </div>
  );
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
  children: ReactNode;
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

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm border transition ${
        active ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

export default function AdminOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<TabKey>("all");

  // pagination
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState<number>(1);
  const [totalInTab, setTotalInTab] = useState<number>(0);

  // Selection (Gmail-mode)
  const [selectAllInTabMode, setSelectAllInTabMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  // Preview panel
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [clientFiles, setClientFiles] = useState<OrderFile[]>([]);
  const [adminFiles, setAdminFiles] = useState<OrderFile[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFile, setViewerFile] = useState<OrderFile | null>(null);
  const [viewerUrl, setViewerUrl] = useState("");

  const resetSelection = () => {
    setSelectAllInTabMode(false);
    setSelectedIds(new Set());
    setExcludedIds(new Set());
  };

  // ---- query helpers ----
  const applyTabFilter = (q: any, t: TabKey) => {
    if (t === "trash") q = q.not("deleted_at", "is", null);
    else q = q.is("deleted_at", null);

    if (t === "unread") q = q.eq("is_read", false);
    if (t === "in_progress") q = q.eq("status", "in_progress");
    if (t === "done") q = q.eq("status", "done");
    if (t === "archived") q = q.eq("status", "archived");

    return q;
  };

  // ---- load current page + total count for current tab ----
  const loadPage = async (t = tab, p = page, ps = pageSize) => {
    setLoading(true);

    // 1) total count
    {
      let countQ = supabase.from("orders").select("id", { count: "exact", head: true });
      countQ = applyTabFilter(countQ, t);
      const { count, error } = await countQ;
      if (error) toast.error(error.message || "Ошибка count");
      setTotalInTab(count ?? 0);
    }

    // 2) page data
    const from = (p - 1) * ps;
    const to = from + ps - 1;

    let dataQ = supabase
      .from("orders")
      .select("id,name,email,status,created_at,is_read,deleted_at,script")
      .order("created_at", { ascending: false })
      .range(from, to);

    dataQ = applyTabFilter(dataQ, t);

    const { data, error } = await dataQ;
    if (error) {
      toast.error(error.message || "Не удалось загрузить заявки");
      setOrders([]);
    } else {
      setOrders((data as Order[]) ?? []);
    }

    setLoading(false);
  };

  // load when tab/page/pageSize changes
  useEffect(() => {
    loadPage(tab, page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, pageSize]);

  // reset page/selection when tab changes
  useEffect(() => {
    setPage(1);
    resetSelection();
    setPreviewOrder(null);
    setClientFiles([]);
    setAdminFiles([]);
  }, [tab]);

  // ---- realtime (best-effort) ----
  const reloadTimer = useRef<any>(null);
  const scheduleReload = () => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => {
      loadPage(tab, page, pageSize);
    }, 250);
  };

  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const order = payload.new as Order;

        // toast for new
        if (!order.is_read && !order.deleted_at) {
          toast.success(`🆕 Новая заявка от ${order.name}`, { duration: 4000 });
        }

        // If current tab matches and page=1, add to top (best effort)
        const fitsTab =
          (tab !== "trash" ? !order.deleted_at : !!order.deleted_at) &&
          (tab !== "unread" ? true : !order.is_read) &&
          (tab !== "in_progress" ? true : order.status === "in_progress") &&
          (tab !== "done" ? true : order.status === "done") &&
          (tab !== "archived" ? true : order.status === "archived");

        if (fitsTab) {
          setTotalInTab((prev) => prev + 1);
          if (page === 1) {
            setOrders((prev) => {
              if (prev.some((o) => o.id === order.id)) return prev;
              const next = [order, ...prev];
              return next.slice(0, pageSize);
            });
          }
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const updated = payload.new as Order;
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
        if (previewOrder?.id === updated.id) setPreviewOrder((p) => (p ? { ...p, ...updated } : p));
        scheduleReload();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, (payload) => {
        const deleted = payload.old as { id: string };
        setOrders((prev) => prev.filter((o) => o.id !== deleted.id));
        setTotalInTab((prev) => Math.max(0, prev - 1));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(deleted.id);
          return next;
        });
        setExcludedIds((prev) => {
          const next = new Set(prev);
          next.delete(deleted.id);
          return next;
        });
        if (previewOrder?.id === deleted.id) {
          setPreviewOrder(null);
          setClientFiles([]);
          setAdminFiles([]);
        }
        scheduleReload();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, pageSize, previewOrder?.id]);

  // ---- selection helpers ----
  const visibleIds = useMemo(() => orders.map((o) => o.id), [orders]);

  const isChecked = (id: string) => {
    if (selectAllInTabMode) return !excludedIds.has(id);
    return selectedIds.has(id);
  };

  const selectedCount = useMemo(() => {
    if (!selectAllInTabMode) return selectedIds.size;
    return Math.max(0, totalInTab - excludedIds.size);
  }, [selectAllInTabMode, selectedIds, excludedIds, totalInTab]);

  const allVisibleSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    return visibleIds.every((id) => isChecked(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds, selectAllInTabMode, selectedIds, excludedIds]);

  const someVisibleSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    return visibleIds.some((id) => isChecked(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds, selectAllInTabMode, selectedIds, excludedIds]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [someVisibleSelected, allVisibleSelected]);

  const toggleSelectAllVisible = () => {
    if (visibleIds.length === 0) return;

    if (selectAllInTabMode) {
      setExcludedIds((prev) => {
        const next = new Set(prev);
        if (allVisibleSelected) visibleIds.forEach((id) => next.add(id));
        else visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
        else visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    if (selectAllInTabMode) {
      setExcludedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllInTab = () => {
    if (totalInTab === 0) return toast("Нечего выбирать");
    setSelectAllInTabMode(true);
    setSelectedIds(new Set());
    setExcludedIds(new Set());
    toast.success(`Выбраны все во вкладке: ${totalInTab}`);
  };

  // ---- selection snapshot (for Undo) ----
  type SelectionSnapshot =
    | { mode: "ids"; ids: string[] }
    | { mode: "all_in_tab"; tab: TabKey; excluded: string[] };

  const snapshotSelection = (): SelectionSnapshot | null => {
    if (selectAllInTabMode) {
      return { mode: "all_in_tab", tab, excluded: Array.from(excludedIds) };
    }
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return null;
    return { mode: "ids", ids };
  };

  const applySnapshotToQuery = (q: any, snap: SelectionSnapshot) => {
    if (snap.mode === "ids") return q.in("id", snap.ids);

    // all_in_tab
    q = applyTabFilter(q, snap.tab);
    if (snap.excluded.length > 0) q = q.not("id", "in", toInFilter(snap.excluded));
    return q;
  };

  // ---- Undo toast ----
  const showUndoToast = (label: string, onUndo: () => Promise<void>) => {
    toast.custom(
      (t) => (
        <div
          className={`max-w-sm w-[92vw] rounded-xl border bg-white p-3 shadow-lg ${
            t.visible ? "animate-enter" : "animate-leave"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-slate-800">
              <b>{label}</b>
              <div className="text-xs text-slate-500 mt-1">Можно отменить действие.</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
                onClick={async () => {
                  try {
                    await onUndo();
                    toast.dismiss(t.id);
                    toast.success("Отменено");
                    resetSelection();
                    await loadPage(tab, page, pageSize);
                  } catch (e: any) {
                    toast.dismiss(t.id);
                    toast.error(e?.message || "Не удалось отменить");
                  }
                }}
              >
                Undo
              </button>

              <button
                className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
                onClick={() => toast.dismiss(t.id)}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      ),
      { duration: 8000 }
    );
  };

  // ---- bulk actions ----
  const bulkUpdate = async (
    patch: Partial<Order>,
    successText: string,
    opts?: { withUndo?: boolean; undoPatch?: Partial<Order>; undoLabel?: string }
  ) => {
    const snap = snapshotSelection();
    if (!snap) return;

    setBulkLoading(true);
    const t = toast.loading("Обновляю…");

    let q = supabase.from("orders").update(patch);
    q = applySnapshotToQuery(q, snap);

    const { error } = await q;

    toast.dismiss(t);

    if (error) {
      toast.error(error.message || "Ошибка обновления");
      setBulkLoading(false);
      return;
    }

    toast.success(successText);

    // Undo
    if (opts?.withUndo && opts.undoPatch) {
      const undoSnap = snap; // same filter as action
      showUndoToast(opts.undoLabel || "Действие выполнено", async () => {
        let uq = supabase.from("orders").update(opts.undoPatch!);
        uq = applySnapshotToQuery(uq, undoSnap);
        const { error: ue } = await uq;
        if (ue) throw new Error(ue.message || "Undo failed");
      });
    }

    resetSelection();
    await loadPage(tab, page, pageSize);
    setBulkLoading(false);
  };

  const bulkSoftDelete = async () => {
    if (selectedCount === 0) return;
    if (!confirm(`Переместить в корзину: ${selectedCount} шт.?`)) return;

    await bulkUpdate(
      { deleted_at: new Date().toISOString() },
      "Перемещено в корзину",
      {
        withUndo: true,
        undoPatch: { deleted_at: null },
        undoLabel: `Перемещено в корзину (${selectedCount})`,
      }
    );
  };

  const bulkRestore = async () => {
    if (selectedCount === 0) return;
    await bulkUpdate({ deleted_at: null }, "Восстановлено из корзины");
  };

  const bulkDeleteForever = async () => {
    const snap = snapshotSelection();
    if (!snap) return;

    // ✅ hard confirm
    if (!askTypeDELETE(`Удалить НАВСЕГДА: ${selectedCount} шт.?\nЭто нельзя отменить.`)) return;

    setBulkLoading(true);
    const t = toast.loading("Удаляю…");

    let q = supabase.from("orders").delete();
    q = applySnapshotToQuery(q, snap);

    const { error } = await q;

    toast.dismiss(t);

    if (error) {
      toast.error(error.message || "Ошибка удаления");
      setBulkLoading(false);
      return;
    }

    toast.success("Удалено навсегда");
    resetSelection();
    await loadPage(tab, page, pageSize);
    setBulkLoading(false);
  };

  // ---- Trash polish: clear trash (with exact counts) ----
  const getTrashCount = async (olderThanIso?: string) => {
    let q = supabase.from("orders").select("id", { count: "exact", head: true }).not("deleted_at", "is", null);
    if (olderThanIso) q = q.lt("deleted_at", olderThanIso);
    const { count, error } = await q;
    if (error) throw new Error(error.message || "Не удалось посчитать корзину");
    return count ?? 0;
  };

  const clearTrashAll = async () => {
    if (tab !== "trash") return; // safety

    const t = toast.loading("Считаю…");
    try {
      const cnt = await getTrashCount();
      toast.dismiss(t);

      if (cnt === 0) return toast("Корзина уже пустая");

      if (!askTypeDELETE(`Очистить корзину полностью?\n\nБудет удалено НАВСЕГДА: ${cnt} шт.`)) return;

      const t2 = toast.loading(`Очищаю корзину (${cnt})…`);
      const { error } = await supabase.from("orders").delete().not("deleted_at", "is", null);
      toast.dismiss(t2);

      if (error) throw new Error(error.message || "Не удалось очистить корзину");

      toast.success(`Корзина очищена: удалено ${cnt}`);
      resetSelection();
      setPage(1);
      await loadPage("trash", 1, pageSize);
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || "Ошибка");
    }
  };

  const clearTrashOlder30 = async () => {
    if (tab !== "trash") return; // safety

    const cutoffIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const t = toast.loading("Считаю старые…");
    try {
      const cnt = await getTrashCount(cutoffIso);
      toast.dismiss(t);

      if (cnt === 0) return toast("Нет файлов в корзине старше 30 дней");

      if (
        !askTypeDELETE(
          `Очистить корзину старше 30 дней?\n\nБудет удалено НАВСЕГДА: ${cnt} шт.\n(где deleted_at < ${new Date(
            cutoffIso
          ).toLocaleDateString()})`
        )
      )
        return;

      const t2 = toast.loading(`Удаляю старые (${cnt})…`);
      const { error } = await supabase
        .from("orders")
        .delete()
        .not("deleted_at", "is", null)
        .lt("deleted_at", cutoffIso);

      toast.dismiss(t2);

      if (error) throw new Error(error.message || "Не удалось удалить старые");

      toast.success(`Удалено старых: ${cnt}`);
      resetSelection();
      setPage(1);
      await loadPage("trash", 1, pageSize);
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || "Ошибка");
    }
  };

  // ---- Preview panel loaders/actions ----
  const loadPreview = async (order: Order) => {
    setPreviewOrder(order);
    setPreviewLoading(true);
    try {
      // mark read on preview click (default)
      if (!order.is_read) {
        await supabase.from("orders").update({ is_read: true }).eq("id", order.id);
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, is_read: true } : o)));
      }

      const [cRes, aRes] = await Promise.all([
        authedFetch(`/api/orders/${order.id}/files`, { cache: "no-store" }),
        authedFetch(`/api/admin/orders/${order.id}/files`, { cache: "no-store" }),
      ]);

      const cJson = await cRes.json();
      const aJson = await aRes.json();

      const cArr: OrderFile[] = Array.isArray(cJson) ? cJson : cJson.files || [];
      const aArr: OrderFile[] = Array.isArray(aJson) ? aJson : aJson.files || [];

      setClientFiles(cArr);
      setAdminFiles(aArr);
    } catch (e: any) {
      toast.error(e?.message || "Не удалось загрузить превью");
      setClientFiles([]);
      setAdminFiles([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const updateOneStatus = async (orderId: string, status: OrderStatus) => {
    const t = toast.loading("Обновляю статус…");
    try {
      const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
      if (error) throw new Error(error.message || "Не удалось обновить статус");
      toast.dismiss(t);
      toast.success("Статус обновлён");
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
      setPreviewOrder((p) => (p?.id === orderId ? { ...p, status } : p));
      scheduleReload();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || "Ошибка");
    }
  };

  const moveOneToTrash = async (orderId: string) => {
    if (!confirm("Переместить заявку в корзину?")) return;

    const t = toast.loading("Перемещаю…");
    try {
      const { error } = await supabase
        .from("orders")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) throw new Error(error.message || "Не удалось переместить");

      toast.dismiss(t);
      toast.success("В корзине");

      // Undo for single
      showUndoToast("Перемещено в корзину (1)", async () => {
        const { error: ue } = await supabase.from("orders").update({ deleted_at: null }).eq("id", orderId);
        if (ue) throw new Error(ue.message || "Undo failed");
      });

      scheduleReload();
      // If current tab isn't trash, remove from list immediately
      if (tab !== "trash") setOrders((prev) => prev.filter((o) => o.id !== orderId));
      if (previewOrder?.id === orderId) setPreviewOrder(null);
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || "Ошибка");
    }
  };

  const openFile = async (f: OrderFile) => {
    const url = f.url;
    if (!url) return toast.error("Нет url у файла (проверь API /files)");
    setViewerFile(f);
    setViewerUrl(url);
    setViewerOpen(true);
  };

  const totalPages = Math.max(1, Math.ceil(totalInTab / pageSize));

  if (loading) return <div className="p-6">Загрузка заявок…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Заявки</h1>

        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === "all"} onClick={() => setTab("all")} label="Все" />
          <TabButton active={tab === "unread"} onClick={() => setTab("unread")} label="Новые" />
          <TabButton active={tab === "in_progress"} onClick={() => setTab("in_progress")} label="В работе" />
          <TabButton active={tab === "done"} onClick={() => setTab("done")} label="Готово" />
          <TabButton active={tab === "archived"} onClick={() => setTab("archived")} label="Архив" />
          <TabButton active={tab === "trash"} onClick={() => setTab("trash")} label="Корзина" />
        </div>
      </div>

      {/* pagination controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3">
        <div className="text-sm text-slate-600">
          Всего во вкладке: <b>{totalInTab}</b> • Страница <b>{page}</b> из <b>{totalPages}</b>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
              resetSelection();
            }}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <button
            className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
              resetSelection();
            }}
          >
            ← Назад
          </button>

          <button
            className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => {
              setPage((p) => Math.min(totalPages, p + 1));
              resetSelection();
            }}
          >
            Вперёд →
          </button>
        </div>
      </div>

      {/* trash tools */}
      {tab === "trash" && (
        <div className="rounded-xl border bg-white p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Корзина: <b>{totalInTab}</b>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
              onClick={clearTrashOlder30}
              disabled={bulkLoading || totalInTab === 0}
              title="Удалит навсегда всё, что в корзине старше 30 дней"
            >
              Очистить старше 30 дней
            </button>

            <button
              className="rounded-lg bg-red-600 text-white px-3 py-1 text-sm hover:bg-red-700 disabled:opacity-50"
              onClick={clearTrashAll}
              disabled={bulkLoading || totalInTab === 0}
              title="Удалит навсегда ВСЁ из корзины"
            >
              Очистить корзину
            </button>
          </div>
        </div>
      )}

      {/* bulk bar */}
      <div className="rounded-xl border bg-white p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm select-none">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAllVisible}
            />
            Выбрать всё (на экране)
          </label>

          <button
            className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
            onClick={selectAllInTab}
            disabled={bulkLoading || totalInTab === 0}
            title="Gmail-режим: выбраны все в этой вкладке, кроме тех, что ты снимешь галочкой"
          >
            Выбрать всё во вкладке ({totalInTab})
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {selectedCount === 0 ? (
            <div className="text-sm text-slate-500">
              Выдели заявки чекбоксами (или “Выбрать всё во вкладке”) для массовых действий
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-700">
                Выбрано: <b>{selectedCount}</b>
                {selectAllInTabMode ? (
                  <span className="ml-2 text-xs text-slate-500">(исключено: {excludedIds.size})</span>
                ) : null}
              </span>

              <button
                className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                onClick={() => bulkUpdate({ is_read: true }, "Отмечено как прочитано")}
                disabled={bulkLoading}
              >
                Прочитано
              </button>

              {tab !== "trash" ? (
                <>
                  <button
                    className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => bulkUpdate({ status: "in_progress" }, "Статус: В работе")}
                    disabled={bulkLoading}
                  >
                    В работу
                  </button>

                  <button
                    className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => bulkUpdate({ status: "done" }, "Статус: Готово")}
                    disabled={bulkLoading}
                  >
                    Готово
                  </button>

                  <button
                    className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => bulkUpdate({ status: "archived" }, "Статус: Архив")}
                    disabled={bulkLoading}
                  >
                    Архив
                  </button>

                  <button
                    className="rounded-lg bg-slate-900 text-white px-3 py-1 text-sm hover:bg-black disabled:opacity-50"
                    onClick={bulkSoftDelete}
                    disabled={bulkLoading}
                  >
                    В корзину
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                    onClick={bulkRestore}
                    disabled={bulkLoading}
                  >
                    Восстановить
                  </button>

                  <button
                    className="rounded-lg bg-red-600 text-white px-3 py-1 text-sm hover:bg-red-700 disabled:opacity-50"
                    onClick={bulkDeleteForever}
                    disabled={bulkLoading}
                    title="Нужен ввод DELETE"
                  >
                    Удалить навсегда
                  </button>
                </>
              )}

              <button
                className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                onClick={resetSelection}
                disabled={bulkLoading}
              >
                Снять выделение
              </button>
            </div>
          )}
        </div>
      </div>

      {/* layout: list + preview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        {/* list */}
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="text-slate-500">Ничего нет</div>
          ) : (
            orders.map((order) => {
              const unread = !order.is_read && !order.deleted_at;

              return (
                <div
                  key={order.id}
                  className={`flex items-center justify-between gap-4 rounded-xl border p-4 shadow-sm transition ${
                    unread ? "bg-blue-50 border-blue-400" : "bg-white"
                  } hover:shadow-md`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked(order.id)}
                      onChange={() => toggleOne(order.id)}
                      className="mt-1"
                    />

                    <div className="min-w-0">
                      <button
                        className="text-left font-medium truncate hover:underline"
                        onClick={() => loadPreview(order)}
                        title="Открыть Preview"
                      >
                        {order.name}
                      </button>

                      <div className="text-sm text-slate-500 truncate">{order.email}</div>
                      <div className="text-xs text-slate-400">{formatDate(order.created_at)}</div>

                      {!order.is_read && !order.deleted_at ? (
                        <div className="mt-1 inline-flex rounded bg-blue-600 px-2 py-0.5 text-xs text-white">
                          NEW
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!order.deleted_at && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{order.status}</span>
                    )}

                    <button
                      onClick={() => loadPreview(order)}
                      className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
                    >
                      Preview
                    </button>

                    <button
                      onClick={() => router.push(`/admin/orders/${order.id}`)}
                      className="text-blue-600 underline text-sm"
                    >
                      Открыть
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* preview */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm h-fit sticky top-4">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold">Preview</div>
            {previewOrder ? (
              <button
                className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
                onClick={() => {
                  setPreviewOrder(null);
                  setClientFiles([]);
                  setAdminFiles([]);
                }}
              >
                Закрыть
              </button>
            ) : null}
          </div>

          {!previewOrder ? (
            <div className="text-sm text-slate-500 mt-3">Нажми Preview у заявки — тут появится мини-просмотр.</div>
          ) : (
            <div className="mt-3 space-y-4">
              <div className="text-sm">
                <div className="font-medium truncate">{previewOrder.name}</div>
                <div className="text-xs text-slate-400">{formatDate(previewOrder.created_at)}</div>
              </div>

              <div className="rounded-xl border p-3 text-sm space-y-2">
                <div>
                  <b>Email:</b> {previewOrder.email}
                </div>
                <div>
                  <b>Статус:</b>{" "}
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    {previewOrder.status}
                  </span>
                </div>
                {previewOrder.script ? (
                  <div className="whitespace-pre-wrap">
                    <b>Запрос:</b> {previewOrder.script}
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-sm font-medium mb-2">Действия</div>
                <div className="flex flex-wrap gap-2">
                  {tab !== "trash" ? (
                    <>
                      <button
                        className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
                        onClick={() => updateOneStatus(previewOrder.id, "in_progress")}
                      >
                        В работу
                      </button>
                      <button
                        className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
                        onClick={() => updateOneStatus(previewOrder.id, "done")}
                      >
                        Готово
                      </button>
                      <button
                        className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
                        onClick={() => updateOneStatus(previewOrder.id, "archived")}
                      >
                        Архив
                      </button>
                      <button
                        className="rounded-lg bg-slate-900 text-white px-3 py-1 text-sm hover:bg-black"
                        onClick={() => moveOneToTrash(previewOrder.id)}
                      >
                        В корзину
                      </button>
                      <button
                        className="ml-auto text-sm text-blue-600 underline"
                        onClick={() => router.push(`/admin/orders/${previewOrder.id}`)}
                      >
                        Открыть полностью →
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
                        onClick={async () => {
                          const t = toast.loading("Восстанавливаю…");
                          const { error } = await supabase
                            .from("orders")
                            .update({ deleted_at: null })
                            .eq("id", previewOrder.id);
                          toast.dismiss(t);
                          if (error) return toast.error(error.message || "Ошибка");
                          toast.success("Восстановлено");
                          scheduleReload();
                        }}
                      >
                        Восстановить
                      </button>
                      <button
                        className="rounded-lg bg-red-600 text-white px-3 py-1 text-sm hover:bg-red-700"
                        onClick={async () => {
                          if (!askTypeDELETE("Удалить эту заявку НАВСЕГДА?")) return;
                          const t = toast.loading("Удаляю…");
                          const { error } = await supabase.from("orders").delete().eq("id", previewOrder.id);
                          toast.dismiss(t);
                          if (error) return toast.error(error.message || "Ошибка");
                          toast.success("Удалено навсегда");
                          setPreviewOrder(null);
                          scheduleReload();
                        }}
                      >
                        Удалить навсегда
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-sm font-medium mb-2">Файлы клиента</div>
                {previewLoading ? (
                  <div className="text-sm text-slate-500">Загрузка…</div>
                ) : clientFiles.length === 0 ? (
                  <div className="text-sm text-slate-500">Нет файлов</div>
                ) : (
                  <div className="space-y-2">
                    {clientFiles.map((f) => (
                      <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                        <div className="min-w-0">
                          <div className="text-sm truncate">{f.filename}</div>
                          <div className="text-xs text-slate-500">
                            {formatBytes(Number(f.size))} • {f.mime}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-lg border px-2 py-1 text-sm hover:bg-slate-50"
                            onClick={() => openFile(f)}
                          >
                            Просмотр
                          </button>
                          <button
                            className="rounded-lg border px-2 py-1 text-sm hover:bg-slate-50"
                            onClick={() => {
                              if (!f.url) return toast.error("Нет url у файла");
                              downloadDirect(f.url, f.filename);
                            }}
                            title="Скачает напрямую без новой вкладки"
                          >
                            ⬇
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-sm font-medium mb-2">Файлы админа</div>
                {previewLoading ? (
                  <div className="text-sm text-slate-500">Загрузка…</div>
                ) : adminFiles.length === 0 ? (
                  <div className="text-sm text-slate-500">Нет файлов</div>
                ) : (
                  <div className="space-y-2">
                    {adminFiles.map((f) => (
                      <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                        <div className="min-w-0">
                          <div className="text-sm truncate">{f.filename}</div>
                          <div className="text-xs text-slate-500">
                            {formatBytes(Number(f.size))} • {f.mime}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-lg border px-2 py-1 text-sm hover:bg-slate-50"
                            onClick={() => openFile(f)}
                          >
                            Просмотр
                          </button>
                          <button
                            className="rounded-lg border px-2 py-1 text-sm hover:bg-slate-50"
                            onClick={() => {
                              if (!f.url) return toast.error("Нет url у файла");
                              downloadDirect(f.url, f.filename);
                            }}
                            title="Скачает напрямую без новой вкладки"
                          >
                            ⬇
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* file viewer modal */}
      <Modal
        open={viewerOpen}
        title={viewerFile ? viewerFile.filename : "Просмотр"}
        onClose={() => {
          setViewerOpen(false);
          setViewerFile(null);
          setViewerUrl("");
        }}
      >
        {viewerFile ? (
          <div className="space-y-3">
            <FileViewer mime={viewerFile.mime} url={viewerUrl} />

            <div className="flex items-center justify-between gap-2 pt-2">
              <div className="text-xs text-slate-500">{viewerFile.mime}</div>
              <button
                className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
                onClick={() => downloadDirect(viewerUrl, viewerFile.filename)}
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