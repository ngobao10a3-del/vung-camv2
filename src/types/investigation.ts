export type ClueCategory = "document" | "cctv" | "photo" | "blueprint" | "audio_transcript";

/**
 * Thứ bậc trạng thái điều tra:
 * unverified (0) -> supported / contradicted (1) -> conditional_confirmed (2) -> verified | debunked_fake (3)
 * Lưu ý: 'verified' và 'debunked_fake' là hai kết luận cuối cùng loại trừ lẫn nhau.
 */
export type InvestigationStatus =
  | "unverified"
  | "supported"
  | "contradicted"
  | "conditional_confirmed"
  | "verified"
  | "debunked_fake"
  | "conflicted";

export interface ClueDefinition {
  id: string;
  title: string;
  category: ClueCategory;
  summary: string;
  detailContent: string;
  visualAssetUrl?: string;
  relatedRuleIds: string[];
}

export type Clue = ClueDefinition;

export interface DeductionGroup {
  id: string;
  ruleId: string;
  requiredClueIds: string[];
  orderMatters?: boolean;
  resultingStatus: Exclude<InvestigationStatus, "unverified" | "conflicted">;
  deductionNote: string;
  unlockCountermeasure?: boolean;
}