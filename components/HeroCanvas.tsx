"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, Float } from "@react-three/drei";
import * as THREE from "three";

/**
 * Every visual in this scene is generated at runtime from geometric
 * primitives and GLSL. Nothing is fetched: no textures, no HDR envmaps,
 * no video. That keeps `connect-src 'self'` in the CSP honest and means
 * the hero cannot be used as a vector for third-party asset loading.
 *
 * Memory safety: all geometries and materials are declared as JSX, so
 * react-three-fiber's reconciler owns their lifecycle and calls
 * .dispose() on unmount. We additionally force-release the WebGL context
 * in <ContextGuard /> so a route change cannot strand a live context.
 */

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */

const SCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Procedural "code editor" screen. Rows of syntax-coloured token bars
 * scroll upward; a caret blinks on the active line. No text rendering,
 * no font loading — it is all step functions over a hash.
 */
const SCREEN_FRAG = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform float uSeed;
  uniform vec3  uTint;

  float hash(float n) { return fract(sin(n * 43758.5453123) * 43758.5453123); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 uv = vUv;

    // Gutter on the left, like a line-number column.
    float gutter = 0.075;

    float rows   = 30.0;
    float scroll = uTime * 1.35;
    float y      = (1.0 - uv.y) * rows + scroll;
    float row    = floor(y);
    float rowF   = fract(y);

    // Vertical extent of the glyph band inside each row cell.
    float band = step(0.18, rowF) * step(rowF, 0.74);

    float r = hash(row + uSeed);

    // Indentation in tab stops, so the code has believable structure.
    float indent = floor(r * 3.0) * 0.075;
    float start  = gutter + 0.03 + indent;

    // Blank line every so often, for rhythm.
    float blank = step(hash(row * 1.7 + uSeed), 0.14);

    float lineLen = 0.16 + hash(row * 2.3 + uSeed) * 0.62;
    float endX    = min(start + lineLen, 0.965);

    vec3 col = vec3(0.0);

    // --- token bars -------------------------------------------------
    float inLine = step(start, uv.x) * step(uv.x, endX) * band * (1.0 - blank);

    // Split the line into tokens with small gaps, each token a different
    // "syntax" colour.
    float tokW  = 0.055;
    float tok   = floor((uv.x - start) / tokW);
    float tokF  = fract((uv.x - start) / tokW);
    float gap   = step(0.82, tokF);           // whitespace between tokens
    float th    = hash2(vec2(row, tok) + uSeed);

    vec3 kw     = vec3(0.78, 0.42, 1.00);     // keyword  — violet
    vec3 fn     = vec3(0.22, 0.96, 1.00);     // function — cyan
    vec3 str    = vec3(0.37, 0.93, 0.83);     // string   — mint
    vec3 plain  = vec3(0.62, 0.70, 0.86);     // ident    — grey-blue

    vec3 tokCol = plain;
    tokCol = mix(tokCol, str, step(0.55, th));
    tokCol = mix(tokCol, fn,  step(0.74, th));
    tokCol = mix(tokCol, kw,  step(0.90, th));

    // First token of a line reads as a keyword more often.
    tokCol = mix(tokCol, kw, step(tok, 0.5) * step(0.45, th));

    col += tokCol * inLine * (1.0 - gap);

    // --- line numbers in the gutter --------------------------------
    float gNum = step(0.022, uv.x) * step(uv.x, gutter - 0.012) * band;
    col += vec3(0.20, 0.26, 0.38) * gNum;

    // --- blinking caret --------------------------------------------
    float activeRow = floor(scroll + rows * 0.42);
    float onActive  = step(abs(row - activeRow), 0.5);
    float caretX    = step(endX + 0.006, uv.x) * step(uv.x, endX + 0.020);
    float blink     = step(0.5, fract(uTime * 1.6));
    col += vec3(0.55, 1.0, 1.0) * caretX * band * onActive * blink;

    // --- current-line highlight ------------------------------------
    col += uTint * 0.045 * onActive * step(gutter, uv.x);

    // --- ambient screen wash, scanlines, vignette -------------------
    col += uTint * 0.030;
    col *= 0.86 + 0.14 * sin(uv.y * 620.0);

    float d   = distance(uv, vec2(0.5));
    col *= smoothstep(0.92, 0.28, d);

    // Subtle bloom-ish lift toward the centre.
    col += uTint * 0.05 * smoothstep(0.75, 0.0, d);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Infinite grid floor that fades out with distance. */
const FLOOR_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;

  float grid(vec2 p, float w) {
    vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
    float l = min(g.x, g.y);
    return 1.0 - min(l * w, 1.0);
  }

  void main() {
    vec2 p = (vUv - 0.5) * 42.0;
    float fine  = grid(p, 1.0) * 0.30;
    float coarse= grid(p * 0.2, 1.2) * 0.55;
    float d = distance(vUv, vec2(0.5));
    float fade = smoothstep(0.5, 0.06, d);

    // Slow pulse travelling outward from the desk.
    float pulse = 0.5 + 0.5 * sin(d * 26.0 - uTime * 1.6);

    vec3 col = mix(vec3(0.13, 0.55, 0.78), vec3(0.42, 0.28, 0.85), pulse);
    gl_FragColor = vec4(col * (fine + coarse) * fade, (fine + coarse) * fade);
  }
`;

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

function Screen({
  width,
  height,
  tint,
  seed,
}: {
  width: number;
  height: number;
  tint: THREE.Color;
  seed: number;
}) {
  const mat = useRef<THREE.ShaderMaterial>(null);

  // Uniform object is memoised so we never reallocate it per frame.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeed: { value: seed },
      uTint: { value: tint },
    }),
    [seed, tint],
  );

  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime!.value += dt;
  });

  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <shaderMaterial
        ref={mat}
        vertexShader={SCREEN_VERT}
        fragmentShader={SCREEN_FRAG}
        uniforms={uniforms}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Monitor                                                             */
/* ------------------------------------------------------------------ */

function Monitor({
  position,
  rotation,
  width = 2.1,
  height = 1.25,
  tint,
  seed,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  width?: number;
  height?: number;
  tint: THREE.Color;
  seed: number;
}) {
  const bezel = 0.055;

  return (
    <group position={position} rotation={rotation}>
      {/* Chassis */}
      <mesh castShadow position={[0, 0, -0.045]}>
        <boxGeometry args={[width + bezel * 2, height + bezel * 2, 0.09]} />
        <meshStandardMaterial
          color="#0b0f1a"
          roughness={0.42}
          metalness={0.75}
        />
      </mesh>

      {/* Emissive panel */}
      <group position={[0, 0, 0.002]}>
        <Screen width={width} height={height} tint={tint} seed={seed} />
      </group>

      {/* Light spill onto the desk in front of the panel */}
      <pointLight
        position={[0, 0, 0.6]}
        color={tint}
        intensity={2.6}
        distance={5.5}
        decay={2}
      />

      {/* Stand */}
      <mesh position={[0, -height / 2 - 0.28, -0.05]}>
        <cylinderGeometry args={[0.045, 0.055, 0.55, 16]} />
        <meshStandardMaterial color="#131a29" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0, -height / 2 - 0.55, 0.02]}>
        <cylinderGeometry args={[0.32, 0.34, 0.035, 28]} />
        <meshStandardMaterial color="#131a29" metalness={0.85} roughness={0.35} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Desk, peripherals, engineer                                         */
/* ------------------------------------------------------------------ */

function Keyboard() {
  // Deterministic key grid — no randomness, so SSR and client agree.
  const keys = useMemo(() => {
    const out: { pos: [number, number, number]; w: number }[] = [];
    const rows = 5;
    const cols = 15;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isSpace = r === 4 && c > 4 && c < 10;
        if (isSpace && c !== 5) continue;
        out.push({
          pos: [(c - (cols - 1) / 2) * 0.108, 0, (r - (rows - 1) / 2) * 0.108],
          w: isSpace ? 0.53 : 0.094,
        });
      }
    }
    return out;
  }, []);

  return (
    <group position={[0, 0.045, 1.02]} rotation={[-0.04, 0, 0]}>
      {/* Deck */}
      <mesh receiveShadow>
        <boxGeometry args={[1.78, 0.05, 0.62]} />
        <meshStandardMaterial color="#0c1120" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* Backlit keycaps */}
      {keys.map((k, i) => (
        <mesh key={i} position={[k.pos[0], 0.042, k.pos[2]]}>
          <boxGeometry args={[k.w, 0.022, 0.094]} />
          <meshStandardMaterial
            color="#0e1626"
            emissive="#38f5ff"
            emissiveIntensity={0.42}
            roughness={0.65}
          />
        </mesh>
      ))}
      {/* Underglow */}
      <pointLight
        position={[0, -0.08, 0]}
        color="#38f5ff"
        intensity={1.1}
        distance={1.9}
        decay={2}
      />
    </group>
  );
}

/** Low-poly engineer, seen from behind, lit only by monitor spill. */
function Engineer() {
  const head = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!head.current) return;
    const t = state.clock.elapsedTime;
    // Small idle motion: a slow look across the monitors plus breathing.
    head.current.rotation.y = Math.sin(t * 0.32) * 0.24;
    head.current.position.y = 0.99 + Math.sin(t * 1.1) * 0.006;
  });

  const skin = "#0a0e18";

  return (
    <group position={[0, 0, 2.05]}>
      {/* Torso */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.29, 0.5, 6, 18]} />
        <meshStandardMaterial color={skin} roughness={0.88} metalness={0.05} />
      </mesh>

      {/* Head */}
      <group ref={head} position={[0, 0.99, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.19, 26, 22]} />
          <meshStandardMaterial color={skin} roughness={0.9} />
        </mesh>
        {/* Headphone band + cups */}
        <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.03, 0]}>
          <torusGeometry args={[0.2, 0.018, 10, 28, Math.PI]} />
          <meshStandardMaterial color="#141c2e" metalness={0.7} roughness={0.4} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.195, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.062, 0.062, 0.05, 18]} />
            <meshStandardMaterial
              color="#141c2e"
              emissive="#8b5cf6"
              emissiveIntensity={0.5}
              roughness={0.5}
            />
          </mesh>
        ))}
      </group>

      {/* Arms reaching toward the keyboard */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * 0.33, 0.42, -0.42]}
          rotation={[-1.16, 0, s * 0.16]}
          castShadow
        >
          <capsuleGeometry args={[0.072, 0.62, 5, 14]} />
          <meshStandardMaterial color={skin} roughness={0.88} />
        </mesh>
      ))}

      {/* Chair back */}
      <mesh position={[0, 0.5, 0.42]} rotation={[0.14, 0, 0]}>
        <boxGeometry args={[0.86, 1.06, 0.09]} />
        <meshStandardMaterial color="#080b13" roughness={0.95} />
      </mesh>
    </group>
  );
}

function Desk() {
  return (
    <group>
      {/* Top */}
      <mesh position={[0, -0.03, 0.55]} receiveShadow castShadow>
        <boxGeometry args={[6.4, 0.09, 2.5]} />
        <meshStandardMaterial color="#0a0f1b" roughness={0.55} metalness={0.45} />
      </mesh>
      {/* Front edge light strip */}
      <mesh position={[0, -0.03, 1.79]}>
        <boxGeometry args={[6.4, 0.012, 0.012]} />
        <meshStandardMaterial
          color="#38f5ff"
          emissive="#38f5ff"
          emissiveIntensity={3.2}
          toneMapped={false}
        />
      </mesh>
      {/* Legs */}
      {([-2.9, 2.9] as const).map((x) =>
        ([-0.4, 1.5] as const).map((z) => (
          <mesh key={`${x}:${z}`} position={[x, -0.9, z]}>
            <boxGeometry args={[0.09, 1.7, 0.09]} />
            <meshStandardMaterial color="#080c15" metalness={0.8} roughness={0.4} />
          </mesh>
        )),
      )}
      {/* Desk mug, because every engineer has one */}
      <mesh position={[1.55, 0.13, 1.35]}>
        <cylinderGeometry args={[0.11, 0.09, 0.24, 20]} />
        <meshStandardMaterial color="#121a2c" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Floor() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime!.value += dt;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.78, 0]}>
      <planeGeometry args={[60, 60]} />
      <shaderMaterial
        ref={mat}
        vertexShader={SCREEN_VERT}
        fragmentShader={FLOOR_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Slow-drifting dust motes caught in the monitor light. */
function Motes({ count = 90 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const a = new Float32Array(count * 3);
    // Deterministic PRNG: identical output on server and client.
    let s = 1337;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      a[i * 3] = (rnd() - 0.5) * 12;
      a[i * 3 + 1] = rnd() * 5 - 1.4;
      a[i * 3 + 2] = (rnd() - 0.5) * 8;
    }
    return a;
  }, [count]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.018;
    ref.current.position.y = Math.sin(t * 0.22) * 0.12;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.028}
        color="#7fd8ff"
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/* Camera rig — smooth cursor tracking                                 */
/* ------------------------------------------------------------------ */

function CameraRig({ reduced }: { reduced: boolean }) {
  const { camera, pointer } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 0.55, 0), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const base = useMemo(() => new THREE.Vector3(0, 1.35, 6.5), []);

  useFrame((_, dt) => {
    if (reduced) {
      camera.position.lerp(base, 1 - Math.pow(0.001, dt));
      camera.lookAt(target);
      return;
    }

    // Frame-rate independent smoothing: the damping factor is the
    // fraction of remaining distance closed per second.
    const k = 1 - Math.pow(0.0016, dt);

    desired.set(
      base.x + pointer.x * 1.35,
      base.y + pointer.y * 0.62,
      base.z - Math.abs(pointer.x) * 0.35,
    );

    camera.position.lerp(desired, k);
    // Counter-rotate the look target slightly for a parallax feel.
    camera.lookAt(target.x - pointer.x * 0.28, target.y - pointer.y * 0.18, target.z);
  });

  return null;
}

/**
 * Releases the WebGL context deterministically on unmount. R3F disposes
 * scene objects for us, but browsers cap live contexts (~16), so an
 * SPA that mounts several canvases can silently lose the oldest one
 * unless the context is explicitly released.
 */
function ContextGuard() {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => e.preventDefault();
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.dispose();
      gl.forceContextLoss();
    };
  }, [gl]);

  return null;
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function Scene({ reduced }: { reduced: boolean }) {
  // Colours are created once; passing new THREE.Color per render would
  // invalidate the memoised uniform objects downstream every frame.
  const tints = useMemo(
    () => ({
      left: new THREE.Color("#7c4dff"),
      centre: new THREE.Color("#22d3ee"),
      right: new THREE.Color("#2dd4bf"),
    }),
    [],
  );

  return (
    <>
      <color attach="background" args={["#090d16"]} />
      <fog attach="fog" args={["#090d16", 8.5, 20]} />

      <ambientLight intensity={0.16} />
      {/* Cool rim from behind-left, warm kick from the right. */}
      <directionalLight position={[-6, 5, -4]} intensity={0.5} color="#5b8dff" />
      <directionalLight position={[6, 3, 3]} intensity={0.22} color="#ff7ad9" />

      <Float
        speed={reduced ? 0 : 1.1}
        rotationIntensity={reduced ? 0 : 0.12}
        floatIntensity={reduced ? 0 : 0.22}
        floatingRange={[-0.045, 0.045]}
      >
        <group position={[0, -0.15, 0]}>
          <Monitor
            position={[-2.42, 1.06, -0.35]}
            rotation={[0, 0.46, 0]}
            width={1.75}
            height={1.12}
            tint={tints.left}
            seed={11.3}
          />
          <Monitor
            position={[0, 1.24, -0.72]}
            rotation={[0, 0, 0]}
            width={2.55}
            height={1.45}
            tint={tints.centre}
            seed={2.7}
          />
          <Monitor
            position={[2.42, 1.06, -0.35]}
            rotation={[0, -0.46, 0]}
            width={1.75}
            height={1.12}
            tint={tints.right}
            seed={31.9}
          />

          <Desk />
          <Keyboard />
          <Engineer />
        </group>
      </Float>

      <Floor />
      <Motes />

      <CameraRig reduced={reduced} />
      <ContextGuard />
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Public component                                                    */
/* ------------------------------------------------------------------ */

/** Graceful degradation where WebGL is unavailable, blocked, or software-only. */
function detectWebGL(): boolean {
  if (typeof document === "undefined") return true;
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function HeroCanvas() {
  // Both are read lazily during the first render rather than set from an
  // effect, which would cause a second render pass. Safe here because this
  // component is loaded with `ssr: false`, so it never renders on the server.
  const [supported] = useState(detectWebGL);
  const [reduced, setReduced] = useState(prefersReducedMotion);

  // Only subscribes; the setState happens in the change callback.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!supported) {
    return (
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(56,245,255,0.14),transparent_62%)]"
      />
    );
  }

  return (
    <Canvas
      className="!absolute inset-0"
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.35, 6.5], fov: 42, near: 0.1, far: 60 }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Suspense fallback={null}>
        <Scene reduced={reduced} />
      </Suspense>
    </Canvas>
  );
}
