"use client";

import dynamic from "next/dynamic";

/** The Hydra brings React Flow; load it only on its own page so other levels stay light. */
export const HydraLevelLazy = dynamic(() => import("./HydraLevel").then((m) => m.HydraLevel), {
  ssr: false,
  loading: () => <div className="rift-line w-full" />,
});
