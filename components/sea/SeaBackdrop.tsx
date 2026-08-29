"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { buildSeaLUT, buildGlitterTexture, ROW_SKY, ROW_WATER, ROW_GAIN, SKY_MAX } from "./lut";
import { D_BOTTOM } from "./camera";

const VERT = /* glsl */ `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    // Fullscreen triangle-ish quad, pinned to the far plane.
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  varying vec2 vNdc;

  uniform vec3  uCamPos, uRight, uUp, uFwd;
  uniform float uTanHalfV, uAspect;
  uniform float uSkyMax, uDBottom, uMaxAz;
  uniform float uTime, uPixelAngle;
  uniform float uWaveAmp, uReflDistort, uReflStrength;
  uniform sampler2D uLUT, uRefl, uBoat, uGlitter;

  const float ROW_SKY   = ${ROW_SKY.toFixed(6)};
  const float ROW_WATER = ${ROW_WATER.toFixed(6)};
  const float ROW_GAIN  = ${ROW_GAIN.toFixed(6)};
  const float TAU = 6.2831853;
  const float G   = 9.81;

  // Wave spectrum, scaled to a physically sane roughness.
  //
  // Cox-Munk gives a mean square slope of about 0.003 + 0.00512*U for wind
  // speed U. The photographed evening is nearly windless, so this is tuned to
  // an RMS slope near 0.06 rad - about half a 1.5 m/s breeze. Running it at a
  // full 0.12 made the mid-field visibly teal: with that much tilt the ripples
  // reach far up into the cool part of the sky, which a glassy evening sea
  // does not do. These constants put the nine octaves at ~0.06 rad, with
  // slope rising slightly toward the short end (0.615/0.585 = 1.05 per octave)
  // so most of the roughness lives in the fine chop - which is what produces
  // sparkle up close and, once it filters away with distance, the soft glitter
  // path near the horizon.
  const float LAMBDA0 = 12.0;
  const float AMP0    = 0.043;
  const float LAMBDA_K = 0.585;
  const float AMP_K    = 0.615;

  vec3 skyColor2D(float e, vec3 dir) {
    float u = clamp(e, 0.0, uSkyMax) / uSkyMax;
    vec3 c = texture2D(uLUT, vec2(u, ROW_SKY)).rgb;
    
    // Soft atmospheric rose/violet haze band sitting directly on the horizon
    float hzHaze = exp(-max(e, 0.0) * 90.0) * 0.18;
    vec3 hazeCol = vec3(0.54, 0.33, 0.36);
    c = mix(c, hazeCol, hzHaze);

    // 2D Solar sunset glow: warm golden halo expanding around the sun bearing
    vec3 sunDir = normalize(vec3(0.20, 0.05, -0.98));
    float cosSun = max(dot(dir, sunDir), 0.0);
    float solarGlow = pow(cosSun, 3.8) * (1.0 - smoothstep(0.0, 0.35, e));
    float solarCore = pow(cosSun, 14.0) * (1.0 - smoothstep(0.0, 0.15, e));
    vec3 glowCol = vec3(1.0, 0.78, 0.38) * (solarGlow * 0.22 + solarCore * 0.35);
    c += glowCol;

    // Subtle horizontal atmospheric stratification / temperature inversion layers
    float strat = sin(e * 140.0 + sin(e * 380.0) * 0.6) * 0.010 * (1.0 - smoothstep(0.02, 0.25, e));
    c += vec3(0.02, 0.015, -0.005) * strat;

    // Rays angled below the horizon darken as distant water
    float below = clamp(-e / 0.10, 0.0, 1.0);
    return c * mix(1.0, 0.45, below);
  }

  vec3 skyColor(float e) {
    vec3 fwd = vec3(0.0, sin(e), -cos(e));
    return skyColor2D(e, fwd);
  }

  /**
   * Sky averaged over a cone of half-width sigma. Ripples too small to resolve
   * scatter the reflected ray over a range of elevations.
   */
  vec3 skyBlurred(float e, float sigma) {
    return skyColor(e) * 0.4026
         + (skyColor(e - sigma) + skyColor(e + sigma)) * 0.2442
         + (skyColor(e - 2.0 * sigma) + skyColor(e + 2.0 * sigma)) * 0.0545;
  }

  vec3 waterColor(float d) {
    return texture2D(uLUT, vec2(clamp(d / uDBottom, 0.0, 1.0), ROW_WATER)).rgb;
  }

  float hGain(float x) {
    return texture2D(uLUT, vec2(clamp(x, 0.0, 1.0), ROW_GAIN)).r;
  }

  /**
   * Ripple slope with organic sea chop, wave groups, and directional dispersion.
   */
  vec2 rippleSlope(vec2 p, float footprint, out float lostVar, out float totalVar) {
    vec2 grad = vec2(0.0);
    lostVar = 0.0;
    totalVar = 0.0;
    float lambda = LAMBDA0;
    float amp = AMP0 * uWaveAmp;
    float ang = 0.4;

    for (int i = 0; i < 9; i++) {
      float k = TAU / lambda;
      float lod = smoothstep(0.9 * footprint, 2.4 * footprint, lambda);
      float omega = uTime * sqrt(G * k);

      // Primary wave train
      vec2 d1 = vec2(cos(ang), sin(ang));
      float phase1 = dot(d1, p) * k + omega;
      // Cross-chop component with angular offset and dispersion
      vec2 d2 = vec2(cos(ang + 0.62), sin(ang + 0.62));
      float phase2 = dot(d2, p) * k * 1.11 - omega * 0.96 + 1.35;

      // Gerstner-like crest sharpening (steeper crests, flatter troughs)
      float sharp1 = cos(phase1 - 0.32 * sin(phase1));
      float sharp2 = cos(phase2 - 0.22 * sin(phase2));

      // Wave group modulation to break infinite planar crest lines
      float groupMod = 0.84 + 0.16 * cos(dot(vec2(cos(ang * 0.5), sin(ang * 0.5)), p) * (k * 0.14));

      float s1 = amp * k * 0.72;
      float s2 = amp * k * 0.46;
      grad += (d1 * (s1 * sharp1) + d2 * (s2 * sharp2)) * (lod * groupMod);

      // Variance tracking for LOD roughness
      float octVar = 0.5 * (s1 * s1 + s2 * s2);
      totalVar += octVar;
      lostVar  += octVar * (1.0 - lod * lod);

      lambda *= LAMBDA_K;
      amp    *= AMP_K;
      ang    += 2.399963;
    }
    return grad;
  }

  void main() {
    vec3 dir = normalize(
      uFwd + uRight * (vNdc.x * uTanHalfV * uAspect) + uUp * (vNdc.y * uTanHalfV)
    );

    vec2 uv = vNdc * 0.5 + 0.5;
    vec3 col;

    if (dir.y >= 0.0) {
      col = skyColor2D(asin(clamp(dir.y, -1.0, 1.0)), dir);
    } else {
      float sinD = -dir.y;
      float delta = asin(clamp(sinD, 0.0, 1.0));

      float t = uCamPos.y / sinD;
      vec2 p = (uCamPos + dir * t).xz;

      // Geometric mean footprint for area filtering
      float footprint = t * uPixelAngle / sqrt(max(sinD, 0.0015));

      float lostVar, totalVar;
      vec2 grad = rippleSlope(p, footprint, lostVar, totalVar);
      vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));

      float rough = sqrt(2.0 * lostVar);

      // Ripples shaded by sky elevation reflection
      vec3 r = reflect(dir, n);
      vec3 lit = skyBlurred(asin(clamp(r.y, -1.0, 1.0)), rough);
      vec3 flatSky = skyBlurred(delta, sqrt(2.0 * totalVar));
      vec3 ratio = clamp(lit / max(flatSky, vec3(1e-4)), vec3(0.35), vec3(2.5));

      // Sun glitter wedge
      float azNorm = clamp(atan(dir.x, -dir.z) / uMaxAz * 0.5 + 0.5, 0.0, 1.0);
      float glit = texture2D(uGlitter, vec2(azNorm, clamp(delta / uDBottom, 0.0, 1.0))).r;

      // Physical Fresnel scaling
      float fresnel = 0.05 + 0.95 * pow(1.0 - sinD, 5.0);
      vec3 waterBase = waterColor(delta);
      vec3 modRatio = mix(vec3(1.0), ratio, clamp(fresnel * 1.35, 0.40, 1.0));

      col = waterBase * modRatio * glit;

      // Subtle specular sun glints on ripple crests
      vec3 sunDir = normalize(vec3(0.18, 0.06, -0.98));
      float spec = pow(max(dot(r, sunDir), 0.0), 38.0);
      vec3 sunGlint = vec3(1.0, 0.88, 0.62) * spec * glit * 0.32;
      col += sunGlint;




      // --- boat reflection -------------------------------------------------
      // Asymmetric downward elongation with wave shard fragmentation
      vec2 off = vec2(grad.x / uAspect * 0.9, grad.y) * (uReflDistort / uTanHalfV);

      vec4 sumAcc = vec4(0.0);
      vec4 maxAcc = vec4(0.0);
      float totalWeight = 0.0;

      for (int j = 0; j < 7; j++) {
        float fj = float(j);
        float st = (fj - 2.0) * 0.38;
        vec2 suv = uv + off * (1.0 + st) + vec2(0.0, -0.016 * (uReflDistort / 0.05) * max(st, 0.0));
        vec4 samp = texture2D(uRefl, clamp(suv, vec2(0.001), vec2(0.999)));

        float w = exp(-0.42 * st * st);
        sumAcc += samp * w;
        totalWeight += w;
        if (samp.a > maxAcc.a) maxAcc = samp;
      }

      vec4 avgAcc = sumAcc / totalWeight;
      vec4 acc = mix(avgAcc, maxAcc, 0.50);

      float breakup = 1.0 - clamp(length(grad) * 1.5, 0.0, 0.35);
      float k = clamp(uReflStrength * breakup, 0.0, 1.0);
      col = col * (1.0 - acc.a * k) + acc.rgb * k;
    }

    // The boat itself, over sky and sea alike
    vec4 boat = texture2D(uBoat, uv);
    col = col * (1.0 - boat.a) + boat.rgb;

    // Horizontal vignette from lens
    col *= hGain(uv.x);

    // Subtle 35mm radial corner vignette falloff
    vec2 ndcAspect = vNdc * vec2(uAspect * 0.58, 0.72);
    float radialVignette = clamp(1.0 - 0.18 * dot(ndcAspect, ndcAspect), 0.75, 1.0);
    col *= radialVignette;

    // Subtle analog film grain for photographic texture
    float filmGrain = (fract(sin(dot(gl_FragCoord.xy + uTime * 6.78, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.012;
    col += filmGrain;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

type SeaUniforms = {
  uCamPos: { value: THREE.Vector3 };
  uRight: { value: THREE.Vector3 };
  uUp: { value: THREE.Vector3 };
  uFwd: { value: THREE.Vector3 };
  uTanHalfV: { value: number };
  uAspect: { value: number };
  uSkyMax: { value: number };
  uMaxAz: { value: number };
  uDBottom: { value: number };
  uTime: { value: number };
  uPixelAngle: { value: number };
  uWaveAmp: { value: number };
  uReflDistort: { value: number };
  uReflStrength: { value: number };
  uLUT: { value: THREE.Texture };
  uGlitter: { value: THREE.Texture };
  uRefl: { value: THREE.Texture };
  uBoat: { value: THREE.Texture };
};

export default function SeaBackdrop({
  reflection,
  boat,
  waveAmp = 1,
  reflDistort = 0.075,
  reflStrength = 0.95,
  frozenTime,
}: {
  reflection: THREE.Texture;
  boat: THREE.Texture;
  waveAmp?: number;
  reflDistort?: number;
  reflStrength?: number;
  /** Pin the clock, so screenshots are byte-comparable between runs. */
  frozenTime?: number;
}) {
  const { size } = useThree();

  const lut = useMemo(() => buildSeaLUT(), []);
  const glitter = useMemo(() => buildGlitterTexture(), []);
  const mesh = useRef<THREE.Mesh>(null);

  // Initial values only. Per-frame updates go through the material handle
  // below, because the uniforms are the MATERIAL's mutable state - this object
  // is just what it starts with.
  const initialUniforms = useMemo<SeaUniforms>(
    () => ({
      uCamPos: { value: new THREE.Vector3() },
      uRight: { value: new THREE.Vector3() },
      uUp: { value: new THREE.Vector3() },
      uFwd: { value: new THREE.Vector3() },
      uTanHalfV: { value: 0.2 },
      uAspect: { value: 1.5 },
      uSkyMax: { value: SKY_MAX },
      uMaxAz: { value: 0.29 },
      uDBottom: { value: D_BOTTOM },
      uTime: { value: 0 },
      uPixelAngle: { value: 0.001 },
      uWaveAmp: { value: 1 },
      uReflDistort: { value: 0.075 },
      uReflStrength: { value: 0.95 },
      uLUT: { value: lut },
      uGlitter: { value: glitter },
      uRefl: { value: reflection },
      uBoat: { value: boat },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lut, glitter],
  );

  useFrame((state, dt) => {
    const mat = mesh.current?.material as THREE.ShaderMaterial | undefined;
    if (!mat) return;
    const u = mat.uniforms as unknown as SeaUniforms;
    const cam = state.camera as THREE.PerspectiveCamera;

    u.uTime.value = frozenTime !== undefined ? frozenTime : u.uTime.value + dt;
    u.uWaveAmp.value = waveAmp;
    u.uReflDistort.value = reflDistort;
    u.uReflStrength.value = reflStrength;
    u.uRefl.value = reflection;
    u.uBoat.value = boat;

    cam.getWorldPosition(u.uCamPos.value);
    cam.matrixWorld.extractBasis(u.uRight.value, u.uUp.value, u.uFwd.value);
    u.uFwd.value.negate(); // three's camera looks down -Z

    const tanHalfV = Math.tan((cam.fov * Math.PI) / 360);
    u.uTanHalfV.value = tanHalfV;
    u.uAspect.value = cam.aspect;
    u.uMaxAz.value = Math.atan(tanHalfV * cam.aspect);
    // Angular size of one pixel, which drives the ripple LOD.
    u.uPixelAngle.value = (2 * tanHalfV) / Math.max(1, size.height);
  }, 0);

  return (
    <mesh ref={mesh} frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={initialUniforms}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
