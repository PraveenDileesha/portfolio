import * as THREE from "three";
import { SKY_SRGB, WATER_SRGB, HGAIN, GLITTER, GLITTER_AZ, GLITTER_DE } from "./palette";
import { FOV_Y, PITCH, E_TOP, HORIZON_FRAC } from "./camera";

const LUT_W = 256;
export const ROW_SKY = 1 / 6;
export const ROW_WATER = 3 / 6;
export const ROW_GAIN = 5 / 6;

/**
 * The sky LUT is indexed by ELEVATION, from the horizon up to SKY_MAX.
 *
 * SKY_MAX has to reach well past the top of the original frame. Water in the
 * foreground is seen at up to ~13 degrees of depression, and a tilted ripple
 * throws the reflected ray higher still - up to about 30 degrees. The photo
 * only records sky to 9 degrees, so without extending it every one of those
 * rays clamps to the same colour, the tilted and the flat reflection come out
 * identical, and the ripples cancel to a mirror finish. That is exactly what
 * happened before this was added.
 */
export const SKY_MAX = (34 * Math.PI) / 180;

const tanHalfV = Math.tan(FOV_Y / 2);
const REF_H = 800; // the working copy the scanlines were measured from
const HZ_ROW = HORIZON_FRAC * REF_H;

/** Elevation that measured sky sample `j` was taken at. */
function skyElevAt(j: number, n: number): number {
  const y = (j / (n - 1)) * (HZ_ROW - 2);
  return Math.atan((0.5 - y / REF_H) * 2 * tanHalfV) - PITCH;
}

const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

const lerp3 = (a: number[], b: number[], k: number) =>
  [0, 1, 2].map((c) => a[c]! * (1 - k) + b[c]! * k);

/**
 * Sky colour at an elevation. Inside the photographed range this interpolates
 * the measurement; above it, the gradient at the top of frame is continued and
 * damped exponentially toward a limit, so the sky keeps cooling into deeper
 * twilight blue instead of flat-lining.
 */
function skyAtElevation(e: number): number[] {
  const n = SKY_SRGB.length;
  if (e <= E_TOP) {
    // Elevation falls as j rises, so walk down from the top of frame.
    for (let j = 0; j < n - 1; j++) {
      const e0 = skyElevAt(j, n);
      const e1 = skyElevAt(j + 1, n);
      if (e <= e0 && e >= e1) return lerp3(SKY_SRGB[j]!, SKY_SRGB[j + 1]!, (e0 - e) / (e0 - e1));
    }
    return SKY_SRGB[n - 1]!;
  }
  const top = SKY_SRGB[0]!;
  const back = SKY_SRGB[3]!;
  const de = E_TOP - skyElevAt(3, n);
  const tau = 0.22;
  const k = tau * (1 - Math.exp(-(e - E_TOP) / tau));
  // Natural twilight roll-off toward zenith so high sky doesn't over-brighten or over-cool reflections
  const decay = Math.exp(-(e - E_TOP) / 0.50);
  return [0, 1, 2].map((c) => {
    const val = top[c]! + ((top[c]! - back[c]!) / de) * k;
    return Math.min(1, Math.max(0, val * (0.80 + 0.20 * decay)));
  });
}

function resample(stops: number[][], i: number): number[] {
  const t = (i / (LUT_W - 1)) * (stops.length - 1);
  const a = Math.floor(t);
  return lerp3(stops[a]!, stops[Math.min(stops.length - 1, a + 1)]!, t - a);
}

/**
 * One 256x3 float texture carrying every measured curve:
 *
 *   row 0  sky, indexed by elevation 0 .. SKY_MAX
 *   row 1  water, indexed by depression 0 .. D_BOTTOM
 *   row 2  horizontal vignette gain (in .r)
 *
 * Packing them together avoids indexing a uniform array in the fragment
 * shader, which GLSL ES 1.00 does not reliably allow, and gets interpolation
 * between stops for free.
 *
 * Colours are converted sRGB -> linear here. With tone mapping disabled and a
 * single linear -> sRGB encode at the end of the composite, the output matches
 * the source photo's numbers rather than a re-graded version of them.
 */
export function buildSeaLUT(): THREE.DataTexture {
  const data = new Float32Array(LUT_W * 3 * 4);

  for (let i = 0; i < LUT_W; i++) {
    const s = skyAtElevation((i / (LUT_W - 1)) * SKY_MAX);
    const w = resample(WATER_SRGB, i);
    const g = resample(HGAIN.map((v) => [v, v, v]), i);

    let o = i * 4;
    data[o] = toLinear(s[0]!); data[o + 1] = toLinear(s[1]!); data[o + 2] = toLinear(s[2]!); data[o + 3] = 1;

    o = (LUT_W + i) * 4;
    data[o] = toLinear(w[0]!); data[o + 1] = toLinear(w[1]!); data[o + 2] = toLinear(w[2]!); data[o + 3] = 1;

    // Gain is a multiplier, not a colour - it must NOT be sRGB-decoded.
    o = (LUT_W * 2 + i) * 4;
    data[o] = g[0]!; data[o + 1] = g[0]!; data[o + 2] = g[0]!; data[o + 3] = 1;
  }

  const tex = new THREE.DataTexture(data, LUT_W, 3, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace; // already linear
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Sun-glitter field as a small 2D texture, indexed by (azimuth, depression).
 * Kept separate from the 1D curves because it is genuinely two-dimensional:
 * the bright path narrows as it comes toward the viewer.
 */
export function buildGlitterTexture(): THREE.DataTexture {
  const data = new Float32Array(GLITTER_AZ * GLITTER_DE * 4);
  for (let d = 0; d < GLITTER_DE; d++)
    for (let a = 0; a < GLITTER_AZ; a++) {
      const v = GLITTER[d]![a]!;
      const o = (d * GLITTER_AZ + a) * 4;
      data[o] = v; data[o + 1] = v; data[o + 2] = v; data[o + 3] = 1;
    }
  const tex = new THREE.DataTexture(data, GLITTER_AZ, GLITTER_DE, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
