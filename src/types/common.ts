import type { Condition } from "./conditions";
import type { EffectBlock } from "./effects";

export type FlagValue = string | number | boolean | null;

export const ACTION_TAGS = {
  OPEN_EXTERIOR_DOOR: "OPEN_EXTERIOR_DOOR",
  OPEN_LANTERN_DOOR: "OPEN_LANTERN_DOOR",
  OPEN_LOCKER_04: "OPEN_LOCKER_04",
  ANSWER_RADIO: "ANSWER_RADIO",
  ANSWER_PHONE: "ANSWER_PHONE",
  ENTER_LANTERN_BEAM: "ENTER_LANTERN_BEAM",
  SIGN_LOGBOOK: "SIGN_LOGBOOK",
  REPORT_ID: "REPORT_ID",
  USE_OBSERVATION_GEAR: "USE_OBSERVATION_GEAR",
  LEAVE_SCENE: "LEAVE_SCENE",
  CUT_MAIN_RELAY: "CUT_MAIN_RELAY",
  INVERT_SIGNAL_FREQUENCY: "INVERT_SIGNAL_FREQUENCY",
  INSPECT_OBJECT: "INSPECT_OBJECT",
  TAKE_ITEM: "TAKE_ITEM",
  USE_ITEM: "USE_ITEM"
} as const;

export type ActionTag = (typeof ACTION_TAGS)[keyof typeof ACTION_TAGS];

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  consumeOnUse?: boolean;
}

/** Dữ liệu hiển thị trên UI - Tuyệt đối không chứa đáp án */
export interface PuzzleDefinition {
  id: string;
  sceneId: string;
  title: string;
  description: string;
  solutionType: "passcode" | "item_combination" | "sequence_order";
  maxAttempts?: number;
}

/** Dữ liệu kiểm chứng tách rời, chỉ PuzzleSystem được phép đọc */
export interface PuzzleSolution {
  puzzleId: string;
  expectedSolution: string | string[];
  solveCondition?: Condition;
  onSolve: EffectBlock;
  onFail?: EffectBlock;
  onFailBySubmission?: Record<string, EffectBlock>;
}

export type EntityRole = "environmental" | "stalking";
export type EntityState = "dormant" | "stalking" | "active" | "banished";

export interface EntityDefinition {
  id: string;
  name: string;
  role: EntityRole;
  description: string;
  initialState: EntityState;
  threat: 1 | 2 | 3;
}

export interface EndingDefinition {
  id: string;
  code: string;
  title: string;
  rank: "S" | "B" | "DEAD";
  description: string;
  unlockedArchiveIds?: string[];
}

export interface ChapterDefinition {
  id: string;
  version: string;
  code: string;
  title: string;
  summary: string;
  initialSceneId: string;
  initialFlags: Record<string, FlagValue>;
  initialRuleIds: string[];
  sceneIds: string[];
  ruleIds: string[];
  clueIds: string[];
  itemIds: string[];
  puzzleIds: string[];
  entityIds: string[];
  endingIds: string[];
}