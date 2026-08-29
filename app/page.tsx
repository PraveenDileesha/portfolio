"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const BoatSunsetCanvas = dynamic(() => import("@/components/BoatSunsetCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#090d16]" />,
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
    <main className="min-h-screen bg-[#f4f1ee] text-[#1d2328]">
      <section className="relative h-[72vh] min-h-[560px] overflow-hidden bg-[#dfe8ec]">
        <BoatSunsetCanvas
          className="!absolute inset-0"
          frozenTime={opts.t}
          waveAmp={opts.wave}
        />

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08),_transparent_58%)]" />
      </section>

      <section id="latest-posts" className="-mt-1 bg-[#f4f1ee]">
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-2 sm:px-8 lg:px-10 lg:pb-20 lg:pt-3">
          <div className="border-b border-[#d2c8c1] pb-6">
            <h2 className="mb-3 text-[clamp(1.5rem,2.8vw,2.6rem)] font-medium leading-[1.08] tracking-[-0.05em] text-[#1d2328]">
              Who is Praveen Dileesha?
            </h2>

            <p className="max-w-4xl text-[0.96rem] leading-7 text-[#3a3f45] sm:text-[1.06rem]">
              I&apos;m a generalist builder who chooses to explore the given subject before figuring things out.
            </p>

            <p className="mt-4 max-w-5xl text-[0.96rem] leading-7 text-[#3a3f45] sm:text-[1.06rem]">
              Currently, I&apos;m a software engineering Intern at SimpleBooks, developing end-to-end while embedding AI where it matters. I just graduated in 2026 with First Class Honours in BEng Software Engineering from the University of Westminster, where my final year research centered on automated machine learning for natural language processing models. Prior to my current role, I spent a year as a Customer Success Engineer Intern on the Identity and Access Management team at WSO2.
            </p>

            <h3 className="mt-8 text-[clamp(1.4rem,2.4vw,2.4rem)] font-medium leading-[1.1] tracking-[-0.05em] text-[#1d2328]">
              Thoughts on life and technology.
            </h3>
          </div>

          <div className="mt-6 divide-y divide-[#d2c8c1]">
            <article className="grid gap-6 py-8 sm:grid-cols-[180px_1fr] sm:items-start">
              <time className="text-sm uppercase tracking-[0.12em] text-[#6d6c69]">
                May 20, 2024
              </time>

              <div>
                <h3 className="text-2xl font-medium tracking-[-0.04em] text-[#1d2328] sm:text-[2rem]">
                  Building in Public
                </h3>
                <p className="mt-3 max-w-2xl text-base leading-7 text-[#4b4d52]">
                  Why I write in public and what I&apos;ve learned so far.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
