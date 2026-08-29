"use client";

import { useMemo, useRef } from "react";
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import * as THREE from "three";
import Boat, { setClipSign } from "./sea/Boat";
import SeaBackdrop from "./sea/SeaBackdrop";
import { BOAT_DIST, CAM_HEIGHT, PITCH, FOV_Y, BOAT_OFFSET_X } from "./sea/camera";

/**
 * A photographic scene rebuilt in WebGL: sky, sea, boat and reflection are all
 * generated at runtime. Nothing is fetched - no textures, no HDRI, no image of
 * the original. The only thing carried over from the photo is measurement:
 * a colour scanline (see sea/palette.ts) and a set of proportions.
 */

const FBO_OPTS = { samples: 4 } as const;

/** Distant stakes at the far left of the original, ~340m out. */
function Stakes() {
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#2b2b2c", toneMapped: false, side: THREE.DoubleSide }),
    [],
  );
  const posts = useMemo(
    () => [
      [-96, 0.9, -282], [-92.5, 0.75, -279], [-99, 0.62, -286],
      [-88, 0.5, -276], [-103, 0.8, -290],
    ] as const,
    [],
  );
  return (
    <group>
      {posts.map(([x, hgt, z], i) => (
        <mesh key={i} material={mat} position={[x, hgt / 2, z]}>
          <boxGeometry args={[0.34, hgt, 0.34]} />
        </mesh>
      ))}
    </group>
  );
}

function Scene({
  waveAmp,
  frozenTime,
  parallax,
}: {
  waveAmp: number;
  frozenTime?: number;
  parallax: number;
}) {
  const { size, viewport } = useThree();

  // Everything that must appear BOTH mirrored in the water and upright above
  // it lives in its own scene, so it can be drawn twice per frame.
  const boatScene = useMemo(() => new THREE.Scene(), []);
  const boatGroup = useRef<THREE.Group>(null);

  const dpr = Math.min(viewport.dpr, 2);
  const fw = Math.max(2, Math.floor(size.width * dpr));
  const fh = Math.max(2, Math.floor(size.height * dpr));
  // MSAA here rather than on the canvas: the antenna is a couple of pixels
  // wide at 56m, and it is composited from these targets rather than drawn to
  // the screen directly.
  //
  // Note: do NOT pass depthBuffer here. drei reads that flag as "attach a depth
  // TEXTURE", and a depth texture on a multisampled target is invalid - it
  // leaves the framebuffer incomplete and nothing draws at all. The plain depth
  // renderbuffer this needs is already WebGLRenderTarget's default.
  const fboRefl = useFBO(fw, fh, FBO_OPTS);
  const fboBoat = useFBO(fw, fh, FBO_OPTS);

  const home = useMemo(
    () => new THREE.Vector3(-BOAT_OFFSET_X, CAM_HEIGHT, BOAT_DIST),
    [],
  );

  useFrame((state) => {
    // Renderer/scene/camera come off the frame state rather than being closed
    // over from render scope, since this callback mutates renderer state.
    const { gl, scene, camera } = state;
    const cam = camera as THREE.PerspectiveCamera;

    // Translate only: gentle natural ocean drift sway without mouse dragging
    const t = state.clock.elapsedTime;
    cam.position.set(
      home.x + Math.sin(t * 0.11) * 0.10,
      home.y + Math.sin(t * 0.17) * 0.045,
      home.z,
    );
    cam.rotation.set(-PITCH, 0, 0, "YXZ");
    cam.updateMatrixWorld();

    const g = boatGroup.current;
    if (!g) return;

    // Gentle mooring motion: the boat is tethered, so it rolls and nods but
    // barely translates.
    const bob = frozenTime !== undefined ? frozenTime : t;
    g.position.y = Math.sin(bob * 0.62) * 0.055;
    g.rotation.z = Math.sin(bob * 0.48 + 1.1) * 0.017;
    g.rotation.x = Math.sin(bob * 0.71) * 0.010;

    const prevTarget = gl.getRenderTarget();
    gl.setClearColor(0x000000, 0);

    // --- pass 1: the boat mirrored through the water plane ------------------
    // Reflecting the GEOMETRY about y=0 while keeping the real camera is
    // equivalent to reflecting the camera, and leaves the target aligned 1:1
    // with the screen - so the water shader can sample it by screen UV.
    g.scale.y = -1;
    setClipSign(g, -1);
    gl.setRenderTarget(fboRefl);
    gl.clear(true, true, false);
    gl.render(boatScene, cam);

    // --- pass 2: the boat upright, clipped at the waterline ------------------
    g.scale.y = 1;
    setClipSign(g, 1);
    gl.setRenderTarget(fboBoat);
    gl.clear(true, true, false);
    gl.render(boatScene, cam);

    // --- pass 3: composite sky, sea, reflection and boat in one shot ---------
    // A single draw to the screen means exactly one linear -> sRGB conversion,
    // and lets the lens vignette fall across everything uniformly.
    gl.setRenderTarget(prevTarget);
    gl.render(scene, cam);
  }, 1);

  return (
    <>
      <SeaBackdrop
        reflection={fboRefl.texture}
        boat={fboBoat.texture}
        waveAmp={waveAmp}
        frozenTime={frozenTime}
      />
      {createPortal(
        <group ref={boatGroup} rotation={[0, -0.1, 0]}>
          <Boat />
          <Stakes />
        </group>,
        boatScene,
      )}
    </>
  );
}

export default function BoatSunsetCanvas({
  waveAmp = 1,
  frozenTime,
  parallax = 0.55,
  className,
}: {
  waveAmp?: number;
  /** Pin the clock for reproducible screenshots. */
  frozenTime?: number;
  parallax?: number;
  className?: string;
}) {
  return (
    <Canvas
      className={className}
      flat // no tone mapping: the palette is already graded, by the photograph
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      camera={{
        fov: (FOV_Y * 180) / Math.PI,
        near: 0.5,
        far: 2000,
        position: [-BOAT_OFFSET_X, CAM_HEIGHT, BOAT_DIST],
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <Scene waveAmp={waveAmp} frozenTime={frozenTime} parallax={parallax} />
    </Canvas>
  );
}
