"use client";

/**
 * Meteoroid — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
/**
 * Meteoroid: a deformed stone, cratered and lit by one hard sun, hollow, with a
 * second sun inside that shines out through holes drilled in the craters.
 *
 * The surface is too detailed to work out every frame, so it is baked once onto
 * cube maps when the scene starts: the shape, the craters, the cracks, the
 * colour and the light the holes throw on the stone. After that a frame only
 * reads those maps, and walks a short way
 * towards the sun from each lit pixel, which is what drops the crater floors
 * into shadow. No mesh is cut for the holes: a pixel over one works out what the
 * view down it meets, so the hollow keeps its depth as the rock turns.
 */
import { useThreeScene } from "@vectorvesper/motion/three";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export interface MeteoroidProps {
  /** How fast the rock turns. Default 1. */
  spin?: number;
  /** Whether a drag turns the rock, and a flick throws it. Default true. */
  draggable?: boolean;
  /** Which rock to make. Each seed is a different stone. Default 7. */
  seed?: number;
  /** Image shown where the scene cannot run: reduced motion, or a device below the floor. */
  poster?: string;
  /** Sizes the area. Without a height it is 100svh tall. */
  className?: string;
  style?: React.CSSProperties;
  /** Content drawn over the rock. */
  children?: React.ReactNode;
}

/** Texels along each edge of a baked cube face. */
const MAP_FULL = 1024;
const MAP_REDUCED = 640;
/** Cells along each edge of a cube face of the mesh. Pixels get their detail from the maps. */
const MESH_FULL = 192;
const MESH_REDUCED = 112;
/** Short side in device pixels, up to which the smaller maps and mesh are sharp enough. */
const SMALL_SCREEN = 700;
/** Tiles along each edge of a cube face. A texel only tests the craters listed for its tile. */
const TILES = 16;
const LIST_WIDTH = 1024;
/** Flat fracture faces cut into the rock. */
const CUTS = 12;
/** Past this size a crater is a basin: it bends the ground rather than replacing it. */
const BASIN = 0.4;
/** Most holes drilled through the rock. */
const HOLES = 28;
/** How far a hole's light reaches over the stone, in hole widths. */
const REFLECT_REACH = 11;
/** That light is soft, so its map can be this many times smaller than the others. */
const REFLECT_SHRINK = 4;
/** The rock is never thinner than this, which bounds how far a crater can reach. */
const LOWEST_RADIUS = 0.5;
/** Steps a pixel takes towards the sun. */
const STEPS_FULL = 14;
const STEPS_REDUCED = 9;
/**
 * How much longer each step is than the one before. Fewer steps stride further
 * to end where the full walk ends, or a quality change would move every long shadow.
 */
const STRIDE_FULL = 1.4;
const STRIDE_REDUCED = STRIDE_FULL ** ((STEPS_FULL - 1) / (STEPS_REDUCED - 1));
/** Radians a second. */
const SPIN = 0.04;
/** How quickly a flicked rock coasts to a stop, per second. */
const COAST = 3;
/** Presses on these, laid over the rock, are theirs and don't turn it. */
const INTERACTIVE = "a,button,input,select,textarea,label,summary,[role=button],[contenteditable],[tabindex]";
/** Where the turn starts, so the first thing seen is the rock's best side. */
const FIRST_TURN = -1.05;
const FADE_SECONDS = 1.4;
const FOV = 24;
/** Half the view's short side, in rock radii. */
const FIT = 1.32;

const AXIS = new THREE.Vector3(0.28, 1, 0.14).normalize();
const SUN = new THREE.Vector3(-0.84, 0.46, 0.28).normalize();

type Crater = {
  x: number;
  y: number;
  z: number;
  size: number;
  depth: number;
  fresh: number;
  reach: number;
  sharp: number;
  age: number;
};

function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDirection(rand: () => number): [number, number, number] {
  const z = rand() * 2 - 1;
  const a = rand() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return [s * Math.cos(a), s * Math.sin(a), z];
}

/** Matches how cube maps are addressed, and FACE_GLSL below. */
function faceDirection(face: number, u: number, v: number): [number, number, number] {
  const d: [number, number, number][] = [
    [1, -v, -u],
    [-1, -v, u],
    [u, 1, v],
    [u, -1, -v],
    [u, -v, 1],
    [-u, -v, -1],
  ];
  const [x, y, z] = d[face];
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

function buildCraters(rand: () => number) {
  const craters: Crater[] = [];

  // Big craters keep apart, as overlapping ones read as one blur.
  const place = (size: number, gap: number): [number, number, number] => {
    let best = randomDirection(rand);
    for (let i = 0; i < 40; i++) {
      const [x, y, z] = best;
      const clear = craters.every(
        (c) => Math.hypot(c.x - x, c.y - y, c.z - z) > (c.size + size) * gap,
      );
      if (clear) break;
      best = randomDirection(rand);
    }
    return best;
  };

  const add = (
    [x, y, z]: [number, number, number],
    size: number,
    fresh: number,
    ratio: number,
    reach: number,
    sharp: number,
    age: number,
  ) => {
    craters.push({ x, y, z, size, fresh, reach, sharp, depth: size * ratio, age });
  };

  for (let i = 0; i < 3; i++) {
    const size = BASIN + 0.04 + rand() * 0.16;
    add(place(size, 0.8), size, 0.25, 0.2, 1.6, 2.6, 3);
  }
  for (let i = 0; i < 16; i++) {
    const size = 0.12 + rand() * 0.16;
    const fresh = 0.7 + rand() * 0.3;
    add(place(size, 0.95), size, fresh, 0.34 + fresh * 0.28, 2.4, 2.4 + fresh, rand());
  }
  for (let i = 0; i < 46; i++) {
    const size = 0.05 + rand() * 0.07;
    const fresh = 0.45 + rand() * 0.55;
    add(place(size, 0.7), size, fresh, 0.34 + fresh * 0.3, 2.4, 2.2 + fresh, 1 + rand());
  }

  // Real crater fields hold many small for each large, and they gather in patches.
  for (let i = 0; i < 1900; i++) {
    const size = 0.009 / Math.sqrt(1 - rand() * 0.995);
    const p = randomDirection(rand);
    const patch = Math.sin(3.1 * p[0] + 1.3) * Math.sin(2.7 * p[1] + 0.4) * Math.sin(3.4 * p[2] + 2.1);
    if (rand() > 0.6 + patch * 1.1) continue;
    const fresh = 0.2 + rand() * 0.8;
    add(p, size, fresh, 0.2 + fresh * 0.34, 2.4, 2 + fresh * 1.2, 2 + rand());
  }

  // Oldest first. The holes land last, sweeping their floors clear of smaller marks.
  return craters.sort((a, b) => b.age - a.age);
}

/** Drills the floors of some of the deeper craters, a little off centre, into the hollow. */
function buildHoles(craters: Crater[], rand: () => number) {
  const holes: THREE.Vector4[] = [];

  const drill = (crater: Crater, index: number, width: number, drift: number) => {
    const middle = new THREE.Vector3(crater.x, crater.y, crater.z);
    const side = new THREE.Vector3(Math.abs(crater.x) < 0.8 ? 1 : 0, Math.abs(crater.x) < 0.8 ? 0 : 1, 0);
    const u = side.clone().cross(middle).normalize();
    const v = middle.clone().cross(u);
    const a = rand() * Math.PI * 2;
    const reach = crater.size * drift * rand();
    const at = middle
      .clone()
      .addScaledVector(u, Math.cos(a) * reach)
      .addScaledVector(v, Math.sin(a) * reach)
      .normalize();

    // A younger crater landing here would leave the hole hanging on its wall.
    for (let i = index + 1; i < craters.length; i++) {
      const c = craters[i];
      if (Math.hypot(c.x - at.x, c.y - at.y, c.z - at.z) < c.size * 1.2 + width) return;
    }
    for (const h of holes) {
      if (Math.hypot(h.x - at.x, h.y - at.y, h.z - at.z) < (h.w + width) * 1.6) return;
    }
    if (holes.length < HOLES) holes.push(new THREE.Vector4(at.x, at.y, at.z, width));
  };

  craters.forEach((crater, index) => {
    if (crater.size > BASIN || crater.size < 0.05) return;
    if (crater.size > 0.12) {
      if (rand() < 0.88) drill(crater, index, crater.size * (0.15 + rand() * 0.12), 0.32);
      if (crater.size > 0.17 && rand() < 0.5) drill(crater, index, crater.size * (0.08 + rand() * 0.07), 0.55);
    } else if (rand() < 0.26) {
      drill(crater, index, crater.size * (0.26 + rand() * 0.12), 0.24);
    }
  });

  const count = holes.length;
  while (holes.length < HOLES) holes.push(new THREE.Vector4(0, 0, 1, 0));
  return { holes, count };
}

/** Lists which craters reach each tile, keeping their age order. */
function buildTiles(craters: Crater[]) {
  const total = TILES * TILES * 6;
  const centres = new Float32Array(total * 4);
  for (let face = 0, n = 0; face < 6; face++) {
    for (let y = 0; y < TILES; y++) {
      for (let x = 0; x < TILES; x++, n++) {
        const at = (i: number) => (i / TILES) * 2 - 1;
        const [cx, cy, cz] = faceDirection(face, at(x + 0.5), at(y + 0.5));
        let wide = 0;
        for (const [a, b] of [
          [x, y],
          [x + 1, y],
          [x, y + 1],
          [x + 1, y + 1],
        ]) {
          const [px, py, pz] = faceDirection(face, at(a), at(b));
          wide = Math.max(wide, Math.hypot(px - cx, py - cy, pz - cz));
        }
        centres.set([cx, cy, cz, wide * 1.1], n * 4);
      }
    }
  }

  const lists: number[][] = Array.from({ length: total }, () => []);
  craters.forEach((crater, id) => {
    const chord = (crater.reach * crater.size) / LOWEST_RADIUS;
    for (let n = 0; n < total; n++) {
      const dx = centres[n * 4] - crater.x;
      const dy = centres[n * 4 + 1] - crater.y;
      const dz = centres[n * 4 + 2] - crater.z;
      const limit = chord + centres[n * 4 + 3];
      if (dx * dx + dy * dy + dz * dz < limit * limit) lists[n].push(id);
    }
  });

  const entries = lists.reduce((sum, list) => sum + list.length, 0);
  const rows = Math.max(Math.ceil((entries * 2) / LIST_WIDTH), 1);
  const listData = new Float32Array(LIST_WIDTH * rows * 4);
  const tileData = new Float32Array(total * 4);
  let written = 0;
  lists.forEach((list, n) => {
    tileData[n * 4] = written;
    tileData[n * 4 + 1] = list.length;
    for (const id of list) {
      const c = craters[id];
      listData.set([c.x, c.y, c.z, c.size, c.depth, c.fresh, c.reach, c.sharp], written * 8);
      written++;
    }
  });

  const tiles = new THREE.DataTexture(tileData, TILES, TILES * 6, THREE.RGBAFormat, THREE.FloatType);
  tiles.needsUpdate = true;
  const entriesTexture = new THREE.DataTexture(listData, LIST_WIDTH, rows, THREE.RGBAFormat, THREE.FloatType);
  entriesTexture.needsUpdate = true;
  return { tiles, entries: entriesTexture };
}

/** Fine grain for the pixels the maps are too coarse for. Holds its slope too, so one read can light it. */
function buildGrain(rand: () => number) {
  const size = 64;
  const count = size * size * size;
  const wrap = (i: number) => (i + size) % size;
  const index = (x: number, y: number, z: number) => wrap(x) + wrap(y) * size + wrap(z) * size * size;

  let field = new Float32Array(count);
  for (let i = 0; i < count; i++) field[i] = rand() - 0.5;

  const reach = [1, size, size * size];
  for (let axis = 0; axis < 3; axis++) {
    const next = new Float32Array(count);
    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const before = index(x - +(axis === 0), y - +(axis === 1), z - +(axis === 2));
          const after = index(x + +(axis === 0), y + +(axis === 1), z + +(axis === 2));
          const i = x + y * reach[1] + z * reach[2];
          next[i] = field[before] * 0.25 + field[i] * 0.5 + field[after] * 0.25;
        }
      }
    }
    field = next;
  }

  let peak = 0;
  for (let i = 0; i < count; i++) peak = Math.max(peak, Math.abs(field[i]));
  const data = new Uint8Array(count * 4);
  const pack = (v: number) => Math.round(Math.min(Math.max(v * 0.5 + 0.5, 0), 1) * 255);
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = index(x, y, z);
        data[i * 4] = pack(((field[index(x + 1, y, z)] - field[index(x - 1, y, z)]) / peak) * 1.4);
        data[i * 4 + 1] = pack(((field[index(x, y + 1, z)] - field[index(x, y - 1, z)]) / peak) * 1.4);
        data[i * 4 + 2] = pack(((field[index(x, y, z + 1)] - field[index(x, y, z - 1)]) / peak) * 1.4);
        data[i * 4 + 3] = pack((field[i] / peak) * 1.6);
      }
    }
  }

  const grain = new THREE.Data3DTexture(data, size, size, size);
  grain.format = THREE.RGBAFormat;
  grain.type = THREE.UnsignedByteType;
  grain.wrapS = grain.wrapT = grain.wrapR = THREE.RepeatWrapping;
  grain.minFilter = THREE.LinearMipmapLinearFilter;
  grain.magFilter = THREE.LinearFilter;
  grain.generateMipmaps = true;
  grain.unpackAlignment = 1;
  grain.needsUpdate = true;
  return grain;
}

/** A sphere made from a cube, whose cells stay near square where a UV sphere's pinch. */
function buildBall(cells: number) {
  const side = cells + 1;
  const positions = new Float32Array(side * side * 6 * 3);
  const index = new Uint32Array(cells * cells * 6 * 6);
  const faces = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  let p = 0;
  let t = 0;
  faces.forEach(([n, a, b], face) => {
    const first = face * side * side;
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        // Spaced by angle, or the cells would crowd towards the cube's corners.
        const u = Math.tan(((x / cells) * 2 - 1) * (Math.PI / 4));
        const v = Math.tan(((y / cells) * 2 - 1) * (Math.PI / 4));
        const px = n[0] + a[0] * u + b[0] * v;
        const py = n[1] + a[1] * u + b[1] * v;
        const pz = n[2] + a[2] * u + b[2] * v;
        const l = Math.hypot(px, py, pz);
        positions[p++] = px / l;
        positions[p++] = py / l;
        positions[p++] = pz / l;
        if (x < cells && y < cells) {
          const i = first + x + y * side;
          index[t++] = i;
          index[t++] = i + 1;
          index[t++] = i + side;
          index[t++] = i + 1;
          index[t++] = i + side + 1;
          index[t++] = i + side;
        }
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  return geometry;
}

const QUAD_VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FACE_GLSL = /* glsl */ `
vec3 faceDirection(int face, vec2 uv) {
  if (face == 0) return vec3(1.0, -uv.y, -uv.x);
  if (face == 1) return vec3(-1.0, -uv.y, uv.x);
  if (face == 2) return vec3(uv.x, 1.0, uv.y);
  if (face == 3) return vec3(uv.x, -1.0, -uv.y);
  if (face == 4) return vec3(uv.x, -uv.y, 1.0);
  return vec3(-uv.x, -uv.y, -1.0);
}
`;

const NOISE_GLSL = /* glsl */ `
vec3 slope(ivec3 cell) {
  uvec3 v = uvec3(cell + 2048) * uvec3(1597334677u, 3812015801u, 2798796415u);
  uint h = (v.x ^ v.y ^ v.z) * 2246822519u;
  h ^= h >> 13u;
  h *= 3266489917u;
  return vec3(float(h & 1023u), float((h >> 10u) & 1023u), float((h >> 20u) & 1023u)) / 511.5 - 1.0;
}

float noise(vec3 p) {
  vec3 floored = floor(p);
  vec3 f = p - floored;
  ivec3 c = ivec3(floored);
  vec3 s = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(slope(c), f);
  float b = dot(slope(c + ivec3(1, 0, 0)), f - vec3(1.0, 0.0, 0.0));
  float d = dot(slope(c + ivec3(0, 1, 0)), f - vec3(0.0, 1.0, 0.0));
  float e = dot(slope(c + ivec3(1, 1, 0)), f - vec3(1.0, 1.0, 0.0));
  float g = dot(slope(c + ivec3(0, 0, 1)), f - vec3(0.0, 0.0, 1.0));
  float h = dot(slope(c + ivec3(1, 0, 1)), f - vec3(1.0, 0.0, 1.0));
  float i = dot(slope(c + ivec3(0, 1, 1)), f - vec3(0.0, 1.0, 1.0));
  float j = dot(slope(c + ivec3(1, 1, 1)), f - vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, s.x), mix(d, e, s.x), s.y), mix(mix(g, h, s.x), mix(i, j, s.x), s.y), s.z);
}

const mat3 TURN = mat3(0.0, 0.8, 0.6, -0.8, 0.36, -0.48, -0.6, -0.48, 0.64);
`;

const LAND_FRAG = /* glsl */ `
uniform int uFace;
uniform float uSize;
uniform vec3 uShift;
uniform vec3 uStretch;
uniform vec4 uCuts[${CUTS}];
uniform vec4 uHoles[${HOLES}];
uniform highp sampler2D uTiles;
uniform highp sampler2D uEntries;

${FACE_GLSL}
${NOISE_GLSL}

float softMin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// The radius along a direction, before any crater. Fracture planes keep it from
// being the soft blob that noise alone makes.
float body(vec3 p) {
  vec3 q = p * 1.25 + uShift;
  vec3 warp = q + 0.9 * vec3(noise(q), noise(q + 17.0), noise(q + 41.0));
  float radius = 1.0 / length(p / uStretch);
  radius += 0.3 * noise(warp * 0.8) + 0.15 * noise(warp * 1.7 + 9.0);
  for (int i = 0; i < ${CUTS}; i++) {
    float facing = dot(p, uCuts[i].xyz);
    if (facing > 0.1) radius = softMin(radius, uCuts[i].w / facing, 0.07);
  }
  return radius;
}

// Sharp creases, rough where they are high and smooth where they are low.
float ridges(vec3 p, int layers) {
  float sum = 0.0;
  float amp = 0.5;
  float weight = 1.0;
  for (int i = 0; i < layers; i++) {
    float n = 1.0 - abs(noise(p) * 1.7);
    n *= n;
    sum += n * amp * weight;
    weight = clamp(n * 1.8, 0.2, 1.0);
    p = TURN * p * 2.1 + 3.7;
    amp *= 0.48;
  }
  return sum;
}

float gravel(vec3 p, int layers) {
  float sum = 0.0;
  float amp = 1.0;
  for (int i = 0; i < layers; i++) {
    sum += noise(p) * amp;
    p = TURN * p * 2.2 + 5.1;
    amp *= 0.55;
  }
  return sum;
}

// Small round pits, as in pumice. Size stays under half a cell, so the nearest eight cells are enough.
float pits(vec3 p) {
  vec3 base = floor(p - 0.5);
  float deepest = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 cell = base + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
    vec3 pick = slope(ivec3(cell)) * 0.5 + 0.5;
    vec3 d = cell + pick - p;
    float size = 0.12 + 0.34 * pick.x * pick.y;
    deepest = max(deepest, smoothstep(1.0, 0.25, dot(d, d) / (size * size)));
  }
  return deepest;
}

// Fractures follow the zero lines of noise, which never end abruptly, so a mask breaks them up.
float cracks(vec3 p) {
  vec3 q = p * 2.0 + 0.6 * vec3(noise(p * 2.7 + 11.0), noise(p * 2.7 + 23.0), noise(p * 2.7 + 31.0));
  float wide = smoothstep(0.02, 0.0, abs(noise(q))) * smoothstep(-0.05, 0.3, noise(p * 1.4 + 37.0));
  float fine = smoothstep(0.016, 0.0, abs(noise(q * 2.3 + 5.0))) * smoothstep(0.0, 0.3, noise(p * 2.1 + 43.0));
  return max(wide, fine * 0.6);
}

// Older marks fade under a new crater, so each one lands cleanly. Basins are kept
// apart in bend: a crater that cleared those too would refill them, leaving a
// column of old ground standing in the basin.
void carve(vec3 p, vec3 lean, float radius, float wobble, vec2 uv, inout vec3 land, inout float bend) {
  ivec2 tile = ivec2(clamp(uv * 0.5 + 0.5, 0.0, 0.9999) * ${TILES}.0);
  vec2 span = texelFetch(uTiles, tile + ivec2(0, uFace * ${TILES}), 0).xy;
  int first = int(span.x);
  int last = first + int(span.y);
  for (int i = first; i < last; i++) {
    int at = i * 2;
    vec4 place = texelFetch(uEntries, ivec2(at & ${LIST_WIDTH - 1}, at >> ${Math.log2(LIST_WIDTH)}), 0);
    vec4 form = texelFetch(uEntries, ivec2((at + 1) & ${LIST_WIDTH - 1}, at >> ${Math.log2(LIST_WIDTH)}), 0);

    // Distance over the surface, so a crater stays round on a slope.
    vec3 d = p - place.xyz;
    float along = dot(lean, d);
    float t = sqrt(radius * radius * dot(d, d) + along * along) / place.w;
    if (t > form.z) continue;
    // Capped, or on a wide crater it outgrows its own ripples and the wall breaks into fingers.
    t *= 1.0 + wobble * 0.14 * min(0.16 / place.w, 1.0);

    float fresh = form.y;
    float rim = form.x * (0.05 + 0.13 * fresh);
    float inner = rim - (form.x + rim) * (1.0 - pow(t, form.w));
    float outer = (rim / pow(max(t, 0.9), 3.0)) * smoothstep(form.z, form.z * 0.55, t);
    float shape = mix(inner, outer, smoothstep(0.93, 1.07, t));
    if (place.w > ${BASIN}) {
      bend += shape;
      continue;
    }
    float clear = smoothstep(1.2, 0.8, t);
    land.x = land.x * (1.0 - clear) + shape;

    float blanket = 0.0;
    if (fresh > 0.45) {
      float rays = 0.5 + noise(normalize(d) * 5.0 + place.xyz * 13.0) * 1.2;
      blanket = fresh * smoothstep(form.z, 1.0, t) * smoothstep(0.85, 1.05, t) * clamp(rays, 0.2, 1.0);
    }
    land.y = max(land.y * (1.0 - clear), blanket);
    land.z = max(land.z * (1.0 - clear), smoothstep(1.02, 0.5, t) * (0.5 + 0.5 * fresh));
  }
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 1.0) / uSize * 2.0 - 1.0;
  vec3 p = normalize(faceDirection(uFace, uv));
  float radius = body(p);

  vec3 ex = dFdx(p);
  vec3 ey = dFdy(p);
  vec3 lean = (dFdx(radius) * cross(ey, p) + dFdy(radius) * cross(p, ex)) / dot(p, cross(ex, ey));

  vec3 q = p * radius + uShift;
  float wobble = noise(q * 7.0) * 0.7 + noise(q * 19.0) * 0.3;

  vec3 land = vec3((ridges(q * 2.6, 4) - 0.45) * 0.04, 0.0, 0.0);
  float bend = 0.0;
  carve(p, lean, radius, wobble, uv, land, bend);

  float rough = smoothstep(-0.25, 0.3, noise(q * 2.7 + 13.0));
  float crack = cracks(q);
  float detail = (ridges(q * 9.0 + 3.0, 4) - 0.45) * mix(0.003, 0.009, rough);
  detail += gravel(q * 37.0, 4) * mix(0.0012, 0.003, rough);
  detail -= pits(q * 44.0) * 0.0035 * rough + pits(q * 103.0 + 7.0) * 0.0016;
  detail -= crack * 0.0035;

  for (int i = 0; i < ${HOLES}; i++) {
    vec4 hole = uHoles[i];
    if (hole.w > 0.0) detail -= smoothstep(1.45, 1.0, distance(p, hole.xyz) / hole.w) * hole.w * 0.2;
  }

  gl_FragColor = vec4(radius + bend + land.x + detail - 1.0, land.y, land.z, crack);
}
`;

const SURFACE_FRAG = /* glsl */ `
uniform int uFace;
uniform float uSize;
uniform highp sampler2D uLand;

${FACE_GLSL}

vec3 pointAt(ivec2 at) {
  vec2 uv = (vec2(at) - 0.5) / uSize * 2.0 - 1.0;
  return normalize(faceDirection(uFace, uv)) * (1.0 + texelFetch(uLand, at, 0).r);
}

void main() {
  ivec2 at = ivec2(gl_FragCoord.xy) + 1;
  vec3 across = pointAt(at + ivec2(1, 0)) - pointAt(at - ivec2(1, 0));
  vec3 upward = pointAt(at + ivec2(0, 1)) - pointAt(at - ivec2(0, 1));
  vec3 point = pointAt(at);
  vec3 normal = normalize(cross(across, upward));
  if (dot(normal, point) < 0.0) normal = -normal;
  gl_FragColor = vec4(normal, length(point) - 1.0);
}
`;

const TINT_FRAG = /* glsl */ `
uniform int uFace;
uniform float uSize;
uniform vec3 uShift;
uniform highp sampler2D uLand;

${FACE_GLSL}
${NOISE_GLSL}

const vec3 ASH = vec3(0.2, 0.188, 0.174);
const vec3 BASALT = vec3(0.085, 0.079, 0.076);
const vec3 RUST = vec3(0.235, 0.165, 0.115);
const vec3 PALE = vec3(0.36, 0.34, 0.315);

void main() {
  ivec2 at = ivec2(gl_FragCoord.xy) + 1;
  vec4 land = texelFetch(uLand, at, 0);
  vec2 uv = (vec2(at) - 0.5) / uSize * 2.0 - 1.0;
  vec3 p = normalize(faceDirection(uFace, uv)) * (1.0 + land.r) + uShift;

  float patchy = noise(p * 4.3 + 5.0) + 0.5 * noise(p * 11.0 + 3.0) + 0.3 * noise(p * 29.0 + 7.0);
  vec3 stone = mix(ASH, BASALT, smoothstep(-0.3, 0.35, noise(p * 1.6) + 0.4 * patchy));
  stone = mix(stone, RUST, 0.45 * smoothstep(0.1, 0.5, noise(p * 2.9 + 19.0) + 0.45 * patchy));
  stone = mix(stone, PALE, land.g * 0.55);
  stone *= 1.0 - 0.3 * land.b;
  stone *= 1.0 - 0.3 * land.a;
  gl_FragColor = vec4(sqrt(stone), 1.0);
}
`;

// Stone never moves against its holes, so the light they throw on it is worked out
// once. xyz points at the light and its length is the strength. Alpha numbers the
// hole this is the mouth of, so a frame tests that one hole and not all of them.
const REFLECT_FRAG = /* glsl */ `
uniform int uFace;
uniform float uSize;
uniform vec4 uHoles[${HOLES}];
uniform samplerCube uSurface;

${FACE_GLSL}

void main() {
  vec2 uv = gl_FragCoord.xy / uSize * 2.0 - 1.0;
  vec3 dir = normalize(faceDirection(uFace, uv));
  vec3 point = dir * (1.0 + textureLod(uSurface, dir, 2.0).a);
  vec3 arriving = vec3(0.0);
  float mouth = 0.0;
  for (int i = 0; i < ${HOLES}; i++) {
    vec4 hole = uHoles[i];
    float apart = distance(dir, hole.xyz);
    if (hole.w == 0.0 || apart >= hole.w * ${REFLECT_REACH}.0) continue;

    // Past the rim by a few texels, as filtering blurs the number at its edge.
    if (apart < hole.w + 5.0 / uSize) mouth = float(i + 1);

    float radius = 1.0 + textureLod(uSurface, hole.xyz, 3.0).a;
    vec3 away = hole.xyz * radius - point;
    float gap = dot(away, away) + hole.w * hole.w * 0.6;
    vec3 toward = away / sqrt(gap);
    float leaving = 0.35 + 0.65 * max(-dot(toward, hole.xyz), 0.0);
    arriving += toward * leaving * hole.w * hole.w / gap
      * smoothstep(${REFLECT_REACH}.0, ${REFLECT_REACH}.0 * 0.5, apart / hole.w);
  }
  gl_FragColor = vec4(arriving, mouth);
}
`;

const GLOW_VERT = /* glsl */ `
attribute vec4 aHole;
uniform samplerCube uSurface;
uniform vec3 uEye;
varying vec2 vAt;
varying float vFacing;

void main() {
  float radius = 1.0 + textureLod(uSurface, aHole.xyz, 3.0).a;
  vec3 mouth = aHole.xyz * radius;
  vec4 centre = modelViewMatrix * vec4(mouth, 1.0);

  // Walked up the line of sight, so a hole behind a ridge doesn't glow through it.
  vec3 sight = normalize(uEye - mouth);
  float seen = max(dot(sight, aHole.xyz), 0.0);
  float travelled = 0.04;
  for (int i = 0; i < 6; i++) {
    vec3 ray = mouth + sight * travelled;
    seen *= smoothstep(-0.015, 0.02, length(ray) - 1.0 - textureLod(uSurface, ray, 3.0).a);
    travelled *= 1.7;
  }
  vFacing = seen;
  vAt = position.xy;
  centre.xy += position.xy * aHole.w * 8.5;

  // Half the holes face away at any time, and blending an unseen glow still costs.
  gl_Position = seen > 0.02 ? projectionMatrix * centre : vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const GLOW_FRAG = /* glsl */ `
uniform float uFade;
varying vec2 vAt;
varying float vFacing;

void main() {
  float d = dot(vAt, vAt);
  float glow = (exp(-d * 17.0) * 0.5 + exp(-d * 3.5) * 0.16) * smoothstep(1.0, 0.5, d);
  gl_FragColor = vec4(vec3(1.0, 0.62, 0.3) * glow * vFacing * uFade, 1.0);
}
`;

const ROCK_VERT = /* glsl */ `
uniform samplerCube uSurface;
uniform float uLevel;
varying vec3 vDir;
varying vec3 vPoint;

void main() {
  vDir = position;
  vPoint = position * (1.0 + textureLod(uSurface, position, uLevel).a);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(vPoint, 1.0);
}
`;

const ROCK_FRAG = /* glsl */ `
uniform samplerCube uSurface;
uniform samplerCube uTint;
uniform samplerCube uReflect;
uniform sampler3D uGrain;
uniform vec3 uSun;
uniform vec3 uEye;
uniform vec4 uHoles[${HOLES}];
uniform float uFade;
uniform float uMapSize;
uniform int uSteps;
uniform float uStride;
varying vec3 vDir;
varying vec3 vPoint;

const float SUN_SIZE = 0.34;
const vec3 SUN_CORE = vec3(1.0, 0.93, 0.8) * 16.0;
const vec3 SUN_EDGE = vec3(1.0, 0.58, 0.2) * 7.0;
const vec3 HOLLOW = vec3(1.0, 0.62, 0.24) * 3.2;
const vec3 EMBER = vec3(1.0, 0.42, 0.1) * 2.6;
const vec3 WARM = vec3(1.0, 0.56, 0.24);

// What a view down a hole meets: the wall of the shaft, lit from below, or the
// hollow past it, which holds the sun. Worked out from the view, so the depth
// stays right as the rock turns.
vec3 throughHole(vec3 start, vec3 ray, vec3 axis, float width, float inner, float speck) {
  vec3 o = start - axis * dot(start, axis);
  vec3 d = ray - axis * dot(ray, axis);
  float a = max(dot(d, d), 0.00001);
  float b = dot(o, d);
  float c = dot(o, o) - width * width;
  float s = (-b + sqrt(max(b * b - a * c, 0.0))) / a;
  float along = dot(start + ray * s, axis);
  if (along > inner) return EMBER * exp((inner - along) * 24.0) * (0.5 + speck);

  float wide = length(cross(start, ray));
  float disc = sqrt(max(1.0 - wide * wide / (SUN_SIZE * SUN_SIZE), 0.0));
  vec3 sun = mix(SUN_EDGE, SUN_CORE, pow(disc, 0.6));
  vec3 beyond = HOLLOW + SUN_EDGE * 0.5 * exp((SUN_SIZE - wide) * 6.0);
  return mix(beyond, sun, smoothstep(SUN_SIZE + 0.012, SUN_SIZE - 0.012, wide));
}

// The walk widens as it goes, reading blurrier height, so its long far steps
// can't miss anything big enough to matter at that distance.
float sunlight(vec3 point) {
  float light = 1.0;
  float travelled = 0.006;
  for (int i = 0; i < uSteps; i++) {
    vec3 ray = point + uSun * travelled;
    float above = length(ray);
    if (above > 1.5) break;
    float level = max(log2(travelled * uMapSize * 0.22), 0.0);
    float ground = 1.0 + textureLod(uSurface, ray, level).a;
    light = min(light, (above - ground + 0.0015) / (travelled * 0.05));
    if (light <= 0.0) return 0.0;
    travelled *= uStride;
  }
  return light * light * (3.0 - 2.0 * light);
}

vec3 develop(vec3 c) {
  c = c * (2.51 * c + 0.03) / (c * (2.43 * c + 0.59) + 0.14);
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}

void main() {
  vec3 dir = normalize(vDir);
  vec4 surface = texture(uSurface, dir);
  vec3 point = dir * (1.0 + surface.a);
  vec3 view = normalize(uEye - vPoint);

  vec4 coarse = texture(uGrain, point * 3.1);
  vec4 fine = texture(uGrain, point.yzx * 7.3);
  vec3 lift = (coarse.xyz - 0.5) * 0.55 + (fine.xyz - 0.5) * 0.4;
  vec3 normal = normalize(surface.xyz);
  normal = normalize(normal + lift - normal * dot(lift, normal));

  vec3 stone = texture(uTint, dir).rgb;
  stone *= stone;
  stone *= 0.72 + 0.56 * mix(coarse.a, fine.a, 0.6);

  // Low ground sees less of the sky, and holds the darker dust.
  vec4 nearby = textureLod(uSurface, dir, 3.5);
  float low = nearby.a - surface.a;
  float lower = textureLod(uSurface, dir, 5.5).a - surface.a;
  float lowest = textureLod(uSurface, dir, 7.0).a - surface.a;
  float open = clamp(1.0 - low * 22.0 - lower * 7.0 - lowest * 3.0, 0.12, 1.0);

  float facing = dot(normal, uSun);
  float light = 0.0;
  if (facing > 0.0) light = sunlight(point + surface.xyz * 0.002);

  // Dust scatters light evenly, so it doesn't fall away at the edges as paint does.
  float across = max(dot(normal, view), 0.02);
  float lit = max(facing, 0.0);
  float diffuse = mix(lit, 2.0 * lit / (lit + across), 0.5);

  vec3 color = stone * diffuse * light * vec3(1.2, 1.14, 1.05);
  color += stone * open * vec3(0.028, 0.034, 0.044) * (0.6 + 0.4 * normal.y);
  color *= mix(1.0, open, 0.55);

  // Reads the broad form, as this light lands from close by. Capped, or a cluster of
  // holes burns the stone white. The sun outshines it where it lands, so stone in
  // the sun keeps its own colour and grain.
  vec4 reflected = texture(uReflect, dir);
  vec3 soft = normalize(mix(normal, nearby.xyz, 0.45));
  float caught = max((dot(soft, reflected.xyz) + 0.2 * length(reflected.xyz)) / 1.2, 0.0);
  caught /= 1.0 + caught * 1.5;
  color += stone * WARM * caught * mix(15.0, 4.0, clamp(diffuse * light, 0.0, 1.0));

  float pixel = length(fwidth(dir));
  if (reflected.a >= 0.5) {
    // Where filtering blurs the number it can name the wrong hole, but only outside every rim.
    vec4 hole = uHoles[int(reflected.a + 0.5) - 1];
    float edge = pixel / hole.w;
    float opening = smoothstep(1.0 + edge, 1.0 - edge, distance(dir, hole.xyz) / hole.w);
    if (opening > 0.0) {
      vec3 ray = normalize(vPoint - uEye);
      float radius = 1.0 + textureLod(uSurface, hole.xyz, 3.0).a;
      vec3 inside = throughHole(point, ray, hole.xyz, hole.w * length(point), radius - 0.07 - hole.w, fine.a);
      color = mix(color, inside, opening);
    }
  }

  float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  gl_FragColor = vec4(develop(color) * uFade + (dither - 0.5) / 255.0, 1.0);
}
`;

export function Meteoroid({
  spin = 1,
  draggable = true,
  seed = 7,
  poster,
  className = "",
  style,
  children,
}: MeteoroidProps) {
  const config = useRef({ spin });
  useEffect(() => {
    config.current = { spin };
  }, [spin]);
  const startSeed = useRef(seed);
  const [noFloat, setNoFloat] = useState(false);
  // Pixels dragged since the last frame, and the pointer's speed for a flick.
  const drag = useRef({ pointer: -1, x: 0, y: 0, t: 0, dx: 0, dy: 0, vx: 0, vy: 0 });
  const [dragging, setDragging] = useState(false);
  // Kept out of the scene, so one rebuilt after a lost context shows the same side.
  const turned = useRef<THREE.Quaternion | null>(null);

  const { ref, state } = useThreeScene({
    label: "Meteoroid",
    cost: "normal",
    maxDpr: { full: 1.5, reduced: 1 },
    renderer: () =>
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        stencil: false,
        powerPreference: "high-performance",
      }),
    async setup({ renderer, width, height }) {
      const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 30);
      // Height needs more precision than 8-bit colour, or the lighting shows steps.
      if (!renderer.extensions.has("EXT_color_buffer_float")) {
        setNoFloat(true);
        return { scene: new THREE.Scene(), camera };
      }

      renderer.setClearColor(0x000000, 1);

      // From the screen, not the starting quality: the maps can't change later, so
      // one slow load would otherwise leave a fast machine with the small ones.
      const full = Math.min(width, height) * Math.min(window.devicePixelRatio, 1.5) > SMALL_SCREEN;
      const mapSize = full ? MAP_FULL : MAP_REDUCED;
      const meshCells = full ? MESH_FULL : MESH_REDUCED;

      const rand = mulberry(startSeed.current);
      const shift = new THREE.Vector3(rand() * 40, rand() * 40, rand() * 40);
      const stretch = new THREE.Vector3(1.16 + rand() * 0.1, 0.92 + rand() * 0.08, 0.84 + rand() * 0.08);
      const cuts = Array.from({ length: CUTS }, () => {
        const [x, y, z] = randomDirection(rand);
        return new THREE.Vector4(x, y, z, 0.64 + rand() * 0.28);
      });
      const pose = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rand() * Math.PI, rand() * Math.PI * 2, rand() * Math.PI),
      );

      const craters = buildCraters(rand);
      const { tiles, entries } = buildTiles(craters);
      const { holes, count: holeCount } = buildHoles(craters, rand);
      const grain = buildGrain(rand);

      // A texel past each edge lets the normals see across the cube's seams.
      const land = new THREE.WebGLRenderTarget(mapSize + 2, mapSize + 2, {
        type: THREE.FloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: false,
        generateMipmaps: false,
      });
      const surface = new THREE.WebGLCubeRenderTarget(mapSize, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        generateMipmaps: false,
      });
      const tint = new THREE.WebGLCubeRenderTarget(mapSize, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        generateMipmaps: false,
      });

      const reflected = new THREE.WebGLCubeRenderTarget(Math.round(mapSize / REFLECT_SHRINK), {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        generateMipmaps: false,
      });

      const bake = {
        uFace: { value: 0 },
        uSize: { value: mapSize },
        uShift: { value: shift },
        uLand: { value: land.texture },
        uHoles: { value: holes },
      };
      const flat = { depthTest: false, depthWrite: false };
      const landMaterial = new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: LAND_FRAG,
        uniforms: {
          uFace: bake.uFace,
          uSize: bake.uSize,
          uShift: bake.uShift,
          uHoles: bake.uHoles,
          uStretch: { value: stretch },
          uCuts: { value: cuts },
          uTiles: { value: tiles },
          uEntries: { value: entries },
        },
        ...flat,
      });
      const surfaceMaterial = new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: SURFACE_FRAG,
        uniforms: bake,
        ...flat,
      });
      const tintMaterial = new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: TINT_FRAG,
        uniforms: bake,
        ...flat,
      });

      const reflectMaterial = new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: REFLECT_FRAG,
        uniforms: {
          uFace: bake.uFace,
          uSize: { value: reflected.width },
          uHoles: bake.uHoles,
          uSurface: { value: surface.texture },
        },
        ...flat,
      });

      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), landMaterial);
      quad.frustumCulled = false;
      const bakeScene = new THREE.Scene();
      bakeScene.add(quad);

      const stamp = (material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget, face?: number) => {
        quad.material = material;
        renderer.setRenderTarget(target, face);
        renderer.render(bakeScene, camera);
      };

      const bakeFace = (face: number) => {
        bake.uFace.value = face;
        if (face === 5) {
          // Set now, so the last face's draw builds the mips of the finished maps.
          surface.texture.generateMipmaps = true;
          tint.texture.generateMipmaps = true;
        }
        stamp(landMaterial, land);
        stamp(surfaceMaterial, surface, face);
        stamp(tintMaterial, tint, face);
        renderer.setRenderTarget(null);
      };

      // Comes last, as it reads the finished surface and its mips.
      const bakeReflected = () => {
        for (let face = 0; face < 6; face++) {
          bake.uFace.value = face;
          stamp(reflectMaterial, reflected, face);
        }
        renderer.setRenderTarget(null);
      };

      const shade = {
        uSurface: { value: surface.texture },
        uTint: { value: tint.texture },
        uReflect: { value: reflected.texture },
        uGrain: { value: grain },
        uSun: { value: new THREE.Vector3() },
        uEye: { value: new THREE.Vector3() },
        uHoles: { value: holes },
        uFade: { value: 0 },
        uMapSize: { value: mapSize },
        uLevel: { value: Math.log2(mapSize / (meshCells * 2)) + 1 },
        uSteps: { value: STEPS_FULL },
        uStride: { value: STRIDE_FULL },
      };
      const rock = new THREE.Mesh(
        buildBall(meshCells),
        new THREE.ShaderMaterial({ vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG, uniforms: shade }),
      );
      rock.frustumCulled = false;
      rock.visible = false;
      rock.quaternion.copy(pose);
      const scene = new THREE.Scene();
      scene.add(rock);

      const glowShape = new THREE.PlaneGeometry(2, 2);
      const glowGeometry = new THREE.InstancedBufferGeometry();
      glowGeometry.index = glowShape.index;
      glowGeometry.setAttribute("position", glowShape.getAttribute("position"));
      const holeData = new Float32Array(holeCount * 4);
      holes.slice(0, holeCount).forEach((hole, i) => hole.toArray(holeData, i * 4));
      glowGeometry.setAttribute("aHole", new THREE.InstancedBufferAttribute(holeData, 4));
      glowGeometry.instanceCount = holeCount;
      const glow = new THREE.Mesh(
        glowGeometry,
        new THREE.ShaderMaterial({
          vertexShader: GLOW_VERT,
          fragmentShader: GLOW_FRAG,
          uniforms: { uSurface: shade.uSurface, uEye: shade.uEye, uFade: shade.uFade },
          transparent: true,
          blending: THREE.CustomBlending,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneFactor,
          depthTest: false,
          depthWrite: false,
        }),
      );
      glow.frustumCulled = false;
      rock.add(glow);

      // On the page's own thread this would freeze it for a couple of seconds on a
      // first visit. Colour spaces differ on and off a target, and each is its own program.
      const bakes = new THREE.Scene();
      for (const material of [landMaterial, surfaceMaterial, tintMaterial, reflectMaterial]) {
        const mesh = new THREE.Mesh(quad.geometry, material);
        mesh.frustumCulled = false;
        bakes.add(mesh);
      }
      renderer.setRenderTarget(land);
      await renderer.compileAsync(bakes, camera);
      renderer.setRenderTarget(null);
      await renderer.compileAsync(scene, camera);

      const turn = (turned.current ??= new THREE.Quaternion().setFromAxisAngle(AXIS, FIRST_TURN).multiply(pose));
      const back = new THREE.Quaternion();
      const nudge = new THREE.Quaternion();
      const across = new THREE.Vector3();
      let faces = 0;
      let shown = 0;

      return {
        scene,
        camera,
        update(frame) {
          // Taken before the bake returns, so a drag while it runs is dropped
          // rather than landing all at once.
          const held = drag.current;
          let dx = held.dx;
          let dy = held.dy;
          held.dx = held.dy = 0;

          if (faces < 6) {
            bakeFace(faces++);
            return;
          }
          if (!rock.visible) {
            bakeReflected();
            rock.visible = true;
            return;
          }

          const dt = Math.min(frame.dt, 0.05);
          if (held.pointer < 0) {
            turn.premultiply(nudge.setFromAxisAngle(AXIS, dt * SPIN * config.current.spin));
            dx += held.vx * dt;
            dy += held.vy * dt;
            held.vx *= Math.exp(-dt * COAST);
            held.vy *= Math.exp(-dt * COAST);
          }
          const moved = Math.hypot(dx, dy);
          if (moved > 0) {
            // About the rate that keeps the grabbed point under the pointer.
            const perPixel = (2 * FIT) / Math.max(Math.min(frame.width, frame.height), 1);
            turn.premultiply(nudge.setFromAxisAngle(across.set(dy / moved, dx / moved, 0), moved * perPixel));
          }
          turn.normalize();
          rock.quaternion.copy(turn);
          back.copy(turn).invert();
          shade.uSun.value.copy(SUN).applyQuaternion(back);
          shade.uEye.value.copy(camera.position).applyQuaternion(back);

          shown = Math.min(shown + dt / FADE_SECONDS, 1);
          shade.uFade.value = shown * shown * (3 - 2 * shown);
          shade.uSteps.value = frame.quality === "full" ? STEPS_FULL : STEPS_REDUCED;
          shade.uStride.value = frame.quality === "full" ? STRIDE_FULL : STRIDE_REDUCED;
        },
        resize(width, height) {
          const across = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * Math.min(width / Math.max(height, 1), 1);
          camera.position.z = FIT / across;
        },
        dispose() {
          land.dispose();
          surface.dispose();
          tint.dispose();
          reflected.dispose();
          tiles.dispose();
          entries.dispose();
          grain.dispose();
          quad.geometry.dispose();
          glowShape.dispose();
          landMaterial.dispose();
          surfaceMaterial.dispose();
          tintMaterial.dispose();
          reflectMaterial.dispose();
        },
      };
    },
  });

  const still = state === "poster" || noFloat;
  const running = (state === "active" || state === "constrained") && !noFloat;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (!running || held.pointer >= 0 || e.button !== 0) return;
    const control = (e.target as Element).closest?.(INTERACTIVE);
    if (control && control !== e.currentTarget && e.currentTarget.contains(control)) return;
    held.pointer = e.pointerId;
    held.x = e.clientX;
    held.y = e.clientY;
    held.t = e.timeStamp;
    held.vx = held.vy = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (held.pointer !== e.pointerId) return;
    const mx = e.clientX - held.x;
    const my = e.clientY - held.y;
    const dt = Math.max(1, e.timeStamp - held.t) / 1000;
    held.dx += mx;
    held.dy += my;
    held.vx = held.vx * 0.4 + (mx / dt) * 0.6;
    held.vy = held.vy * 0.4 + (my / dt) * 0.6;
    held.x = e.clientX;
    held.y = e.clientY;
    held.t = e.timeStamp;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (held.pointer !== e.pointerId) return;
    held.pointer = -1;
    // A flick carries on only if the pointer was still moving when it let go.
    if (e.type === "pointercancel" || e.timeStamp - held.t > 80) held.vx = held.vy = 0;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  return (
    <div
      className={`vv-meteoroid ${className}`}
      onPointerDown={draggable ? onPointerDown : undefined}
      onPointerMove={draggable ? onPointerMove : undefined}
      onPointerUp={draggable ? endDrag : undefined}
      onPointerCancel={draggable ? endDrag : undefined}
      style={
        draggable && running
          ? {
              cursor: dragging ? "grabbing" : "grab",
              // Sideways drags turn the rock; vertical swipes still scroll the page.
              touchAction: "pan-y",
              userSelect: "none",
              ...style,
            }
          : style
      }
    >
      <style>{STYLES}</style>
      <div
        ref={ref}
        aria-hidden
        className="vv-mt-scene"
        style={still && poster ? { backgroundImage: `url(${poster})` } : undefined}
      />
      {children && <div className="vv-mt-over">{children}</div>}
    </div>
  );
}

const STYLES = `
/* Zero specificity, so a class that sizes the component wins. */
:where(.vv-meteoroid) { position: relative; min-height: 100svh; }
.vv-meteoroid { overflow: hidden; background: #000; }
.vv-mt-scene { position: absolute; inset: 0; background-size: cover; background-position: center; }
.vv-mt-over { position: relative; z-index: 1; width: 100%; height: 100%; }
`;
