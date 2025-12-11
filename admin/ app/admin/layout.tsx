// app/admin/layout.tsx
"use client";

import { ReactNode } from "react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <aside className="w-full md:w-64 bg-white border-b md:border-r shadow-sm p-4 md:h-screen md:fixed">
        <h1 className="text-xl font-bold mb-4">ReplixCast Admin</h1>

        <nav className="space-y-2">
          <Link href="/admin/orders" className="block p-2 hover:bg-gray-100 rounded">
            Заявки
          </Link>
          <Link href="/admin/login" className="block p-2 hover:bg-gray-100 rounded">
            Выйти
          </Link>
        </nav>
      </aside>

      <main className="md:ml-64 p-6">{children}</main>
    </div>
  );
}
