import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

export const projectSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(400),
  stack: z.array(z.string().min(1).max(32)).min(1).max(8),
  status: z.enum(["shipped", "in flight", "research", "open source"]),
});

export type Project = z.infer<typeof projectSchema>;

/* ------------------------------------------------------------------ */
/* Contact form                                                        */
/* ------------------------------------------------------------------ */

/**
 * Strips C0/C1 control characters and collapses whitespace. Control
 * characters are what let a submission forge newlines into logs or
 * smuggle terminators into downstream systems.
 */
const CONTROL_CHARS = /[\x00-\x1F\x7F-\x9F]/g;

const clean = (s: string) => s.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();

export const contactSchema = z
  .object({
    name: z.string().transform(clean).pipe(z.string().min(2).max(80)),
    email: z.string().transform(clean).pipe(z.email().max(160)),
    message: z.string().transform(clean).pipe(z.string().min(10).max(2000)),
    // Honeypot. This must ACCEPT a filled value so the route can decide what
    // to do with it: rejecting here at validation would return a 422 that
    // tells the bot exactly which field gave it away.
    company: z.string().max(200).optional().default(""),
  })
  .strict(); // reject unknown keys rather than passing them through

export type ContactInput = z.infer<typeof contactSchema>;

// NOTE: environment parsing lives in lib/env.server.ts, not here.
// This module is imported by client components, so anything added
// below ships to the browser.
