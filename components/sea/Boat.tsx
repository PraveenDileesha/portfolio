"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { BOAT_LENGTH } from "./camera";

/**
 * Proportions based on the source photograph.
 * Hull length is 330px in 1200x800 copy: 1px = BOAT_LENGTH / 330 m.
 */
const PX = BOAT_LENGTH / 330;
const L = BOAT_LENGTH;
const HALF = L / 2;

const FREEBOARD = 52 * PX;   // deck edge above water, amidships  ~1.42m
const STERN_TOP = 58 * PX;   // stern height                      ~1.58m
const PROW_TOP = 84 * PX;    // stem head at the bow              ~2.29m
const CABIN_TOP = 94 * PX;   // wheelhouse roof                   ~2.56m
const RACK_TOP = 110 * PX;   // top canopy                        ~3.00m
const MAST_TIP = 205 * PX;   // antenna tip                       ~5.59m
const BEAM_HALF = 1.15;

const CABIN_X0 = -HALF + 72 * PX;
const CABIN_X1 = -HALF + 196 * PX;
// Inset symmetrically from the cabin footprint so the rack sits centred on
// the roof instead of overhanging one end and falling short of the other.
const RACK_X0 = CABIN_X0 + 4 * PX;
const RACK_X1 = CABIN_X1 - 4 * PX;
const MAST_X = -HALF + 168 * PX;

/** Interpolate a table of [t, value] control points. */
function curve(table: [number, number][], t: number): number {
  for (let i = 0; i < table.length - 1; i++) {
    const [t0, v0] = table[i]!;
    const [t1, v1] = table[i + 1]!;
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * (k * k * (3 - 2 * k));
    }
  }
  return table[table.length - 1]![1];
}

/** Smooth sheer line dipping amidships and rising gracefully to the bow. */
const SHEER: [number, number][] = [
  [0.0, STERN_TOP],
  [0.18, FREEBOARD * 1.02],
  [0.45, FREEBOARD * 0.98],
  [0.72, FREEBOARD * 1.06],
  [0.88, FREEBOARD * 1.24],
  [1.0, PROW_TOP],
];
const sheerAt = (t: number) => curve(SHEER, t);

function smooth01(a: number, b: number, x: number): number {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

/** Hull beam: wide amidships, gently tapering to stem and transom. */
function halfBeamAt(t: number): number {
  const fullness = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.88)), 0.60);
  const bowTaper = 1 - smooth01(0.70, 1.0, t) * 0.98;
  const sternTaper = 1 - smooth01(0.12, 0.0, t) * 0.50;
  return BEAM_HALF * fullness * bowTaper * sternTaper;
}

/** Keel profile: submerged amidships, rising to waterline near ends. */
const KEEL: [number, number][] = [
  [0.0, 0.45],
  [0.15, 0.02],
  [0.40, -0.62],
  [0.65, -0.64],
  [0.82, -0.25],
  [0.92, 0.05],
  [1.0, 0.55],
];
const keelAt = (t: number) => curve(KEEL, t);

/**
 * Lofted boat hull:
 * - Gracefully raked curved stem forward
 * - Smooth carvel/lapstrake cross sections
 */
function buildHull(): THREE.BufferGeometry {
  const NU = 96, NV = 32;
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i < NU; i++) {
    const t = i / (NU - 1);
    const sheer = sheerAt(t);
    const keel = keelAt(t);
    const hb = halfBeamAt(t);

    // Forward rake at the bow stem
    const bowRake = Math.pow(Math.max(0, (t - 0.72) / 0.28), 1.8) * 0.38;
    const xBase = -HALF + t * L;

    for (let j = 0; j < NV; j++) {
      const s = j / (NV - 1);
      const v = 1 - Math.abs(2 * s - 1); // 0 at sheer, 1 at keel
      const side = s < 0.5 ? 1 : -1;
      
      const z = side * hb * Math.pow(Math.max(0, 1 - Math.pow(v, 1.8)), 0.55);
      const y = sheer + (keel - sheer) * v;
      // Rake is strongest at the upper sheer of the bow
      const x = xBase + bowRake * (1.0 - v * 0.65);

      pos.push(x, y, z);
      uvs.push(t, v);
    }
  }

  for (let i = 0; i < NU - 1; i++) {
    for (let j = 0; j < NV - 1; j++) {
      const a = i * NV + j, b = a + NV;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Recessed wooden deck closing the top of the hull. */
function buildDeck(): THREE.BufferGeometry {
  const NU = 64;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < NU; i++) {
    const t = i / (NU - 1);
    const bowRake = Math.pow(Math.max(0, (t - 0.72) / 0.28), 1.8) * 0.38;
    const x = -HALF + t * L + bowRake;
    const y = sheerAt(t) - 0.10;
    const hb = halfBeamAt(t) * 0.94;
    pos.push(x, y, hb, x, y, -hb);
  }
  for (let i = 0; i < NU - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Mooring line with catenary sag plunging naturally into the water (y=0). */
function buildRope(
  from: THREE.Vector3, to: THREE.Vector3, sag: number, r: number,
): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const p = from.clone().lerp(to, u);
    p.y -= Math.sin(Math.PI * u) * sag;
    pts.push(p);
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, r, 6, false);
}

// ---------------------------------------------------------------------------
// Shaders: Faded Light Blue & Weathered White with Realistic Shadows
// ---------------------------------------------------------------------------

const COMMON_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying float vWorldY;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldY = wp.y;
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

/**
 * Hull Shader:
 * - Upper Sheer Strake: Faded light marine blue
 * - Main Hull Body: Faded weathered white/cream with soft ambient shadow gradient
 * - Prow Stem Tip: Red/crimson accent
 * - Lapstrake planking with soft seam relief and rim light
 */
const HULL_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying float vWorldY;

  uniform float uClipSign;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    if (vWorldY * uClipSign < 0.0) discard;

    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 sunDir = normalize(vec3(-0.35, 0.22, -0.90));

    float u = vUv.x; // stern -> bow (0..1)
    float v = vUv.y; // sheer -> keel (0..1)

    // --- 1. Lapstrake Wooden Planking ---
    float plankCount = 14.0;
    float plankCoord = v * plankCount;
    float plankIdx = floor(plankCoord);
    float plankFrac = fract(plankCoord);

    // Dark seam between overlapping planks
    float seam = smoothstep(0.0, 0.07, plankFrac) * smoothstep(1.0, 0.93, plankFrac);
    float seamDark = mix(0.72, 1.0, seam);

    // Plank normal bevel (catches sunset rim light)
    vec3 plankN = n;
    plankN.y += (plankFrac - 0.5) * 0.16;
    plankN = normalize(plankN);

    // Subtle wood grain & matte paint stipple
    float grain = sin(u * 200.0 + sin(v * 70.0) * 3.5 + sin(u * 45.0) * 2.0) * 0.012;
    float paintNoise = (hash(vUv * vec2(400.0, 160.0)) - 0.5) * 0.015;
    float plankTone = (sin(plankIdx * 9.27 + 2.1) * 0.5 + 0.5) * 0.03 - 0.015;

    // --- 2. Color Layers from Description ---
    // Light blue border along upper sheer strake - matches the cabin's #33aed9
    vec3 colLightBlue = vec3(0.15, 0.50, 0.64);
    // Faded white base hull paint
    vec3 colWhite = vec3(0.75, 0.72, 0.67);
    // Dark twilight shadow tint coming across the left corner / stern
    vec3 colShadowTint = vec3(0.18, 0.16, 0.14);
    // Crimson bow peak accent
    vec3 colRed = vec3(0.62, 0.18, 0.13);
    // Dark rub rail trim
    vec3 colRub = vec3(0.15, 0.14, 0.13);

    // Zone masks
    float isRub = 1.0 - smoothstep(0.0, 0.030, v);
    float isBlue = 1.0 - smoothstep(0.15, 0.21, v);
    float isRed = smoothstep(0.92, 0.97, u) * (1.0 - smoothstep(0.0, 0.40, v));

    // Shadow tint coming from the left corner (stern u=0) and lower keel (v=1)
    float leftCornerShadow = (1.0 - smoothstep(0.12, 0.88, u)) * 0.72;
    float keelShadow = smoothstep(0.25, 0.88, v) * 0.60;
    float hullShadow = clamp(leftCornerShadow + keelShadow, 0.0, 0.82);
    vec3 whiteBase = mix(colWhite, colShadowTint, hullShadow);

    // Bow flare catches slightly more sky ambient
    whiteBase *= mix(0.92, 1.08, smoothstep(0.50, 0.95, u));

    vec3 baseCol = whiteBase;
    baseCol = mix(baseCol, colLightBlue, isBlue);
    baseCol = mix(baseCol, colRed, isRed);
    baseCol = mix(baseCol, colRub, isRub);

    baseCol = (baseCol + grain + paintNoise + plankTone) * seamDark;

    // --- 3. Lighting & Deep Silhouette Shadows ---
    // Sunset Backlight / Rim lighting on plank edges & sheer
    float rimDot = 1.0 - max(dot(plankN, viewDir), 0.0);
    float backDot = max(dot(-plankN, sunDir), 0.0);
    float rim = pow(rimDot, 2.8) * (0.15 + 0.85 * backDot);
    vec3 rimLight = vec3(1.0, 0.65, 0.30) * rim * 0.60;

    // Drastically drop ambient light to create a deep backlit silhouette, but keep enough for the light blue to read
    float skyDiff = max(plankN.y, 0.0);
    vec3 skyLight = vec3(0.24, 0.32, 0.40) * skyDiff * 0.20;
    float seaDiff = max(-plankN.y, 0.0);
    vec3 seaLight = vec3(0.35, 0.28, 0.18) * seaDiff * 0.15;
    vec3 ambLight = vec3(0.12, 0.14, 0.16);

    // Contact shadow at waterline
    float ao = smoothstep(-0.25, 0.30, vWorldY);
    ao = mix(0.40, 1.0, ao);

    vec3 finalCol = baseCol * (ambLight + skyLight + seaLight) * ao + rimLight;
    // The sheer strake must read as the exact same blue as the cabin walls,
    // but the hull's seam darkening, grain, sea-bounce light and waterline
    // shadow all shift its shade away from that. So for this band, light the
    // pure cabin-matching hue with the cabin shader's own recipe (ambient +
    // sky only, no seamDark/grain/seaLight/ao) instead of the hull's.
    vec3 cabinSkyLight = vec3(0.24, 0.32, 0.40) * skyDiff * 0.18;
    vec3 cabinMatchCol = colLightBlue * (ambLight + cabinSkyLight) + rimLight;
    finalCol = mix(finalCol, cabinMatchCol, isBlue);
    gl_FragColor = vec4(finalCol, 1.0);
  }
`;

/**
 * Cabin Shader:
 * - Faded light blue painted wooden paneling
 * - Cast shadow under roof overhang
 * - Wood panel seams and rim highlights
 */
const CABIN_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying float vWorldY;

  uniform vec3 uColor;
  uniform float uClipSign;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    if (vWorldY * uClipSign < 0.0) discard;

    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 sunDir = normalize(vec3(-0.35, 0.22, -0.90));

    // Vertical wooden board paneling along cabin walls
    float boardCoord = (vWorldPos.x - vWorldPos.z * 0.15) * 11.0;
    float boardFrac = fract(boardCoord);
    float boardSeam = smoothstep(0.0, 0.08, boardFrac) * smoothstep(1.0, 0.92, boardFrac);
    float seamDark = mix(0.78, 1.0, boardSeam);

    vec3 boardN = n;
    if (abs(n.x) > 0.3 || abs(n.z) > 0.3) {
      boardN.x += (boardFrac - 0.5) * 0.12;
      boardN = normalize(boardN);
    }

    float paintNoise = (hash(vWorldPos.xy * 25.0) - 0.5) * 0.015;
    vec3 baseCol = (uColor + paintNoise) * seamDark;

    // Cast shadow under the roof overhang onto the upper cabin wall
    float roofShadow = smoothstep(0.0, 0.22, 2.56 - vWorldY);
    roofShadow = mix(0.30, 1.0, roofShadow);

    // Sunset rim lighting on corners and roof edge
    float rimDot = 1.0 - max(dot(boardN, viewDir), 0.0);
    float backDot = max(dot(-boardN, sunDir), 0.0);
    float rim = pow(rimDot, 2.8) * (0.15 + 0.85 * backDot);
    vec3 rimLight = vec3(1.0, 0.65, 0.30) * rim * 0.60;

    // Deep silhouette ambient lighting
    float skyDiff = max(boardN.y, 0.0);
    vec3 skyLight = vec3(0.24, 0.32, 0.40) * skyDiff * 0.18;
    vec3 ambLight = vec3(0.12, 0.14, 0.16);

    vec3 finalCol = baseCol * (ambLight + skyLight) * roofShadow + rimLight;
    gl_FragColor = vec4(finalCol, 1.0);
  }
`;

/** Window opening shader: radiant golden sunset sky shining through */
const WINDOW_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vWorldY;
  uniform float uClipSign;

  void main() {
    if (vWorldY * uClipSign < 0.0) discard;
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 sunDir = normalize(vec3(-0.35, 0.22, -0.90));

    // Warm golden-amber sunset light shining through the open cabin windows
    vec3 sunsetGlow = vec3(0.94, 0.65, 0.25);
    float spec = pow(max(dot(reflect(-sunDir, n), viewDir), 0.0), 6.0);
    vec3 col = mix(sunsetGlow * 0.90, vec3(1.0, 0.86, 0.50), spec * 0.50);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function useBoatMaterial(fragShader: string, uniforms: Record<string, { value: unknown }> = {}) {
  return useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: COMMON_VERT,
      fragmentShader: fragShader,
      uniforms: {
        uClipSign: { value: 1 },
        ...uniforms,
      },
      side: THREE.DoubleSide,
      toneMapped: false,
    });
  }, [fragShader, uniforms]);
}

/** Flip every boat material between upright and mirrored reflection passes. */
export function setClipSign(root: THREE.Object3D, sign: number) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
    if (m && m.uniforms && m.uniforms.uClipSign) m.uniforms.uClipSign.value = sign;
  });
}

export default function Boat() {
  const hull = useMemo(() => buildHull(), []);
  const deck = useMemo(() => buildDeck(), []);

  // Faded Light Blue & Weathered White Materials matching photo
  const hullMat = useBoatMaterial(HULL_FRAG);
  // Light blue inner cockpit / deck
  const deckMat = useBoatMaterial(CABIN_FRAG, { uColor: { value: new THREE.Color("#258eb5") } });
  // Light marine blue chamber (cabin with windows)
  const cabinBlueMat = useBoatMaterial(CABIN_FRAG, { uColor: { value: new THREE.Color("#2680a3") } });
  // Red borders on the roof and gunwale (more vivid red)
  const roofTrimMat = useBoatMaterial(CABIN_FRAG, { uColor: { value: new THREE.Color("#cc1e10") } });
  // Sun-faded roof canopy top
  const roofTopMat = useBoatMaterial(CABIN_FRAG, { uColor: { value: new THREE.Color("#a8a294") } });
  // Weathered light wooden posts on rack
  const woodPostsMat = useBoatMaterial(CABIN_FRAG, { uColor: { value: new THREE.Color("#b4ae9e") } });
  // Dark cast iron exhaust & mast
  const darkMetalMat = useBoatMaterial(CABIN_FRAG, { uColor: { value: new THREE.Color("#1e1c1a") } });
  // Red flag on mast
  const flagMat = useBoatMaterial(CABIN_FRAG, { uColor: { value: new THREE.Color("#8a261a") } });
  // Glowing windows
  const windowMat = useBoatMaterial(WINDOW_FRAG);

  // 3 Mooring ropes from the bow plunging gracefully into the water
  const ropes = useMemo(
    () => [
      buildRope(new THREE.Vector3(HALF + 0.35, PROW_TOP - 0.22, 0.04), new THREE.Vector3(HALF + 5.2, -0.05, 0.6), 0.25, 0.016),
      buildRope(new THREE.Vector3(HALF + 0.32, PROW_TOP - 0.38, 0.08), new THREE.Vector3(HALF + 3.8, -0.05, 0.4), 0.48, 0.016),
      buildRope(new THREE.Vector3(HALF + 0.28, PROW_TOP - 0.52, -0.04), new THREE.Vector3(HALF + 2.5, -0.05, 0.2), 0.65, 0.016),
    ],
    [],
  );

  const cabinLen = CABIN_X1 - CABIN_X0;
  const cabinMid = (CABIN_X0 + CABIN_X1) / 2;
  const cabinH = CABIN_TOP - FREEBOARD;
  const rackLen = RACK_X1 - RACK_X0;
  const rackMid = (RACK_X0 + RACK_X1) / 2;

  // Window band (7 square panes along wheelhouse side)
  const windowPanes = useMemo(() => {
    const panes: number[] = [];
    const n = 7;
    for (let i = 0; i < n; i++) panes.push(CABIN_X0 + cabinLen * ((i + 0.62) / (n + 0.25)));
    return panes;
  }, [cabinLen]);
  const winSize = cabinH * 0.34;

  return (
    <group>
      {/* 1. Main Hull & Deck */}
      <mesh geometry={hull} material={hullMat} />
      <mesh geometry={deck} material={deckMat} />

      {/* 2. Wheelhouse Structure in Faded Light Blue */}
      {/* Lower cabin base */}
      <mesh material={cabinBlueMat} position={[cabinMid, FREEBOARD + cabinH * 0.25, 0]}>
        <boxGeometry args={[cabinLen, cabinH * 0.50, BEAM_HALF * 1.38]} />
      </mesh>
      {/* Upper cabin header */}
      <mesh material={cabinBlueMat} position={[cabinMid, FREEBOARD + cabinH * 0.88, 0]}>
        <boxGeometry args={[cabinLen, cabinH * 0.24, BEAM_HALF * 1.38]} />
      </mesh>
      {/* Bulkhead corners */}
      <mesh material={cabinBlueMat} position={[CABIN_X0 + 0.08, FREEBOARD + cabinH * 0.58, 0]}>
        <boxGeometry args={[0.16, cabinH * 0.55, BEAM_HALF * 1.36]} />
      </mesh>
      <mesh material={cabinBlueMat} position={[CABIN_X1 - 0.08, FREEBOARD + cabinH * 0.58, 0]}>
        <boxGeometry args={[0.16, cabinH * 0.55, BEAM_HALF * 1.36]} />
      </mesh>

      {/* Side window cutouts glowing with sunset light */}
      {windowPanes.map((x, i) =>
        ([1, -1] as const).map((s) => (
          <group key={`win:${i}:${s}`}>
            <mesh
              material={windowMat}
              position={[x, FREEBOARD + cabinH * 0.59, s * (BEAM_HALF * 0.692)]}
              rotation={[0, s > 0 ? 0 : Math.PI, 0]}
            >
              <planeGeometry args={[winSize, winSize]} />
            </mesh>
            {/* Mullion post between windows - sits clear of the window edge so it doesn't bite into the pane */}
            <mesh
              material={cabinBlueMat}
              position={[x + winSize / 2 + 0.04, FREEBOARD + cabinH * 0.59, s * (BEAM_HALF * 0.694)]}
            >
              <boxGeometry args={[0.08, winSize, 0.02]} />
            </mesh>
          </group>
        )),
      )}

      {/* Front Windshield Windows */}
      {([-0.36, 0.0, 0.36] as const).map((zOffset, i) => (
        <mesh
          key={`fwin:${i}`}
          material={windowMat}
          position={[CABIN_X1 + 0.01, FREEBOARD + cabinH * 0.61, zOffset * BEAM_HALF]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <planeGeometry args={[BEAM_HALF * 0.30, cabinH * 0.36]} />
        </mesh>
      ))}

      {/* 3. Cabin Roof with Red Trim Overhang */}
      <mesh material={roofTrimMat} position={[cabinMid, CABIN_TOP + 0.02, 0]}>
        <boxGeometry args={[cabinLen * 1.06, 0.05, BEAM_HALF * 1.52]} />
      </mesh>
      <mesh material={roofTopMat} position={[cabinMid, CABIN_TOP + 0.05, 0]}>
        <boxGeometry args={[cabinLen * 1.04, 0.03, BEAM_HALF * 1.48]} />
      </mesh>

      {/* 4. Upper Roof Rack: Light wood posts, 2 horizontal rails & canopy */}
      {([1, -1] as const).map((s) =>
        [RACK_X0 + 0.1, rackMid - 0.5, rackMid + 0.5, RACK_X1 - 0.1].map((x, i) => (
          <mesh key={`post${s}${i}`} material={woodPostsMat} position={[x, (CABIN_TOP + RACK_TOP) / 2, s * BEAM_HALF * 0.66]}>
            <boxGeometry args={[0.06, RACK_TOP - CABIN_TOP, 0.06]} />
          </mesh>
        )),
      )}
      {/* 2 horizontal side rails */}
      {([1, -1] as const).map((s) =>
        [RACK_TOP, CABIN_TOP + (RACK_TOP - CABIN_TOP) * 0.52].map((y, i) => (
          <mesh key={`rail${s}${i}`} material={woodPostsMat} position={[rackMid, y, s * BEAM_HALF * 0.66]}>
            <boxGeometry args={[rackLen, 0.04, 0.04]} />
          </mesh>
        )),
      )}
      {/* Canopy top cover */}
      <mesh material={roofTopMat} position={[rackMid, RACK_TOP + 0.03, 0]}>
        <boxGeometry args={[rackLen * 1.05, 0.04, BEAM_HALF * 1.40]} />
      </mesh>

      {/* 5. Curved Exhaust Pipe behind wheelhouse */}
      <mesh material={darkMetalMat} position={[CABIN_X0 + 0.35, CABIN_TOP + 0.32, 0.12]}>
        <cylinderGeometry args={[0.032, 0.032, 0.70, 8]} />
      </mesh>
      <mesh material={darkMetalMat} position={[CABIN_X0 + 0.44, CABIN_TOP + 0.64, 0.12]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.030, 0.032, 0.22, 8]} />
      </mesh>

      {/* 6. Mast (pole only, no flag) */}
      <mesh material={darkMetalMat} position={[MAST_X, (RACK_TOP + MAST_TIP) / 2, 0.06]}>
        <cylinderGeometry args={[0.012, 0.024, MAST_TIP - RACK_TOP, 6]} />
      </mesh>
      <mesh material={darkMetalMat} position={[MAST_X, MAST_TIP - 0.25, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.50, 6]} />
      </mesh>

      {/* Derrick post on stern deck */}
      <mesh material={darkMetalMat} position={[CABIN_X1 + 0.45, FREEBOARD + 0.40, -0.1]}>
        <cylinderGeometry args={[0.032, 0.040, 0.85, 6]} />
      </mesh>

      {/* 7. Mooring ropes */}
      {ropes.map((g, i) => (
        <mesh key={i} geometry={g} material={darkMetalMat} />
      ))}
    </group>
  );
}
