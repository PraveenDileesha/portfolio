import "server-only";
import { z } from "zod";

/**
 * Server-only environment access.
 *
 * The `server-only` import makes this a build error rather than a runtime
 * surprise if a client component ever reaches this module. Keeping it out
 * of lib/schemas.ts matters because that file IS imported by client
 * components - so anything living beside it ends up in the browser bundle.
 *
 * None of these are NEXT_PUBLIC_*, so Next will not inline them client-side.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CONTACT_WEBHOOK_URL: z.url().optional(),
});

export function readServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Report only the failing keys - the values may themselves be secrets.
    throw new Error(
      `Invalid server environment: ${parsed.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}`,
    );
  }
  return parsed.data;
}
