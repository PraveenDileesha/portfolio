"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import ProjectCard from "@/components/ProjectCard";
import Terminal from "@/components/Terminal";
import { projects, capabilities } from "@/lib/content";

/**
 * three.js is ~600kB. Keeping it out of SSR and off the initial bundle
 * means first paint is the gradient + copy, with the scene streaming in
 * behind it. `ssr: false` is legal here because this is a client component.
 */
const HeroCanvas = dynamic(() => import("@/components/HeroCanvas"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(56,245,255,0.12),transparent_60%)]"
    />
  ),
});

const EASE = [0.22, 1, 0.36, 1] as const;

function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-4">
      <span className="font-mono text-[11px] tracking-[0.28em] text-[#38f5ff]">
        {n}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-[#38f5ff]/40 to-transparent" />
      <span className="font-mono text-[11px] tracking-[0.28em] text-[#7c8aa5] uppercase">
        {children}
      </span>
    </div>
  );
}

export default function Home() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Hero copy drifts up and dissolves as the scene scrolls away.
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -110]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const canvasScale = useTransform(scrollYProgress, [0, 1], [1, 1.14]);

  return (
    <main className="relative bg-[#090d16]">
      {/* ============================== NAV ============================= */}
      <header className="fixed inset-x-0 top-0 z-50">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a href="#top" className="font-mono text-sm tracking-tight text-[#e7ecf5]">
            <span className="text-[#38f5ff]">~/</span>engineer
          </a>
          <div className="glass hidden items-center gap-1 rounded-full px-2 py-1.5 md:flex">
            {[
              ["work", "#work"],
              ["stack", "#stack"],
              ["about", "#about"],
              ["contact", "#contact"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-4 py-1.5 font-mono text-xs text-[#7c8aa5] transition-colors hover:bg-white/5 hover:text-[#e7ecf5]"
              >
                {label}
              </a>
            ))}
          </div>
          <a
            href="#contact"
            className="rounded-full border border-[#38f5ff]/30 bg-[#38f5ff]/10 px-4 py-2 font-mono text-xs text-[#38f5ff] transition-colors hover:bg-[#38f5ff]/20"
          >
            available
          </a>
        </nav>
      </header>

      {/* ============================== HERO ============================ */}
      <section
        id="top"
        ref={heroRef}
        className="relative flex h-screen min-h-[42rem] items-center justify-center overflow-hidden"
      >
        <motion.div style={{ scale: canvasScale }} className="absolute inset-0">
          <HeroCanvas />
        </motion.div>

        {/* Legibility scrim: the scene is busy behind the headline. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(9,13,22,0.72)_0%,transparent_28%,transparent_58%,rgba(9,13,22,0.94)_100%)]"
        />

        <motion.div
          style={{ y: copyY, opacity: copyOpacity }}
          className="relative z-10 mx-auto max-w-4xl px-6 text-center"
        >
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
            className="font-mono text-xs tracking-[0.34em] text-[#38f5ff] uppercase"
          >
            software engineer
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, delay: 0.28, ease: EASE }}
            className="mt-6 text-[clamp(2.6rem,7.5vw,5.4rem)] leading-[0.98] font-semibold tracking-[-0.035em] text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(180deg,#ffffff 0%,#cfe0ff 46%,#7f9ccc 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            Building the parts
            <br />
            you never see.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.42, ease: EASE }}
            className="mx-auto mt-7 max-w-xl text-[15px] leading-relaxed text-[#93a3bf]"
          >
            Real-time graphics, distributed systems, and interfaces with a
            pulse. Ten years turning hard constraints into things that feel
            effortless.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.56, ease: EASE }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <a
              href="#work"
              className="group relative overflow-hidden rounded-full bg-[#e7ecf5] px-7 py-3 text-sm font-medium text-[#090d16] transition-transform hover:scale-[1.03]"
            >
              View selected work
            </a>
            <a
              href="#contact"
              className="glass rounded-full px-7 py-3 text-sm text-[#e7ecf5] transition-colors hover:bg-white/[0.07]"
            >
              Get in touch
            </a>
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
        >
          <div className="flex h-10 w-6 items-start justify-center rounded-full border border-white/15 p-1.5">
            <motion.span
              animate={{ y: [0, 12, 0], opacity: [1, 0.2, 1] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
              className="block h-1.5 w-1 rounded-full bg-[#38f5ff]"
            />
          </div>
        </motion.div>
      </section>

      {/* ============================== STACK =========================== */}
      <section id="stack" className="relative mx-auto max-w-6xl px-6 py-28">
        <SectionLabel n="01">what I do</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((c, i) => (
            <motion.div
              key={c.k}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
              className="glass rounded-2xl p-6"
            >
              <h3 className="font-mono text-sm tracking-[0.16em] text-[#38f5ff] uppercase">
                {c.k}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#7c8aa5]">{c.v}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============================== ABOUT + TERMINAL ================ */}
      <section id="about" className="relative mx-auto max-w-6xl px-6 py-20">
        <SectionLabel n="02">the setup</SectionLabel>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -26 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.75, ease: EASE }}
          >
            <h2 className="text-[clamp(1.9rem,4vw,3rem)] leading-[1.06] font-semibold tracking-[-0.03em] text-[#e7ecf5]">
              Three monitors,
              <br />
              one long-running process.
            </h2>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-[#7c8aa5]">
              I care about the layers most people scroll past: the render loop
              that has to finish in 8ms, the scheduler that cannot drop a job,
              the install step that must not run someone else&apos;s code.
            </p>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[#7c8aa5]">
              This page is a small demonstration of that. Every pixel in the
              hero is generated on the GPU at runtime — no textures, no video,
              nothing fetched from a host I do not control.
            </p>

            <dl className="mt-9 grid grid-cols-3 gap-6">
              {[
                ["10+", "years shipping"],
                ["40M", "jobs/day at peak"],
                ["0", "postinstall scripts"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="text-2xl font-semibold tracking-tight text-[#e7ecf5]">
                    {n}
                  </dt>
                  <dd className="mt-1 font-mono text-[11px] tracking-wide text-[#7c8aa5]">
                    {l}
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>

          <Terminal />
        </div>
      </section>

      {/* ============================== WORK ============================ */}
      <section id="work" className="relative mx-auto max-w-6xl px-6 py-28">
        <SectionLabel n="03">selected work</SectionLabel>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p, i) => (
            <ProjectCard key={p.title} project={p} index={i} />
          ))}
        </div>
      </section>

      {/* ============================== CONTACT ========================= */}
      <section id="contact" className="relative mx-auto max-w-6xl px-6 pt-20 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="glass relative overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(139,92,246,0.18),transparent_60%)]"
          />
          <div className="relative">
            <p className="font-mono text-[11px] tracking-[0.3em] text-[#38f5ff] uppercase">
              open to work
            </p>
            <h2 className="mx-auto mt-5 max-w-2xl text-[clamp(1.8rem,4.4vw,3.2rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-[#e7ecf5]">
              Have something difficult?
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-[#7c8aa5]">
              Rendering pipelines, systems that need to stay up, or a codebase
              that has stopped being fun. Tell me about it.
            </p>
            <a
              href="mailto:hello@example.com"
              className="mt-9 inline-block rounded-full bg-[#e7ecf5] px-8 py-3.5 text-sm font-medium text-[#090d16] transition-transform hover:scale-[1.03]"
            >
              hello@example.com
            </a>
          </div>
        </motion.div>
      </section>

      {/* ============================== FOOTER ========================== */}
      <footer className="border-t border-white/6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <p className="font-mono text-[11px] text-[#5b687f]">
            built with next.js · three.js · zero third-party assets
          </p>
          <p className="font-mono text-[11px] text-[#5b687f]">
            © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </main>
  );
}
