import type { ChapterDefinition, EntityState, FlagValue } from "../types/common";
import type { CharacterState } from "../types/dialogue";
import type { InvestigationStatus } from "../types/investigation";
import type { RuleLifecycleState } from "../types/rules";
import type { GameState, SaveData } from "../types/save";

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

const CURRENT_ENGINE_SCHEMA_VERSION = 2;

const STATUS_RANK: Record<InvestigationStatus, number> = {
  unverified: 0,
  supported: 1,
  contradicted: 1,
  conditional_confirmed: 2,
  verified: 3,
  debunked_fake: 3,
  conflicted: 4
};

const clone = <T,>(value: T): T => structuredClone(value);

/** Bảo vệ kết luận: không hạ cấp kết luận đã chốt và đánh dấu conflicted nếu mâu thuẫn */
export function resolveNextInvestigationStatus(
  current: InvestigationStatus | undefined,
  incoming: InvestigationStatus
): InvestigationStatus {
  const prev = current ?? "unverified";
  if (prev === incoming) return prev;
  if (prev === "conflicted" || incoming === "conflicted") return "conflicted";

  const isOppositeFinal =
    (prev === "verified" && incoming === "debunked_fake") ||
    (prev === "debunked_fake" && incoming === "verified");
  if (isOppositeFinal) return "conflicted";

  const isOppositeTemp =
    (prev === "supported" && incoming === "contradicted") ||
    (prev === "contradicted" && incoming === "supported");
  if (isOppositeTemp) return "conflicted";

  return STATUS_RANK[incoming] > STATUS_RANK[prev] ? incoming : prev;
}

export function createInitialState(chapterId = "CH-01", sceneId = "SC-01"): GameState {
  const defaultRuleIds = ["R-01", "R-02", "R-03", "R-04", "R-05", "R-06", "R-07", "R-08", "R-09", "R-10"];
  const ruleLifecycleStates: Record<string, RuleLifecycleState> = {};
  const investigationStatuses: Record<string, InvestigationStatus> = {};

  for (const id of defaultRuleIds) {
    ruleLifecycleStates[id] = "active";
    investigationStatuses[id] = "unverified";
  }

  return {
    chapterId,
    currentSceneId: sceneId,
    observationMode: false,
    flags: {
      power_mode: "normal",
      radio_state: "broadcasting",
      fog_breached: false,
      identity_exposed: false,
      locker_knocking: false,
      flashlight_on: false,
      red_filter_installed: false,
      captain_missing_confirmed: false
    },
    inventoryItemIds: [],
    collectedItemIds: [],
    discoveredClueIds: [],
    discoveredRuleIds: [...defaultRuleIds],
    ruleLifecycleStates,
    ruleViolationCounts: {},
    investigationStatuses,
    linkedCluesByRule: {},
    completedDeductionGroupIds: [],
    unlockedDeductionNotes: [],
    unlockedCountermeasureRuleIds: [],
    solvedPuzzleIds: [],
    puzzleAttempts: {},
    entityStates: { "EN-01": "active", "EN-02": "dormant" },
    triggeredOnceIds: [],
    completedDialogueIds: [],
    characterStates: {},
    readArchiveIds: [],
    logs: ["Bạn vừa bước vào Trạm Hải Đăng Mũi Sương."],
    activeEndingId: null,
    identityOverwriteCount: 0
  };
}

export class GameStateStore {
  private state: GameState;

  constructor(initialState: GameState) {
    this.state = clone(initialState);
  }

  static fromChapter(
    chapter: ChapterDefinition,
    initialEntityStates: Record<string, EntityState> = {}
  ): GameStateStore {
    const ruleLifecycleStates: Record<string, RuleLifecycleState> = {};
    const investigationStatuses: Record<string, InvestigationStatus> = {};

    for (const ruleId of chapter.ruleIds) {
      ruleLifecycleStates[ruleId] = chapter.initialRuleIds.includes(ruleId) ? "active" : "inactive";
      investigationStatuses[ruleId] = "unverified";
    }

    return new GameStateStore({
      chapterId: chapter.id,
      currentSceneId: chapter.initialSceneId,
      observationMode: false,
      flags: { ...chapter.initialFlags },
      inventoryItemIds: [],
      collectedItemIds: [],
      discoveredClueIds: [],
      discoveredRuleIds: [...chapter.initialRuleIds],
      ruleLifecycleStates,
      ruleViolationCounts: {},
      investigationStatuses,
      linkedCluesByRule: {},
      completedDeductionGroupIds: [],
      unlockedDeductionNotes: [],
      unlockedCountermeasureRuleIds: [],
      solvedPuzzleIds: [],
    puzzleAttempts: {},
      entityStates: { ...initialEntityStates },
      triggeredOnceIds: [],
      completedDialogueIds: [],
      characterStates: {},
      readArchiveIds: [],
      logs: [],
      activeEndingId: null,
      identityOverwriteCount: 0
    });
  }

  /** Tạo bản sao độc lập tại thời điểm gọi để bảo vệ state gốc */
  snapshot(): DeepReadonly<GameState> {
    return clone(this.state) as DeepReadonly<GameState>;
  }

  /** Alias giữ tương thích với UI và các module gọi getState() */
  getState(): DeepReadonly<GameState> {
    return this.snapshot();
  }

  hasTriggeredOnce(onceId: string): boolean {
    return this.state.triggeredOnceIds.includes(onceId);
  }

  markOnce(onceId: string): boolean {
    if (this.hasTriggeredOnce(onceId)) return false;
    this.state = {
      ...this.state,
      triggeredOnceIds: [...this.state.triggeredOnceIds, onceId]
    };
    return true;
  }

  setFlag(key: string, value: FlagValue): boolean {
    if (Object.is(this.state.flags[key], value)) return false;
    this.state = {
      ...this.state,
      flags: { ...this.state.flags, [key]: value }
    };
    return true;
  }

  incFlag(key: string, amount: number): boolean {
    const current = this.state.flags[key];
    const base = typeof current === "number" ? current : 0;
    return this.setFlag(key, base + amount);
  }

  /** Chặn tuyệt đối việc nhặt lại vật phẩm đã từng thu thập (kể cả sau khi đã tiêu thụ) */
  addItem(itemId: string): boolean {
    if (this.state.collectedItemIds.includes(itemId)) {
      return false;
    }
    this.state = {
      ...this.state,
      inventoryItemIds: [...this.state.inventoryItemIds, itemId],
      collectedItemIds: [...this.state.collectedItemIds, itemId]
    };
    return true;
  }

  removeItem(itemId: string): boolean {
    if (!this.state.inventoryItemIds.includes(itemId)) return false;
    this.state = {
      ...this.state,
      inventoryItemIds: this.state.inventoryItemIds.filter(id => id !== itemId)
    };
    return true;
  }

  discoverClue(clueId: string): boolean {
    if (this.state.discoveredClueIds.includes(clueId)) return false;
    this.state = {
      ...this.state,
      discoveredClueIds: [...this.state.discoveredClueIds, clueId]
    };
    return true;
  }

  discoverRule(ruleId: string): boolean {
    if (this.state.discoveredRuleIds.includes(ruleId)) return false;
    this.state = {
      ...this.state,
      discoveredRuleIds: [...this.state.discoveredRuleIds, ruleId]
    };
    return true;
  }

  solvePuzzle(puzzleId: string): boolean {
    if (this.state.solvedPuzzleIds.includes(puzzleId)) return false;
    this.state = {
      ...this.state,
      solvedPuzzleIds: [...this.state.solvedPuzzleIds, puzzleId]
    };
    return true;
  }

  setEntityState(entityId: string, next: EntityState): boolean {
    if (this.state.entityStates[entityId] === next) return false;
    this.state = {
      ...this.state,
      entityStates: { ...this.state.entityStates, [entityId]: next }
    };
    return true;
  }

  setRuleLifecycle(ruleId: string, next: RuleLifecycleState): boolean {
    if (this.state.ruleLifecycleStates[ruleId] === next) return false;
    this.state = {
      ...this.state,
      ruleLifecycleStates: { ...this.state.ruleLifecycleStates, [ruleId]: next }
    };
    return true;
  }

  incrementRuleViolation(ruleId: string): number {
    const nextCount = (this.state.ruleViolationCounts[ruleId] ?? 0) + 1;
    this.state = {
      ...this.state,
      ruleViolationCounts: { ...this.state.ruleViolationCounts, [ruleId]: nextCount }
    };
    return nextCount;
  }

  applyInvestigationStatus(ruleId: string, incoming: InvestigationStatus): InvestigationStatus {
    const current = this.state.investigationStatuses[ruleId];
    const resolved = resolveNextInvestigationStatus(current, incoming);
    if (resolved !== current) {
      this.state = {
        ...this.state,
        investigationStatuses: { ...this.state.investigationStatuses, [ruleId]: resolved }
      };
    }
    return resolved;
  }

  changeScene(sceneId: string): boolean {
    if (this.state.currentSceneId === sceneId) return false;
    this.state = {
      ...this.state,
      currentSceneId: sceneId
    };
    return true;
  }

  addLog(message: string): void {
    this.state = {
      ...this.state,
      logs: [...this.state.logs, message]
    };
  }

  setEnding(endingId: string): boolean {
    if (this.state.activeEndingId !== null) return false;
    this.state = {
      ...this.state,
      activeEndingId: endingId
    };
    return true;
  }

  recordIdentityOverwrite(reason: string): number {
    const nextCount = Math.min(2, Math.max(0, this.state.identityOverwriteCount ?? 0) + 1);
    this.state = {
      ...this.state,
      identityOverwriteCount: nextCount,
      lastOverwriteReason: reason
    };
    return nextCount;
  }

  setDeathReason(reason: string): boolean {
    if (this.state.deathReason === reason) return false;
    this.state = {
      ...this.state,
      deathReason: reason
    };
    return true;
  }

  toggleObservationMode(force?: boolean): boolean {
    const next = force ?? !this.state.observationMode;
    this.state = { ...this.state, observationMode: next };
    return next;
  }

  incrementPuzzleAttempt(puzzleId: string): number {
    const nextCount = (this.state.puzzleAttempts[puzzleId] ?? 0) + 1;
    this.state = {
      ...this.state,
      puzzleAttempts: { ...this.state.puzzleAttempts, [puzzleId]: nextCount }
    };
    return nextCount;
  }

  setRuleLinkedClues(ruleId: string, clueIds: string[]): boolean {
    const prev = this.state.linkedCluesByRule[ruleId] ?? [];
    if (prev.length === clueIds.length && prev.every((id, idx) => id === clueIds[idx])) return false;
    this.state = {
      ...this.state,
      linkedCluesByRule: { ...this.state.linkedCluesByRule, [ruleId]: [...clueIds] }
    };
    return true;
  }

  recordDeductionCompletion(groupId: string, note: string, unlockCountermeasureForRuleId?: string): boolean {
    if (this.state.completedDeductionGroupIds.includes(groupId)) return false;
    const nextNotes = note && !this.state.unlockedDeductionNotes.includes(note)
      ? [...this.state.unlockedDeductionNotes, note]
      : this.state.unlockedDeductionNotes;
    const nextCountermeasures = unlockCountermeasureForRuleId && !this.state.unlockedCountermeasureRuleIds.includes(unlockCountermeasureForRuleId)
      ? [...this.state.unlockedCountermeasureRuleIds, unlockCountermeasureForRuleId]
      : this.state.unlockedCountermeasureRuleIds;
    this.state = {
      ...this.state,
      completedDeductionGroupIds: [...this.state.completedDeductionGroupIds, groupId],
      unlockedDeductionNotes: nextNotes,
      unlockedCountermeasureRuleIds: nextCountermeasures
    };
    return true;
  }

  markDialogueCompleted(dialogueId: string): boolean {
    if (this.state.completedDialogueIds.includes(dialogueId)) return false;
    this.state = {
      ...this.state,
      completedDialogueIds: [...this.state.completedDialogueIds, dialogueId]
    };
    return true;
  }

  setCharacterState(characterId: string, characterState: CharacterState): boolean {
    const prev = this.state.characterStates[characterId];
    if (
      prev &&
      prev.met === characterState.met &&
      prev.expression === characterState.expression &&
      prev.note === characterState.note
    ) {
      return false;
    }
    this.state = {
      ...this.state,
      characterStates: {
        ...this.state.characterStates,
        [characterId]: { ...characterState }
      }
    };
    return true;
  }

  markArchiveRead(documentId: string): boolean {
    if (this.state.readArchiveIds.includes(documentId)) return false;
    this.state = {
      ...this.state,
      readArchiveIds: [...this.state.readArchiveIds, documentId]
    };
    return true;
  }

  exportSave(slotId = "slot-1", chapterVersions: Record<string, string> = { "CH-01": "1.0.0" }): SaveData {
    return {
      engineSchemaVersion: CURRENT_ENGINE_SCHEMA_VERSION,
      chapterVersions: { ...chapterVersions },
      slotId,
      savedAt: new Date().toISOString(),
      unlockedGlobalArchives: [],
      state: clone(this.state)
    };
  }

  importSave(save: SaveData): boolean {
    if (
      save.engineSchemaVersion !== CURRENT_ENGINE_SCHEMA_VERSION ||
      !save.state ||
      typeof save.state.currentSceneId !== "string"
    ) {
      return false;
    }
    const rawCount = save.state.identityOverwriteCount;
    const normalizedOverwriteCount =
      typeof rawCount === "number" && Number.isFinite(rawCount)
        ? Math.max(0, Math.min(2, Math.floor(rawCount)))
        : 0;

    const nextState: GameState = {
      ...save.state,
      puzzleAttempts: save.state.puzzleAttempts ?? {},
      completedDialogueIds: Array.isArray(save.state.completedDialogueIds) ? save.state.completedDialogueIds : [],
      characterStates: save.state.characterStates ? { ...save.state.characterStates } : {},
      readArchiveIds: Array.isArray(save.state.readArchiveIds) ? save.state.readArchiveIds : [],
      identityOverwriteCount: normalizedOverwriteCount
    };
    if (typeof save.state.lastOverwriteReason !== "string") {
      delete nextState.lastOverwriteReason;
    }
    if (typeof save.state.deathReason !== "string") {
      delete nextState.deathReason;
    }

    this.state = clone(nextState);
    return true;
  }
}