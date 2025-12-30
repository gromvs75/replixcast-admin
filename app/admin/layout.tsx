"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [checked, setChecked] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setChecked(true);
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setChecked(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ✅ редирект делаем эффектом (не в рендере)
  useEffect(() => {
    if (!checked) return;
    if (pathname === "/admin/login") return;
    if (!session) router.replace("/admin/login");
  }, [checked, session, pathname, router]);

  // логин не блокируем
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Проверка…
      </div>
    );
  }

  // пока редиректим — ничего не рендерим
  if (!session) return null;

  const logout = async () => {
    // 1) попросим страницы очистить локальный UI
    window.dispatchEvent(new Event("admin:logout"));

    // 2) выходим из supabase
    await supabase.auth.signOut();

    // 3) на логин
    router.replace("/admin/login");
    router.refresh();
  };

  // ---- nav helpers ----
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const navClass = (href: string) =>
    `text-sm font-medium hover:underline ${
      isActive(href) ? "text-slate-900" : "text-slate-600"
    }`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              ReplixCast
            </div>
            <span className="text-slate-300">/</span>

            {/* ✅ Меню */}
            <nav className="flex items-center gap-4">
              <Link href="/admin/orders" className={navClass("/admin/orders")}>
                Заявки
              </Link>

              <Link href="/admin/leads" className={navClass("/admin/leads")}>
                Лиды
              </Link>
            </nav>
          </div>

          <button
            onClick={logout}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
            title="Выйти из админки"
          >
            Выйти
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}