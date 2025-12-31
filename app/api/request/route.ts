// app/api/request/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// --- Supabase admin (service role) ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- ENV ---
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const LEADS_BUCKET = process.env.LEADS_BUCKET || "leads";

// ALLOWED_ORIGINS=https://replixcast.de,https://www.replixcast.de,http://localhost:3000
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// --- Limits ---
const MAX_FILES = 3;
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || "4");
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// --- Rate limit ---
const RATE_LIMIT_WINDOW_SEC = 10 * 60;
const RATE_LIMIT_MAX = 5;

// --- Helpers ---
function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function getIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0]?.trim();
  return ip || req.headers.get("x-real-ip") || "unknown";
}
function escapeHtml(s: string) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function safeFilename(name: string) {
  const n = (name || "file").trim();
  return n.replace(/[^\w.\-]+/g, "_").slice(0, 180);
}

// File-like
type WebFileLike = {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function asWebFileLike(v: any): WebFileLike | null {
  if (!v) return null;
  if (typeof v?.arrayBuffer !== "function") return null;

  const name = typeof v?.name === "string" && v.name ? String(v.name) : "upload.bin";
  const type = typeof v?.type === "string" ? String(v.type) : "";
  const size = typeof v?.size === "number" ? Number(v.size) : 0;

  return { name, type, size, arrayBuffer: v.arrayBuffer.bind(v) };
}

// Забираем до 3 файлов: files / files[] / file / upload и т.п.
function pickMultipartFiles(fd: FormData): WebFileLike[] {
  const out: WebFileLike[] = [];
  const keys = ["files", "files[]", "file", "file[]", "upload", "uploads", "photo", "image", "avatar"];

  for (const k of keys) {
	const arr = fd.getAll(k);
	for (const v of arr) {
	  const f = asWebFileLike(v);
	  if (f) out.push(f);
	}
  }

  // fallback: если ключи другие — пройдёмся по всем полям
  if (out.length === 0) {
	for (const [, v] of fd.entries()) {
	  const f = asWebFileLike(v);
	  if (f) out.push(f);
	}
  }

  return out.slice(0, MAX_FILES);
}

// --- CORS ---
function isOriginAllowed(origin: string) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.length === 0) return true;
  return ALLOWED_ORIGINS.includes(origin);
}
function corsHeaders(origin: string) {
  const allowOrigin =
	!origin
	  ? "*"
	  : ALLOWED_ORIGINS.length === 0
		? "*"
		: ALLOWED_ORIGINS.includes(origin)
		  ? origin
		  : "";

  return {
	"Access-Control-Allow-Origin": allowOrigin || "null",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Max-Age": "86400",
	Vary: "Origin",
  };
}
function corsJson(req: Request, body: any, init?: { status?: number }) {
  const origin = req.headers.get("origin") || "";
  return NextResponse.json(body, {
	status: init?.status ?? 200,
	headers: corsHeaders(origin),
  });
}
export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";
  if (!isOriginAllowed(origin)) {
	return new NextResponse(null, { status: 403, headers: corsHeaders(origin) });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

async function verifyTurnstile(token: string, ip?: string) {
  if (!TURNSTILE_SECRET_KEY) return { ok: false as const, error: "TURNSTILE_SECRET_KEY is missing" };
  if (!token) return { ok: false as const, error: "Missing turnstile token" };

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
  if (!j?.success) return { ok: false as const, error: "Turnstile failed", details: j };
  return { ok: true as const };
}

async function rateLimitByIp(ip: string) {
  const cutoffIso = new Date(Date.now() - RATE_LIMIT_WINDOW_SEC * 1000).toISOString();

  const { count, error } = await supabaseAdmin
	.from("lead_requests")
	.select("id", { count: "exact", head: true })
	.eq("ip", ip)
	.gte("created_at", cutoffIso);

  if (error) {
	console.error("[rateLimitByIp] supabase error:", error);
	return { ok: true as const, warn: error.message };
  }

  const c = count ?? 0;
  if (c >= RATE_LIMIT_MAX) return { ok: false as const, error: "Too many requests. Try later." };
  return { ok: true as const };
}

async function telegramSendMessage(html: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
	return { ok: false as const, error: "Telegram env is missing" };
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

  const j = await res.json().catch(() => ({} as any));
  if (!res.ok || !j?.ok) return { ok: false as const, error: j?.description || `HTTP ${res.status}` };
  return { ok: true as const };
}

export async function POST(req: Request) {
  const debugMode = new URL(req.url).searchParams.get("debug") === "1";
  const build =
	process.env.VERCEL_GIT_COMMIT_SHA ||
	process.env.VERCEL_GIT_COMMIT_REF ||
	process.env.VERCEL_ENV ||
	"unknown";

  const debug: any = {
	build,
	bucket: LEADS_BUCKET,
	contentType: req.headers.get("content-type") || "",
	filesFound: [],
	uploadErrors: [],
	leadFilesInsertError: null,
	bucketCheck: null,
  };

  try {
	const origin = req.headers.get("origin") || "";
	if (!isOriginAllowed(origin)) {
	  return corsJson(req, { ok: false, error: "Origin not allowed", debug: debugMode ? debug : undefined }, { status: 403 });
	}

	const ip = getIp(req);
	const ua = req.headers.get("user-agent") || "";
	const referer = req.headers.get("referer") || "";

	const ct = req.headers.get("content-type") || "";
	const isMultipart = ct.includes("multipart/form-data");

	let name = "";
	let email = "";
	let message = "";
	let token = "";
	let files: WebFileLike[] = [];

	if (isMultipart) {
	  const fd = await req.formData();

	  name = String(fd.get("name") || "").trim();
	  email = String(fd.get("email") || "").trim();
	  message = String(fd.get("message") || fd.get("description") || "").trim();
	  token = String(fd.get("cf-turnstile-response") || fd.get("turnstileToken") || "").trim();

	  files = pickMultipartFiles(fd);
	} else {
	  const body = await req.json().catch(() => null);
	  name = String(body?.name || "").trim();
	  email = String(body?.email || "").trim();
	  message = String(body?.message || body?.description || "").trim();
	  token = String(body?.turnstileToken || body?.cfTurnstileResponse || "").trim();
	  files = [];
	}

	debug.filesFound = files.map((f) => ({ name: f.name, size: f.size, type: f.type }));

	if (!email || !isValidEmail(email)) {
	  return corsJson(req, { ok: false, error: "Valid email is required", debug: debugMode ? debug : undefined }, { status: 400 });
	}
	if (!message) {
	  return corsJson(req, { ok: false, error: "Message is required", debug: debugMode ? debug : undefined }, { status: 400 });
	}
	if (!name) name = "—";

	if (files.length > MAX_FILES) {
	  return corsJson(req, { ok: false, error: `Max ${MAX_FILES} files`, debug: debugMode ? debug : undefined }, { status: 400 });
	}
	for (const f of files) {
	  if (f.size > MAX_FILE_BYTES) {
		return corsJson(
		  req,
		  { ok: false, error: `File "${f.name}" is too large. Max ${MAX_FILE_MB}MB`, debug: debugMode ? debug : undefined },
		  { status: 413 }
		);
	  }
	}

	// Turnstile
	const ts = await verifyTurnstile(token, ip);
	if (!ts.ok) {
	  return corsJson(req, { ok: false, error: ts.error, details: (ts as any).details || null, debug: debugMode ? debug : undefined }, { status: 403 });
	}

	// Rate-limit
	const rl = await rateLimitByIp(ip);
	if (!rl.ok) return corsJson(req, { ok: false, error: rl.error, debug: debugMode ? debug : undefined }, { status: 429 });

	// Bucket check (debug only)
	if (debugMode) {
	  try {
		const { data, error } = await supabaseAdmin.storage.listBuckets();
		debug.bucketCheck = {
		  ok: !error,
		  error: error ? String(error.message || error) : null,
		  exists: Array.isArray(data) ? data.some((b: any) => b?.name === LEADS_BUCKET) : null,
		};
	  } catch (e: any) {
		debug.bucketCheck = { ok: false, error: e?.message || String(e), exists: null };
	  }
	}

	// Insert lead
	const { data: lead, error: leadErr } = await supabaseAdmin
	  .from("lead_requests")
	  .insert({
		ip,
		name,
		email,
		message,
		user_agent: ua,
		referer,
	  })
	  .select("id, created_at")
	  .single();

	if (leadErr || !lead) {
	  console.error("[lead insert] error:", leadErr);
	  return corsJson(req, { ok: false, error: leadErr?.message || "DB insert failed", debug: debugMode ? debug : undefined }, { status: 500 });
	}

	const leadId = String(lead.id);

	// Upload files
	const uploaded: { path: string; name: string; size: number; type: string; bucket: string }[] = [];
	for (let i = 0; i < files.length; i++) {
	  const file = files[i];
	  const safeName = safeFilename(file.name);
	  const path = `${leadId}/${Date.now()}_${i + 1}_${safeName}`;

	  try {
		const buf = Buffer.from(await file.arrayBuffer());

		const up = await supabaseAdmin.storage.from(LEADS_BUCKET).upload(path, buf, {
		  contentType: file.type || "application/octet-stream",
		  upsert: true,
		});

		if (up.error) {
		  debug.uploadErrors.push({ name: file.name, error: String(up.error.message || up.error) });
		  continue;
		}

		uploaded.push({ path, name: safeName, size: file.size, type: file.type || "", bucket: LEADS_BUCKET });
	  } catch (e: any) {
		debug.uploadErrors.push({ name: file.name, error: e?.message || String(e) });
	  }
	}

	// Insert lead_files
	if (uploaded.length > 0) {
	  const rows = uploaded.map((u) => ({
		lead_id: leadId,
		file_path: u.path,
		file_name: u.name,
		file_mime: u.type || null,
		file_size: u.size || null,
		bucket: u.bucket,
	  }));

	  const ins = await supabaseAdmin.from("lead_files").insert(rows as any);
	  if (ins.error) {
		debug.leadFilesInsertError = String(ins.error.message || ins.error);
		console.error("[lead_files insert] error:", ins.error);
	  }

	  // Update lead_requests first-file fields (по твоей схеме)
	  const upd = await supabaseAdmin
		.from("lead_requests")
		.update({
		  file_path: uploaded[0].path,
		  file_name: uploaded[0].name,
		  file_type: uploaded[0].type || null,
		  file_size: uploaded[0].size || null,
		})
		.eq("id", leadId);

	  if (upd.error) console.error("[lead_requests update file_*] error:", upd.error);
	}

	// Telegram (со списком файлов)
	const filesLine =
	  uploaded.length > 0
		? `\n📎 Файлы (${uploaded.length}):\n` +
		  uploaded.map((f) => `• ${escapeHtml(f.name)} (${Math.round(f.size / 1024)} KB)`).join("\n")
		: files.length > 0
		  ? `\n⚠️ Файлы были прикреплены, но не загрузились в Storage (bucket: "${escapeHtml(LEADS_BUCKET)}").`
		  : "";

	const textMsg =
	  `🆕 <b>Новая заявка (lead)</b>\n` +
	  `🆔 <code>${escapeHtml(leadId)}</code>\n` +
	  `👤 <b>${escapeHtml(name)}</b>\n` +
	  `✉️ ${escapeHtml(email)}\n` +
	  `🌐 IP: <code>${escapeHtml(ip)}</code>\n` +
	  (referer ? `🔗 ${escapeHtml(referer)}\n` : "") +
	  `\n📝 ${escapeHtml(message)}` +
	  filesLine;

	const tg = await telegramSendMessage(textMsg);
	if (!tg.ok) {
	  console.error("[telegram] error:", tg.error);
	  return corsJson(req, { ok: false, error: tg.error || "Telegram failed", leadId, debug: debugMode ? debug : undefined }, { status: 500 });
	}

	return corsJson(req, { ok: true, leadId, files: uploaded, debug: debugMode ? debug : undefined });
  } catch (e: any) {
	console.error("[/api/request] error:", e);
	debug.fatal = e?.message || String(e);
	return corsJson(req, { ok: false, error: debug.fatal, debug: debugMode ? debug : undefined }, { status: 500 });
  }
}