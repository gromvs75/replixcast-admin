"use client";

import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setIsAuthChecked(true);
    };
    check();
  }, []);

  // Показываем пустой экран, пока проверяем авторизацию
  if (!isAuthChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Проверка доступа…
      </div>
    );
  }

  // Если нет сессии — отправляем на логин
  if (!session) {
    if (pathname !== "/admin/login") router.push("/admin/login");
    return null;
  }

  const nav = [
    { href: "/admin/orders", label: "Заявки" },
    { href: "/admin/invoices", label: "Инвойсы" },
    { href: "/admin/settings", label: "Настройки" },
  ];

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* TOP BAR */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 bg-black rounded-xl text-white flex items-center justify-center font-bold">
            R
          </div>
          <div>
            <div className="text-sm font-semibold">ReplixCast Admin</div>
            <div className="text-xs text-slate-500">Панель управления заявками</div>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="flex items-center gap-6 text-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                pathname.startsWith(item.href)
                  ? "font-semibold text-slate-900"
                  : "text-slate-600 hover:text-slate-900"
              }
            >
              {item.label}
            </Link>
          ))}

          <button
            onClick={logout}
            className="text-slate-500 hover:text-red-600 text-sm"
          >
            Выйти
          </button>
        </nav>
      </header>

      {/* CONTENT */}
      <main className="p-6">{children}</main>
    </div>
  );
}
