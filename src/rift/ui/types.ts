import type { Rift } from "@/content/rift";
import type { RiftAction, RiftState } from "../state";

export type Dispatch = (action: RiftAction) => void;

/** Everything a rift's UI needs about its level, passed from the server page. */
export interface RiftLevelInfo {
  id: string;
  title: string;
  summary: string;
  difficulty: number;
  minutes: number;
  concept: { id: string; name: string };
  world: { id: string; name: string; accent: "flow" | "player" | "warn" | "good" | "pink" | "lime" };
  next: { id: string; title: string } | null;
  rift: Rift;
}

/** What the level page tells a hand-built level about where it sits in the city. */
export interface BespokeInfo {
  world: RiftLevelInfo["world"];
  concept: string;
  next: RiftLevelInfo["next"];
}

export interface BeatProps {
  info: RiftLevelInfo;
  state: RiftState;
  dispatch: Dispatch;
}
