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
    <main className="relative h-screen w-screen overflow-hidden bg-[#090d16]">
      <BoatSunsetCanvas
        className="!absolute inset-0"
        frozenTime={opts.t}
        waveAmp={opts.wave}
      />
      <h1 className="hero-name pointer-events-none absolute inset-x-0 top-[6%] px-4 text-left font-display sm:px-8">
        Praveen Dileesha
      </h1>
    </main>
  );
}
