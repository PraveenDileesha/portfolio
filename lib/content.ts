import { projectSchema, type Project } from "@/lib/schemas";

const raw = [
  {
    title: "Aperture Renderer",
    description:
      "A physically-based WebGPU renderer with clustered forward shading and temporal upsampling. Holds 120fps on a million-triangle scene in the browser.",
    stack: ["WebGPU", "WGSL", "Rust", "WASM"],
    status: "shipped",
  },
  {
    title: "Halyard",
    description:
      "Distributed job scheduler handling 40M tasks a day. Exactly-once delivery via idempotency keys and a Raft-backed commit log.",
    stack: ["Go", "Raft", "Postgres", "gRPC"],
    status: "shipped",
  },
  {
    title: "Nullspace",
    description:
      "Type-safe RPC layer that derives client SDKs straight from server route definitions. No codegen step, and no drift between the two.",
    stack: ["TypeScript", "Zod", "tRPC"],
    status: "open source",
  },
  {
    title: "Cathode",
    description:
      "GPU-accelerated terminal emulator with subpixel glyph caching and a shader-driven CRT mode. Sub-millisecond frame times under full scrollback.",
    stack: ["Rust", "wgpu", "HarfBuzz"],
    status: "in flight",
  },
  {
    title: "Driftwood",
    description:
      "Incremental static regeneration at the edge, keyed on content hashes rather than wall-clock time. Cut origin traffic by 94% across 200k pages.",
    stack: ["Next.js", "Cloudflare", "Redis"],
    status: "shipped",
  },
  {
    title: "Lattice",
    description:
      "Research into differentiable procedural geometry: optimising SDF parameters directly against a rendered target image.",
    stack: ["Python", "JAX", "GLSL"],
    status: "research",
  },
];

/**
 * Content is parsed through the same schema the API uses, so a typo here
 * fails the build instead of shipping a broken card.
 */
export const projects: Project[] = raw.map((p) => projectSchema.parse(p));

export const capabilities = [
  {
    k: "Systems",
    v: "Distributed schedulers, consensus, storage engines. Comfortable below the runtime.",
  },
  {
    k: "Graphics",
    v: "Real-time rendering in WebGL and WebGPU. Shader authoring, and the maths behind it.",
  },
  {
    k: "Product",
    v: "Interfaces that feel inevitable. Motion, typography, and the restraint to stop.",
  },
  {
    k: "Platform",
    v: "Supply-chain hardening, reproducible builds, and CI that fails loudly and early.",
  },
];
