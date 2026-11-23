import type { Condition } from "../types/conditions";
import type { GameState } from "../types/save";
import type { DeepReadonly } from "./GameStateStore";

export class ConditionEvaluator {
  evaluate(condition: Condition | undefined, state: DeepReadonly<GameState>): boolean {
    if (!condition) return true;

    if ("all" in condition) return condition.all.every(item => this.evaluate(item, state));
    if ("any" in condition) return condition.any.some(item => this.evaluate(item, state));
    if ("not" in condition) return !this.evaluate(condition.not, state);
    if ("flagEquals" in condition) return state.flags[condition.flagEquals.key] === condition.flagEquals.value;
    if ("flagGreaterThan" in condition) {
      const val = state.flags[condition.flagGreaterThan.key];
      return typeof val === "number" && val > condition.flagGreaterThan.value;
    }
    if ("flagLessThan" in condition) {
      const val = state.flags[condition.flagLessThan.key];
      return typeof val === "number" && val < condition.flagLessThan.value;
    }
    if ("hasItem" in condition) return state.inventoryItemIds.includes(condition.hasItem);
    if ("itemCollected" in condition) return state.collectedItemIds.includes(condition.itemCollected);
    if ("hasClue" in condition) return state.discoveredClueIds.includes(condition.hasClue);
    if ("puzzleSolved" in condition) return state.solvedPuzzleIds.includes(condition.puzzleSolved);
    if ("inScene" in condition) return state.currentSceneId === condition.inScene;
    if ("ruleLifecycleIs" in condition) {
      return state.ruleLifecycleStates[condition.ruleLifecycleIs.ruleId] === condition.ruleLifecycleIs.state;
    }
    if ("ruleStatusIs" in condition) {
      return state.investigationStatuses[condition.ruleStatusIs.ruleId] === condition.ruleStatusIs.status;
    }
    if ("entityStateIs" in condition) {
      return state.entityStates[condition.entityStateIs.entityId] === condition.entityStateIs.state;
    }

    return false;
  }
}