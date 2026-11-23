import { useEffect, useState } from "react";
import type {
  CharacterDefinition,
  CharacterExpression,
  CharacterRecordedStatus,
  DialogueChannel,
  DialogueChoice,
  DialogueDefinition,
  DialogueNode
} from "../types/dialogue";
import { DialogueSystem } from "../systems/DialogueSystem";
import {
  createTypewriterState,
  getVisibleTypewriterText,
  resolveDialogueBoxClick,
  stepTypewriter,
  type TypewriterState
} from "../systems/DialogueTypewriter";

type Props = {
  dialogueSystem: DialogueSystem;
  node: DialogueNode;
  activeDialogue: DialogueDefinition | null;
  onStateChange: () => void;
  onCloseDialogue: () => void;
  typewriterSpeedMs?: number;
  identityOverwriteCount?: number;
  lastOverwriteReason?: string;
};

type VisualExpression = "neutral" | "tense" | "shadowed" | "static" | "distorted";

function normalizeVisualExpression(raw?: CharacterExpression): VisualExpression {
  switch (raw) {
    case "tense":
    case "alert":
      return "tense";
    case "shadowed":
    case "distressed":
    case "unknown":
      return "shadowed";
    case "static":
    case "cryptic":
      return "static";
    case "distorted":
      return "distorted";
    case "neutral":
    default:
      return "neutral";
  }
}

const STATUS_BADGE_MAP: Record<CharacterRecordedStatus, { label: string; toneClass: string }> = {
  missing: { label: "MẤT TÍCH", toneClass: "status-missing" },
  automated_system: { label: "TỰ ĐỘNG", toneClass: "status-auto" },
  active_duty: { label: "NHÂN VIÊN TRỰC", toneClass: "status-duty" },
  unconfirmed_archive: { label: "CHƯA XÁC MINH", toneClass: "status-unconfirmed" }
};

const EXPRESSION_LABEL_MAP: Record<VisualExpression, string> = {
  neutral: "neutral · LƯU TRỮ CHUẨN",
  tense: "tense · BIẾN DẠNG NHẸ",
  shadowed: "shadowed · CHE KHUẤT MỘT PHẦN",
  static: "static · NHIỄU TÍN HIỆU",
  distorted: "distorted · DỊ THƯỜNG DANH TÍNH"
};

function PaperCutIdentityPortrait({
  character,
  expression,
  channel
}: {
  character?: CharacterDefinition;
  expression: VisualExpression;
  channel: DialogueChannel;
}) {
  const isSystem = character?.id === "CHAR-SYS" || channel === "SYSTEM";

  return (
    <div
      className={`papercut-portrait-card expr-${expression}`}
      data-expression={expression}
      aria-label={`Ảnh hồ sơ ${character?.name ?? "Nhân sự Trạm 09"} — trạng thái ${expression}`}
    >
      <div className="papercut-photo-header">
        <span>HS-09 · 1998</span>
        <span>{character?.id ?? "CHAR"}</span>
      </div>

      <div className="papercut-silhouette-stage">
        <svg viewBox="0 0 112 132" className="papercut-svg" aria-hidden="true">
          <defs>
            <pattern id="pc-paper-grid" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(22,26,29,0.08)" strokeWidth="0.6" />
            </pattern>
            <clipPath id="pc-card-clip">
              <rect x="4" y="4" width="104" height="124" rx="1" />
            </clipPath>
          </defs>

          {/* Nền giấy ảnh hồ sơ cũ */}
          <rect x="4" y="4" width="104" height="124" fill="#D4C9B1" />
          <rect x="4" y="4" width="104" height="124" fill="url(#pc-paper-grid)" />
          <rect x="7" y="7" width="98" height="118" fill="none" stroke="#6E6553" strokeWidth="0.9" strokeDasharray="3 2" />

          <g clipPath="url(#pc-card-clip)">
            {/* Lớp bóng cắt giấy lệch (biểu hiện căng thẳng hoặc chồng ghi danh tính) */}
            {(expression === "tense" || expression === "distorted") && (
              <g transform={expression === "distorted" ? "translate(6, -3)" : "translate(3, 1)"} opacity={expression === "distorted" ? 0.55 : 0.28}>
                {isSystem ? (
                  <polygon points="28,28 84,28 88,92 24,92" fill="#9E2323" />
                ) : (
                  <>
                    <ellipse cx="56" cy="48" rx="17" ry="20" fill="#9E2323" />
                    <path d="M22 126 Q25 78 56 78 Q87 78 90 126 Z" fill="#9E2323" />
                  </>
                )}
              </g>
            )}

            {/* Bóng cắt giấy chính (nhân sự 1998 hoặc khối thiết bị trạm) */}
            {isSystem ? (
              <g>
                <rect x="24" y="26" width="64" height="66" rx="2" fill="#182024" />
                <rect x="30" y="34" width="52" height="22" fill="#2A3634" />
                <line x1="34" y1="45" x2="78" y2="45" stroke="#CFA855" strokeWidth="1.2" />
                <rect x="32" y="64" width="48" height="6" fill="#B5A88E" />
                <rect x="32" y="75" width="32" height="5" fill="#706A5C" />
              </g>
            ) : (
              <g>
                {/* Cổ áo công tác 1998 */}
                <path d="M22 128 Q26 78 56 78 Q86 78 90 128 Z" fill="#151C20" />
                <polygon points="44,78 56,96 68,78" fill="#B5A88E" opacity="0.88" />
                <polygon points="48,79 56,92 64,79" fill="#273135" />
                {/* Đầu & vai cắt giấy */}
                <ellipse cx="56" cy="48" rx="16.5" ry="20" fill="#151C20" />
                <path d="M40 44 Q44 26 56 26 Q69 26 72 43 Q65 36 56 36 Q47 36 40 44 Z" fill="#0B1115" />
              </g>
            )}

            {/* tense: nếp gấp cắt giấy & dấu cảnh báo góc */}
            {expression === "tense" && (
              <g>
                <line x1="12" y1="54" x2="100" y2="49" stroke="#D4C9B1" strokeWidth="1.4" strokeDasharray="4 2" />
                <path d="M12 16 L24 16 M12 16 L12 28" stroke="#9E2323" strokeWidth="1.6" fill="none" />
                <path d="M100 116 L88 116 M100 116 L100 104" stroke="#9E2323" strokeWidth="1.6" fill="none" />
              </g>
            )}

            {/* shadowed: bóng che một phần hồ sơ / sương tối phủ nửa khung */}
            {expression === "shadowed" && (
              <g>
                <polygon points="0,0 76,0 52,132 0,132" fill="#070C10" opacity="0.72" />
                <line x1="52" y1="4" x2="76" y2="128" stroke="#5C5951" strokeWidth="1" strokeDasharray="2 3" />
              </g>
            )}

            {/* static: vạch nhiễu analog & tracking bar */}
            {expression === "static" && (
              <g>
                <rect x="4" y="34" width="104" height="5" fill="#EDE3CE" opacity="0.45" />
                <rect x="4" y="68" width="104" height="3" fill="#070C10" opacity="0.5" />
                <rect x="4" y="88" width="104" height="6" fill="#EDE3CE" opacity="0.32" />
                <line x1="10" y1="22" x2="96" y2="22" stroke="#161A1D" strokeWidth="1" strokeDasharray="6 3 2 3" />
                <line x1="14" y1="104" x2="102" y2="104" stroke="#161A1D" strokeWidth="1" strokeDasharray="3 5" />
              </g>
            )}

            {/* distorted: lớp danh tính chồng lấn bất thường + dấu niêm phong đỏ */}
            {expression === "distorted" && (
              <g>
                <polygon points="4,40 108,35 108,59 4,64" fill="#D4C9B1" opacity="0.28" />
                <line x1="8" y1="39" x2="104" y2="35" stroke="#D93838" strokeWidth="1.2" />
                <line x1="8" y1="63" x2="104" y2="59" stroke="#D93838" strokeWidth="1.2" strokeDasharray="4 2" />
                <g transform="translate(66, 16) rotate(-11)">
                  <rect x="0" y="0" width="34" height="16" fill="rgba(158, 35, 35, 0.14)" stroke="#9E2323" strokeWidth="1.4" />
                  <text x="17" y="11" textAnchor="middle" fill="#9E2323" fontSize="6.5" fontFamily="monospace" fontWeight="700">
                    GHI ĐÈ
                  </text>
                </g>
              </g>
            )}
          </g>
        </svg>

        {expression === "static" && <div className="papercut-static-overlay" aria-hidden="true" />}
      </div>

      <div className="papercut-expr-caption">{EXPRESSION_LABEL_MAP[expression]}</div>
    </div>
  );
}

export function DialoguePanel({
  dialogueSystem,
  node,
  activeDialogue,
  onStateChange,
  onCloseDialogue,
  typewriterSpeedMs = 16,
  identityOverwriteCount = 0,
  lastOverwriteReason
}: Props) {
  const [typewriter, setTypewriter] = useState<TypewriterState>(() => createTypewriterState(node.text));

  useEffect(() => {
    setTypewriter(createTypewriterState(node.text));
  }, [node.id, node.text]);

  useEffect(() => {
    if (typewriter.isComplete) return;
    const timer = window.setInterval(() => {
      setTypewriter(curr => {
        if (curr.isComplete) return curr;
        return stepTypewriter(curr, 2);
      });
    }, typewriterSpeedMs);

    return () => window.clearInterval(timer);
  }, [node.id, typewriter.isComplete, typewriterSpeedMs]);

  const character = dialogueSystem.getCharacter(node.speakerId);
  const availableChoices = dialogueSystem.getAvailableChoices();
  const isEndNode = Boolean(node.isEnd) || (!node.nextNodeId && (!node.choices || node.choices.length === 0));
  const hasNextNode = Boolean(node.nextNodeId);
  const isReplay = dialogueSystem.isReplaying();

  const visualExpression = normalizeVisualExpression(node.expression ?? character?.defaultExpression);
  const channel: DialogueChannel = node.channel ?? activeDialogue?.channel ?? "MONO";
  const statusMeta = character
    ? STATUS_BADGE_MAP[character.recordedStatus]
    : { label: "CHƯA XÁC MINH", toneClass: "status-unconfirmed" };

  const handleBoxClick = () => {
    const outcome = resolveDialogueBoxClick(typewriter, {
      hasChoices: availableChoices.length > 0,
      isEndNode,
      hasNextNode
    });

    if (outcome.action === "reveal_all") {
      setTypewriter(outcome.state);
      return;
    }

    if (outcome.action === "advance_dialogue") {
      dialogueSystem.advance();
      onStateChange();
      return;
    }

    if (outcome.action === "close_dialogue") {
      dialogueSystem.cancelDialogue();
      onCloseDialogue();
    }
  };

  const handleSelectChoice = (choice: DialogueChoice) => {
    if (dialogueSystem.selectChoice(choice.id)) {
      if (!dialogueSystem.getCurrentNode()) {
        onCloseDialogue();
      } else {
        onStateChange();
      }
    }
  };

  const visibleText = getVisibleTypewriterText(typewriter);

  return (
    <div className="dialogue-box dialogue-papercut-shell" data-testid="dialogue-panel">
      <div className="dialogue-papercut-grid">
        <PaperCutIdentityPortrait
          character={character}
          expression={visualExpression}
          channel={channel}
        />

        <div className="dialogue-papercut-body">
          <div className="dialogue-papercut-head">
            <div className="dialogue-identity-meta">
              <div className="dialogue-name-row">
                <strong className="dialogue-char-name">{character?.name ?? node.speakerId}</strong>
                <span className={`dialogue-status-badge ${statusMeta.toneClass}`}>{statusMeta.label}</span>
                {isReplay && <span className="dialogue-replay-badge">PHÁT LẠI (KHÔNG HIỆU ỨNG)</span>}
              </div>
              <div className="dialogue-role-line">{character?.role ?? "Hồ sơ lưu trữ Trạm 09"}</div>
            </div>

            <div className="dialogue-channel-cluster">
              <span className="dialogue-channel-badge">{channel}</span>
              <button
                type="button"
                className="btn-ghost-sm dialogue-exit-btn"
                onClick={() => {
                  dialogueSystem.cancelDialogue();
                  onCloseDialogue();
                }}
              >
                {isEndNode ? "Xong ✕" : "Đóng về cảnh"}
              </button>
            </div>
          </div>

          <div
            className={`dialogue-text dialogue-typewriter-box ${!typewriter.isComplete ? "typing" : "ready"}`}
            role="button"
            tabIndex={0}
            aria-label="Khung thoại: bấm để hiện hết câu hoặc chuyển tiếp"
            aria-live="polite"
            onClick={handleBoxClick}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleBoxClick();
              }
            }}
          >
            <span>{visibleText}</span>
            {!typewriter.isComplete && <span className="typewriter-caret" aria-hidden="true">▌</span>}
            <div className="typewriter-prompt-hint">
              {!typewriter.isComplete
                ? "Bấm vào khung chữ để hiện ngay toàn bộ câu"
                : availableChoices.length > 0
                  ? "Chọn hướng phản hồi hoặc quan sát bên dưới"
                  : isEndNode
                    ? "Đã hết đoạn ghi · Bấm để quay lại thao tác cảnh"
                    : "Bấm vào khung chữ để đọc tiếp ›"}
            </div>
          </div>

          {identityOverwriteCount > 0 && (
            <div
              className={`overwrite-status-banner ${identityOverwriteCount >= 2 ? "critical" : "warn"}`}
              role="status"
            >
              <strong>
                {identityOverwriteCount >= 2
                  ? "MỨC GHI ĐÈ: 2/2 — DANH TÍNH ĐÃ BỊ GHI ĐÈ"
                  : "MỨC GHI ĐÈ: 1/2 — CẢNH BÁO NGUY HIỂM"}
              </strong>
              {lastOverwriteReason && <span>{lastOverwriteReason}</span>}
            </div>
          )}

          {availableChoices.length > 0 ? (
            <div className="choice-bar" aria-label="Lựa chọn hội thoại">
              {availableChoices.map((choiceItem, idx) => (
                <button
                  key={choiceItem.id}
                  type="button"
                  className="choice-btn"
                  onClick={() => handleSelectChoice(choiceItem)}
                >
                  <span className="choice-index-num" aria-hidden="true">{idx + 1}.</span>
                  <span>{choiceItem.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="choice-bar">
              <button
                type="button"
                className="choice-btn nav-next"
                onClick={handleBoxClick}
              >
                {!typewriter.isComplete
                  ? "Hiện toàn bộ câu"
                  : isEndNode
                    ? "Quay lại thao tác cảnh →"
                    : "Tiếp tục →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
