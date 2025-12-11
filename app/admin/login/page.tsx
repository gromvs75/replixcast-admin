"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/admin/orders");
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          ReplixCast
        </div>
        <h1 className="mb-1 text-center text-xl font-semibold text-slate-900">
          Вход в админку
        </h1>
        <p className="mb-6 text-center text-xs text-slate-500">
          Введите email и пароль администратора Supabase
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-100 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Email
          </label>
          <input
            type="email"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-300"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Пароль
          </label>
          <input
            type="password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-300"
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Входим…" : "Войти"}
        </button>
      </div>
    </div>
  );
}
