import type { EntityState, FlagValue } from "./common";
import type { CharacterState } from "./dialogue";
import type { InvestigationStatus } from "./investigation";
import type { RuleLifecycleState } from "./rules";

export interface GameState {
  chapterId: string;
  currentSceneId: string;
  observationMode: boolean;
  flags: Record<string, FlagValue>;
  inventoryItemIds: string[];
  collectedItemIds: string[];
  discoveredClueIds: string[];
  discoveredRuleIds: string[];
  ruleLifecycleStates: Record<string, RuleLifecycleState>;
  ruleViolationCounts: Record<string, number>;
  investigationStatuses: Record<string, InvestigationStatus>;
  linkedCluesByRule: Record<string, string[]>;
  completedDeductionGroupIds: string[];
  unlockedDeductionNotes: string[];
  unlockedCountermeasureRuleIds: string[];
  solvedPuzzleIds: string[];
  puzzleAttempts: Record<string, number>;
  entityStates: Record<string, EntityState>;
  triggeredOnceIds: string[];
  completedDialogueIds: string[];
  characterStates: Record<string, CharacterState>;
  readArchiveIds: string[];
  logs: string[];
  activeEndingId: string | null;
}

export interface SaveData {
  engineSchemaVersion: number;
  chapterVersions: Record<string, string>;
  slotId: string;
  savedAt: string;
  unlockedGlobalArchives: string[];
  state: GameState;
}