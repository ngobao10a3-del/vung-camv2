import type { ActionTag } from "./common";
import type { Condition } from "./conditions";
import type { EffectBlock, ScreenFxType } from "./effects";
import type { InvestigationStatus } from "./investigation";

export type StateDomain =
  | "flags"
  | "inventory"
  | "clues"
  | "rules"
  | "investigation"
  | "puzzles"
  | "entities"
  | "scene"
  | "ending"
  | "logs";

export type GameEvent =
  | { type: "PLAYER_ACTION_PERFORMED"; actionTag?: ActionTag; targetId: string; sceneId: string }
  | { type: "STATE_MUTATED"; changedFlags: string[]; sceneId: string }
  | { type: "STATE_CHANGED"; domain: StateDomain; targetId?: string; sceneId: string }
  | { type: "SCENE_ENTERED"; sceneId: string }
  | { type: "CLUE_ADDED"; clueId: string; sceneId: string }
  | { type: "RULE_ADDED"; ruleId: string; sceneId: string }
  | { type: "RULE_TRANSFORMED"; ruleId: string; sceneId: string }
  | { type: "RULE_VIOLATED"; ruleId: string; violationCount: number; sceneId: string }
  | { type: "DEDUCTION_UPDATED"; ruleId: string; status: InvestigationStatus; sceneId: string }
  | { type: "PUZZLE_SOLVED"; puzzleId: string; sceneId: string }
  | { type: "FX_REQUESTED"; fx: ScreenFxType; durationMs: number; sceneId: string }
  | { type: "ENDING_REACHED"; endingId: string; sceneId: string };

export interface EventFilter {
  actionTags?: ActionTag[];
  targetIds?: string[];
  sceneIds?: string[];
  ruleIds?: string[];
  puzzleIds?: string[];
}

export interface EventDefinition {
  id: string;
  triggerEvent: GameEvent["type"];
  eventFilter?: EventFilter;
  condition?: Condition;
  result: EffectBlock;
}