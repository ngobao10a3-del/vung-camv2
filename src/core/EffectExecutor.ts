import type { EffectBlock, GameEffect } from "../types/effects";
import type { GameEvent } from "../types/events";
import { GameStateStore } from "./GameStateStore";

export class EffectExecutor {
  constructor(private readonly store: GameStateStore) {}

  execute(block: EffectBlock | undefined): GameEvent[] {
    if (!block || block.effects.length === 0) return [];

    // Chụp ngữ cảnh scene một lần duy nhất tại thời điểm bắt đầu EffectBlock
    const executionSceneId = this.store.snapshot().currentSceneId;

    // Khóa onceId trước khi thực thi hiệu ứng để chống tái kích hoạt
    if (block.onceId && !this.store.markOnce(block.onceId)) {
      return [];
    }

    const emitted: GameEvent[] = [];

    for (const effect of block.effects) {
      try {
        const events = this.apply(effect, executionSceneId);
        emitted.push(...events);
      } catch (error) {
        console.error("[EffectExecutor] Failed to execute effect:", effect, error);
      }
    }

    return emitted;
  }

  private apply(effect: GameEffect, executionSceneId: string): GameEvent[] {
    switch (effect.type) {
      case "SET_FLAG": {
        const changed = this.store.setFlag(effect.key, effect.value);
        return changed
          ? [
              { type: "STATE_MUTATED", changedFlags: [effect.key], sceneId: executionSceneId },
              { type: "STATE_CHANGED", domain: "flags", targetId: effect.key, sceneId: executionSceneId }
            ]
          : [];
      }

      case "INC_FLAG": {
        const changed = this.store.incFlag(effect.key, effect.amount);
        return changed
          ? [
              { type: "STATE_MUTATED", changedFlags: [effect.key], sceneId: executionSceneId },
              { type: "STATE_CHANGED", domain: "flags", targetId: effect.key, sceneId: executionSceneId }
            ]
          : [];
      }

      case "ADD_ITEM": {
        const added = this.store.addItem(effect.itemId);
        return added
          ? [{ type: "STATE_CHANGED", domain: "inventory", targetId: effect.itemId, sceneId: executionSceneId }]
          : [];
      }

      case "REMOVE_ITEM": {
        const removed = this.store.removeItem(effect.itemId);
        return removed
          ? [{ type: "STATE_CHANGED", domain: "inventory", targetId: effect.itemId, sceneId: executionSceneId }]
          : [];
      }

      case "DISCOVER_CLUE": {
        const discovered = this.store.discoverClue(effect.clueId);
        return discovered
          ? [
              { type: "CLUE_ADDED", clueId: effect.clueId, sceneId: executionSceneId },
              { type: "STATE_CHANGED", domain: "clues", targetId: effect.clueId, sceneId: executionSceneId }
            ]
          : [];
      }

      case "DISCOVER_RULE": {
        const discovered = this.store.discoverRule(effect.ruleId);
        return discovered
          ? [
              { type: "RULE_ADDED", ruleId: effect.ruleId, sceneId: executionSceneId },
              { type: "STATE_CHANGED", domain: "rules", targetId: effect.ruleId, sceneId: executionSceneId }
            ]
          : [];
      }

      case "MARK_PUZZLE_SOLVED": {
        const solved = this.store.solvePuzzle(effect.puzzleId);
        return solved
          ? [
              { type: "PUZZLE_SOLVED", puzzleId: effect.puzzleId, sceneId: executionSceneId },
              { type: "STATE_CHANGED", domain: "puzzles", targetId: effect.puzzleId, sceneId: executionSceneId }
            ]
          : [];
      }

      case "SET_ENTITY_STATE": {
        const changed = this.store.setEntityState(effect.entityId, effect.state);
        return changed
          ? [{ type: "STATE_CHANGED", domain: "entities", targetId: effect.entityId, sceneId: executionSceneId }]
          : [];
      }

      case "SET_RULE_LIFECYCLE": {
        const changed = this.store.setRuleLifecycle(effect.ruleId, effect.state);
        if (!changed) return [];

        const events: GameEvent[] = [
          { type: "STATE_CHANGED", domain: "rules", targetId: effect.ruleId, sceneId: executionSceneId }
        ];
        if (effect.state === "transformed") {
          events.push({ type: "RULE_TRANSFORMED", ruleId: effect.ruleId, sceneId: executionSceneId });
        }
        return events;
      }

      case "SET_INVESTIGATION_STATUS": {
        const prev = this.store.snapshot().investigationStatuses[effect.ruleId];
        const next = this.store.applyInvestigationStatus(effect.ruleId, effect.status);
        return next !== prev
          ? [
              { type: "DEDUCTION_UPDATED", ruleId: effect.ruleId, status: next, sceneId: executionSceneId },
              { type: "STATE_CHANGED", domain: "investigation", targetId: effect.ruleId, sceneId: executionSceneId }
            ]
          : [];
      }

      case "CHANGE_SCENE": {
        const changed = this.store.changeScene(effect.sceneId);
        return changed ? [{ type: "SCENE_ENTERED", sceneId: effect.sceneId }] : [];
      }

      case "TRIGGER_FX":
        return [{ type: "FX_REQUESTED", fx: effect.fx, durationMs: effect.durationMs, sceneId: executionSceneId }];

      case "SHOW_LOG":
        this.store.addLog(effect.message);
        return [{ type: "STATE_CHANGED", domain: "logs", sceneId: executionSceneId }];

      case "TRIGGER_ENDING": {
        const set = this.store.setEnding(effect.endingId);
        return set ? [{ type: "ENDING_REACHED", endingId: effect.endingId, sceneId: executionSceneId }] : [];
      }
    }
  }
}