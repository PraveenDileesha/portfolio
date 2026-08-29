"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const BoatSunsetCanvas = dynamic(() => import("@/components/BoatSunsetCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#090d16]" />,
});

export default function SeaPage() {
  // ?t=<seconds> pins the clock and disables parallax so a screenshot of this
  // page is reproducible; ?wave=<n> scales the ripples. Development aids only -
  // without them the scene just runs. Read in a lazy initialiser rather than an
  // effect: the canvas is ssr:false, so there is no server render to mismatch.
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
    </main>
  );
}
