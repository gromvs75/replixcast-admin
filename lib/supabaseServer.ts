// lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function supabaseServer() {
  const cookieStore = cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, anon, {
	cookies: {
	  get(name) {
		return cookieStore.get(name)?.value;
	  },
	  set(name, value, options) {
		cookieStore.set({ name, value, ...options });
	  },
	  remove(name, options) {
		cookieStore.set({ name, value: "", ...options, maxAge: 0 });
	  },
	},
  });
}