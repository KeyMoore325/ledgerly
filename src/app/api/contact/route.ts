import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const runtime = "nodejs";

const ContactSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(100),
  email: z.string().trim().email("Please enter a valid email address.").max(200),
  topic: z.enum(["feedback", "bug", "question", "other"]),
  message: z.string().trim().min(10, "Please write at least 10 characters.").max(4000),
  website: z.string().max(0).optional(), // honeypot: must stay empty
});

// Simple per-IP rate limit (in memory; swap for a shared store in production)
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return Response.json({ error: "Too many messages. Please try again later." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = ContactSchema.safeParse(json);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return Response.json({ error: "Please fix the highlighted fields.", fieldErrors }, { status: 400 });
  }

  hits.set(ip, [...recent, now]);
  const { website: _honeypot, ...msg } = parsed.data;
  void _honeypot;

  // Store messages locally. Replace this with an email or CRM integration when you deploy.
  try {
    const dir = path.join(process.cwd(), "data");
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, "messages.jsonl"), JSON.stringify({ ...msg, receivedAt: new Date().toISOString() }) + "\n");
  } catch (e) {
    console.error("Could not store contact message", e);
    return Response.json({ error: "We couldn't save your message. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
