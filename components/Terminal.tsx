"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

type Line = {
  /** Prompt glyph rendered before the text, if any. */
  prompt?: string;
  text: string;
  tone?: "cmd" | "ok" | "warn" | "dim" | "code";
  /** Skip the typing animation and print instantly. */
  instant?: boolean;
};

const TONE: Record<NonNullable<Line["tone"]>, string> = {
  cmd: "text-[#e7ecf5]",
  ok: "text-[#5eead4]",
  warn: "text-[#fbbf24]",
  dim: "text-[#7c8aa5]",
  code: "text-[#38f5ff]",
};

const SCRIPT: Line[] = [
  { prompt: "❯", text: "pnpm install --frozen-lockfile", tone: "cmd" },
  { text: "Lockfile is up to date, resolution step is skipped", tone: "dim", instant: true },
  { text: "✓ 447 packages audited · 0 lifecycle scripts executed", tone: "ok", instant: true },
  { prompt: "❯", text: "whoami", tone: "cmd" },
  { text: "software engineer — systems, graphics, and the web", tone: "dim", instant: true },
  { prompt: "❯", text: "cat stack.json", tone: "cmd" },
  { text: '{ "lang": ["TypeScript", "Rust", "Go"],', tone: "code", instant: true },
  { text: '  "gpu":  ["WebGL", "GLSL", "WebGPU"],', tone: "code", instant: true },
  { text: '  "infra":["Docker", "Terraform", "AWS"] }', tone: "code", instant: true },
  { prompt: "❯", text: "./deploy --env production", tone: "cmd" },
  { text: "building ▸ optimising ▸ shipping", tone: "dim", instant: true },
  { text: "✓ live in 1.2s", tone: "ok", instant: true },
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const TYPE_MS = 34;
const LINE_PAUSE_MS = 380;

export default function Terminal() {
  const hostRef = useRef<HTMLDivElement>(null);
  const inView = useInView(hostRef, { once: true, amount: 0.35 });

  const [done, setDone] = useState<Line[]>([]);
  const [typing, setTyping] = useState("");
  const [idx, setIdx] = useState(0);

  // Derived, not stored: storing it would mean a setState in the effect body.
  const finished = idx >= SCRIPT.length;

  /** One effect drives the whole animation, one line at a time. */
  useEffect(() => {
    if (!inView) return;

    const line = SCRIPT[idx];
    if (!line) return;

    // Read the preference here rather than holding it in state: the first
    // client render must match the server's, and the server cannot know it.
    const reduced = prefersReducedMotion();

    const timers: ReturnType<typeof setTimeout>[] = [];

    const commit = (delay: number) => {
      timers.push(
        setTimeout(() => {
          setDone((d) => [...d, line]);
          setTyping("");
          setIdx((i) => i + 1);
        }, delay),
      );
    };

    if (reduced || line.instant) {
      // Reduced motion prints the whole transcript with no typing effect.
      commit(reduced ? 0 : 150);
    } else {
      let char = 0;
      const step = () => {
        char += 1;
        setTyping(line.text.slice(0, char));
        if (char < line.text.length) {
          timers.push(setTimeout(step, TYPE_MS));
        } else {
          commit(LINE_PAUSE_MS);
        }
      };
      timers.push(setTimeout(step, TYPE_MS));
    }

    // Clearing every timer here means unmounting mid-type - or a Strict Mode
    // double-invoke in dev - cannot leave a timeout calling setState on a
    // dead component.
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [inView, idx]);

  // Keep the newest line in view without scrolling the page itself.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [done, typing]);

  const active = SCRIPT[idx];

  return (
    <motion.div
      ref={hostRef}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="glass relative w-full overflow-hidden rounded-2xl"
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-white/8 bg-white/[0.02] px-4 py-3">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-xs tracking-wide text-[#7c8aa5]">
          ~/portfolio — zsh — 80×24
        </span>
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="h-[19rem] overflow-y-auto px-5 py-4 font-mono text-[13px] leading-[1.75]"
        role="log"
        aria-live="polite"
        aria-label="Terminal session transcript"
      >
        {done.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-words">
            {l.prompt && <span className="mr-2 text-[#8b5cf6]">{l.prompt}</span>}
            <span className={TONE[l.tone ?? "dim"]}>{l.text}</span>
          </div>
        ))}

        {typing && active && (
          <div className="whitespace-pre-wrap break-words">
            {active.prompt && (
              <span className="mr-2 text-[#8b5cf6]">{active.prompt}</span>
            )}
            <span className={TONE[active.tone ?? "dim"]}>{typing}</span>
            <span className="ml-0.5 inline-block h-[1.05em] w-[0.55em] translate-y-[0.18em] animate-pulse bg-[#38f5ff]" />
          </div>
        )}

        {finished && (
          <div>
            <span className="mr-2 text-[#8b5cf6]">❯</span>
            <span className="ml-0.5 inline-block h-[1.05em] w-[0.55em] translate-y-[0.18em] animate-pulse bg-[#38f5ff]" />
          </div>
        )}
      </div>

      {/* CRT scanline wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 3px)",
        }}
      />
    </motion.div>
  );
}
