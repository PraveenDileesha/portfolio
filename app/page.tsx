"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const BoatSunsetCanvas = dynamic(() => import("@/components/BoatSunsetCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#f4f1ee]" />,
});

export default function HomePage() {
  // ?t=<seconds> pins the clock for reproducible screenshots
  // ?wave=<n> scales the ripples — development aids only
  const [opts] = useState<{ t?: number; wave: number }>(() => {
    if (typeof window === "undefined") return { wave: 1 };
    const q = new URLSearchParams(window.location.search);
    const t = q.get("t");
    const wave = q.get("wave");
    return {
      t: t === null ? undefined : Number(t),
      wave: wave === null ? 1 : Number(wave),
    };
  });

  return (
    <main className="bg-[#f4f1ee] text-[#1d2328]">
      <section className="relative flex h-dvh min-h-[560px] flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 bg-[#dfe8ec]">
          <BoatSunsetCanvas
            className="!absolute inset-0"
            frozenTime={opts.t}
            waveAmp={opts.wave}
          />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08),_transparent_58%)]" />
        </div>

        <div className="shrink-0 overflow-y-auto bg-[#f4f1ee] px-6 py-4 sm:px-8 sm:py-5 lg:px-10">
          <div className="mx-auto max-w-[1200px] text-left">
            <h2 className="mb-2 text-[clamp(1.4rem,2.2vw,2.4rem)] font-medium leading-[1.08] tracking-[-0.05em] text-[#1d2328]">
              Who is Praveen Dileesha?
            </h2>

            <p className="max-w-[1150px] text-[clamp(0.78rem,1vw,0.98rem)] leading-[1.5] text-[#3a3f45]">
              I&apos;m a generalist builder who chooses to explore the given subject before figuring things out.
            </p>

            <p className="mt-2 max-w-[1150px] text-[clamp(0.78rem,1vw,0.98rem)] leading-[1.5] text-[#3a3f45] sm:mt-3">
              Currently, I&apos;m a software engineering Intern at SimpleBooks (Sri Lanka), developing end-to-end while embedding AI where it matters. I just graduated in 2026 with First Class Honours in BEng Software Engineering from the University of Westminster, where my final year research centered on automated machine learning for natural language processing models. Prior to my current role, I spent a year as a Customer Success Engineer Intern on the Identity and Access Management team at WSO2.
            </p>
          </div>
        </div>
      </section>

      <section id="latest-posts" className="bg-[#f4f1ee]">
        <div className="px-6 pb-16 pt-8 sm:px-8 lg:px-10 lg:pb-20 lg:pt-10">
          <div className="mx-auto max-w-[1200px] border-b border-[#d2c8c1] pb-6 text-left">
            <h3 className="text-[clamp(1.6rem,2.6vw,2.6rem)] font-medium leading-[1.08] tracking-[-0.05em] text-[#1d2328]">
              Thoughts on life and technology.
            </h3>
          </div>

          <div className="mx-auto mt-8 max-w-[1200px] divide-y divide-[#d2c8c1] text-left">
            <article className="flex flex-col py-8 text-left">
              <time className="text-sm uppercase tracking-[0.18em] text-[#6d6c69]">
                May 20, 2024
              </time>

              <h3 className="mt-2 text-[clamp(1.4rem,2.2vw,2rem)] font-medium leading-[1.1] tracking-[-0.05em] text-[#1d2328]">
                Building in Public
              </h3>
              <p className="mt-1.5 max-w-[760px] text-[0.95rem] leading-[1.5] text-[#4b4d52]">
                Why I write in public and what I&apos;ve learned so far.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
