import type { ActionTag } from "./common";
import type { Condition } from "./conditions";
import type { EffectBlock } from "./effects";

export interface HotspotAction {
  id: string;
  label: string;
  actionTag?: ActionTag;
  visibleCondition?: Condition;
  requiredItemId?: string;
  hideAfterOnceId?: string;
  narrativeText: string;
  result: EffectBlock;
}

export interface Hotspot {
  id: string;
  label: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visibleCondition?: Condition;
  actions: HotspotAction[];
}

export interface SceneDefinition {
  id: string;
  chapterId: string;
  name: string;
  diegeticOverlay: "none" | "cctv_frame" | "blueprint_grid" | "case_file";
  backgroundUrl: string;
  ambientLog: string;
  onEnter?: EffectBlock;
  hotspots: Hotspot[];
}

export type Scene = SceneDefinition;