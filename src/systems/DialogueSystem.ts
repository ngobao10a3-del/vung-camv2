import type {
  CharacterDefinition,
  DialogueChoice,
  DialogueDefinition,
  DialogueNode
} from "../types/dialogue";
import { ConditionEvaluator } from "../core/ConditionEvaluator";
import { EffectExecutor } from "../core/EffectExecutor";
import { EventDispatcher } from "../core/EventDispatcher";
import { GameStateStore } from "../core/GameStateStore";

export class DialogueSystem {
  private readonly dialoguesById = new Map<string, DialogueDefinition>();
  private readonly charactersById = new Map<string, CharacterDefinition>();
  private activeDialogueId: string | null = null;
  private currentNodeId: string | null = null;
  private replayMode = false;

  constructor(
    private readonly store: GameStateStore,
    private readonly evaluator: ConditionEvaluator,
    private readonly executor: EffectExecutor,
    dialogues: readonly DialogueDefinition[] = [],
    private readonly dispatcher?: EventDispatcher,
    characters: readonly CharacterDefinition[] = []
  ) {
    this.registerDialogues(dialogues);
    this.registerCharacters(characters);
  }

  registerDialogues(dialogues: readonly DialogueDefinition[]): void {
    this.dialoguesById.clear();
    for (const dialogue of dialogues) {
      this.dialoguesById.set(dialogue.id, dialogue);
    }
  }

  registerCharacters(characters: readonly CharacterDefinition[]): void {
    this.charactersById.clear();
    for (const character of characters) {
      this.charactersById.set(character.id, character);
    }
  }

  getAllDialogues(): DialogueDefinition[] {
    return Array.from(this.dialoguesById.values());
  }

  getDialogue(dialogueId: string): DialogueDefinition | undefined {
    return this.dialoguesById.get(dialogueId);
  }

  getCharacter(characterId: string): CharacterDefinition | undefined {
    return this.charactersById.get(characterId);
  }

  getActiveDialogue(): DialogueDefinition | null {
    if (!this.activeDialogueId) return null;
    return this.dialoguesById.get(this.activeDialogueId) ?? null;
  }

  getActiveDialogueId(): string | null {
    return this.activeDialogueId;
  }

  isReplaying(): boolean {
    return this.replayMode;
  }

  isDialogueCompleted(dialogueId: string): boolean {
    return this.store.snapshot().completedDialogueIds.includes(dialogueId);
  }

  getCompletedDialogues(): DialogueDefinition[] {
    return this.store
      .snapshot()
      .completedDialogueIds.map(id => this.dialoguesById.get(id))
      .filter((d): d is DialogueDefinition => d !== undefined);
  }

  startDialogue(dialogueId: string): boolean {
    const dialogue = this.dialoguesById.get(dialogueId);
    if (!dialogue) return false;

    const entryNode = dialogue.nodes.find(node => node.id === dialogue.entryNodeId);
    if (!entryNode) return false;

    if (entryNode.condition && !this.evaluator.evaluate(entryNode.condition, this.store.snapshot())) {
      return false;
    }

    this.replayMode = false;
    this.activeDialogueId = dialogue.id;
    this.enterNode(dialogue, entryNode);
    return true;
  }

  /** Phát lại hội thoại đã hoàn thành mà không kích hoạt lại gameplay effect */
  replayDialogue(dialogueId: string): boolean {
    if (!this.isDialogueCompleted(dialogueId)) return false;
    const dialogue = this.dialoguesById.get(dialogueId);
    if (!dialogue) return false;

    const entryNode = dialogue.nodes.find(node => node.id === dialogue.entryNodeId);
    if (!entryNode) return false;

    if (entryNode.condition && !this.evaluator.evaluate(entryNode.condition, this.store.snapshot())) {
      return false;
    }

    this.replayMode = true;
    this.activeDialogueId = dialogue.id;
    this.enterNode(dialogue, entryNode);
    return true;
  }

  /** Đóng hội thoại hiện tại (nếu đang dang dở sẽ không đánh dấu hoàn thành) */
  cancelDialogue(): void {
    this.activeDialogueId = null;
    this.currentNodeId = null;
    this.replayMode = false;
  }

  getCurrentNode(): DialogueNode | null {
    if (!this.activeDialogueId || !this.currentNodeId) return null;
    const dialogue = this.dialoguesById.get(this.activeDialogueId);
    if (!dialogue) return null;
    return dialogue.nodes.find(node => node.id === this.currentNodeId) ?? null;
  }

  getAvailableChoices(): DialogueChoice[] {
    const node = this.getCurrentNode();
    if (!node || !node.choices || node.choices.length === 0) return [];

    const state = this.store.snapshot();
    return node.choices.filter(choice => {
      if (!this.evaluator.evaluate(choice.condition, state)) return false;
      if (!this.replayMode) {
        if (choice.onceId && this.store.hasTriggeredOnce(choice.onceId)) return false;
        if (choice.effects?.onceId && this.store.hasTriggeredOnce(choice.effects.onceId)) return false;
      }
      return true;
    });
  }

  selectChoice(choiceId: string): boolean {
    if (!this.activeDialogueId) return false;
    const dialogue = this.dialoguesById.get(this.activeDialogueId);
    const node = this.getCurrentNode();
    if (!dialogue || !node) return false;

    const choice = this.getAvailableChoices().find(item => item.id === choiceId);
    if (!choice) return false;

    if (!this.replayMode) {
      if (choice.effects) {
        const events = this.executor.execute(choice.effects);
        for (const evt of events) {
          this.dispatcher?.dispatch(evt);
        }
      }

      if (choice.onceId) {
        this.store.markOnce(choice.onceId);
      }
    }

    if (choice.nextNodeId) {
      const nextNode = dialogue.nodes.find(item => item.id === choice.nextNodeId);
      if (!nextNode) return false;
      if (nextNode.condition && !this.evaluator.evaluate(nextNode.condition, this.store.snapshot())) {
        return false;
      }
      this.enterNode(dialogue, nextNode);
      return true;
    }

    if (!this.replayMode) {
      this.store.markDialogueCompleted(dialogue.id);
    }
    this.activeDialogueId = null;
    this.currentNodeId = null;
    this.replayMode = false;
    return true;
  }

  advance(): boolean {
    if (!this.activeDialogueId) return false;
    const dialogue = this.dialoguesById.get(this.activeDialogueId);
    const node = this.getCurrentNode();
    if (!dialogue || !node) return false;

    if (node.isEnd) return false;
    if (this.getAvailableChoices().length > 0) return false;
    if (!node.nextNodeId) return false;

    const nextNode = dialogue.nodes.find(item => item.id === node.nextNodeId);
    if (!nextNode) return false;
    if (nextNode.condition && !this.evaluator.evaluate(nextNode.condition, this.store.snapshot())) {
      return false;
    }

    this.enterNode(dialogue, nextNode);
    return true;
  }

  private enterNode(dialogue: DialogueDefinition, node: DialogueNode): void {
    this.currentNodeId = node.id;

    if (!this.replayMode) {
      const existingCharState = this.store.snapshot().characterStates[node.speakerId];
      const characterDef = this.charactersById.get(node.speakerId);
      const expression =
        node.expression ?? characterDef?.defaultExpression ?? existingCharState?.expression ?? "neutral";

      this.store.setCharacterState(node.speakerId, {
        met: true,
        expression,
        ...(existingCharState?.note !== undefined ? { note: existingCharState.note } : {})
      });

      if (node.effects) {
        const events = this.executor.execute(node.effects);
        for (const evt of events) {
          this.dispatcher?.dispatch(evt);
        }
      }

      const isTerminalNode =
        Boolean(node.isEnd) || (!node.nextNodeId && (!node.choices || node.choices.length === 0));
      if (isTerminalNode) {
        this.store.markDialogueCompleted(dialogue.id);
      }
    }
  }
}
