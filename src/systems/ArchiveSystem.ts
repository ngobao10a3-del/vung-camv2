import type { ArchiveDocumentDefinition } from "../types/archive";
import type { GameState } from "../types/save";
import { ConditionEvaluator } from "../core/ConditionEvaluator";
import { DeepReadonly, GameStateStore } from "../core/GameStateStore";

export class ArchiveSystem {
  private readonly documents: ArchiveDocumentDefinition[] = [];
  private readonly documentsById = new Map<string, ArchiveDocumentDefinition>();

  constructor(
    private readonly store: GameStateStore,
    private readonly evaluator: ConditionEvaluator,
    documents: readonly ArchiveDocumentDefinition[] = []
  ) {
    this.registerDocuments(documents);
  }

  registerDocuments(documents: readonly ArchiveDocumentDefinition[]): void {
    this.documents.length = 0;
    this.documentsById.clear();
    for (const doc of documents) {
      this.documents.push(doc);
      this.documentsById.set(doc.id, doc);
    }
  }

  getTotalCount(): number {
    return this.documents.length;
  }

  isUnlocked(documentId: string): boolean {
    const doc = this.documentsById.get(documentId);
    if (!doc) return false;
    return this.evaluateUnlock(doc, this.store.snapshot());
  }

  getUnlockedDocuments(): ArchiveDocumentDefinition[] {
    const state = this.store.snapshot();
    return this.documents.filter(doc => this.evaluateUnlock(doc, state));
  }

  getUnlockedDocument(documentId: string): ArchiveDocumentDefinition | undefined {
    const doc = this.documentsById.get(documentId);
    if (!doc) return undefined;
    return this.evaluateUnlock(doc, this.store.snapshot()) ? doc : undefined;
  }

  isRead(documentId: string): boolean {
    return this.store.snapshot().readArchiveIds.includes(documentId);
  }

  getUnreadCount(): number {
    const state = this.store.snapshot();
    return this.getUnlockedDocuments().filter(doc => !state.readArchiveIds.includes(doc.id)).length;
  }

  markAsRead(documentId: string): boolean {
    if (!this.isUnlocked(documentId)) return false;
    return this.store.markArchiveRead(documentId);
  }

  private evaluateUnlock(doc: ArchiveDocumentDefinition, state: DeepReadonly<GameState>): boolean {
    if (!this.evaluator.evaluate(doc.unlockCondition, state)) {
      return false;
    }

    if (doc.unlockRequiresAnyOf) {
      const { conditions = [], completedDialogueIds = [] } = doc.unlockRequiresAnyOf;
      const condMatched = conditions.some(cond => this.evaluator.evaluate(cond, state));
      const dlgMatched = completedDialogueIds.some(dlgId => state.completedDialogueIds.includes(dlgId));
      if (!condMatched && !dlgMatched) {
        return false;
      }
    }

    return true;
  }
}
