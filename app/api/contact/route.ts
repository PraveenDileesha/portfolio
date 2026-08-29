import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/schemas";
import { readServerEnv } from "@/lib/env.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Crude in-process rate limit. Swap for a shared store behind a load balancer. */
const HITS = new Map<string, { n: number; reset: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function limited(ip: string): boolean {
  const now = Date.now();
  const rec = HITS.get(ip);
  if (!rec || now > rec.reset) {
    HITS.set(ip, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (limited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Reject anything that is not JSON before touching the body.
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  // Single validation gate: everything downstream works on parsed data,
  // never on the raw request. .strict() rejects unknown keys outright.
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        // Field names only. Echoing submitted values back is a reflection risk.
        fields: parsed.error.issues.map((i) => i.path.join(".")),
      },
      { status: 422 },
    );
  }

  // Honeypot tripped: accept silently so bots learn nothing.
  if (parsed.data.company) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  const env = readServerEnv();
  if (env.CONTACT_WEBHOOK_URL) {
    // Secret lives only in the server process; it is never sent to the client.
    await fetch(env.CONTACT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: parsed.data.name,
        email: parsed.data.email,
        message: parsed.data.message,
      }),
    });
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
