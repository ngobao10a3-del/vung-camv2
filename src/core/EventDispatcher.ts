import type { EventDefinition, EventFilter, GameEvent } from "../types/events";
import { GameStateStore } from "./GameStateStore";
import { ConditionEvaluator } from "./ConditionEvaluator";
import { EffectExecutor } from "./EffectExecutor";

export type EventSubscriber = (event: GameEvent) => void;

const MAX_EVENTS_PER_TURN = 50;

export class EventDispatcher {
  private readonly queue: GameEvent[] = [];
  private readonly subscribers = new Set<EventSubscriber>();
  private eventDefinitions: EventDefinition[] = [];
  private isFlushing = false;

  constructor(
    private readonly store: GameStateStore,
    private readonly evaluator: ConditionEvaluator,
    private readonly executor: EffectExecutor,
    initialDefinitions: EventDefinition[] = []
  ) {
    this.eventDefinitions = [...initialDefinitions];
  }

  registerEventDefinitions(definitions: EventDefinition[]): void {
    this.eventDefinitions = [...definitions];
  }

  subscribe(listener: EventSubscriber): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  dispatch(event: GameEvent): void {
    this.queue.push(event);
    if (!this.isFlushing) {
      this.flush();
    }
  }

  private flush(): void {
    this.isFlushing = true;
    let processedCount = 0;

    try {
      while (this.queue.length > 0) {
        if (processedCount >= MAX_EVENTS_PER_TURN) {
          const message =
            `[EventDispatcher] Loop guard triggered: exceeded ` +
            `${MAX_EVENTS_PER_TURN} events in a single turn.`;

          console.error(message);
          this.store.addLog(message);
          this.queue.length = 0;
          break;
        }

        const currentEvent = this.queue.shift()!;
        processedCount++;

        // Mỗi sự kiện chụp một snapshot độc lập trước khi duyệt subscriber và EventDefinition
        const eventStateSnapshot = this.store.snapshot();

        // 1. Cô lập lỗi cho từng subscriber
        for (const listener of this.subscribers) {
          try {
            listener(currentEvent);
          } catch (error) {
            console.error("[EventDispatcher] Subscriber threw an error:", error);
          }
        }

        // 2. Đánh giá các EventDefinition trên cùng snapshot
        for (const definition of this.eventDefinitions) {
          try {
            if (definition.triggerEvent !== currentEvent.type) {
              continue;
            }

            if (!this.matchesFilter(currentEvent, definition.eventFilter)) {
              continue;
            }

            if (
              definition.condition &&
              !this.evaluator.evaluate(definition.condition, eventStateSnapshot)
            ) {
              continue;
            }

            const followUpEvents = this.executor.execute(definition.result);
            for (const nextEvent of followUpEvents) {
              this.queue.push(nextEvent);
            }
          } catch (error) {
            console.error(
              `[EventDispatcher] EventDefinition "${definition.id}" failed:`,
              error
            );
          }
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  private matchesFilter(event: GameEvent, filter: EventFilter | undefined): boolean {
    if (!filter) {
      return true;
    }

    if (filter.actionTags?.length) {
      if (
        event.type !== "PLAYER_ACTION_PERFORMED" ||
        !event.actionTag ||
        !filter.actionTags.includes(event.actionTag)
      ) {
        return false;
      }
    }

    if (filter.targetIds?.length) {
      if (
        event.type !== "PLAYER_ACTION_PERFORMED" ||
        !filter.targetIds.includes(event.targetId)
      ) {
        return false;
      }
    }

    if (filter.sceneIds?.length) {
      if (!filter.sceneIds.includes(event.sceneId)) {
        return false;
      }
    }

    if (filter.ruleIds?.length) {
      const hasRuleId =
        event.type === "RULE_ADDED" ||
        event.type === "RULE_TRANSFORMED" ||
        event.type === "RULE_VIOLATED" ||
        event.type === "DEDUCTION_UPDATED";

      if (!hasRuleId || !filter.ruleIds.includes(event.ruleId)) {
        return false;
      }
    }

    if (filter.puzzleIds?.length) {
      if (
        event.type !== "PUZZLE_SOLVED" ||
        !filter.puzzleIds.includes(event.puzzleId)
      ) {
        return false;
      }
    }

    return true;
  }
}