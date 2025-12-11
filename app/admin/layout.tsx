import React from "react";

export const metadata = {
  title: "ReplixCast Admin",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-black text-center text-sm font-bold leading-8 text-white">
              R
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">
                ReplixCast Admin
              </div>
              <div className="text-xs text-slate-500">
                Панель управления заявками
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-6 text-sm text-slate-600">
            <a href="/admin/orders" className="hover:text-black">
              Заявки
            </a>
            <a href="/admin/invoices" className="hover:text-black">
              Инвойсы
            </a>
            <a href="/admin/settings" className="hover:text-black">
              Настройки
            </a>
            <a
              href="/admin/login"
              className="text-red-600 hover:text-red-800 font-medium"
            >
              Выйти
            </a>
          </nav>
          </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
