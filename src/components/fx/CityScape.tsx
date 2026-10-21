"use client";

import { useEffect, useMemo, useRef } from "react";
import { boundsOf, districtAt, layoutCity, project, unproject, type CityBuilding, type CityDistrict } from "./cityLayout";

type Rgb = [number, number, number];
const SEEN_KEY = "archirift:city-built";
const ACCENTS = ["flow", "player", "warn", "good", "pink", "lime"] as const;

interface WorldInput {
  id: string;
  track: "lld" | "hld";
  accent: string;
  name: string;
  order: number;
}

interface LevelInput {
  id: string;
  world: string;
  difficulty: number;
}

/**
 * Your progress as a skyline. Each district is a block, each level a building: finished levels
 * stand solid with warm lit windows, unfinished ones are still blueprints. Newly finished levels
 * rise out of the ground the next time you see the map. The camera glides between the two halves
 * of the city when you switch track, and leans towards whichever district you are looking at.
 * Purely decorative for assistive tech: the tiles below are the accessible way in.
 */
export function CityScape({
  worlds,
  levels,
  done,
  track,
  focus,
  onFocus,
  onPick,
  haze = true,
  className = "",
}: {
  worlds: WorldInput[];
  levels: LevelInput[];
  done: Set<string>;
  /** Which half of the city the camera frames; "all" shows the whole skyline. */
  track: "lld" | "hld" | "all";
  focus: string | null;
  onFocus: (id: string | null) => void;
  onPick: (id: string) => void;
  /** Paint fog in the page colour; turn off on cards, where a CSS mask fades the edges instead. */
  haze?: boolean;
  className?: string;
}) {
  const layout = useMemo(() => layoutCity(worlds, levels), [worlds, levels]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ done, track, focus, onFocus, onPick, haze });
  live.current = { done, track, focus, onFocus, onPick, haze };
  const wakeRef = useRef<() => void>(() => {});

  useEffect(() => wakeRef.current(), [done, track, focus]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const buildings = [...layout.buildings].sort((a, b) => a.x + a.y - (b.x + b.y));
    const byWorld = new Map<string, CityDistrict>(layout.districts.map((d) => [d.id, d]));
    const orderOf = new Map(worlds.map((w) => [w.id, String(w.order).padStart(2, "0")]));
    const tallest = new Map<string, number>();
    for (const b of layout.buildings) tallest.set(b.worldId, Math.max(tallest.get(b.worldId) ?? 0, b.h));

    // Which finished buildings this browser has already watched go up.
    let seen = new Set<string>();
    try {
      seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
    } catch {
      /* private mode: everything simply appears built */
    }
    const growStart = new Map<string, number>();
    const syncGrowth = (now: number) => {
      let fresh = 0;
      for (const b of buildings) {
        const finished = live.current.done.has(b.levelId);
        if (!finished) {
          growStart.delete(b.levelId);
          continue;
        }
        if (growStart.has(b.levelId)) continue;
        if (seen.has(b.levelId) || reduced) growStart.set(b.levelId, -Infinity);
        else {
          growStart.set(b.levelId, now + 350 + fresh * 110);
          fresh += 1;
          seen.add(b.levelId);
        }
      }
      if (fresh > 0) {
        try {
          localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
        } catch {
          /* ignore */
        }
      }
    };
    const growth = (b: CityBuilding, now: number) => {
      const start = growStart.get(b.levelId);
      if (start === undefined) return 0;
      const t = Math.min(1, Math.max(0, (now - start) / 900));
      // Ease out with a small overshoot: the tower settles into place.
      const c1 = 1.3;
      return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };

    // Theme colours, re-read when the theme changes.
    const colour = { bg: [7, 9, 15] as Rgb, surface: [14, 19, 29] as Rgb, surface2: [20, 26, 38] as Rgb, ink: [230, 234, 240] as Rgb, quiet: [150, 160, 176] as Rgb, line: [35, 42, 54] as Rgb, lineStrong: [52, 62, 80] as Rgb, lamp: [255, 196, 107] as Rgb, flow: [56, 225, 255] as Rgb };
    const accent: Record<string, Rgb> = {};
    let light = false;
    let font = "ui-monospace, monospace";
    const readColours = () => {
      const css = getComputedStyle(document.documentElement);
      const rgb = (name: string, fallback: Rgb): Rgb => {
        let v = css.getPropertyValue(name).trim();
        // The CSS minifier may shorten #ffffff to #fff.
        if (/^#[0-9a-f]{3}$/i.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
        if (!/^#[0-9a-f]{6}$/i.test(v)) return fallback;
        return [1, 3, 5].map((k) => parseInt(v.slice(k, k + 2), 16)) as Rgb;
      };
      colour.bg = rgb("--bg", colour.bg);
      colour.surface = rgb("--surface", colour.surface);
      colour.surface2 = rgb("--surface-2", colour.surface2);
      colour.ink = rgb("--ink", colour.ink);
      colour.quiet = rgb("--ink-quiet", colour.quiet);
      colour.line = rgb("--line", colour.line);
      colour.lineStrong = rgb("--line-strong", colour.lineStrong);
      colour.lamp = rgb("--lamp", colour.lamp);
      colour.flow = rgb("--flow", colour.flow);
      for (const a of ACCENTS) accent[a] = rgb(`--${a}`, colour.flow);
      light = colour.bg[0] + colour.bg[1] + colour.bg[2] > 384;
      font = getComputedStyle(document.body).getPropertyValue("--font-jetbrains-mono").trim() || font;
      wake();
    };
    const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const css = (c: Rgb, alpha = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha})`;

    let width = 0;
    let height = 0;
    const cam = { x: 0, y: 0, s: 20, vx: 0, vy: 0, vs: 0, ready: false };
    const pointer = { inside: false, hover: null as string | null };

    const cameraTarget = () => {
      const { track, focus } = live.current;
      const own = layout.districts.filter((d) => track === "all" || d.track === track);
      const b = boundsOf(own);
      let x = (b.minX + b.maxX) / 2;
      let y = (b.minY + b.maxY) / 2;
      let s = Math.min(width / (b.maxX - b.minX + 4), height / (b.maxY - b.minY + 1.2));
      const fd = focus ? byWorld.get(focus) : undefined;
      // Lean towards the district under discussion, but only when the pointer is not on the canvas
      // itself (moving the camera under a still pointer would make the hover jump).
      if (fd && (track === "all" || fd.track === track) && !pointer.inside) {
        const fb = boundsOf([fd]);
        x += ((fb.minX + fb.maxX) / 2 - x) * 0.22;
        y += ((fb.minY + fb.maxY) / 2 - y) * 0.22;
        s *= 1.07;
      }
      return { x, y, s };
    };

    const toScreen = (x: number, y: number, z: number): [number, number] => {
      const [X, Y] = project(x, y, z);
      return [width / 2 + (X - cam.x) * cam.s, height / 2 + (Y - cam.y) * cam.s];
    };
    const poly = (pts: [number, number][]) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    };

    // Traffic: a few lights travelling the roads, like requests moving through the city.
    const cars = reduced
      ? []
      : Array.from({ length: Math.min(34, layout.roads.length * 4) }, (_, i) => ({
          road: i % layout.roads.length,
          t: ((i * 0.618) % 1 + 1) % 1,
          dir: i % 2 === 0 ? 1 : -1,
          speed: 0.9 + ((i * 0.37) % 1) * 0.9,
          warm: i % 3 === 0,
        }));

    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      syncGrowth(now);

      const goal = cameraTarget();
      if (!cam.ready || reduced) {
        Object.assign(cam, { x: goal.x, y: goal.y, s: goal.s, vx: 0, vy: 0, vs: 0, ready: width > 0 });
      } else {
        // A critically damped-ish spring: the camera glides and settles without wobbling.
        const k = 0.06;
        const d = 0.78;
        cam.vx = (cam.vx + (goal.x - cam.x) * k) * d;
        cam.vy = (cam.vy + (goal.y - cam.y) * k) * d;
        cam.vs = (cam.vs + (goal.s - cam.s) * k) * d;
        cam.x += cam.vx;
        cam.y += cam.vy;
        cam.s += cam.vs;
      }

      const { focus, track } = live.current;
      const active = pointer.hover ?? focus;
      ctx.clearRect(0, 0, width, height);

      // District plates.
      for (const d of layout.districts) {
        const on = d.id === active;
        const tone = accent[d.accent] ?? colour.flow;
        const m = 0.18;
        poly([toScreen(d.x - m, d.y - m, 0), toScreen(d.x + d.w + m, d.y - m, 0), toScreen(d.x + d.w + m, d.y + d.d + m, 0), toScreen(d.x - m, d.y + d.d + m, 0)]);
        ctx.fillStyle = css(mix(light ? colour.surface : colour.surface, tone, on ? 0.14 : 0.04), track === "all" || d.track === track ? 1 : 0.55);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = css(on ? tone : colour.line, on ? 0.8 : 0.9);
        ctx.stroke();
      }

      // The highway between the two halves: a wide carriageway under its own dashed centre line.
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const [w, c, a] of [
        [cam.s * 0.9, colour.lineStrong, light ? 0.55 : 0.5],
        [cam.s * 0.7, colour.surface2, 1],
      ] as const) {
        ctx.lineWidth = Math.max(2, w);
        ctx.strokeStyle = css(c, a);
        ctx.beginPath();
        for (const r of layout.roads) {
          if (!r.highway) continue;
          const a1 = toScreen(r.x1, r.y1, 0);
          const b1 = toScreen(r.x2, r.y2, 0);
          ctx.moveTo(a1[0], a1[1]);
          ctx.lineTo(b1[0], b1[1]);
        }
        ctx.stroke();
      }
      ctx.lineCap = "butt";
      ctx.lineJoin = "miter";

      // Roads: a quiet centre line.
      ctx.setLineDash([cam.s * 0.25, cam.s * 0.3]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = css(colour.lineStrong, 0.7);
      for (const r of layout.roads) {
        const a = toScreen(r.x1, r.y1, 0);
        const b = toScreen(r.x2, r.y2, 0);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Traffic.
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1.5, cam.s * 0.09);
      for (const c of cars) {
        const r = layout.roads[c.road];
        const len = Math.hypot(r.x2 - r.x1, r.y2 - r.y1) || 1;
        c.t = (((c.t + (c.dir * c.speed * dt) / len) % 1) + 1) % 1;
        const tail = Math.max(0, Math.min(1, c.t - (c.dir * 0.7) / len));
        const lane = c.dir * 0.12;
        const nx = (r.y2 - r.y1) / len;
        const ny = -(r.x2 - r.x1) / len;
        const a = toScreen(r.x1 + (r.x2 - r.x1) * tail + nx * lane, r.y1 + (r.y2 - r.y1) * tail + ny * lane, 0);
        const b = toScreen(r.x1 + (r.x2 - r.x1) * c.t + nx * lane, r.y1 + (r.y2 - r.y1) * c.t + ny * lane, 0);
        const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
        const tone = c.warm ? colour.lamp : colour.flow;
        g.addColorStop(0, css(tone, 0));
        g.addColorStop(1, css(tone, light ? 0.8 : 0.95));
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      ctx.lineCap = "butt";

      // Buildings, back to front.
      let growing = false;
      for (const b of buildings) {
        const district = byWorld.get(b.worldId);
        const tone = accent[district?.accent ?? "flow"] ?? colour.flow;
        const on = b.worldId === active;
        const dim = track === "all" || district?.track === track ? 1 : 0.5;
        const g = growth(b, now);
        if (g > 0 && g < 1) growing = true;

        if (g < 1) {
          // Blueprint: the outline of what this level will build.
          const h = b.h;
          const top = [toScreen(b.x, b.y, h), toScreen(b.x + b.w, b.y, h), toScreen(b.x + b.w, b.y + b.d, h), toScreen(b.x, b.y + b.d, h)];
          const base = [toScreen(b.x + b.w, b.y, 0), toScreen(b.x + b.w, b.y + b.d, 0), toScreen(b.x, b.y + b.d, 0)];
          ctx.lineWidth = 1;
          ctx.strokeStyle = css(on ? tone : colour.quiet, (on ? 0.8 : light ? 0.5 : 0.45) * dim);
          poly(top);
          ctx.fillStyle = css(on ? tone : colour.quiet, (on ? 0.12 : 0.06) * dim);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          for (const [i, p] of [[1, base[0]], [2, base[1]], [3, base[2]]] as const) {
            ctx.moveTo(top[i][0], top[i][1]);
            ctx.lineTo(p[0], p[1]);
          }
          ctx.moveTo(base[0][0], base[0][1]);
          ctx.lineTo(base[1][0], base[1][1]);
          ctx.lineTo(base[2][0], base[2][1]);
          ctx.stroke();
        }

        if (g > 0) {
          const h = b.h * g;
          const a = toScreen(b.x, b.y, h);
          const t1 = toScreen(b.x + b.w, b.y, h);
          const t2 = toScreen(b.x + b.w, b.y + b.d, h);
          const t3 = toScreen(b.x, b.y + b.d, h);
          const g1 = toScreen(b.x + b.w, b.y, 0);
          const g2 = toScreen(b.x + b.w, b.y + b.d, 0);
          const g3 = toScreen(b.x, b.y + b.d, 0);
          // On paper, built towers are inked in so they stand out from the pale blueprints around them.
          // At night they glow with their district's colour, so lit towers read against the wireframes.
          const right = light ? mix(colour.surface, colour.ink, 0.42) : mix(colour.surface2, tone, 0.22);
          const left = light ? mix(colour.surface, colour.ink, 0.22) : mix(colour.surface, tone, 0.12);
          const roof = light ? mix(colour.surface, tone, 0.55) : mix(colour.surface2, tone, on ? 0.75 : 0.6);
          ctx.globalAlpha = dim;
          poly([g1, g2, t2, t1]);
          ctx.fillStyle = css(right);
          ctx.fill();
          poly([g3, g2, t2, t3]);
          ctx.fillStyle = css(left);
          ctx.fill();
          poly([a, t1, t2, t3]);
          ctx.fillStyle = css(roof);
          ctx.fill();
          ctx.strokeStyle = css(light ? colour.ink : tone, light ? 0.55 : on ? 0.95 : 0.7);
          ctx.lineWidth = 1;
          ctx.stroke();

          // Lit windows, fading in as the tower settles.
          if (g > 0.85 && cam.s > 9) {
            const floors = Math.max(2, Math.floor(b.h / 0.3));
            const fade = Math.min(1, (g - 0.85) / 0.15) * dim;
            for (let f = 0; f < floors; f += 1) {
              const z0 = ((f + 0.3) / floors) * b.h;
              const z1 = ((f + 0.7) / floors) * b.h;
              for (let k = 0; k < 2; k += 1) {
                const lit = ((b.seed * 997 + f * 31 + k * 17) % 1) > 0.3;
                const u0 = 0.18 + k * 0.38;
                const u1 = u0 + 0.24;
                ctx.fillStyle = lit ? css(colour.lamp, (light ? 0.85 : 0.9) * fade) : css(colour.bg, 0.45 * fade);
                poly([toScreen(b.x + b.w, b.y + b.d * u0, z0), toScreen(b.x + b.w, b.y + b.d * u1, z0), toScreen(b.x + b.w, b.y + b.d * u1, z1), toScreen(b.x + b.w, b.y + b.d * u0, z1)]);
                ctx.fill();
                ctx.fillStyle = lit && ((b.seed * 409 + f * 13 + k) % 1) > 0.35 ? css(colour.lamp, (light ? 0.7 : 0.75) * fade) : css(colour.bg, 0.45 * fade);
                poly([toScreen(b.x + b.w * u0, b.y + b.d, z0), toScreen(b.x + b.w * u1, b.y + b.d, z0), toScreen(b.x + b.w * u1, b.y + b.d, z1), toScreen(b.x + b.w * u0, b.y + b.d, z1)]);
                ctx.fill();
              }
            }
          }
          ctx.globalAlpha = 1;
        }
      }

      // Atmospheric haze: the far edge of the city fades into the night.
      if (live.current.haze) {
        const haze = ctx.createLinearGradient(0, 0, 0, height);
        haze.addColorStop(0, css(colour.bg, 0.9));
        haze.addColorStop(0.28, css(colour.bg, 0));
        haze.addColorStop(0.85, css(colour.bg, 0));
        haze.addColorStop(1, css(colour.bg, 0.6));
        ctx.fillStyle = haze;
        ctx.fillRect(0, 0, width, height);
      }

      // Each block carries its district number (as on the tiles below); the one you are looking at
      // also raises its name above the rooftops.
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const d of layout.districts) {
        if (track !== "all" && d.track !== track) continue;
        const on = d.id === active;
        // Too small to read: numbers would only crowd each other.
        if (cam.s < 8 && !on) continue;
        const tone = accent[d.accent] ?? colour.ink;
        const [nx, ny] = toScreen(d.x + d.w + 0.15, d.y + d.d + 0.15, 0);
        ctx.font = `600 10px ${font}`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = css(colour.bg, 0.9);
        ctx.strokeText(orderOf.get(d.id) ?? "", nx, ny + 9);
        ctx.fillStyle = css(on ? tone : colour.quiet, on ? 1 : 0.85);
        ctx.fillText(orderOf.get(d.id) ?? "", nx, ny + 9);
        if (!on) continue;
        // Centred on the block but raised above its back corner, so the label never hides a tower.
        const [cx] = toScreen(d.x + d.w / 2, d.y + d.d / 2, 0);
        const [, cy] = toScreen(d.x, d.y, (tallest.get(d.id) ?? 1) + 0.9);
        const [, base] = toScreen(d.x + d.w / 2, d.y + d.d / 2, (tallest.get(d.id) ?? 1) + 0.05);
        ctx.strokeStyle = css(tone, 0.6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 4);
        ctx.lineTo(cx, base);
        ctx.stroke();
        const label = d.name.toUpperCase();
        ctx.font = `600 11px ${font}`;
        const tw = ctx.measureText(label).width + 16;
        ctx.fillStyle = css(colour.bg, 0.92);
        ctx.strokeStyle = css(tone, 0.7);
        ctx.beginPath();
        ctx.roundRect(cx - tw / 2, cy - 18, tw, 22, 11);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = css(colour.ink);
        ctx.fillText(label, cx, cy - 7);
      }

      const moving = Math.abs(cam.vx) + Math.abs(cam.vy) + Math.abs(cam.vs) > 0.0005;
      return cars.length > 0 || moving || growing;
    };

    let raf = 0;
    let visible = true;
    const loop = (now: number) => {
      const again = draw(now);
      raf = again && visible && !document.hidden ? requestAnimationFrame(loop) : 0;
    };
    function wake() {
      if (!raf && visible && !document.hidden && width > 0) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    }
    wakeRef.current = wake;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cam.ready = false;
      wake();
    };

    const hit = (e: PointerEvent): CityDistrict | undefined => {
      const rect = canvas.getBoundingClientRect();
      const X = (e.clientX - rect.left - width / 2) / cam.s + cam.x;
      const Y = (e.clientY - rect.top - height / 2) / cam.s + cam.y;
      // Try a little above the ground first, so pointing at a tower picks its own district.
      for (const z of [1.1, 0.4, 0]) {
        const [x, y] = unproject(X, Y + z * 0.82);
        const t = live.current.track;
        const d = districtAt(layout, x, y, t === "all" ? undefined : t);
        if (d) return d;
      }
      return undefined;
    };
    const onMove = (e: PointerEvent) => {
      pointer.inside = true;
      const id = hit(e)?.id ?? null;
      canvas.style.cursor = id ? "pointer" : "";
      if (id !== pointer.hover) {
        pointer.hover = id;
        live.current.onFocus(id);
        wake();
      }
    };
    const onLeave = () => {
      pointer.inside = false;
      if (pointer.hover) {
        pointer.hover = null;
        live.current.onFocus(null);
      }
      canvas.style.cursor = "";
      wake();
    };
    const onClick = (e: PointerEvent) => {
      const d = hit(e);
      if (d) live.current.onPick(d.id);
    };

    readColours();
    const themeWatch = new MutationObserver(readColours);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const scheme = window.matchMedia("(prefers-color-scheme: light)");
    scheme.addEventListener("change", readColours);
    const sizeWatch = new ResizeObserver(resize);
    sizeWatch.observe(canvas);
    const viewWatch = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      wake();
    });
    viewWatch.observe(canvas);
    document.addEventListener("visibilitychange", wake);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick as EventListener);
    resize();

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      wakeRef.current = () => {};
      themeWatch.disconnect();
      scheme.removeEventListener("change", readColours);
      sizeWatch.disconnect();
      viewWatch.disconnect();
      document.removeEventListener("visibilitychange", wake);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick as EventListener);
    };
  }, [layout, worlds]);

  return <canvas ref={canvasRef} aria-hidden="true" className={`block h-full w-full touch-pan-y ${className}`} />;
}
