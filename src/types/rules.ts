import type { ActionTag } from "./common";
import type { Condition } from "./conditions";
import type { EffectBlock } from "./effects";

export type RuleType = "true" | "fake" | "conditional" | "transforming";

/** Vòng đời vận hành thực tế của quy tắc trong Engine (tách biệt với nhận thức người chơi) */
export type RuleLifecycleState = "inactive" | "active" | "transformed";

export interface RuleViolationTrigger {
  actionTag?: ActionTag;
  targetId?: string;
  condition?: Condition;
}

export interface RuleDefinition {
  id: string;
  code: string;
  title: string;
  type: RuleType;
  scope: string;
  baseText: string;
  activeCondition?: Condition;
  transformCondition?: Condition;
  transformedText?: string;
  onTransform?: EffectBlock;
  violationTriggers: RuleViolationTrigger[];
  maxViolations?: number;
  onViolate?: EffectBlock;
  countermeasureHint: string;
}

export type Rule = RuleDefinition;