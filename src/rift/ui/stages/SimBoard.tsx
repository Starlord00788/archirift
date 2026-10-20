"use client";

import { motion } from "motion/react";
import type { SimConfig } from "@/content/rift";
import { SIM, type SimResult, type TierId } from "../../sim";

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  colour: string;
  tier?: TierId;
}

const health = (rho: number | undefined) => (rho === undefined ? "var(--line-strong)" : !Number.isFinite(rho) || rho >= 1 ? "var(--fail)" : rho >= 0.8 ? "var(--warn)" : "var(--good)");

/**
 * The live architecture: boxes for each tier, coloured by how hard they're working, with packets
 * flowing at a density proportional to real traffic. Red packets fall out where requests are dropped.
 */
export function SimBoard({ config, result }: { config: SimConfig; result: SimResult }) {
  const rho = (id: TierId) => result.tiers.find((t) => t.id === id)?.utilisation;
  const f = result.flows;
  const peak = Math.max(1, f.incoming);

  const boxes: Box[] = [];
  const at = (b: Box) => {
    boxes.push(b);
    return b;
  };
  const users = at({ id: "users", x: 8, y: 128, w: 70, h: 44, label: "Users", sub: `${Math.round(f.incoming).toLocaleString("en-IN")} rps`, colour: "var(--ink-quiet)" });
  const limiter = config.rateLimit ? at({ id: "rl", x: 102, y: 128, w: 76, h: 44, label: "Limiter", sub: f.blocked > 0 ? `blocks ${Math.round(f.blocked)}` : "token bucket", colour: "var(--warn)" }) : null;
  const cdn = config.cdn ? at({ id: "cdn", x: 200, y: 22, w: 76, h: 44, label: "CDN", sub: `${Math.round(f.toCdn)} rps`, colour: "var(--good)" }) : null;
  const lb = config.servers > 1 ? at({ id: "lb", x: 200, y: 128, w: 76, h: 44, label: "LB", sub: "balancer", colour: "var(--flow)" }) : null;

  const shown = Math.min(config.servers, 5);
  const serverBoxes = Array.from({ length: shown }, (_, i) =>
    at({
      id: `s${i}`,
      x: 304,
      y: 150 - (shown * 30) / 2 + i * 30,
      w: 92,
      h: 24,
      label: i === shown - 1 && config.servers > shown ? `+${config.servers - shown + 1} more` : `App ${SIM.sizeNames[config.serverSize - 1]}`,
      colour: health(rho("app")),
      tier: "app",
    }),
  );
  const cache = config.cache ? at({ id: "cache", x: 432, y: 40, w: 84, h: 44, label: "Cache", sub: `${Math.round(f.toCache)} reads/s`, colour: health(rho("cache")), tier: "cache" }) : null;
  const queue = config.queue ? at({ id: "queue", x: 432, y: 224, w: 84, h: 44, label: "Queue", sub: `${config.workers} workers`, colour: health(rho("queue")), tier: "queue" }) : null;
  const dbLabel = config.shards > 1 ? `DB ×${config.shards} shards` : "Database";
  const db = at({ id: "db", x: 560, y: 120, w: 110, h: 60, label: dbLabel, sub: config.replicas > 0 ? `+${config.replicas} replica${config.replicas > 1 ? "s" : ""}` : "primary", colour: health(Math.max(rho("dbRead") ?? 0, rho("dbWrite") ?? 0)), tier: "dbWrite" });

  const centre = (b: Box, side: "l" | "r" | "t" | "b") =>
    side === "l" ? { x: b.x, y: b.y + b.h / 2 } : side === "r" ? { x: b.x + b.w, y: b.y + b.h / 2 } : side === "t" ? { x: b.x + b.w / 2, y: b.y } : { x: b.x + b.w / 2, y: b.y + b.h };
  const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => `M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`;

  type Wire = { id: string; d: string; load: number; colour: string };
  const wires: Wire[] = [];
  const front = limiter ?? users;
  if (limiter) wires.push({ id: "u-rl", d: curve(centre(users, "r"), centre(limiter, "l")), load: f.incoming, colour: "var(--warn)" });
  if (cdn) wires.push({ id: "u-cdn", d: curve(centre(users, "r"), centre(cdn, "l")), load: f.toCdn, colour: "var(--good)" });
  const entry = lb ?? null;
  if (entry) wires.push({ id: "f-lb", d: curve(centre(front, "r"), centre(entry, "l")), load: f.toApp, colour: health(rho("app")) });
  for (const s of serverBoxes) {
    wires.push({ id: `to-${s.id}`, d: curve(centre(entry ?? front, "r"), centre(s, "l")), load: f.toApp / shown, colour: health(rho("app")) });
  }
  const mid = serverBoxes[Math.floor(shown / 2)];
  if (cache) {
    wires.push({ id: "s-cache", d: curve(centre(mid, "r"), centre(cache, "l")), load: f.toCache, colour: health(rho("cache")) });
    wires.push({ id: "cache-db", d: curve(centre(cache, "r"), centre(db, "t")), load: f.toDbReads, colour: health(rho("dbRead")) });
  } else {
    wires.push({ id: "s-db-r", d: curve(centre(mid, "r"), centre(db, "l")), load: f.toDbReads, colour: health(rho("dbRead")) });
  }
  if (queue) {
    wires.push({ id: "s-q", d: curve(centre(serverBoxes.at(-1)!, "r"), centre(queue, "l")), load: f.toQueue, colour: health(rho("queue")) });
    wires.push({ id: "q-db", d: curve(centre(queue, "r"), centre(db, "b")), load: f.toDbWrites, colour: health(rho("dbWrite")) });
  } else {
    wires.push({ id: "s-db-w", d: curve(centre(serverBoxes.at(-1)!, "r"), { x: db.x, y: db.y + db.h - 12 }), load: f.toDbWrites, colour: health(rho("dbWrite")) });
  }

  const dropping = f.dropped > 0.5;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-[color-mix(in_srgb,var(--bg)_60%,var(--surface))]">
      <svg viewBox="0 0 680 300" className="block h-auto w-full" role="img" aria-label={`Live system: ${result.tiers.map((t) => `${t.label} at ${Number.isFinite(t.utilisation) ? Math.round(t.utilisation * 100) : "over"} percent`).join(", ")}`}>
        <defs>
          <pattern id="sim-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--grid)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="680" height="300" fill="url(#sim-grid)" />

        {wires.map((w) => (
          <path key={w.id} d={w.d} fill="none" stroke="var(--line-strong)" strokeWidth={1 + Math.min(3, (w.load / peak) * 4)} strokeOpacity={w.load > 0 ? 0.8 : 0.25} />
        ))}

        <g className="motion-only">
          {wires.map((w) => {
            if (w.load <= 0.5) return null;
            const dots = Math.max(1, Math.min(5, Math.round((w.load / peak) * 6)));
            return Array.from({ length: dots }, (_, i) => (
              <circle key={`${w.id}-${i}-${dots}`} r="3" fill={w.colour}>
                <animateMotion dur="1.6s" begin={`${(i / dots) * 1.6}s`} repeatCount="indefinite" path={w.d} />
              </circle>
            ));
          })}
          {dropping &&
            [0, 1, 2].map((i) => (
              <circle key={`drop-${i}`} r="3" fill="var(--fail)" cx={300 + i * 14} cy={150}>
                <animate attributeName="cy" values="150;290" dur="1.1s" begin={`${i * 0.35}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0" dur="1.1s" begin={`${i * 0.35}s`} repeatCount="indefinite" />
              </circle>
            ))}
        </g>

        {boxes.map((b) => (
          <motion.g key={b.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 24 }} style={{ originX: `${b.x + b.w / 2}px`, originY: `${b.y + b.h / 2}px` }}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.id === "db" || b.id === "cache" ? 14 : 8} fill="var(--surface)" stroke={b.colour} strokeWidth={b.tier ? 2 : 1.4} />
            <text x={b.x + b.w / 2} y={b.y + (b.sub ? b.h / 2 - 3 : b.h / 2 + 4)} textAnchor="middle" fontSize={b.h < 30 ? 10.5 : 12} fontWeight={600} fill="var(--ink)" className="font-display">
              {b.label}
            </text>
            {b.sub && (
              <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 12} textAnchor="middle" fontSize={9.5} fill="var(--ink-quiet)" className="font-mono">
                {b.sub}
              </text>
            )}
          </motion.g>
        ))}
        {dropping && (
          <text x={350} y={285} textAnchor="middle" fontSize={11} fill="var(--fail)" className="font-mono">
            dropping {Math.round(f.dropped).toLocaleString("en-IN")} req/s
          </text>
        )}
      </svg>
    </div>
  );
}
