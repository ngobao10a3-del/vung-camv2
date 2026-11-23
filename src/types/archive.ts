import type { Condition } from "./conditions";

export type ArchiveDocumentCategory =
  | "diary"
  | "dossier"
  | "broadcast"
  | "tape"
  | "technical"
  | "cctv";

export interface ArchiveDocumentDefinition {
  id: string;
  title: string;
  sourceLabel: string;
  category: ArchiveDocumentCategory;
  relatedSceneId: string;
  relatedClueIds: string[];
  unlockCondition: Condition;
  content: string;
}
