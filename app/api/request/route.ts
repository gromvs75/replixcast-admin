// app/api/request/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ENV
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// CORS allowlist (Strato -> Vercel)
// Пример: ALLOWED_ORIGINS=https://replixcast.de,https://www.replixcast.de,http://localhost:3000
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Rate limit
const RATE_LIMIT_WINDOW_SEC = 10 * 60; // 10 минут
const RATE_LIMIT_MAX = 5; // 5 запросов за окно

// Upload limits (для лида лучше держать умеренно; Telegram тоже имеет лимиты)
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
];

function corsHeaders(origin: string) {
  // Если allowlist пуст — разрешаем всё (удобно для тестов).
  // Если задан — разрешаем ТОЛЬКО указанные origin.
  const allowOrigin =
	ALLOWED_ORIGINS.length === 0
	  ? "*"
	  : ALLOWED_ORIGINS.includes(origin)
	  ? origin
	  : "";

  return {
	"Access-Control-Allow-Origin": allowOrigin || "null",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Max-Age": "86400",
	"Vary": "Origin",
  };
}

function corsJson(req: Request, body: any, init?: { status?: number }) {
  const origin = req.headers.get("origin") || "";
  return NextResponse.json(body, {
	status: init?.status ?? 200,
	headers: corsHeaders(origin),
  });
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function getIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0]?.trim();
  return ip || req.headers.get("x-real-ip") || "unknown";
}

function originAllowed(req: Request) {
  if (ALLOWED_ORIGINS.length === 0) return true;
  const origin = req.headers.get("origin") || "";
  return ALLOWED_ORIGINS.includes(origin);
}

// ✅ Preflight для браузера (Strato -> Vercel)
export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";

  if (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(origin)) {
	return new NextResponse(null, { status: 403, headers: corsHeaders(origin) });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

async function verifyTurnstile(token: string, ip?: string) {
  if (!TURNSTILE_SECRET_KEY) return { ok: false, error: "TURNSTILE_SECRET_KEY is missing" };
  if (!token) return { ok: false, error: "Missing turnstile token" };

  const form = new URLSearchParams();
  form.set("secret", TURNSTILE_SECRET_KEY);
  form.set("response", token);
  if (ip && ip !== "unknown") form.set("remoteip", ip);

  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
	method: "POST",
	headers: { "content-type": "application/x-www-form-urlencoded" },
	body: form.toString(),
  });

  const j = (await r.json().catch(() => null)) as any;
  if (!j?.success) return { ok: false, error: "Turnstile failed", details: j };
  return { ok: true };
}

async function rateLimitByIp(ip: string) {
  const cutoffIso = new Date(Date.now() - RATE_LIMIT_WINDOW_SEC * 1000).toISOString();

  const { count, error } = await supabaseAdmin
	.from("lead_requests")
	.select("id", { count: "exact", head: true })
	.eq("ip", ip)
	.gte("created_at", cutoffIso);

  // если таблицы нет/ошибка — не блокируем
  if (error) return { ok: true, warn: error.message || "rate limit check failed" };

  const c = count ?? 0;
  if (c >= RATE_LIMIT_MAX) return { ok: false, error: "Too many requests. Try later." };
  return { ok: true };
}

async function telegramSendMessage(html: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
	return { ok: false, error: "Telegram env is missing" };
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
	method: "POST",
	headers: { "content-type": "application/json" },
	body: JSON.stringify({
	  chat_id: TELEGRAM_CHAT_ID,
	  text: html,
	  parse_mode: "HTML",
	  disable_web_page_preview: true,
	}),
  });

  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j?.ok) return { ok: false, error: j?.description || `HTTP ${res.status}` };
  return { ok: true };
}

async function telegramSendDocument(file: File, captionHtml: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
	return { ok: false, error: "Telegram env is missing" };
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;

  const fd = new FormData();
  fd.set("chat_id", TELEGRAM_CHAT_ID);
  fd.set("caption", captionHtml);
  fd.set("parse_mode", "HTML");
  fd.set("document", file, file.name || "file");

  const res = await fetch(url, { method: "POST", body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j?.ok) return { ok: false, error: j?.description || `HTTP ${res.status}` };
  return { ok: true };
}

function escapeHtml(s: string) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: Request) {
  try {
	// 0) origin allowlist
	if (!originAllowed(req)) {
	  return corsJson(req, { ok: false, error: "Origin not allowed" }, { status: 403 });
	}

	const ip = getIp(req);
	const ua = req.headers.get("user-agent") || "";
	const referer = req.headers.get("referer") || "";

	const ct = req.headers.get("content-type") || "";
	const isMultipart = ct.includes("multipart/form-data");

	let name = "";
	let email = "";
	let message = "";
	let hp = "";
	let token = "";
	let file: File | null = null;

	if (isMultipart) {
	  const fd = await req.formData();

	  name = String(fd.get("name") || "").trim();
	  email = String(fd.get("email") || "").trim();
	  message = String(fd.get("message") || fd.get("description") || fd.get("script") || "").trim();

	  // honeypot
	  hp = String(fd.get("company") || fd.get("website") || "").trim();

	  // Turnstile token (стандартное имя поля у Cloudflare)
	  token = String(fd.get("cf-turnstile-response") || fd.get("turnstileToken") || "").trim();

	  const f = fd.get("file");
	  if (f && typeof f !== "string") file = f as File;

	  // на всякий случай: если в лендинге поле иначе названо
	  if (!file) {
		const f2 = fd.get("photo") || fd.get("photo-file");
		if (f2 && typeof f2 !== "string") file = f2 as File;
	  }
	} else {
	  const body = await req.json().catch(() => null);
	  name = String(body?.name || "").trim();
	  email = String(body?.email || "").trim();
	  message = String(body?.message || body?.description || "").trim();
	  hp = String(body?.company || body?.website || "").trim();
	  token = String(body?.turnstileToken || body?.cfTurnstileResponse || "").trim();
	}

	// honeypot: молча “успех”, чтобы боты не понимали
	if (hp) return corsJson(req, { ok: true });

	if (!name) return corsJson(req, { ok: false, error: "Name is required" }, { status: 400 });
	if (!email || !isValidEmail(email)) {
	  return corsJson(req, { ok: false, error: "Valid email is required" }, { status: 400 });
	}
	if (!message) return corsJson(req, { ok: false, error: "Message is required" }, { status: 400 });

	// Turnstile
	const ts = await verifyTurnstile(token, ip);
	if (!ts.ok) {
	  return corsJson(req, { ok: false, error: ts.error, details: ts.details || null }, { status: 403 });
	}

	// Rate limit
	const rl = await rateLimitByIp(ip);
	if (!rl.ok) return corsJson(req, { ok: false, error: rl.error }, { status: 429 });

	// File validation (optional)
	if (file) {
	  if (file.size > MAX_FILE_SIZE) {
		return corsJson(req, { ok: false, error: "File too large" }, { status: 400 });
	  }
	  if (file.type && !ALLOWED_MIME.includes(file.type)) {
		return corsJson(req, { ok: false, error: "Invalid file type" }, { status: 400 });
	  }
	}

	// Log в БД (best-effort)
	await supabaseAdmin
	  .from("lead_requests")
	  .insert({
		ip,
		name,
		email,
		message,
		user_agent: ua,
		referer,
	  })
	  .catch(() => null);

	const text =
	  `🆕 <b>Новая заявка (lead)</b>\n` +
	  `👤 <b>${escapeHtml(name)}</b>\n` +
	  `✉️ ${escapeHtml(email)}\n` +
	  `🌐 IP: <code>${escapeHtml(ip)}</code>\n` +
	  (referer ? `🔗 ${escapeHtml(referer)}\n` : "") +
	  `\n📝 ${escapeHtml(message)}`;

	const tg = file ? await telegramSendDocument(file, text) : await telegramSendMessage(text);
	if (!tg.ok) {
	  return corsJson(req, { ok: false, error: tg.error || "Telegram failed" }, { status: 500 });
	}

	return corsJson(req, { ok: true });
  } catch (e: any) {
	return corsJson(req, { ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}