"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DebugAuthPage() {
  const [userId, setUserId] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  const load = async () => {
	const { data, error } = await supabase.auth.getUser();
	if (error) {
	  alert(error.message);
	  return;
	}
	setUserId(data.user?.id ?? "");
	setEmail(data.user?.email ?? "");
  };

  return (
	<div className="p-6 max-w-xl mx-auto space-y-4">
	  <h1 className="text-2xl font-semibold">Debug Auth</h1>

	  <button
		onClick={load}
		className="rounded-lg bg-black px-4 py-2 text-white"
	  >
		Получить user id
	  </button>

	  <div className="rounded-xl border bg-white p-4 space-y-2">
		<div className="text-sm text-slate-500">Email</div>
		<div className="font-mono break-all">{email || "—"}</div>

		<div className="text-sm text-slate-500 mt-3">User ID</div>
		<div className="font-mono break-all">{userId || "—"}</div>

		{userId && (
		  <button
			className="mt-3 rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
			onClick={() => navigator.clipboard.writeText(userId)}
		  >
			Скопировать ID
		  </button>
		)}
	  </div>
	</div>
  );
}