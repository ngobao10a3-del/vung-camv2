import type { PuzzleDefinition, PuzzleSolution } from "../types/common";
import { ConditionEvaluator } from "../core/ConditionEvaluator";
import { EffectExecutor } from "../core/EffectExecutor";
import { EventDispatcher } from "../core/EventDispatcher";
import { GameStateStore } from "../core/GameStateStore";

export interface PuzzleAttemptResult {
  status: "solved" | "failed" | "locked" | "already_solved" | "missing_items" | "not_found";
  attemptsUsed: number;
  remainingAttempts: number | null;
}

const normalizeToken = (value: string): string => value.replace(/\s+/g, "").toUpperCase();

export class PuzzleSystem {
  private readonly definitionsById = new Map<string, PuzzleDefinition>();
  private readonly solutionsById = new Map<string, PuzzleSolution>();

  constructor(
    private readonly store: GameStateStore,
    private readonly executor: EffectExecutor,
    private readonly dispatcher: EventDispatcher,
    definitions: readonly PuzzleDefinition[] = [],
    solutions: readonly PuzzleSolution[] = [],
    private readonly evaluator: ConditionEvaluator = new ConditionEvaluator()
  ) {
    this.registerPuzzles(definitions, solutions);
  }

  registerPuzzles(definitions: readonly PuzzleDefinition[], solutions: readonly PuzzleSolution[]): void {
    this.definitionsById.clear();
    this.solutionsById.clear();
    for (const def of definitions) this.definitionsById.set(def.id, def);
    for (const sol of solutions) this.solutionsById.set(sol.puzzleId, sol);
  }

  getPuzzleDefinition(puzzleId: string): PuzzleDefinition | undefined {
    return this.definitionsById.get(puzzleId);
  }

  getPuzzlesForScene(sceneId: string): PuzzleDefinition[] {
    return Array.from(this.definitionsById.values()).filter(p => p.sceneId === sceneId);
  }

  isSolved(puzzleId: string): boolean {
    return this.store.snapshot().solvedPuzzleIds.includes(puzzleId);
  }

  getAttemptCount(puzzleId: string): number {
    return this.store.snapshot().puzzleAttempts[puzzleId] ?? 0;
  }

  submitSolution(puzzleId: string, submission: string | string[]): PuzzleAttemptResult {
    const definition = this.definitionsById.get(puzzleId);
    const solution = this.solutionsById.get(puzzleId);
    if (!definition || !solution) return { status: "not_found", attemptsUsed: 0, remainingAttempts: null };

    const attemptsUsed = this.getAttemptCount(puzzleId);
    const calcRemaining = (used: number): number | null =>
      definition.maxAttempts === undefined ? null : Math.max(0, definition.maxAttempts - used);

    if (this.store.snapshot().activeEndingId !== null) {
      return { status: "locked", attemptsUsed, remainingAttempts: calcRemaining(attemptsUsed) };
    }
    if (this.isSolved(puzzleId)) {
      return { status: "already_solved", attemptsUsed, remainingAttempts: calcRemaining(attemptsUsed) };
    }
    if (definition.maxAttempts !== undefined && attemptsUsed >= definition.maxAttempts) {
      return { status: "locked", attemptsUsed, remainingAttempts: 0 };
    }

    const specificFailBlock = !Array.isArray(submission)
      ? solution.onFailBySubmission?.[normalizeToken(submission)]
      : undefined;

    if (
      !specificFailBlock &&
      solution.solveCondition &&
      !this.evaluator.evaluate(solution.solveCondition, this.store.snapshot())
    ) {
      return { status: "missing_items", attemptsUsed, remainingAttempts: calcRemaining(attemptsUsed) };
    }
    if (definition.solutionType === "item_combination") {
      const submittedItems = Array.isArray(submission) ? submission : [submission];
      const inventory = this.store.snapshot().inventoryItemIds;
      if (!submittedItems.every(itemId => inventory.includes(itemId))) {
        return { status: "missing_items", attemptsUsed, remainingAttempts: calcRemaining(attemptsUsed) };
      }
    }

    if (this.matchesSolution(definition, solution, submission)) {
      for (const evt of this.executor.execute({ effects: [{ type: "MARK_PUZZLE_SOLVED", puzzleId }] })) {
        this.dispatcher.dispatch(evt);
      }
      for (const evt of this.executor.execute(solution.onSolve)) {
        this.dispatcher.dispatch(evt);
      }
      return { status: "solved", attemptsUsed, remainingAttempts: calcRemaining(attemptsUsed) };
    }

    const nextAttempts = this.store.incrementPuzzleAttempt(puzzleId);
    this.dispatcher.dispatch({
      type: "STATE_CHANGED",
      domain: "puzzles",
      targetId: puzzleId,
      sceneId: this.store.snapshot().currentSceneId
    });
    if (specificFailBlock) {
      for (const evt of this.executor.execute(specificFailBlock)) {
        this.dispatcher.dispatch(evt);
      }
    } else if (solution.onFail) {
      for (const evt of this.executor.execute(solution.onFail)) {
        this.dispatcher.dispatch(evt);
      }
    }
    const isNowLocked = definition.maxAttempts !== undefined && nextAttempts >= definition.maxAttempts;
    return { status: isNowLocked ? "locked" : "failed", attemptsUsed: nextAttempts, remainingAttempts: calcRemaining(nextAttempts) };
  }

  private matchesSolution(definition: PuzzleDefinition, solution: PuzzleSolution, submission: string | string[]): boolean {
    const expected = solution.expectedSolution;
    switch (definition.solutionType) {
      case "passcode": {
        const exp = Array.isArray(expected) ? expected.map(normalizeToken).join("") : normalizeToken(expected);
        const sub = Array.isArray(submission) ? submission.map(normalizeToken).join("") : normalizeToken(submission);
        return sub.length > 0 && sub === exp;
      }
      case "sequence_order": {
        const expSeq = (Array.isArray(expected) ? expected : [expected]).map(normalizeToken);
        const subSeq = (Array.isArray(submission) ? submission : [submission]).map(normalizeToken);
        return expSeq.length === subSeq.length && expSeq.every((step, idx) => step === subSeq[idx]);
      }
      case "item_combination": {
        const expSet = new Set((Array.isArray(expected) ? expected : [expected]).map(s => s.trim()));
        const subSet = new Set((Array.isArray(submission) ? submission : [submission]).map(s => s.trim()));
        if (expSet.size !== subSet.size) return false;
        for (const item of expSet) if (!subSet.has(item)) return false;
        return true;
      }
    }
  }
}