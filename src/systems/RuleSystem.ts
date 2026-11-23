import type { Condition } from "../types/conditions";
import type { GameEvent } from "../types/events";
import type { RuleDefinition, RuleLifecycleState, RuleViolationTrigger } from "../types/rules";
import type { GameState } from "../types/save";
import { ConditionEvaluator } from "../core/ConditionEvaluator";
import { EffectExecutor } from "../core/EffectExecutor";
import { EventDispatcher } from "../core/EventDispatcher";
import { GameStateStore, type DeepReadonly } from "../core/GameStateStore";

const LIFECYCLE_TRIGGER_EVENTS: ReadonlySet<GameEvent["type"]> = new Set([
  "STATE_MUTATED",
  "STATE_CHANGED",
  "SCENE_ENTERED",
  "PUZZLE_SOLVED",
  "CLUE_ADDED",
  "RULE_ADDED"
]);

const STATE_VIOLATION_TRIGGER_EVENTS: ReadonlySet<GameEvent["type"]> = new Set([
  "STATE_MUTATED",
  "STATE_CHANGED",
  "SCENE_ENTERED",
  "RULE_TRANSFORMED",
  "PUZZLE_SOLVED"
]);

export class RuleSystem {
  private readonly rulesById = new Map<string, RuleDefinition>();
  private readonly activeStateViolations = new Set<string>();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly store: GameStateStore,
    private readonly evaluator: ConditionEvaluator,
    private readonly executor: EffectExecutor,
    private readonly dispatcher: EventDispatcher,
    rules: readonly RuleDefinition[] = []
  ) {
    this.registerRules(rules);
    this.unsubscribe = this.dispatcher.subscribe(event => this.handleEvent(event));
  }

  registerRules(rules: readonly RuleDefinition[]): void {
    this.rulesById.clear();
    this.activeStateViolations.clear();
    for (const rule of rules) {
      this.rulesById.set(rule.id, rule);
    }
    this.syncLifecycles();
  }

  dispose(): void {
    this.unsubscribe();
  }

  getRule(ruleId: string): RuleDefinition | undefined {
    return this.rulesById.get(ruleId);
  }

  getAllRules(): RuleDefinition[] {
    return Array.from(this.rulesById.values());
  }

  getDiscoveredRules(): RuleDefinition[] {
    const discoveredIds = this.store.snapshot().discoveredRuleIds;
    return discoveredIds
      .map(id => this.rulesById.get(id))
      .filter((rule): rule is RuleDefinition => rule !== undefined);
  }

  getRuleLifecycle(ruleId: string): RuleLifecycleState {
    return this.store.snapshot().ruleLifecycleStates[ruleId] ?? "inactive";
  }

  getViolationCount(ruleId: string): number {
    return this.store.snapshot().ruleViolationCounts[ruleId] ?? 0;
  }

  getEffectiveRuleText(ruleId: string): string {
    const rule = this.rulesById.get(ruleId);
    if (!rule) return "";
    const lifecycle = this.getRuleLifecycle(ruleId);
    if (lifecycle === "transformed" && rule.transformedText) {
      return rule.transformedText;
    }
    return rule.baseText;
  }

  syncLifecycles(sceneId?: string): void {
    const currentSceneId = sceneId ?? this.store.snapshot().currentSceneId;
    const state = this.store.snapshot();

    for (const rule of this.rulesById.values()) {
      this.evaluateSingleRuleLifecycle(rule, state, currentSceneId);
    }
  }

  private handleEvent(event: GameEvent): void {
    const state = this.store.snapshot();

    if (LIFECYCLE_TRIGGER_EVENTS.has(event.type)) {
      for (const rule of this.rulesById.values()) {
        this.evaluateSingleRuleLifecycle(rule, state, event.sceneId);
      }
    }

    const updatedState = this.store.snapshot();

    if (event.type === "PLAYER_ACTION_PERFORMED") {
      this.evaluateActionViolations(event, updatedState);
    } else if (STATE_VIOLATION_TRIGGER_EVENTS.has(event.type)) {
      this.evaluateStateViolations(event, updatedState);
    }
  }

  private evaluateSingleRuleLifecycle(
    rule: RuleDefinition,
    state: DeepReadonly<GameState>,
    sceneId: string
  ): void {
    const currentLifecycle = state.ruleLifecycleStates[rule.id] ?? "inactive";

    if (currentLifecycle === "transformed") {
      return;
    }

    if (rule.transformCondition && this.evaluator.evaluate(rule.transformCondition, state)) {
      const lifecycleEvents = this.executor.execute({
        effects: [{ type: "SET_RULE_LIFECYCLE", ruleId: rule.id, state: "transformed" }]
      });
      for (const nextEvent of lifecycleEvents) {
        this.dispatcher.dispatch(nextEvent);
      }

      if (rule.onTransform) {
        const transformEvents = this.executor.execute(rule.onTransform);
        for (const nextEvent of transformEvents) {
          this.dispatcher.dispatch(nextEvent);
        }
      }
      return;
    }

    if (rule.activeCondition) {
      const shouldBeActive = this.evaluator.evaluate(rule.activeCondition, state);
      const nextLifecycle: RuleLifecycleState = shouldBeActive ? "active" : "inactive";

      if (nextLifecycle !== currentLifecycle) {
        const events = this.executor.execute({
          effects: [{ type: "SET_RULE_LIFECYCLE", ruleId: rule.id, state: nextLifecycle }]
        });
        for (const nextEvent of events) {
          this.dispatcher.dispatch({ ...nextEvent, sceneId });
        }
      }
    }
  }

  private evaluateActionViolations(
    event: Extract<GameEvent, { type: "PLAYER_ACTION_PERFORMED" }>,
    state: DeepReadonly<GameState>
  ): void {
    for (const rule of this.rulesById.values()) {
      if (rule.type === "fake") continue;

      const lifecycle = state.ruleLifecycleStates[rule.id] ?? "inactive";
      if (lifecycle === "inactive") continue;

      const matched = rule.violationTriggers.some(trigger =>
        this.matchesActionTrigger(trigger, event, state)
      );

      if (matched) {
        this.triggerViolation(rule, event.sceneId);
      }
    }
  }

  private evaluateStateViolations(event: GameEvent, state: DeepReadonly<GameState>): void {
    for (const rule of this.rulesById.values()) {
      if (rule.type === "fake") continue;

      const lifecycle = state.ruleLifecycleStates[rule.id] ?? "inactive";

      rule.violationTriggers.forEach((trigger, index) => {
        if (trigger.actionTag || trigger.targetId || !trigger.condition) {
          return;
        }

        const violationKey = `${rule.id}#${index}`;
        const isCurrentlyViolated =
          lifecycle !== "inactive" && this.evaluator.evaluate(trigger.condition, state);

        if (isCurrentlyViolated) {
          if (!this.activeStateViolations.has(violationKey)) {
            this.activeStateViolations.add(violationKey);
            this.triggerViolation(rule, event.sceneId);
          }
        } else {
          this.activeStateViolations.delete(violationKey);
        }
      });
    }
  }

  private matchesActionTrigger(
    trigger: RuleViolationTrigger,
    event: Extract<GameEvent, { type: "PLAYER_ACTION_PERFORMED" }>,
    state: DeepReadonly<GameState>
  ): boolean {
    if (!trigger.actionTag && !trigger.targetId) {
      return false;
    }

    if (trigger.actionTag && trigger.actionTag !== event.actionTag) {
      return false;
    }

    if (trigger.targetId && trigger.targetId !== event.targetId) {
      return false;
    }

    return this.evaluateOptionalCondition(trigger.condition, state);
  }

  private evaluateOptionalCondition(
    condition: Condition | undefined,
    state: DeepReadonly<GameState>
  ): boolean {
    if (!condition) return true;
    return this.evaluator.evaluate(condition, state);
  }

  private triggerViolation(rule: RuleDefinition, sceneId: string): void {
    const currentState = this.store.snapshot();
    if (currentState.activeEndingId !== null) return;

    const currentCount = currentState.ruleViolationCounts[rule.id] ?? 0;
    if (rule.maxViolations !== undefined && currentCount >= rule.maxViolations) {
      return;
    }

    const violationCount = this.store.incrementRuleViolation(rule.id);

    this.dispatcher.dispatch({
      type: "RULE_VIOLATED",
      ruleId: rule.id,
      violationCount,
      sceneId
    });
    this.dispatcher.dispatch({
      type: "STATE_CHANGED",
      domain: "rules",
      targetId: rule.id,
      sceneId
    });

    if (rule.onViolate) {
      const followUpEvents = this.executor.execute(rule.onViolate);
      for (const nextEvent of followUpEvents) {
        this.dispatcher.dispatch(nextEvent);
      }
    }
  }
}