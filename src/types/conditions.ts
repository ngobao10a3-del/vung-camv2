import type { EntityState, FlagValue } from "./common";
import type { InvestigationStatus } from "./investigation";
import type { RuleLifecycleState } from "./rules";

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { flagEquals: { key: string; value: FlagValue } }
  | { flagGreaterThan: { key: string; value: number } }
  | { flagLessThan: { key: string; value: number } }
  | { hasItem: string }
  | { itemCollected: string }
  | { hasClue: string }
  | { puzzleSolved: string }
  | { inScene: string }
  | { ruleLifecycleIs: { ruleId: string; state: RuleLifecycleState } }
  | { ruleStatusIs: { ruleId: string; status: InvestigationStatus } }
  | { entityStateIs: { entityId: string; state: EntityState } }
  | { triggeredOnce: string };