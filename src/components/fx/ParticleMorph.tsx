"use client";

import { useEffect, useRef } from "react";
import { buildClouds, SHAPES } from "./shapes";

/**
 * The hero's living city: a few thousand points that fly between shapes (a planet, a skyline, a
 * load-balanced system, a lattice of classes). Drawn on a 2D canvas with a hand-rolled 3D
 * projection, so it needs no WebGL library. The cursor tilts the scene through a spring and
 * gently pushes nearby points away. It sleeps when off-screen or in a background tab, and draws a
 * single still frame for reduced-motion users.
 */
export function ParticleMorph({ shape, onAutoAdvance, className = "" }: { shape: number; onAutoAdvance?: (next: number) => void; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = useRef(shape);
  const advance = useRef(onAutoAdvance);
  advance.current = onAutoAdvance;

  useEffect(() => {
    target.current = shape;
  }, [shape]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 640 || (navigator.hardwareConcurrency ?? 8) <= 4;
    const N = small ? 2600 : 5200;
    const clouds = buildClouds(N);

    // Live positions start on the first shape.
    const pos = new Float32Array(clouds[0].xyz);
    const from = new Float32Array(clouds[0].xyz);
    const hue = new Float32Array(clouds[0].hue);
    const delay = new Float32Array(N);
    for (let i = 0; i < N; i += 1) delay[i] = ((i * 2654435761) % 1000) / 1000;

    let current = 0;
    let morphStart = -1;
    const MORPH_MS = 1700;
    const HOLD_MS = 4200;
    let lastShapeAt = 0;

    // Rotation springs (custom physics: stiffness and damping, integrated per frame).
    const rot = { yaw: 0.6, pitch: -0.18, vy: 0, vp: 0, tYaw: 0.6, tPitch: -0.18 };
    let autoYaw = 0;
    const pointer = { x: -9999, y: -9999, inside: false };

    let width = 0;
    let height = 0;
    let dpr = 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduced) draw(performance.now());
    };

    // Colours come from the theme tokens, re-read when the theme changes.
    let palette: string[] = [];
    let light = false;
    const readColours = () => {
      const css = getComputedStyle(document.documentElement);
      const hex = (name: string) => {
        const v = css.getPropertyValue(name).trim();
        // The CSS minifier may shorten #ffffff to #fff.
        if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
        return /^#[0-9a-f]{6}$/i.test(v) ? v : "#38e1ff";
      };
      const stops = [hex("--flow"), hex("--player"), hex("--pink")];
      const bg = hex("--bg");
      light = parseInt(bg.slice(1, 3), 16) > 128;
      const toRgb = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
      const rgb = stops.map(toRgb);
      palette = [];
      for (let k = 0; k < 24; k += 1) {
        const t = k / 23;
        const seg = t < 0.5 ? 0 : 1;
        const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
        const c = rgb[seg].map((v, j) => Math.round(v + (rgb[seg + 1][j] - v) * u));
        palette.push(`rgb(${c[0]},${c[1]},${c[2]})`);
      }
    };
    readColours();
    const themeWatch = new MutationObserver(readColours);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const scheme = window.matchMedia("(prefers-color-scheme: light)");
    scheme.addEventListener("change", readColours);

    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const startMorph = (to: number, now: number) => {
      from.set(pos);
      current = to;
      morphStart = now;
      lastShapeAt = now;
    };

    const draw = (now: number) => {
      // Shape changes: requested by the parent, or automatic after a pause.
      if (target.current !== current) startMorph(target.current, now);
      else if (!reduced && morphStart < 0 && now - lastShapeAt > HOLD_MS && !pointer.inside) {
        const next = (current + 1) % SHAPES.length;
        advance.current?.(next);
        target.current = next;
        startMorph(next, now);
      }

      const goal = clouds[current].xyz;
      const goalHue = clouds[current].hue;
      if (reduced) {
        pos.set(goal);
        hue.set(goalHue);
      } else if (morphStart >= 0) {
        const t = (now - morphStart) / MORPH_MS;
        for (let i = 0; i < N; i += 1) {
          // Each point leaves a little later than the last: the shape dissolves and re-forms in a wave.
          const local = Math.min(1, Math.max(0, (t - delay[i] * 0.35) / 0.65));
          const e = ease(local);
          const k = i * 3;
          // Points arc outwards mid-flight, so the morph feels three-dimensional.
          const lift = Math.sin(e * Math.PI) * 0.18;
          pos[k] = from[k] + (goal[k] - from[k]) * e + from[k] * lift;
          pos[k + 1] = from[k + 1] + (goal[k + 1] - from[k + 1]) * e;
          pos[k + 2] = from[k + 2] + (goal[k + 2] - from[k + 2]) * e + from[k + 2] * lift;
          hue[i] = hue[i] + (goalHue[i] - hue[i]) * 0.08;
        }
        if (t > 1.4) morphStart = -1;
      }

      // Spring the rotation towards the pointer target.
      if (!reduced) {
        autoYaw += 0.0016;
        const k = 0.012;
        const d = 0.86;
        rot.vy = (rot.vy + (rot.tYaw - rot.yaw) * k) * d;
        rot.vp = (rot.vp + (rot.tPitch - rot.pitch) * k) * d;
        rot.yaw += rot.vy;
        rot.pitch += rot.vp;
      }
      const yaw = rot.yaw + autoYaw;
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const cp = Math.cos(rot.pitch);
      const sp = Math.sin(rot.pitch);

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = light ? "source-over" : "lighter";
      const scale = Math.min(width, height) * 0.36;
      const camera = 3.2;
      const cxs = width / 2;
      const cys = height / 2;
      const time = now / 1000;
      for (let i = 0; i < N; i += 1) {
        const k = i * 3;
        // A slow breath keeps the cloud alive between morphs.
        const wobble = reduced ? 0 : Math.sin(time * 1.3 + i * 0.37) * 0.006;
        const x = pos[k] + wobble;
        const y = pos[k + 1] + wobble;
        const z = pos[k + 2];
        const x1 = x * cy - z * sy;
        const z1 = x * sy + z * cy;
        const y2 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        const persp = camera / (camera - z2);
        let sx = cxs + x1 * scale * persp;
        let syy = cys - y2 * scale * persp;
        if (pointer.inside) {
          const dx = sx - pointer.x;
          const dy = syy - pointer.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < 9000) {
            const push = (1 - dist2 / 9000) * 14;
            const dist = Math.sqrt(dist2) || 1;
            sx += (dx / dist) * push;
            syy += (dy / dist) * push;
          }
        }
        const depth = (z2 + 1.4) / 2.8;
        const size = (light ? 1.0 : 0.8) + depth * 1.4;
        ctx.globalAlpha = Math.max(0.12, Math.min(1, (light ? 0.4 : 0.3) + depth * 0.8));
        ctx.fillStyle = palette[Math.min(23, Math.max(0, Math.round(hue[i] * 23)))];
        ctx.fillRect(sx - size / 2, syy - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    let raf = 0;
    let visible = true;
    const loop = (now: number) => {
      draw(now);
      raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
    };
    const wake = () => {
      if (!reduced && !raf && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      pointer.inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      pointer.x = x;
      pointer.y = y;
      // Tilt follows the cursor anywhere on the page, more strongly near the scene.
      rot.tYaw = 0.6 + ((e.clientX / window.innerWidth) * 2 - 1) * 0.55;
      rot.tPitch = -0.18 + ((e.clientY / window.innerHeight) * 2 - 1) * 0.3;
    };
    const onLeave = () => {
      pointer.inside = false;
    };

    const sizeWatch = new ResizeObserver(resize);
    sizeWatch.observe(canvas);
    const viewWatch = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      wake();
    });
    viewWatch.observe(canvas);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    resize();
    if (reduced) draw(performance.now());
    else wake();

    // Reduced motion: still redraw (instantly) when the learner picks a shape.
    const still = reduced ? window.setInterval(() => target.current !== current && draw(performance.now()), 150) : 0;

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(still);
      sizeWatch.disconnect();
      viewWatch.disconnect();
      themeWatch.disconnect();
      scheme.removeEventListener("change", readColours);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className={`block h-full w-full ${className}`} aria-hidden="true" />;
}
