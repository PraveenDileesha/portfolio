"use client";

import { useRef } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import type { Project } from "@/lib/schemas";

/**
 * Glass card with a pointer-tracked 3D tilt and a spotlight that follows
 * the cursor. The tilt runs on motion values, so it never triggers a
 * React re-render while the pointer moves.
 */
export default function ProjectCard({
  project,
  index,
}: {
  project: Project;
  index: number;
}) {
  const ref = useRef<HTMLElement>(null);

  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);

  const spring = { stiffness: 190, damping: 22, mass: 0.6 };
  const rotateY = useSpring(useTransform(mx, [0, 1], [-7, 7]), spring);
  const rotateX = useSpring(useTransform(my, [0, 1], [6, -6]), spring);

  // useMotionTemplate keeps the gradient bound to the motion values. Reading
  // them with .get() inside a template string would freeze the spotlight at
  // whatever position it held on first render.
  const spotX = useTransform(mx, (v) => `${(v * 100).toFixed(2)}%`);
  const spotY = useTransform(my, (v) => `${(v * 100).toFixed(2)}%`);
  const spotlight = useMotionTemplate`radial-gradient(340px circle at ${spotX} ${spotY}, rgba(56,245,255,0.12), transparent 62%)`;

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };

  const reset = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <motion.article
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      initial={{ opacity: 0, y: 34 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{
        duration: 0.65,
        delay: Math.min(index * 0.07, 0.35),
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{ rotateX, rotateY, transformPerspective: 1100 }}
      className="glass glow-ring group relative flex flex-col rounded-2xl p-6 will-change-transform"
    >
      {/* Cursor spotlight */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: spotlight }}
      />

      <div className="flex items-start justify-between gap-4">
        <span className="font-mono text-[11px] tracking-[0.22em] text-[#7c8aa5]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-[#5eead4] uppercase">
          {project.status}
        </span>
      </div>

      <h3 className="mt-5 text-xl font-semibold tracking-tight text-[#e7ecf5]">
        {project.title}
      </h3>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-[#7c8aa5]">
        {project.description}
      </p>

      <ul className="mt-6 flex flex-wrap gap-2">
        {project.stack.map((s) => (
          <li
            key={s}
            className="rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-[#9fb0cc]"
          >
            {s}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center gap-2 font-mono text-xs text-[#38f5ff]">
        <span className="transition-transform duration-300 group-hover:translate-x-1">
          view case study
        </span>
        <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1.5">
          →
        </span>
      </div>
    </motion.article>
  );
}
