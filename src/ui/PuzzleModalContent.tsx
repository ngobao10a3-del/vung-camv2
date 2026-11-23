import { useState } from "react";
import type { PuzzleDefinition } from "../types/common";
import type { ClueDefinition } from "../types/investigation";
import type { GameState } from "../types/save";
import type { DeepReadonly } from "../core/GameStateStore";

export type PuzzleModalFeedback = {
  title: string;
  detail: string;
  tone: "ok" | "warn" | "info";
};

export type PuzzleModalContentProps = {
  scenePuzzles: readonly PuzzleDefinition[];
  state: DeepReadonly<GameState>;
  cluesById: ReadonlyMap<string, ClueDefinition>;
  itemsMeta: Readonly<Record<string, { name: string; note: string }>>;
  onSubmitPuzzle: (puzzleId: string, submission: string) => void;
  onScanRadar: () => void;
  feedback?: PuzzleModalFeedback | null;
};

type SelectorOption = {
  mode: "LOW" | "NORMAL" | "OVERLOAD";
  title: string;
  subtitle: string;
  spec: string;
};

const PZ01_SELECTOR_OPTIONS: readonly SelectorOption[] = [
  {
    mode: "LOW",
    title: "Chế độ tải thấp",
    subtitle: "Triệt nhiễu cao tần",
    spec: "Hạ áp nhánh phụ · Ổn định nguồn cho thiết bị radar quan sát (SC-05)."
  },
  {
    mode: "NORMAL",
    title: "Chế độ tải tiêu chuẩn",
    subtitle: "Vận hành thông thường",
    spec: "Cấp nguồn mặc định toàn trạm · Không lọc nhiễu cao tần cho radar."
  },
  {
    mode: "OVERLOAD",
    title: "Chế độ quá tải",
    subtitle: "Mở rộng vùng quét, tăng nguy cơ mất đồng bộ",
    spec: "Khuếch đại công suất thấu kính vượt ngưỡng · Tải áp lực lớn lên rơ-le cổng."
  }
];

function WheelLock({
  puzzleId,
  digits,
  disabled,
  submitLabel,
  wheelLabels,
  onChangeDigit,
  onSubmit
}: {
  puzzleId: string;
  digits: readonly [number, number, number, number];
  disabled: boolean;
  submitLabel: string;
  wheelLabels: readonly [string, string, string, string];
  onChangeDigit: (index: number, delta: number) => void;
  onSubmit: (code: string) => void;
}) {
  const code = digits.join("");
  return (
    <div className={`wheel-lock-shell ${disabled ? "locked" : ""}`} data-testid={`${puzzleId}-wheel-lock`}>
      <div className="wheel-row" role="group" aria-label={`Bộ bánh răng 4 số của ${puzzleId}`}>
        {digits.map((digit, idx) => (
          <div className="wheel-col" key={`${puzzleId}-w-${idx}`}>
            <span className="wheel-slot-label">{wheelLabels[idx]}</span>
            <button
              type="button"
              className="wheel-step-btn"
              disabled={disabled}
              aria-label={`Tăng chữ số ${idx + 1} của ${puzzleId}`}
              onClick={() => onChangeDigit(idx, 1)}
            >
              ▲
            </button>
            <div className="wheel-readout" aria-live="polite" data-testid={`${puzzleId}-digit-${idx}`}>
              {digit}
            </div>
            <button
              type="button"
              className="wheel-step-btn"
              disabled={disabled}
              aria-label={`Giảm chữ số ${idx + 1} của ${puzzleId}`}
              onClick={() => onChangeDigit(idx, -1)}
            >
              ▼
            </button>
          </div>
        ))}
      </div>
      <div className="wheel-submit-bar">
        <span className="wheel-code-preview">MÃ CHỌN: <b>{code}</b></span>
        <button
          type="button"
          className="btn-primary wheel-submit-btn"
          disabled={disabled}
          onClick={() => onSubmit(code)}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

export function PuzzleModalContent({
  scenePuzzles,
  state,
  cluesById,
  itemsMeta,
  onSubmitPuzzle,
  onScanRadar,
  feedback
}: PuzzleModalContentProps) {
  const [pz02Digits, setPz02Digits] = useState<[number, number, number, number]>([0, 0, 0, 0]);
  const [pz03Digits, setPz03Digits] = useState<[number, number, number, number]>([0, 0, 0, 0]);

  if (scenePuzzles.length === 0) {
    return <div className="empty-box">Khu vực hiện tại không có ổ khóa giải mã nào.</div>;
  }

  const updateWheel = (
    setter: React.Dispatch<React.SetStateAction<[number, number, number, number]>>,
    index: number,
    delta: number
  ) => {
    setter(prev => {
      const next: [number, number, number, number] = [...prev];
      next[index] = (next[index] + delta + 10) % 10;
      return next;
    });
  };

  const currentPowerMode = String(state.flags.power_mode ?? "normal").toUpperCase();
  const radioState = String(state.flags.radio_state ?? "broadcasting").toUpperCase();
  const hasLowPower = state.flags.power_mode === "low";
  const hasC02 = state.discoveredClueIds.includes("C-02");
  const radarScannedInLow = hasLowPower && state.triggeredOnceIds.includes("radar_low_scanned");
  const pz02Unlocked = hasLowPower && radarScannedInLow && hasC02;

  const hasI06 = state.inventoryItemIds.includes("I-06");
  const hasC05 = state.discoveredClueIds.includes("C-05");
  const pz03Unlocked = hasI06 && hasC05;

  const renderEvidenceList = (clueIds: readonly string[], missingNoteById: Record<string, string>) => {
    return (
      <div className="pz-evidence-box">
        <div className="pz-subhead">BẰNG CHỨNG HIỆN TRƯỜNG ĐÃ THU THẬP</div>
        <div className="pz-evidence-list">
          {clueIds.map(id => {
            const discovered = state.discoveredClueIds.includes(id);
            const clue = cluesById.get(id);
            if (!discovered || !clue) {
              return (
                <div className="pz-evidence-item missing" key={id}>
                  <strong>{id} · CHƯA THU THẬP</strong>
                  <span>{missingNoteById[id] ?? "Hãy tìm tài liệu liên quan tại các phòng."}</span>
                </div>
              );
            }
            return (
              <div className="pz-evidence-item discovered" key={id}>
                <strong>{clue.id} · {clue.title}</strong>
                <span>{clue.summary}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="pz-modal-stack">
      {state.identityOverwriteCount > 0 && (
        <div
          className={`overwrite-status-banner ${state.identityOverwriteCount >= 2 ? "critical" : "warn"}`}
          role="status"
        >
          <strong>
            {state.identityOverwriteCount >= 2
              ? "MỨC GHI ĐÈ: 2/2 — DANH TÍNH ĐÃ BỊ GHI ĐÈ"
              : "MỨC GHI ĐÈ: 1/2 — CẢNH BÁO NGUY HIỂM"}
          </strong>
          {state.lastOverwriteReason && <span>{state.lastOverwriteReason}</span>}
        </div>
      )}
      {feedback && (
        <div className={`pz-feedback-banner tone-${feedback.tone}`} role="status">
          <strong>{feedback.title}</strong>
          <span>{feedback.detail}</span>
        </div>
      )}
      {scenePuzzles.map(pz => {
        const isSolved = state.solvedPuzzleIds.includes(pz.id);

        if (pz.id === "PZ-01") {
          return (
            <section className="puzzle-card pz-industrial-panel" key={pz.id} data-testid="puzzle-card-PZ-01">
              <div className="rule-card-top">
                <div>
                  <span className="pz-kicker">BẢNG CÔNG TẮC TẢI ĐIỆN · SC-04</span>
                  <strong>{pz.id} · {pz.title}</strong>
                </div>
                <span className={`badge ${isSolved ? "badge-ok" : "badge-warn"}`}>
                  {isSolved ? "ĐÃ GIẢI · NGUỒN LOW" : `ĐANG CHỌN: ${currentPowerMode}`}
                </span>
              </div>

              <p className="pz-objective">
                <strong>Mục tiêu:</strong> Chọn chế độ tải điện phù hợp trên tủ nguồn Phòng máy để triệt nhiễu cho thiết bị quan sát.
              </p>

              <div className="pz-selector-grid" role="group" aria-label="Công tắc chọn chế độ tải điện PZ-01">
                {PZ01_SELECTOR_OPTIONS.map(opt => {
                  const isActive = currentPowerMode === opt.mode;
                  const isOverload = opt.mode === "OVERLOAD";
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      className={`pz-selector-card ${isOverload ? "mode-overload" : ""} ${isActive ? "is-active" : ""}`}
                      disabled={isSolved}
                      aria-pressed={isActive}
                      onClick={() => onSubmitPuzzle("PZ-01", opt.mode)}
                    >
                      <div className="pz-selector-head">
                        <span className="pz-mode-code">{opt.mode}</span>
                        <span className="pz-mode-state">{isActive ? "ĐANG GẠT" : "CHỌN VỊ TRÍ"}</span>
                      </div>
                      <strong className="pz-mode-title">{opt.title}</strong>
                      <span className="pz-mode-subtitle">{opt.subtitle}</span>
                      <span className="pz-mode-spec">{opt.spec}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        }

        if (pz.id === "PZ-02") {
          return (
            <section className="puzzle-card pz-industrial-panel" key={pz.id} data-testid="puzzle-card-PZ-02">
              <div className="rule-card-top">
                <div>
                  <span className="pz-kicker">RADAR & NGĂN BÍ MẬT · SC-05</span>
                  <strong>{pz.id} · {pz.title}</strong>
                </div>
                <span className={`badge ${isSolved ? "badge-ok" : "badge-warn"}`}>
                  {isSolved ? "ĐÃ GIẢI" : "CHƯA GIẢI"}
                </span>
              </div>

              <p className="pz-objective">
                <strong>Mục tiêu:</strong> Đo góc phương vị (2 chữ số) và biên độ lệch pha (2 chữ số) trên radar, ghép thành mã 4 chữ số mở ngăn kéo dưới bàn.
              </p>

              <div className="pz-briefing-box">
                <div>• <strong>Vai trò chế độ LOW:</strong> Chỉ nguồn tải LOW mới triệt tiêu nhiễu cao tần trên màn quét radar.</div>
                <div>• <strong>Radar độc lập với Camera:</strong> Màn quét radar đo góc mù quang học của thấu kính, hoạt động tách biệt với màn hình CCTV hành lang.</div>
                <div>• <strong>Vùng mù & đối chiếu:</strong> Kết hợp Sổ trực Trần Minh (C-02) cùng kết quả quét radar ở LOW để mở ổ khóa cơ học 4 vòng số.</div>
              </div>

              {renderEvidenceList(["C-02", "C-04", "C-06"], {
                "C-02": "Đọc Sổ trực Trần Minh tại Phòng trực (SC-02) để biết cách ghép hai chỉ số radar.",
                "C-04": "Đọc Sơ đồ tải điện tại Phòng máy (SC-04) để nắm đặc tính chế độ LOW.",
                "C-06": "Kiểm tra màn hình CCTV hành lang tại SC-05 để đối chiếu hành vi của sương mù."
              })}

              <div className="pz-radar-console">
                <div className="pz-radar-head">
                  <span>TRẠM QUÉT RADAR TRỰC TIẾP · R-07</span>
                  <span className={`badge ${hasLowPower ? "badge-ok" : "badge-warn"}`}>
                    NGUỒN: {currentPowerMode}
                  </span>
                </div>
                <div className="pz-radar-screen">
                  {!hasLowPower ? (
                    <span className="pz-radar-noise">
                      NHIỄU CAO TẦN · Không thể đọc thông số góc phương vị và biên độ khi nguồn khác LOW.
                    </span>
                  ) : radarScannedInLow ? (
                    <span className="pz-radar-reading">
                      TÍN HIỆU ỔN ĐỊNH (LOW) · Điểm mù thấu kính ghi nhận: Góc phương vị <b>27° Bắc</b> — Biên độ lệch pha <b>14′</b>.
                    </span>
                  ) : (
                    <span className="pz-radar-standby">
                      Nguồn tải LOW đã sẵn sàng. Bấm nút quét để đọc số đo trực tiếp từ radar.
                    </span>
                  )}
                </div>
                {!isSolved && (
                  <button
                    type="button"
                    className="btn-ghost-sm pz-scan-btn"
                    onClick={onScanRadar}
                  >
                    {radarScannedInLow ? "Quét lại Radar quan sát" : "Kích hoạt quét Radar quan sát"}
                  </button>
                )}
              </div>

              {!isSolved && (
                <>
                  {!pz02Unlocked && (
                    <div className="pz-prereq-banner" role="status">
                      Chốt số 4 vòng đang khóa: Cần kích hoạt quét radar ở chế độ <b>LOW</b> và thu thập <b>Sổ trực Trần Minh (C-02)</b> trước khi xoay mã.
                    </div>
                  )}
                  <WheelLock
                    puzzleId="PZ-02"
                    digits={pz02Digits}
                    disabled={!pz02Unlocked}
                    submitLabel="Mở ngăn bí mật"
                    wheelLabels={["P1", "P2", "L1", "L2"]}
                    onChangeDigit={(idx, delta) => updateWheel(setPz02Digits, idx, delta)}
                    onSubmit={code => onSubmitPuzzle("PZ-02", code)}
                  />
                </>
              )}
            </section>
          );
        }

        if (pz.id === "PZ-03") {
          return (
            <section className="puzzle-card pz-industrial-panel" key={pz.id} data-testid="puzzle-card-PZ-03">
              <div className="rule-card-top">
                <div>
                  <span className="pz-kicker">KHÓA CƠ KHÍ BUỒNG ĐÈN · SC-05 → SC-06</span>
                  <strong>{pz.id} · {pz.title}</strong>
                </div>
                <span className={`badge ${isSolved ? "badge-ok" : "badge-warn"}`}>
                  {isSolved ? "ĐÃ NHẢ CHỐT" : "CHƯA GIẢI"}
                </span>
              </div>

              <p className="pz-objective">
                <strong>Mục tiêu:</strong> Giải mã và nhả chốt khóa cơ học.
              </p>

              <div className="pz-evidence-box">
                <div className="pz-subhead">TƯ LIỆU HIỆU CHUẨN & LIÊN ĐỘNG ĐÃ THU THẬP</div>
                <div className="pz-evidence-list">
                  {hasI06 ? (
                    <div className="pz-evidence-item discovered">
                      <strong>I-06 · {itemsMeta["I-06"]?.name ?? "Sổ mã tần số"} (Công thức thực hành)</strong>
                      <span>{itemsMeta["I-06"]?.note}</span>
                    </div>
                  ) : (
                    <div className="pz-evidence-item missing">
                      <strong>I-06 · CHƯA THU THẬP</strong>
                      <span>Hãy lấy Sổ mã tần số tại Phòng trực (SC-02) để biết công thức tính tần số Trạm 09.</span>
                    </div>
                  )}

                  {hasC05 ? (
                    <div className="pz-evidence-item discovered">
                      <strong>C-05 · {cluesById.get("C-05")?.title ?? "Băng cassette"} (Cảnh báo liên động R-08)</strong>
                      <span>
                        Mặt A cảnh báo: Khóa liên động cửa buồng đèn chỉ cho phép mở cửa sang SC-06 khi bộ đàm đang ở trạng thái TẠM DỪNG (PAUSED).
                      </span>
                    </div>
                  ) : (
                    <div className="pz-evidence-item missing">
                      <strong>C-05 · CHƯA THU THẬP</strong>
                      <span>Lấy Băng cassette (I-03) tại Khu nghỉ (SC-03) và phát tại Phòng trực (SC-02) để nắm cảnh báo khóa liên động.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pz-interlock-status">
                <div>
                  <span>1. Chốt khóa cơ học (PZ-03):</span>
                  <strong className={isSolved ? "status-ok-text" : "status-warn-text"}>
                    {isSolved ? "ĐÃ NHẢ CHỐT CƠ KHÍ" : "ĐANG KHÓA CHỐT"}
                  </strong>
                </div>
                <div>
                  <span>2. Điều kiện mở cửa vào SC-06 (R-08):</span>
                  <strong className={radioState === "PAUSED" ? "status-ok-text" : "status-warn-text"}>
                    {radioState === "PAUSED"
                      ? "BỘ ĐÀM PAUSED — LIÊN ĐỘNG CHO PHÉP MỞ CỬA"
                      : `BỘ ĐÀM ${radioState} — CẦN TẠM DỪNG BỘ ĐÀM ĐỂ MỞ CỬA`}
                  </strong>
                </div>
              </div>

              {!isSolved && (
                <>
                  {!pz03Unlocked && (
                    <div className="pz-prereq-banner" role="status">
                      Chốt tần số 4 vòng đang khóa: Cần có đủ <b>Sổ mã tần số (I-06)</b> và <b>Băng cassette (C-05)</b> để giải mã.
                    </div>
                  )}
                  <WheelLock
                    puzzleId="PZ-03"
                    digits={pz03Digits}
                    disabled={!pz03Unlocked}
                    submitLabel="Nhả chốt khóa cơ học"
                    wheelLabels={["Hz·1", "Hz·2", "Hz·3", "Hz·4"]}
                    onChangeDigit={(idx, delta) => updateWheel(setPz03Digits, idx, delta)}
                    onSubmit={code => onSubmitPuzzle("PZ-03", code)}
                  />
                </>
              )}
            </section>
          );
        }

        return (
          <div className="puzzle-card" key={pz.id}>
            <div className="rule-card-top">
              <strong>{pz.id} · {pz.title}</strong>
              <span className={`badge ${isSolved ? "badge-ok" : "badge-warn"}`}>
                {isSolved ? "ĐÃ GIẢI" : "CHƯA GIẢI"}
              </span>
            </div>
            <p>{pz.description}</p>
          </div>
        );
      })}
    </div>
  );
}
