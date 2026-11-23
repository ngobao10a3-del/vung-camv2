import type { ClueDefinition, DeductionGroup, InvestigationStatus } from "../types/investigation";
import { EffectExecutor } from "../core/EffectExecutor";
import { EventDispatcher } from "../core/EventDispatcher";
import { GameStateStore } from "../core/GameStateStore";

export type LinkClueResult =
  | { ok: true; linkedClueIds: string[] }
  | { ok: false; reason: "CLUE_NOT_FOUND" | "NOT_DISCOVERED" | "ALREADY_LINKED" };

function isOrderedSubsequence(required: readonly string[], actual: readonly string[]): boolean {
  if (required.length === 0) return true;
  let reqIdx = 0;
  for (const item of actual) {
    if (item === required[reqIdx]) {
      reqIdx++;
      if (reqIdx === required.length) return true;
    }
  }
  return false;
}

export class InvestigationSystem {
  private readonly cluesById = new Map<string, ClueDefinition>();
  private deductionGroups: DeductionGroup[] = [];

  constructor(
    private readonly store: GameStateStore,
    private readonly executor: EffectExecutor,
    private readonly dispatcher: EventDispatcher,
    clues: readonly ClueDefinition[] = [],
    deductionGroups: readonly DeductionGroup[] = []
  ) {
    this.registerClues(clues);
    this.registerDeductionGroups(deductionGroups);
  }

  registerClues(clues: readonly ClueDefinition[]): void {
    this.cluesById.clear();
    for (const clue of clues) this.cluesById.set(clue.id, clue);
  }

  registerDeductionGroups(groups: readonly DeductionGroup[]): void {
    this.deductionGroups = [...groups];
  }

  getClue(clueId: string): ClueDefinition | undefined {
    return this.cluesById.get(clueId);
  }

  getDiscoveredClues(): ClueDefinition[] {
    return this.store.snapshot().discoveredClueIds
      .map(id => this.cluesById.get(id))
      .filter((c): c is ClueDefinition => c !== undefined);
  }

  getLinkedClueIds(ruleId: string): string[] {
    return [...(this.store.snapshot().linkedCluesByRule[ruleId] ?? [])];
  }

  getInvestigationStatus(ruleId: string): InvestigationStatus {
    return this.store.snapshot().investigationStatuses[ruleId] ?? "unverified";
  }

  isCountermeasureUnlocked(ruleId: string): boolean {
    return this.store.snapshot().unlockedCountermeasureRuleIds.includes(ruleId);
  }

  getUnlockedDeductionNotes(): string[] {
    return [...this.store.snapshot().unlockedDeductionNotes];
  }

  linkClueToRule(ruleId: string, clueId: string): LinkClueResult {
    if (!this.cluesById.has(clueId)) return { ok: false, reason: "CLUE_NOT_FOUND" };
    const state = this.store.snapshot();
    if (!state.discoveredClueIds.includes(clueId) || !state.discoveredRuleIds.includes(ruleId)) {
      return { ok: false, reason: "NOT_DISCOVERED" };
    }
    const currentLinks = state.linkedCluesByRule[ruleId] ?? [];
    if (currentLinks.includes(clueId)) return { ok: false, reason: "ALREADY_LINKED" };

    const nextLinks = [...currentLinks, clueId];
    this.store.setRuleLinkedClues(ruleId, nextLinks);
    this.dispatcher.dispatch({
      type: "STATE_CHANGED",
      domain: "investigation",
      targetId: ruleId,
      sceneId: state.currentSceneId
    });
    this.evaluateDeductionsForRule(ruleId);
    return { ok: true, linkedClueIds: nextLinks };
  }

  unlinkClueFromRule(ruleId: string, clueId: string): boolean {
    const state = this.store.snapshot();
    const currentLinks = state.linkedCluesByRule[ruleId] ?? [];
    if (!currentLinks.includes(clueId)) return false;
    this.store.setRuleLinkedClues(ruleId, currentLinks.filter(id => id !== clueId));
    this.dispatcher.dispatch({
      type: "STATE_CHANGED",
      domain: "investigation",
      targetId: ruleId,
      sceneId: state.currentSceneId
    });
    return true;
  }

  evaluateDeductionsForRule(ruleId: string): void {
    for (const group of this.deductionGroups.filter(g => g.ruleId === ruleId)) {
      const state = this.store.snapshot();
      if (state.completedDeductionGroupIds.includes(group.id)) continue;
      const linkedClues = state.linkedCluesByRule[ruleId] ?? [];
      const isSatisfied = group.orderMatters
        ? isOrderedSubsequence(group.requiredClueIds, linkedClues)
        : group.requiredClueIds.every(reqId => linkedClues.includes(reqId));
      if (!isSatisfied) continue;

      this.store.recordDeductionCompletion(
        group.id,
        group.deductionNote,
        group.unlockCountermeasure ? group.ruleId : undefined
      );
      const events = this.executor.execute({
        effects: [{ type: "SET_INVESTIGATION_STATUS", ruleId: group.ruleId, status: group.resultingStatus }]
      });
      for (const evt of events) this.dispatcher.dispatch(evt);
    }
  }
}