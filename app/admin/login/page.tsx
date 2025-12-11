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
    } else {
      router.push("/admin/orders");
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-bold">Admin Login</h1>

        <input
          type="email"
          placeholder="Email"
          className="mb-3 w-full rounded-lg bg-zinc-800 p-3 outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="mb-4 w-full rounded-lg bg-zinc-800 p-3 outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full rounded-lg bg-white py-3 font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
        >
          {loading ? "Entering..." : "Login"}
        </button>
      </div>
    </div>
  );
}
