import type { EntityState, FlagValue } from "./common";
import type { InvestigationStatus } from "./investigation";
import type { RuleLifecycleState } from "./rules";

export type ScreenFxType = "glitch" | "static_noise" | "screen_shake" | "red_flash";

export type GameEffect =
  | { type: "SET_FLAG"; key: string; value: FlagValue }
  | { type: "INC_FLAG"; key: string; amount: number }
  | { type: "ADD_ITEM"; itemId: string }
  | { type: "REMOVE_ITEM"; itemId: string }
  | { type: "DISCOVER_CLUE"; clueId: string }
  | { type: "DISCOVER_RULE"; ruleId: string }
  | { type: "MARK_PUZZLE_SOLVED"; puzzleId: string }
  | { type: "SET_ENTITY_STATE"; entityId: string; state: EntityState }
  | { type: "SET_RULE_LIFECYCLE"; ruleId: string; state: RuleLifecycleState }
  | { type: "SET_INVESTIGATION_STATUS"; ruleId: string; status: InvestigationStatus }
  | { type: "CHANGE_SCENE"; sceneId: string }
  | { type: "TRIGGER_FX"; fx: ScreenFxType; durationMs: number }
  | { type: "SHOW_LOG"; message: string }
  | { type: "RECORD_IDENTITY_OVERWRITE"; onceKey: string; reason: string }
  | { type: "SET_DEATH_REASON"; reason: string }
  | { type: "TRIGGER_ENDING"; endingId: string };

export interface EffectBlock {
  onceId?: string;
  effects: GameEffect[];
}