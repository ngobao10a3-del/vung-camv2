import type { Condition } from "./conditions";
import type { EffectBlock } from "./effects";

export type CharacterExpression =
  | "neutral"
  | "tense"
  | "shadowed"
  | "static"
  | "distorted"
  | "distressed"
  | "alert"
  | "cryptic"
  | "unknown";

export type CharacterRecordedStatus =
  | "active_duty"
  | "automated_system"
  | "missing"
  | "unconfirmed_archive";

export type DialogueChannel = "MONO" | "RADIO · 00:15" | "INTERCOM" | "TAPE" | "SYSTEM";

export interface CharacterState {
  met: boolean;
  expression: CharacterExpression;
  note?: string;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  role: string;
  recordedStatus: CharacterRecordedStatus;
  statusNote: string;
  description: string;
  defaultExpression: CharacterExpression;
  portraitTag?: string;
}

export interface DialogueChoice {
  id: string;
  label: string;
  nextNodeId?: string;
  condition?: Condition;
  onceId?: string;
  effects?: EffectBlock;
  isRisky?: boolean;
}

export interface DialogueNode {
  id: string;
  speakerId: string;
  expression?: CharacterExpression;
  channel?: DialogueChannel;
  text: string;
  condition?: Condition;
  choices?: DialogueChoice[];
  nextNodeId?: string;
  effects?: EffectBlock;
  isEnd?: boolean;
}

export interface DialogueDefinition {
  id: string;
  title: string;
  sceneId: string;
  channel?: DialogueChannel;
  entryNodeId: string;
  nodes: DialogueNode[];
}
