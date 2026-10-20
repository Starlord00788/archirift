"use client";

import type { WIDGETS } from "@/content/rift";
import type { StageState } from "../../state";
import { BloomLab } from "../labs/BloomLab";
import { HashRingLab } from "../labs/HashRingLab";
import { LruLab } from "../labs/LruLab";
import { RaceLab } from "../labs/RaceLab";
import { TokenBucketLab } from "../labs/TokenBucketLab";
import type { Dispatch } from "../types";

type State = Extract<StageState, { kind: "lab" }>;

export function LabStage({ widget, state, dispatch }: { widget: (typeof WIDGETS)[number]; state: State; dispatch: Dispatch }) {
  const props = {
    data: state.data,
    done: state.done,
    onChange: (data: unknown) => dispatch({ type: "labUpdate", data }),
    onDone: () => dispatch({ type: "labDone" }),
  };
  switch (widget) {
    case "hashring":
      return <HashRingLab {...props} />;
    case "bloom":
      return <BloomLab {...props} />;
    case "token-bucket":
      return <TokenBucketLab {...props} />;
    case "lru":
      return <LruLab {...props} />;
    case "race":
      return <RaceLab {...props} />;
  }
}
