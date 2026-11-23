export interface TypewriterState {
  fullText: string;
  revealedLength: number;
  isComplete: boolean;
}

export type DialogueBoxClickOutcome =
  | { action: "reveal_all"; state: TypewriterState }
  | { action: "advance_dialogue" }
  | { action: "close_dialogue" }
  | { action: "await_choice" };

export function createTypewriterState(text: string): TypewriterState {
  return {
    fullText: text,
    revealedLength: text.length === 0 ? 0 : 1,
    isComplete: text.length <= 1
  };
}

export function stepTypewriter(state: TypewriterState, stepChars = 1): TypewriterState {
  if (state.isComplete) return state;
  const nextLength = Math.min(state.fullText.length, state.revealedLength + Math.max(1, stepChars));
  return {
    fullText: state.fullText,
    revealedLength: nextLength,
    isComplete: nextLength >= state.fullText.length
  };
}

export function revealAllTypewriter(state: TypewriterState): TypewriterState {
  if (state.isComplete) return state;
  return {
    fullText: state.fullText,
    revealedLength: state.fullText.length,
    isComplete: true
  };
}

export function getVisibleTypewriterText(state: TypewriterState): string {
  return state.fullText.slice(0, state.revealedLength);
}

/**
 * Xử lý cú nhấp vào khung hội thoại:
 * - Nếu chữ đang chạy -> hiện ngay toàn bộ câu hiện tại, chưa chuyển node.
 * - Nếu chữ đã hiện đầy đủ:
 *   - Nếu có lựa chọn nhánh -> giữ nguyên để người chơi chọn nhánh.
 *   - Nếu là node tuyến tính chưa kết thúc -> chuyển sang node kế tiếp.
 *   - Nếu là node cuối -> đóng hội thoại để quay lại thao tác cảnh.
 */
export function resolveDialogueBoxClick(
  state: TypewriterState,
  opts: { hasChoices: boolean; isEndNode: boolean; hasNextNode: boolean }
): DialogueBoxClickOutcome {
  if (!state.isComplete) {
    return { action: "reveal_all", state: revealAllTypewriter(state) };
  }
  if (opts.hasChoices) {
    return { action: "await_choice" };
  }
  if (!opts.isEndNode && opts.hasNextNode) {
    return { action: "advance_dialogue" };
  }
  return { action: "close_dialogue" };
}
