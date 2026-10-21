import type { SimConfig, SimSpec, Wave } from "@/content/rift";

/**
 * The Rift Sim: a small, honest queueing model of a web system (PRD: Simulation and validation
 * model). Each tier has a capacity; utilisation ρ = load / capacity; latency grows as 1 / (1 − ρ)
 * and traffic beyond capacity is dropped. Numbers are illustrative, but the shapes are real:
 * caches absorb reads, replicas add read capacity only, queues smooth writes, shards split them.
 */
export const SIM = {
  networkMs: 20,
  serverRps: 200,
  serverMs: 25,
  /** Vertical scaling: capacity and price per size (S, M, L, XL). Bigger boxes cost disproportionately more. */
  sizeCapacity: [1, 2, 3.5, 6],
  sizeCost: [4, 10, 22, 48],
  sizeNames: ["S", "M", "L", "XL"],
  lbCost: 4,
  cacheMs: 2,
  cacheCost: 8,
  cdnMs: 15,
  cdnCost: 6,
  dbOps: 600,
  dbMs: 12,
  dbCost: 15,
  replicaCost: 10,
  queueMs: 4,
  queueCost: 5,
  workerRate: 150,
  workerCost: 3,
  rateLimitCost: 2,
  breakerCost: 1,
  dependencyTimeoutMs: 3000,
  fallbackMs: 5,
  /** Utilisation is capped here when computing latency so it stays finite. */
  maxRho: 0.97,
} as const;

export type TierId = "edge" | "app" | "cache" | "dbRead" | "dbWrite" | "queue";

export interface TierReport {
  id: TierId;
  label: string;
  /** Load divided by capacity; above 1 the tier is dropping traffic. */
  utilisation: number;
  load: number;
  capacity: number;
}

/** Requests per second along each connection, for drawing traffic. */
export interface SimFlows {
  incoming: number;
  blocked: number;
  toCdn: number;
  toApp: number;
  dropped: number;
  toCache: number;
  toDbReads: number;
  toQueue: number;
  toDbWrites: number;
}

export interface SimResult {
  flows: SimFlows;
  avgMs: number;
  errorPct: number;
  cost: number;
  backlogPerSec: number;
  tiers: TierReport[];
  /** Short, plain-language findings, worst first. */
  findings: string[];
  passed: boolean;
  checks: { latency: boolean; errors: boolean; budget: boolean; backlog: boolean };
}

const queueing = (serviceMs: number, rho: number) => serviceMs / (1 - Math.min(rho, SIM.maxRho));

/** Share of offered load a tier can serve. */
const served = (rho: number) => (rho <= 1 ? 1 : 1 / rho);

export function simCost(c: SimConfig): number {
  const servers = c.servers * SIM.sizeCost[c.serverSize - 1];
  const lb = c.servers > 1 ? SIM.lbCost : 0;
  const db = c.shards * (SIM.dbCost + c.replicas * SIM.replicaCost);
  const queue = c.queue ? SIM.queueCost + c.workers * SIM.workerCost : 0;
  return (
    servers +
    lb +
    db +
    queue +
    (c.cache ? SIM.cacheCost : 0) +
    (c.cdn ? SIM.cdnCost : 0) +
    (c.rateLimit ? SIM.rateLimitCost : 0) +
    (c.breaker ? SIM.breakerCost : 0)
  );
}

export function simulate(config: SimConfig, wave: Wave, goals: SimSpec["goals"]): SimResult {
  const c = config;
  const legit = wave.rps;
  const staticRps = legit * wave.staticRatio;
  const dynamic = legit - staticRps;
  const reads = dynamic * wave.readRatio;
  const writes = dynamic - reads;
  // A rate limiter stops nearly all abusive traffic before it reaches the servers.
  const bots = c.rateLimit ? wave.botRps * 0.02 : wave.botRps;

  // ---- App tier ----
  const alive = Math.max(0, c.servers - (wave.serverCrash ? 1 : 0));
  const dep = wave.dependencyDown;
  // Requests that call a hung dependency hold a server thread until the timeout, unless a circuit
  // breaker fails them fast with a fallback.
  const serviceMs = SIM.serverMs * (1 - dep) + (c.breaker ? SIM.fallbackMs : SIM.dependencyTimeoutMs) * dep;
  const perServer = SIM.serverRps * SIM.sizeCapacity[c.serverSize - 1] * (SIM.serverMs / serviceMs);
  const appCapacity = alive * perServer;
  const appLoad = dynamic + (c.cdn ? 0 : staticRps) + bots;
  const appRho = appCapacity === 0 ? Infinity : appLoad / appCapacity;
  const appPass = alive === 0 ? 0 : served(appRho);
  const appMs = alive === 0 ? 0 : queueing(serviceMs, appRho);

  // ---- Cache ----
  const readsIn = (reads + bots) * appPass;
  const hit = c.cache ? wave.cacheHitRate : 0;
  const readsToDb = readsIn * (1 - hit);

  // ---- Writes: straight to the database, or through a queue drained by workers ----
  const writesIn = writes * appPass;
  const workerCapacity = c.workers * SIM.workerRate;
  const dbWrites = c.queue ? Math.min(writesIn, workerCapacity) : writesIn;
  const backlog = c.queue ? Math.max(0, writesIn - workerCapacity) : 0;

  // ---- Database: each shard has a primary (reads + writes) and optional read replicas ----
  const hot = wave.hotKeyShare;
  const hottestShardWrites = dbWrites * (hot + (1 - hot) / c.shards);
  const writeRho = hottestShardWrites / SIM.dbOps;
  const primaryLeft = Math.max(0, SIM.dbOps - hottestShardWrites);
  const readCapacityPerShard = c.replicas * SIM.dbOps + primaryLeft;
  const readRho = readCapacityPerShard === 0 ? (readsToDb > 0 ? Infinity : 0) : readsToDb / c.shards / readCapacityPerShard;
  const writePass = served(writeRho);
  const readPass = served(readRho);
  const dbWriteMs = queueing(SIM.dbMs, writeRho);
  const dbReadMs = queueing(SIM.dbMs, readRho);

  // ---- Latency of successful legitimate requests ----
  const staticMs = c.cdn ? SIM.cdnMs : SIM.networkMs + appMs;
  const readMs = SIM.networkMs + appMs + (c.cache ? SIM.cacheMs : 0) + (1 - hit) * dbReadMs;
  const writeMs = SIM.networkMs + appMs + (c.queue ? SIM.queueMs : dbWriteMs);
  const staticOk = c.cdn ? staticRps : staticRps * appPass;
  const readOk = reads * appPass * (1 - dep * (c.breaker ? 0 : 1)) * (hit + (1 - hit) * readPass);
  const writeOk = writes * appPass * (1 - dep * (c.breaker ? 0 : 1)) * (c.queue ? 1 : writePass);
  const ok = staticOk + readOk + writeOk;
  // Without a breaker, requests that call the hung dependency time out (errors), and the threads
  // they hold slow everything else down, which `serviceMs` already reflects.
  const avgMs = ok === 0 ? SIM.dependencyTimeoutMs : (staticOk * staticMs + readOk * readMs + writeOk * writeMs) / ok;
  const errorPct = legit === 0 ? 0 : Math.max(0, Math.min(100, (1 - ok / legit) * 100));

  const tiers: TierReport[] = [
    { id: "app", label: alive === 0 ? "App servers (all down)" : `App servers ×${alive}`, utilisation: appRho, load: appLoad, capacity: appCapacity },
    ...(c.cache ? [{ id: "cache" as const, label: "Cache", utilisation: readsIn / 20000, load: readsIn, capacity: 20000 }] : []),
    { id: "dbRead", label: c.replicas > 0 ? `DB reads (+${c.replicas} replicas)` : "DB reads", utilisation: readRho, load: readsToDb, capacity: readCapacityPerShard * c.shards },
    { id: "dbWrite", label: c.shards > 1 ? `DB writes (${c.shards} shards)` : "DB writes", utilisation: writeRho, load: dbWrites, capacity: SIM.dbOps * c.shards },
    ...(c.queue ? [{ id: "queue" as const, label: `Queue → ${c.workers} workers`, utilisation: workerCapacity === 0 ? Infinity : writesIn / workerCapacity, load: writesIn, capacity: workerCapacity }] : []),
  ];

  const findings: string[] = [];
  if (alive === 0) findings.push("Every app server is down. One server is a single point of failure.");
  if (!c.breaker && dep > 0) findings.push(`A dependency is hanging: ${Math.round(dep * 100)}% of requests wait ${SIM.dependencyTimeoutMs / 1000}s and hold server threads hostage.`);
  if (bots > legit * 0.2) findings.push(`Abusive traffic (${Math.round(bots)} rps) is eating your capacity.`);
  if (alive > 0 && appRho > 1) findings.push(`App servers are at ${pct(appRho)}: requests are being dropped.`);
  if (writeRho > 1) findings.push(hot > 0.3 && c.shards > 1 ? `One hot key overloads a single shard (${pct(writeRho)}). More shards won't spread it.` : `Database writes are at ${pct(writeRho)} of what the primary can take.`);
  if (readRho > 1) findings.push(`Database reads are at ${pct(readRho)}.`);
  if (backlog > goals.backlogPerSec) findings.push(`The queue grows by ${Math.round(backlog)} messages every second; workers can't keep up.`);
  if (alive > 0 && appRho > 0.8 && appRho <= 1) findings.push(`App servers are running hot at ${pct(appRho)}, which pushes latency up.`);
  if (readRho > 0.8 && readRho <= 1) findings.push(`Database reads are running hot at ${pct(readRho)}.`);
  if (writeRho > 0.8 && writeRho <= 1) findings.push(`Database writes are running hot at ${pct(writeRho)}.`);

  const cost = simCost(c);
  if (cost > goals.budget) findings.push(`Over budget: ₹${cost}k a month against ₹${goals.budget}k.`);

  if (avgMs > goals.avgMs) {
    const busiest = [...tiers].sort((a, b) => b.utilisation - a.utilisation)[0];
    findings.push(`Average response is ${Math.round(avgMs)} ms against a ${goals.avgMs} ms goal. Busiest tier: ${busiest.label} at ${pct(busiest.utilisation)}.`);
  }

  const checks = {
    latency: avgMs <= goals.avgMs,
    errors: errorPct <= goals.errorPct,
    budget: cost <= goals.budget,
    backlog: backlog <= goals.backlogPerSec,
  };
  const flows: SimFlows = {
    incoming: legit + wave.botRps,
    blocked: wave.botRps - bots,
    toCdn: c.cdn ? staticRps : 0,
    toApp: appLoad,
    dropped: appLoad * (1 - appPass),
    toCache: c.cache ? readsIn : 0,
    toDbReads: readsToDb,
    toQueue: c.queue ? writesIn : 0,
    toDbWrites: dbWrites,
  };

  return {
    flows,
    avgMs: Math.round(avgMs),
    errorPct: Math.round(errorPct * 10) / 10,
    cost,
    backlogPerSec: Math.round(backlog),
    tiers,
    findings,
    passed: checks.latency && checks.errors && checks.budget && checks.backlog,
    checks,
  };
}

function pct(rho: number) {
  return Number.isFinite(rho) ? `${Math.round(rho * 100)}%` : "∞%";
}

/** One moment of a wave as it plays out: how far through, the traffic so far, and what just happened. */
export interface WaveFrame {
  /** 0 → 1 through the wave. */
  t: number;
  wave: Wave;
  /** Incidents that start at this frame, for the live ticker. */
  events: string[];
}

/**
 * A wave as a timeline: traffic ramps up to its peak, abusive traffic and incidents (a crash, a hung
 * dependency) arrive part-way, and the last frames are the full wave, so the final frame's result is
 * exactly what `simulate` judges.
 */
export function waveTimeline(wave: Wave, frames = 32): WaveFrame[] {
  const out: WaveFrame[] = [];
  const botsAt = Math.round(frames * 0.3);
  const incidentAt = Math.round(frames * 0.5);
  const peakAt = Math.round(frames * 0.8);
  for (let k = 0; k < frames; k += 1) {
    const ramp = Math.min(1, k / peakAt);
    const factor = 0.2 + 0.8 * (ramp * ramp * (3 - 2 * ramp));
    const events: string[] = [];
    if (k === botsAt && wave.botRps > 0) events.push(`${wave.botRps.toLocaleString("en-IN")} bot requests a second start hammering the API.`);
    if (k === incidentAt && wave.serverCrash) events.push("An app server just crashed.");
    if (k === incidentAt && wave.dependencyDown > 0) events.push("The payments API stopped responding.");
    if (k === peakAt) events.push(`Peak traffic: ${wave.rps.toLocaleString("en-IN")} requests a second.`);
    out.push({
      t: k / (frames - 1),
      events,
      wave: {
        ...wave,
        rps: wave.rps * factor,
        botRps: k >= botsAt ? wave.botRps * factor : 0,
        serverCrash: k >= incidentAt && wave.serverCrash,
        dependencyDown: k >= incidentAt ? wave.dependencyDown : 0,
      },
    });
  }
  return out;
}

/**
 * Stars for a finished simulation: one for surviving, one for never failing a run, one for coming in
 * at or under par (the reference design's cost).
 */
export function simStars(spec: SimSpec, runs: number, config: SimConfig) {
  const par = simCost(spec.solution);
  const cost = simCost(config);
  const clean = runs <= spec.waves.length;
  const thrifty = cost <= par;
  return { stars: 1 + Number(clean) + Number(thrifty), par, cost, clean, thrifty };
}
