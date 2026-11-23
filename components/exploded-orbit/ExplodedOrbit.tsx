"use client";

/**
 * Exploded Orbit — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
/**
 * Exploded Orbit: a pinned product section. Scroll, and the product comes
 * apart along its own axis like an exploded drawing. Keep going, and its parts
 * swing out to orbit the core, each with its label. Scroll back and it puts
 * itself together again.
 *
 * It takes a 3D model, a .glb or one built with three.js, where each child of
 * the root is a part. Or a stack of images, which come apart as layers.
 */

import { clamp01, getSensorBus } from "@vectorvesper/motion";
import { useThreeScene } from "@vectorvesper/motion/three";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type ExplodedOrbitPhase = "assembled" | "splitting" | "split" | "orbiting";

export interface ExplodedOrbitPart {
  /** The part's name in the model: its node name in a .glb, or `name` on an object you built. */
  id: string;
  label: string;
  note?: string;
}

export interface ExplodedOrbitLayer {
  /** A transparent PNG, WebP or SVG. */
  src: string;
  id?: string;
  label?: string;
  note?: string;
}

export interface ExplodedOrbitProps {
  /** A .glb or .gltf URL, or a function that builds the model with three.js. Each child of its root is a part. */
  model?: string | (() => THREE.Object3D | Promise<THREE.Object3D>);
  /** Labels for the model's parts, matched by name. Parts left out still split and orbit, unlabelled. */
  parts?: ExplodedOrbitPart[];
  /** Images to take apart instead of a model, listed from the back to the front. */
  layers?: ExplodedOrbitLayer[];
  /** The part that stays in the middle while the rest orbit it. The largest by default; `null` sends every part into orbit. */
  core?: string | null;
  /** Which of the model's axes the parts come apart along, with its front facing the positive way. Its longest side by default. */
  axis?: "x" | "y" | "z";
  /** Turns each part makes as it comes off, as if unscrewing. Suits round products. */
  twist?: number;
  /** Where the whole product sits across the stage before it splits, 0 to 1. */
  align?: number;
  /** How far the section scrolls while pinned, as a CSS length. */
  length?: string;
  /**
   * Drives it yourself instead of the page scroll, from 0 assembled to 1 in orbit.
   * The section is then one screen tall and never pins.
   */
  progress?: number;
  theme?: "light" | "dark";
  /** Shown over the stage. Stage it with `data-phase` and `--eo-progress` on the root. */
  children?: React.ReactNode;
  /** Shown instead of the scene under reduced motion. A list of the labelled parts by default. */
  fallback?: React.ReactNode;
  onPhaseChange?: (phase: ExplodedOrbitPhase) => void;
  className?: string;
  style?: React.CSSProperties;
}

/** Stretches of the scroll, 0 to 1: coming apart, then swinging out into orbit. */
const SPLIT: [number, number] = [0.04, 0.38];
const ORBIT: [number, number] = [0.46, 0.7];
/** The share of each stretch spent starting one part after the next. */
const STAGGER = 0.4;
const FOV = 28;
const ORBIT_DOTS = 280;
const AXIS_DOTS = 240;
const TILT = [0.1, -0.08, 0.14];
const NODE = [0.3, 1.5, 2.6];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Turns the model so its axis points along a yaw and pitch, with its up side kept up. */
function poseFor(A: THREE.Vector3, U: THREE.Vector3, yaw: number, pitch: number) {
  const a = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const u = new THREE.Vector3(0, 1, 0).addScaledVector(a, -a.y).normalize();
  const world = new THREE.Matrix4().makeBasis(a, u, new THREE.Vector3().crossVectors(a, u));
  const model = new THREE.Matrix4().makeBasis(A, U, new THREE.Vector3().crossVectors(A, U));
  return new THREE.Quaternion().setFromRotationMatrix(world.multiply(model.transpose()));
}

async function loadModel(src: string) {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  return (await new GLTFLoader().loadAsync(src)).scene;
}

interface Piece {
  holder: THREE.Group;
  id: string;
  /** Where it sits in the assembled model, in model space. */
  centre: THREE.Vector3;
  along: number;
  half: number;
  /** How far along the axis it travels to come apart. */
  offset: number;
  step: number;
  radius: number;
  box: THREE.Box3;
  core: boolean;
  orbit: number;
  phase: number;
  splitAt: number;
  orbitAt: number;
  side: number;
  shown: string;
  placed: string;
}

interface Look {
  hi: string;
  lo: string;
  dots: string;
  night: number;
  version: number;
}

export function ExplodedOrbit({
  model,
  parts,
  layers,
  core,
  axis,
  twist = 0,
  align = 0.5,
  length = "400vh",
  progress: driven,
  theme = "light",
  children,
  fallback,
  onPhaseChange,
  className = "",
  style,
}: ExplodedOrbitProps) {
  const rootRef = useRef<HTMLElement>(null);
  const labelRefs = useRef(new Map<string, HTMLDivElement>());
  const widths = useRef(new Map<string, number>());
  const place = useRef({ top: 0, height: 1 });
  const look = useRef<Look>({ hi: "#fdfdfc", lo: "#f2f2f0", dots: "#2b6069", night: 0, version: 0 });
  const opts = useRef({ align, twist, onPhaseChange, driven });
  useEffect(() => {
    opts.current = { align, twist, onPhaseChange, driven };
  });

  const labels = layers
    ? layers.flatMap((l, i) => (l.label ? [{ id: l.id ?? `layer-${i}`, label: l.label, note: l.note }] : []))
    : (parts ?? []);

  // The shared sensor only listens while something holds it
  useEffect(() => getSensorBus().retain(), []);

  // Where the section sits on the page, so the shared scroll sensor gives its progress
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!root.dataset.phase) root.dataset.phase = "assembled";
    const measure = () => {
      const r = root.getBoundingClientRect();
      place.current = { top: r.top + window.scrollY, height: r.height };
      labelRefs.current.forEach((el, id) => widths.current.set(id, (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 220));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(document.documentElement);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, []);

  // The scene takes its colours from the page, so a restyled section still matches
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cs = getComputedStyle(root);
    const read = (name: string, fallbackColour: string) => cs.getPropertyValue(name).trim() || fallbackColour;
    look.current = {
      hi: read("--eo-ground-hi", "#fdfdfc"),
      lo: read("--eo-ground", "#f2f2f0"),
      dots: read("--eo-orbit", "#2b6069"),
      night: theme === "dark" ? 1 : 0,
      version: look.current.version + 1,
    };
  }, [theme]);

  const { ref, mounted } = useThreeScene({
    label: "ExplodedOrbit",
    cost: "heavy",
    preload: 400,
    maxDpr: { full: 1.5, reduced: 1 },
    renderer: () => new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" }),
    async setup({ renderer: gl }) {
      gl.toneMapping = THREE.NeutralToneMapping;
      // Glass bends a softer copy of what is behind it, which costs far less to draw
      gl.transmissionResolutionScale = 0.6;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 200);

      const pmrem = new THREE.PMREMGenerator(gl);
      const room = new RoomEnvironment();
      const env = pmrem.fromScene(room, 0.035);
      room.dispose();
      pmrem.dispose();
      scene.environment = env.texture;
      const key = new THREE.DirectionalLight(0xffffff, 1.3);
      key.position.set(-5, 7, 6);
      const rim = new THREE.DirectionalLight(0xd2e6ec, 0.8);
      rim.position.set(6, 3, -7);
      scene.add(key, rim);

      // A soft studio backdrop, which glass also needs to have something to bend
      const backU = { uHi: { value: new THREE.Color() }, uLo: { value: new THREE.Color() } };
      const backdrop = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({ uniforms: backU, vertexShader: BACK_VERT, fragmentShader: BACK_FRAG, depthTest: false, depthWrite: false }),
      );
      backdrop.frustumCulled = false;
      backdrop.renderOrder = -10;
      scene.add(backdrop);

      const flat = !!layers?.length;
      const root = new THREE.Group();
      const textures: THREE.Texture[] = [];
      if (layers?.length) {
        const loader = new THREE.TextureLoader();
        const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
        textures.push(...(await Promise.all(layers.map((l) => loader.loadAsync(l.src)))));
        textures.forEach((tex, i) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = aniso;
          const img = tex.image as { width: number; height: number };
          const a = img.width / Math.max(1, img.height);
          const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(a >= 1 ? 2 : 2 * a, a >= 1 ? 2 / a : 2),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
          );
          const node = new THREE.Group();
          node.name = layers[i].id ?? `layer-${i}`;
          node.position.z = i * 0.02;
          node.add(plane);
          root.add(node);
        });
      } else if (model) {
        root.add(typeof model === "string" ? await loadModel(model) : await model());
      }

      // The parts are the children of the first node that has more than one
      let base: THREE.Object3D = root;
      while (base.children.length === 1 && base.children[0].children.length > 0) base = base.children[0];
      root.updateMatrixWorld(true);
      const whole = new THREE.Box3().setFromObject(root);
      const size = whole.isEmpty() ? new THREE.Vector3(1, 1, 1) : whole.getSize(new THREE.Vector3());
      const mid = whole.isEmpty() ? new THREE.Vector3() : whole.getCenter(new THREE.Vector3());
      const k = 2 / Math.max(size.x, size.y, size.z, 1e-6);
      const ax = flat ? "z" : (axis ?? (size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z"));
      const A = new THREE.Vector3(+(ax === "x"), +(ax === "y"), +(ax === "z"));
      const U = ax === "y" ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);

      const stage = new THREE.Group();
      scene.add(stage);
      const tmp = new THREE.Vector3();
      const pieces: Piece[] = base.children.slice().map((node) => {
        const b = new THREE.Box3().setFromObject(node);
        if (b.isEmpty()) b.setFromCenterAndSize(node.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(1e-3, 1e-3, 1e-3));
        const c = b.getCenter(new THREE.Vector3());
        // Each part turns about its own middle, at the model's normalised size
        const inner = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z)).multiply(node.matrixWorld);
        node.removeFromParent();
        node.matrixAutoUpdate = false;
        node.matrix.copy(inner);
        const holder = new THREE.Group();
        holder.add(node);
        stage.add(holder);
        const box = new THREE.Box3(b.min.clone().sub(c).multiplyScalar(k), b.max.clone().sub(c).multiplyScalar(k));
        const centre = c.sub(mid).multiplyScalar(k);
        return {
          holder,
          id: node.name,
          centre,
          along: centre.dot(A),
          half: box.max.dot(A),
          offset: 0,
          step: 0,
          radius: box.getSize(tmp).length() / 2,
          box,
          core: false,
          orbit: 0,
          phase: 0,
          splitAt: 0,
          orbitAt: 0,
          side: 1,
          shown: "",
          placed: "",
        };
      });

      let coreIndex = -1;
      if (core !== null && pieces.length > 1) {
        coreIndex = core ? pieces.findIndex((p) => p.id === core) : -1;
        if (coreIndex < 0) {
          let best = -1;
          pieces.forEach((p, i) => {
            const s = p.box.getSize(tmp);
            if (s.x * s.y * s.z > best) {
              best = s.x * s.y * s.z;
              coreIndex = i;
            }
          });
        }
        pieces[coreIndex].core = true;
      }

      // Lay the parts out along the axis outwards from the core, each clear of the last
      const order = pieces.map((_, i) => i).sort((a, b) => pieces[a].along - pieces[b].along);
      const refRank = coreIndex >= 0 ? order.indexOf(coreIndex) : Math.floor((order.length - 1) / 2);
      const gap = flat ? 0.55 : 0.2;
      if (order.length) {
        const ref = pieces[order[refRank]];
        let edge = ref.along + ref.half;
        for (let r = refRank + 1; r < order.length; r++) {
          const p = pieces[order[r]];
          p.offset = Math.max(0, edge + gap - (p.along - p.half));
          edge = p.along + p.offset + p.half;
          p.step = r - refRank;
        }
        edge = ref.along - ref.half;
        for (let r = refRank - 1; r >= 0; r--) {
          const p = pieces[order[r]];
          p.offset = -Math.max(0, p.along + p.half - (edge - gap));
          edge = p.along + p.offset - p.half;
          p.step = r - refRank;
        }
      }
      const maxStep = Math.max(1, ...pieces.map((p) => Math.abs(p.step)));
      // The outermost parts leave first, so nothing passes through anything
      for (const p of pieces) p.splitAt = (1 - Math.abs(p.step) / maxStep) * STAGGER;

      // Up to three orbits, the parts nearest the core on the inside
      const orbiters = pieces.filter((p) => !p.core).sort((a, b) => Math.abs(a.step) - Math.abs(b.step) || b.step - a.step);
      const rings = orbiters.length <= 3 ? 1 : orbiters.length <= 6 ? 2 : 3;
      const per = Math.max(1, Math.ceil(orbiters.length / rings));
      const coreR = coreIndex >= 0 ? pieces[coreIndex].radius : 0;
      const maxR = Math.max(0.2, ...orbiters.map((p) => p.radius));
      const radii = Array.from({ length: rings }, (_, i) => coreR + maxR * 0.85 + 0.3 + i * (maxR * 1.3 + 0.25));
      orbiters.forEach((p, i) => {
        p.orbit = Math.floor(i / per);
        const count = Math.min(per, orbiters.length - p.orbit * per);
        p.phase = 0.6 + p.orbit * 1.15 + ((i % per) * Math.PI * 2) / count;
        p.orbitAt = (i / Math.max(1, orbiters.length - 1)) * STAGGER;
      });

      // Each orbit drawn as a ring of fine dots
      const dotGeo = new THREE.BufferGeometry();
      dotGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rings * ORBIT_DOTS * 3), 3));
      const dotU = { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 }, uSize: { value: 2 }, uCoreZ: { value: 10 } };
      const dots = new THREE.Points(
        dotGeo,
        new THREE.ShaderMaterial({ uniforms: dotU, vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, transparent: true, depthWrite: false }),
      );
      dots.frustumCulled = false;
      scene.add(dots);

      // The axis the parts come apart along, dotted through the column
      const lo = Math.min(...pieces.map((p) => p.along + p.offset - p.half), 0) - 0.45;
      const hi = Math.max(...pieces.map((p) => p.along + p.offset + p.half), 0) + 0.45;
      const through = coreIndex >= 0 ? pieces[coreIndex].centre : new THREE.Vector3();
      const axisPos = new Float32Array(AXIS_DOTS * 3);
      for (let i = 0; i < AXIS_DOTS; i++) {
        tmp.copy(through).addScaledVector(A, lerp(lo, hi, i / (AXIS_DOTS - 1)) - through.dot(A));
        axisPos.set([tmp.x, tmp.y, tmp.z], i * 3);
      }
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.BufferAttribute(axisPos, 3));
      const lineU = { uColor: dotU.uColor, uOpacity: { value: 0 }, uSize: dotU.uSize, uCoreZ: { value: 1e4 } };
      const line = new THREE.Points(
        lineGeo,
        new THREE.ShaderMaterial({ uniforms: lineU, vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, transparent: true, depthWrite: false }),
      );
      line.frustumCulled = false;
      scene.add(line);

      // Poses: the hero turn, the exploded column, and the way parts face in orbit
      const heroQ = flat ? poseFor(A, U, -0.3, 0.12) : poseFor(A, U, -0.52, 0.27);
      const colQ = flat ? poseFor(A, U, -0.42, 0.82) : poseFor(A, U, -1.12, 0.17);
      const orbQ = flat ? poseFor(A, U, -0.28, 0.1) : poseFor(A, U, -0.74, 0.3);
      const flipQ = new THREE.Quaternion().setFromAxisAngle(U, Math.PI);

      const ringM = radii.map(() => new THREE.Matrix4());
      const ringInv = radii.map(() => new THREE.Matrix4());
      const rot = new THREE.Matrix4();
      const fits = { hero: 6, col: 8, orb: 12 };
      const colCentre = new THREE.Vector3();
      const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const fitFor = (halfW: number, halfH: number, aspect: number) => Math.max(halfH / tanV, halfW / (tanV * aspect));

      // Everything that depends on the stage's shape
      const frameAll = (w: number, h: number) => {
        const aspect = w / Math.max(1, h);
        // On a tall screen the orbits stand on end, so they fill the height
        const roll = aspect < 0.85 ? Math.PI / 2 : 0;
        radii.forEach((_, i) => {
          ringM[i].makeRotationZ(roll).multiply(rot.makeRotationY(NODE[i % 3])).multiply(rot.makeRotationX(TILT[i % 3]));
          ringInv[i].copy(ringM[i]).invert();
        });
        const pos = dotGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < rings; i++) {
          for (let j = 0; j < ORBIT_DOTS; j++) {
            const a = (j / ORBIT_DOTS) * Math.PI * 2;
            tmp.set(Math.sin(a) * radii[i], 0, Math.cos(a) * radii[i]).applyMatrix4(ringM[i]);
            pos.setXYZ(i * ORBIT_DOTS + j, tmp.x, tmp.y, tmp.z);
          }
        }
        pos.needsUpdate = true;
        const half = size.clone().multiplyScalar(k / 2).length();
        fits.hero = fitFor(half, half, aspect);
        const box = new THREE.Box3();
        for (const p of pieces) {
          tmp.copy(p.centre).addScaledVector(A, p.offset).applyQuaternion(colQ);
          box.expandByPoint(new THREE.Vector3(p.radius, p.radius, p.radius).multiplyScalar(0.8).add(tmp));
          box.expandByPoint(new THREE.Vector3(p.radius, p.radius, p.radius).multiplyScalar(-0.8).add(tmp));
        }
        box.getCenter(colCentre);
        const s = box.getSize(new THREE.Vector3());
        fits.col = fitFor(s.x / 2, s.y / 2 + 0.15, aspect) + s.z * 0.12;
        const outer = (radii[rings - 1] ?? 1) + maxR * 0.9;
        fits.orb = roll ? fitFor(outer * 0.5, outer * 1.02, aspect) : fitFor(outer * 1.02, outer * 0.5, aspect);
      };

      const el = rootRef.current;
      const qa = new THREE.Quaternion();
      const qb = new THREE.Quaternion();
      const qt = new THREE.Quaternion();
      const turn = new THREE.Quaternion();
      const pa = new THREE.Vector3();
      const pb = new THREE.Vector3();
      const target = new THREE.Vector3();
      const corner = new THREE.Vector3();
      const yAxis = new THREE.Vector3(0, 1, 0);
      const colour = { hi: new THREE.Color(), lo: new THREE.Color(), ink: new THREE.Color() };
      const goal = { hi: new THREE.Color(), lo: new THREE.Color(), ink: new THREE.Color(), night: 0 };
      let night = 0;
      let lookVersion = -1;
      let progress = 0;
      let time = 0;
      let width = 1;
      let height = 1;
      let phase = "";
      let shownProgress = -1;

      return {
        scene,
        camera,
        resize(w, h) {
          width = w;
          height = h;
          frameAll(w, h);
        },
        update(frame) {
          const dt = Math.min(frame.dt, 1 / 20);
          time += dt;
          if (frame.width !== width || frame.height !== height) {
            width = frame.width;
            height = frame.height;
            frameAll(width, height);
          }
          const w = width;
          const h = height;

          // Scroll through the section, eased so wheel steps glide
          const bus = getSensorBus().state;
          const vh = bus.viewport.height || h;
          const own = opts.current.driven;
          const at = clamp01(own ?? (bus.scroll.y - place.current.top) / Math.max(1, place.current.height - vh));
          progress += (at - progress) * (1 - Math.exp(-dt * 6));
          if (Math.abs(at - progress) < 1e-4) progress = at;
          const s = progress;

          const L = look.current;
          if (L.version !== lookVersion) {
            goal.hi.setStyle(L.hi);
            goal.lo.setStyle(L.lo);
            goal.ink.setStyle(L.dots);
            goal.night = L.night;
            if (lookVersion < 0) {
              colour.hi.copy(goal.hi);
              colour.lo.copy(goal.lo);
              colour.ink.copy(goal.ink);
              night = goal.night;
            }
            lookVersion = L.version;
          }
          const kc = 1 - Math.exp(-dt * 5);
          colour.hi.lerp(goal.hi, kc);
          colour.lo.lerp(goal.lo, kc);
          colour.ink.lerp(goal.ink, kc);
          night += (goal.night - night) * kc;
          backU.uHi.value.copy(colour.hi);
          backU.uLo.value.copy(colour.lo);
          dotU.uColor.value.copy(colour.ink);
          scene.environmentIntensity = lerp(1, 0.55, night);
          key.intensity = lerp(1.3, 0.9, night);
          rim.intensity = lerp(0.8, 2.4, night);

          const sp = clamp01((s - SPLIT[0]) / (SPLIT[1] - SPLIT[0]));
          const op = clamp01((s - ORBIT[0]) / (ORBIT[1] - ORBIT[0]));
          const u = clamp01((s - ORBIT[0]) / (1 - ORBIT[0]));
          const e1 = smooth(0, 0.85, sp);
          const e2 = ease(op);
          const { twist: turns, align: alignAt } = opts.current;

          // The whole product's pose, swaying a little while it waits
          qa.slerpQuaternions(heroQ, colQ, e1);
          qa.premultiply(turn.setFromAxisAngle(yAxis, 0.07 * Math.sin(time * 0.45) * (1 - e1)));

          for (const p of pieces) {
            const ls = ease(clamp01((sp - p.splitAt) / (1 - STAGGER)));
            pa.copy(p.centre).addScaledVector(A, p.offset * ls).applyQuaternion(qa);
            const twistQ = qt.setFromAxisAngle(A, p.core ? 0 : turns * Math.PI * 2 * ls * Math.sign(p.step));
            qb.copy(qa).multiply(twistQ);
            if (p.core) {
              // The core settles in the middle and turns slowly as the orbits go round
              pa.multiplyScalar(1 - e2);
              qb.premultiply(turn.setFromAxisAngle(yAxis, (u * 0.9 + Math.sin(time * 0.3) * 0.02) * e2));
            } else {
              const lo2 = ease(clamp01((op - p.orbitAt) / (1 - STAGGER)));
              if (lo2 > 0) {
                const R = radii[p.orbit];
                const advance = (1 - 0.2 * p.orbit) * Math.PI * 2 * u + time * 0.012;
                // Into the ring's own space, swing round to the slot, and back out
                pb.copy(pa).applyMatrix4(ringInv[p.orbit]);
                const r0 = Math.hypot(pb.x, pb.z);
                const a0 = Math.atan2(pb.x, pb.z);
                const rr = lerp(r0, R, lo2);
                const aa = a0 + (wrap(p.phase - a0) + advance) * lo2;
                const yy = lerp(pb.y, Math.sin(time * 0.8 + p.phase * 3) * 0.03, lo2);
                pa.set(Math.sin(aa) * rr, yy, Math.cos(aa) * rr).applyMatrix4(ringM[p.orbit]);
                // In orbit each part shows the face that pointed away from the core
                const faceQ = turn.copy(orbQ);
                if (!flat && p.step < 0) faceQ.multiply(flipQ);
                faceQ.multiply(twistQ);
                qb.slerp(faceQ, lo2);
              }
            }
            p.holder.position.copy(pa);
            p.holder.quaternion.copy(qb);
          }

          // The camera pulls back as the product opens up
          const dist = lerp(lerp(fits.hero, fits.col, e1), fits.orb, e2);
          const elev = lerp(lerp(0.1, 0.14, e1), 0.36, e2);
          target.copy(colCentre).multiplyScalar(e1 * (1 - e2));
          camera.position.set(target.x, target.y + Math.sin(elev) * dist, target.z + Math.cos(elev) * dist);
          camera.lookAt(target);
          camera.aspect = w / h;
          const al = w < 700 ? 0.5 : lerp(alignAt, 0.5, e1);
          camera.setViewOffset(w, h, (0.5 - al) * w, 0, w, h);
          camera.updateMatrixWorld();

          dotU.uOpacity.value = e2 * lerp(0.5, 0.65, night);
          dotU.uSize.value = 1.9 * frame.pixelRatio;
          dotU.uCoreZ.value = dist;
          lineU.uOpacity.value = smooth(0.2, 0.8, sp) * (1 - e2) * 0.45;
          line.quaternion.copy(qa);

          // Labels sit just outside each part, on the side with room
          const narrow = w < 700;
          for (const p of pieces) {
            const tag = labelRefs.current.get(p.id);
            if (!tag) continue;
            const settled = p.core ? e2 : ease(clamp01((op - p.orbitAt) / (1 - STAGGER)));
            let o = smooth(0.72, 1, settled);
            if (o > 0.001) {
              p.holder.updateMatrix();
              let x0 = Infinity;
              let x1 = -Infinity;
              let y0 = Infinity;
              let y1 = -Infinity;
              for (let c = 0; c < 8; c++) {
                corner
                  .set(c & 1 ? p.box.max.x : p.box.min.x, c & 2 ? p.box.max.y : p.box.min.y, c & 4 ? p.box.max.z : p.box.min.z)
                  .applyMatrix4(p.holder.matrix)
                  .project(camera);
                const sx = (corner.x + 1) * 0.5 * w;
                const sy = (1 - corner.y) * 0.5 * h;
                x0 = Math.min(x0, sx);
                x1 = Math.max(x1, sx);
                y0 = Math.min(y0, sy);
                y1 = Math.max(y1, sy);
              }
              const cx = (x0 + x1) / 2;
              const cy = (y0 + y1) / 2;
              const hw = ((x1 - x0) / 2) * 0.78;
              const tw = widths.current.get(p.id) ?? 220;
              let side = cx < w * 0.5 - 24 ? -1 : cx > w * 0.5 + 24 ? 1 : p.side;
              if (side < 0 && cx - hw - tw < 16) side = 1;
              else if (side > 0 && cx + hw + tw > w - 16) side = -1;
              if (side !== p.side) {
                p.side = side;
                tag.dataset.side = side < 0 ? "l" : "r";
              }
              // The far side of each orbit sits behind the core, so its labels step back
              pb.copy(p.holder.position).applyMatrix4(camera.matrixWorldInverse);
              o *= 1 - smooth(-0.4, 0.9, -pb.z - dist) * (narrow ? 1 : 0.62);
              const t = `translate3d(${(cx + side * hw).toFixed(1)}px,${cy.toFixed(1)}px,0)`;
              if (t !== p.placed) {
                tag.style.transform = t;
                p.placed = t;
              }
            }
            const os = o > 0.001 ? o.toFixed(3) : "0";
            if (os !== p.shown) {
              tag.style.opacity = os;
              tag.style.visibility = os === "0" ? "hidden" : "visible";
              p.shown = os;
            }
          }

          if (el) {
            const next = s < SPLIT[0] + 0.01 ? "assembled" : s < SPLIT[1] ? "splitting" : s < ORBIT[0] + 0.04 ? "split" : "orbiting";
            if (next !== phase) {
              phase = next;
              el.dataset.phase = next;
              opts.current.onPhaseChange?.(next);
            }
            if (Math.abs(s - shownProgress) > 0.0005) {
              shownProgress = s;
              el.style.setProperty("--eo-progress", s.toFixed(4));
            }
          }
        },
        dispose() {
          env.dispose();
          textures.forEach((t) => t.dispose());
          labelRefs.current.forEach((tag) => {
            tag.style.opacity = "0";
            tag.style.visibility = "hidden";
          });
        },
      };
    },
  });

  const list =
    labels.length > 0 ? (
      <ol className="vv-eo-list">
        {labels.map((l) => (
          <li key={l.id}>
            <strong>{l.label}</strong>
            {l.note && <span>{l.note}</span>}
          </li>
        ))}
      </ol>
    ) : null;

  return (
    <section
      ref={rootRef}
      className={`vv-exploded-orbit ${className}`}
      data-theme={theme}
      data-live={mounted ? "" : undefined}
      data-driven={driven == null ? undefined : ""}
      style={{ ...style, ["--eo-length" as string]: driven == null ? length : "100svh" }}
    >
      <style>{STYLES}</style>
      <div className="vv-eo-stage">
        <div ref={ref} className="vv-eo-scene" aria-hidden="true" />
        <div className="vv-eo-labels" aria-hidden="true">
          {labels.map((l) => (
            <div
              key={l.id}
              ref={(node) => {
                if (node) labelRefs.current.set(l.id, node);
                else labelRefs.current.delete(l.id);
              }}
              className="vv-eo-label"
              data-side="r"
            >
              <div className="vv-eo-tag">
                <i className="vv-eo-pin" />
                <i className="vv-eo-lead" />
                <span className="vv-eo-text">
                  <strong>{l.label}</strong>
                  {l.note && <span>{l.note}</span>}
                </span>
              </div>
            </div>
          ))}
        </div>
        {children && <div className="vv-eo-over">{children}</div>}
        <div className="vv-eo-fallback">{fallback ?? list}</div>
      </div>
    </section>
  );
}

export default ExplodedOrbit;

const BACK_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BACK_FRAG = /* glsl */ `
uniform vec3 uHi;
uniform vec3 uLo;
varying vec2 vUv;
void main() {
  // Brightest a little above the middle, and exactly the page's ground at every edge
  vec2 q = (vUv - vec2(0.5, 0.54)) / vec2(0.5, 0.46);
  float g = smoothstep(0.0, 1.0, length(q));
  gl_FragColor = vec4(mix(uHi, uLo, g), 1.0);
  #include <colorspace_fragment>
}
`;

const DOT_VERT = /* glsl */ `
uniform float uSize;
uniform float uCoreZ;
varying float vNear;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize;
  vNear = 1.0 - smoothstep(uCoreZ - 0.8, uCoreZ + 0.8, -mv.z) * 0.65;
}
`;

const DOT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vNear;
void main() {
  float a = smoothstep(0.5, 0.15, length(gl_PointCoord - 0.5)) * uOpacity * vNear;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
`;

const STYLES = `
/* Zero specificity, so a class that places the section wins. */
:where(.vv-exploded-orbit) { position: relative; display: block; }
.vv-exploded-orbit {
  --eo-ground: #f2f2f0; --eo-ground-hi: #fdfdfc; --eo-orbit: #2b6069;
  --eo-ink: #121314; --eo-mute: #686d71; --eo-lead: rgba(18, 19, 20, 0.38);
  height: var(--eo-length, 400vh); color: var(--eo-ink); background: var(--eo-ground);
}
.vv-exploded-orbit[data-theme="dark"] {
  --eo-ground: #0c0d0f; --eo-ground-hi: #1a1e23; --eo-orbit: #9fc3cf;
  --eo-ink: #eceeef; --eo-mute: rgba(236, 238, 239, 0.6); --eo-lead: rgba(236, 238, 239, 0.4);
}
.vv-eo-stage { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; }
/* Driven by the progress prop: the stage fills the section, whatever its height. */
.vv-exploded-orbit[data-driven] .vv-eo-stage { position: relative; height: 100%; }
.vv-eo-scene { position: absolute; inset: 0; }
.vv-eo-labels { position: absolute; inset: 0; pointer-events: none; }
.vv-eo-label { position: absolute; left: 0; top: 0; width: 0; height: 0; opacity: 0; visibility: hidden; will-change: transform, opacity; }
.vv-eo-tag { position: absolute; top: 0; left: 0; display: flex; align-items: center; transform: translateY(-50%); }
.vv-eo-label[data-side="l"] .vv-eo-tag { left: auto; right: 0; flex-direction: row-reverse; text-align: right; }
.vv-eo-pin { flex: none; width: 7px; height: 7px; margin: 0 -3.5px; border-radius: 50%; background: var(--eo-ground); box-shadow: inset 0 0 0 1.5px var(--eo-ink); }
.vv-eo-lead { flex: none; width: 30px; height: 1px; margin: 0 10px 0 7px; background: var(--eo-lead); }
.vv-eo-label[data-side="l"] .vv-eo-lead { margin: 0 7px 0 10px; }
.vv-eo-text { display: grid; gap: 3px; width: max-content; max-width: 14.5rem; }
.vv-eo-text strong { font-size: 14px; font-weight: 600; line-height: 1.2; letter-spacing: -0.01em; }
.vv-eo-text span { font-size: 12.5px; line-height: 1.35; color: var(--eo-mute); text-wrap: pretty; }
.vv-eo-over { position: absolute; inset: 0; pointer-events: none; }
.vv-eo-over > * { pointer-events: auto; }
.vv-eo-fallback { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.vv-eo-list { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); gap: 18px 28px; }
.vv-eo-list li { display: grid; gap: 4px; padding-top: 12px; border-top: 1px solid var(--eo-lead); }
.vv-eo-list strong { font-size: 15px; font-weight: 600; }
.vv-eo-list span { font-size: 13.5px; line-height: 1.4; color: var(--eo-mute); }
@media (prefers-reduced-motion: reduce) {
  .vv-exploded-orbit { height: auto; }
  .vv-eo-stage { position: relative; height: auto; overflow: visible; display: grid; gap: 40px; padding: 120px max(16px, 5vw) 72px; }
  .vv-eo-over { position: relative; inset: auto; }
  .vv-eo-labels { display: none; }
  .vv-eo-fallback { position: relative; width: auto; height: auto; overflow: visible; clip-path: none; white-space: normal; }
}
`;
