import type { ArchiveDocumentDefinition } from "../types/archive";
import { ConditionEvaluator } from "../core/ConditionEvaluator";
import { GameStateStore } from "../core/GameStateStore";

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
    return this.evaluator.evaluate(doc.unlockCondition, this.store.snapshot());
  }

  getUnlockedDocuments(): ArchiveDocumentDefinition[] {
    const state = this.store.snapshot();
    return this.documents.filter(doc => this.evaluator.evaluate(doc.unlockCondition, state));
  }

  getUnlockedDocument(documentId: string): ArchiveDocumentDefinition | undefined {
    const doc = this.documentsById.get(documentId);
    if (!doc) return undefined;
    return this.evaluator.evaluate(doc.unlockCondition, this.store.snapshot()) ? doc : undefined;
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
}
