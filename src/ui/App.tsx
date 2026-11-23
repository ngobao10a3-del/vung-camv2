import { useEffect, useMemo, useState } from "react";
import { ACTION_TAGS } from "../types/common";
import type { SaveData } from "../types/save";
import {
  CHAPTER1_ITEMS as ITEMS,
  CHAPTER1_SCENE_RULE_UNLOCKS as SCENE_RULE_UNLOCKS,
  CHAPTER1_SCENES as SCENES,
  canReachEndingB,
  canReachEndingS,
  canRecoverIdentityAtLanternRoom,
  createChapter1Engine,
  getChapter1DeathReason,
  type Chapter1Engine
} from "../data/chapter1Runtime";
import { CHAPTER1_CLUES } from "../data/chapter1Investigation";
import { InvestigationNotebook } from "./InvestigationNotebook";
import { SceneIllustration } from "./SceneIllustration";
import { DialoguePanel } from "./DialoguePanel";
import { PuzzleModalContent, type PuzzleModalFeedback } from "./PuzzleModalContent";

type ActiveModal = "rules" | "notebook" | "puzzles" | "map" | "logs" | "hint" | null;

const SAVE_STORAGE_KEY = "vung_cam_ch01_quicksave_v2";

const INV_STATUS_BADGE: Record<string, { text: string; tone: string }> = {
  unverified: { text: "Chưa đối chiếu", tone: "neutral" },
  supported: { text: "Có bằng chứng", tone: "warn" },
  contradicted: { text: "Bị phản bác", tone: "warn" },
  conditional_confirmed: { text: "Xác nhận điều kiện", tone: "ok" },
  verified: { text: "Luật thật", tone: "ok" },
  debunked_fake: { text: "Quy tắc giả", tone: "fake" },
  conflicted: { text: "Mâu thuẫn", tone: "fake" }
};

function loadSavedFromStorage(): SaveData | null {
  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

function getSpeakerMeta(speakerLabel: string, isViolation: boolean): { toneClass: string; prefix: string } {
  if (isViolation || speakerLabel.includes("CẢNH BÁO") || speakerLabel.includes("BẪY") || speakerLabel.includes("LỐI ĐI") || speakerLabel.includes("THIẾU")) {
    return { toneClass: "tone-warning", prefix: "CẢNH BÁO" };
  }
  if (speakerLabel.includes("C-05") || speakerLabel.includes("BĂNG")) {
    return { toneClass: "tone-audio", prefix: "BĂNG GHI ÂM" };
  }
  if (speakerLabel.includes("BỘ ĐÀM") || speakerLabel.includes("RADAR") || speakerLabel.includes("GIẢI MÃ") || speakerLabel.includes("HỆ THỐNG") || speakerLabel.includes("ĐÈN PIN") || speakerLabel.includes("THẤU KÍNH")) {
    return { toneClass: "tone-radio", prefix: "VÔ TUYẾN · THIẾT BỊ" };
  }
  return { toneClass: "tone-narration", prefix: "GHI CHÉP CA TRỰC" };
}

function getRuleStampLabel(invStatus: string, lifecycle: string, fallbackText: string): { label: string; stampTone: string } {
  if (lifecycle === "transformed") {
    return { label: "ĐÃ BIẾN ĐỔI", stampTone: "stamp-fake" };
  }
  if (invStatus === "verified") {
    return { label: "LUẬT THẬT", stampTone: "stamp-ok" };
  }
  if (invStatus === "debunked_fake") {
    return { label: "QUY TẮC GIẢ", stampTone: "stamp-fake" };
  }
  if (invStatus === "unverified") {
    return { label: "CHƯA XÁC MINH", stampTone: "stamp-neutral" };
  }
  const toneMap: Record<string, string> = {
    ok: "stamp-ok",
    fake: "stamp-fake",
    warn: "stamp-warn",
    neutral: "stamp-neutral"
  };
  const badgeTone = INV_STATUS_BADGE[invStatus]?.tone ?? "neutral";
  return { label: fallbackText, stampTone: toneMap[badgeTone] ?? "stamp-neutral" };
}

function DockIcon({ kind }: { kind: "rules" | "notebook" | "puzzles" | "map" | "logs" | "hint" }) {
  switch (kind) {
    case "rules":
      return (
        <svg className="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M15 3v4h4" />
          <path d="M9 12h6M9 16h6" />
        </svg>
      );
    case "notebook":
      return (
        <svg className="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5h14a2 2 0 0 1 2 2v12H4z" />
          <path d="M8 5v14M11 10h6M11 14h4" />
        </svg>
      );
    case "puzzles":
      return (
        <svg className="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="1" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          <circle cx="12" cy="16" r="1" />
        </svg>
      );
    case "map":
      return (
        <svg className="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
          <line x1="9" y1="3" x2="9" y2="18" />
          <line x1="15" y1="6" x2="15" y2="21" />
        </svg>
      );
    case "logs":
      return (
        <svg className="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M8 9h8M8 13h8M8 17h5" />
        </svg>
      );
    case "hint":
      return (
        <svg className="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 0 1 5 .5c0 1.8-2.5 2-2.5 3.5" />
          <circle cx="12" cy="17" r="0.8" />
        </svg>
      );
  }
}

export default function App({
  initialEngine,
  initialActiveModal = null
}: {
  initialEngine?: Chapter1Engine;
  initialActiveModal?: ActiveModal;
}) {
  const engine = useMemo(() => initialEngine ?? createChapter1Engine(), [initialEngine]);
  const rules = engine.rules;
  const cluesById = useMemo(() => new Map(CHAPTER1_CLUES.map(clue => [clue.id, clue])), []);

  const [, refresh] = useState(0);
  const [activeModal, setActiveModal] = useState<ActiveModal>(initialActiveModal);
  const [preselectedRuleId, setPreselectedRuleId] = useState<string | undefined>(undefined);
  const [speaker, setSpeaker] = useState("NHẬP CA TRỰC · 23:40");
  const [dialogue, setDialogue] = useState(
    "Bạn nhận lệnh trực thay ca đêm tại Trạm Hải Đăng Mũi Sương. Cánh cổng sắt đóng chặt; sương trắng đang ép sát hàng rào. Một chiếc đèn pin nằm trên bệ gác."
  );
  const [isViolationMsg, setIsViolationMsg] = useState(false);
  const [puzzleFeedback, setPuzzleFeedback] = useState<PuzzleModalFeedback | null>(null);
  const [flash, setFlash] = useState(false);
  const [savedSlot, setSavedSlot] = useState<SaveData | null>(() => loadSavedFromStorage());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const state = engine.store.snapshot();
  const sceneIdx = SCENES.findIndex(s => s.id === state.currentSceneId);
  const scene = SCENES[sceneIdx >= 0 ? sceneIdx : 0];
  const nextScene = SCENES[sceneIdx + 1];
  const discoveredClues = state.discoveredClueIds;
  const discoveredRules = rules.getDiscoveredRules();
  const solved = (id: string) => state.solvedPuzzleIds.includes(id);
  const has = (id: string) => state.inventoryItemIds.includes(id);
  const refreshUI = () => refresh(v => v + 1);

  useEffect(() => {
    const unsubscribe = engine.dispatcher.subscribe(event => {
      if (event.type === "RULE_VIOLATED") {
        setSpeaker(`CẢNH BÁO · ${event.ruleId}`);
        setIsViolationMsg(true);
        setDialogue(`Bạn vừa vi phạm ${event.ruleId}! Hậu quả đã được ghi nhận trong nhật ký.`);
      }
      if (event.type === "FX_REQUESTED" && event.fx === "red_flash") {
        setFlash(true);
        window.setTimeout(() => setFlash(false), event.durationMs);
      }
      refreshUI();
    });
    return () => {
      unsubscribe();
    };
  }, [engine]);

  useEffect(() => {
    const current = engine.store.snapshot();
    if (
      !current.completedDialogueIds.includes("DLG-SC01-ARRIVAL") &&
      !current.activeEndingId &&
      !engine.dialogue.getActiveDialogueId()
    ) {
      engine.dialogue.startDialogue("DLG-SC01-ARRIVAL");
      refreshUI();
    }
  }, [engine]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeModal !== null) {
        setActiveModal(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeModal]);

  const say = (who: string, text: string, violation = false, writeLog = true) => {
    if (writeLog) {
      const currentLogs = engine.store.snapshot().logs;
      if (currentLogs[currentLogs.length - 1] !== text) {
        engine.store.addLog(text);
      }
    }
    setSpeaker(who);
    setIsViolationMsg(violation);
    setDialogue(text);
    refreshUI();
  };

  const setFlag = (key: string, value: string | boolean) => {
    if (engine.store.snapshot().activeEndingId !== null) return;
    engine.store.setFlag(key, value);
    engine.dispatcher.dispatch({
      type: "STATE_CHANGED",
      domain: "flags",
      targetId: key,
      sceneId: engine.store.snapshot().currentSceneId
    });
    refreshUI();
  };

  const perform = (actionTag: keyof typeof ACTION_TAGS, targetId: string) => {
    const current = engine.store.snapshot();
    if (current.activeEndingId !== null) return;
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS[actionTag],
      targetId,
      sceneId: current.currentSceneId
    });
    refreshUI();
  };

  const discoverClue = (id: string, text: string) => {
    if (engine.store.snapshot().activeEndingId !== null) return;
    if (discoveredClues.includes(id)) {
      say(`HỒ SƠ ${id}`, text, false, false);
      setActiveModal("notebook");
      return;
    }
    engine.store.discoverClue(id);
    say(`MANH MỐI MỚI · ${id}`, text);
  };

  const addItem = (id: string) => {
    if (engine.store.snapshot().activeEndingId !== null) return;
    if (has(id)) {
      say("VẬT PHẨM", "Bạn đã có vật phẩm này trong túi đồ.", false, false);
      return;
    }
    engine.store.addItem(id);
    setSelectedItemId(id);
    say("THU THẬP VẬT PHẨM", `Đã cất [${ITEMS[id]?.name ?? id}] vào túi đồ. Bấm vào ô vật phẩm bên dưới để kiểm tra chi tiết.`);
  };

  const getSceneLockReason = (id: string): string | null => {
    if (id === "SC-03" && !discoveredClues.includes("C-01") && !has("I-02")) {
      return "Hãy kiểm tra tài liệu hoặc lấy chìa khóa tại Phòng trực (SC-02) trước khi sang Khu nghỉ.";
    }
    if (id === "SC-04" && !has("I-04")) {
      return "Cửa Phòng máy cần Cầu chì công nghiệp 30A (I-04) tìm thấy tại Khu nghỉ (SC-03).";
    }
    if (id === "SC-05" && !solved("PZ-01")) {
      return "Phòng quan sát chưa ổn định nguồn. Hãy giải Cân bằng tải điện (PZ-01) tại Phòng máy trước.";
    }
    if (id === "SC-06" && !solved("PZ-03")) {
      return "Cửa buồng đèn đang khóa. Hãy giải Khóa tần số (PZ-03) tại Phòng quan sát trước.";
    }
    return null;
  };

  const go = (id: string) => {
    if (engine.store.snapshot().activeEndingId !== null) return;
    if (id === state.currentSceneId) return;
    const lockReason = getSceneLockReason(id);
    if (lockReason) {
      say("LỐI ĐI BỊ KHÓA", lockReason, true, false);
      return;
    }

    if (id === "SC-06") {
      const beforeR08 = rules.getViolationCount("R-08");
      perform("OPEN_LANTERN_DOOR", "lantern_door");
      const postR08 = engine.store.snapshot();
      if (
        postR08.activeEndingId !== null ||
        rules.getViolationCount("R-08") > beforeR08 ||
        postR08.flags.radio_state !== "paused"
      ) {
        say(
          "KHÓA LIÊN ĐỘNG · R-08",
          "Cửa buồng đèn vẫn đóng chặt. Khóa liên động chỉ nhả khi bộ đàm đang ở trạng thái TẠM DỪNG (PAUSED).",
          true,
          false
        );
        return;
      }
    }

    const beforeR10 = rules.getViolationCount("R-10");
    perform("LEAVE_SCENE", `leave_${state.currentSceneId}`);
    const postLeaveState = engine.store.snapshot();
    if (postLeaveState.activeEndingId !== null || rules.getViolationCount("R-10") > beforeR10) {
      return;
    }

    engine.store.changeScene(id);
    engine.dispatcher.dispatch({ type: "SCENE_ENTERED", sceneId: id });

    const unlockRules = SCENE_RULE_UNLOCKS[id] ?? [];
    for (const rId of unlockRules) {
      if (!engine.store.snapshot().discoveredRuleIds.includes(rId)) {
        engine.store.discoverRule(rId);
      }
    }

    const target = SCENES.find(s => s.id === id);
    setPuzzleFeedback(null);
    setActiveModal(null);
    say(`${target?.id} · ${target?.name.toUpperCase()}`, target?.description ?? "");
  };

  const submitPuzzle = (puzzleId: string, submission: string) => {
    if (engine.store.snapshot().activeEndingId !== null) return;
    const result = engine.puzzles.submitSolution(puzzleId, submission);

    if (engine.store.snapshot().activeEndingId !== null) {
      refreshUI();
      return;
    }

    if (result.status === "solved") {
      setPuzzleFeedback(null);
      setActiveModal(null);
      say("GIẢI MÃ THÀNH CÔNG", `Cơ cấu ${puzzleId} đã mở khóa!`);
    } else if (result.status === "already_solved") {
      setPuzzleFeedback(null);
      setActiveModal(null);
      say("CƠ CẤU ĐÃ HOÀN TẤT", `${puzzleId} đã được giải trước đó. Không cần thực hiện lại.`);
    } else if (result.status === "failed") {
      if (puzzleId === "PZ-01" && submission.trim().toUpperCase() === "OVERLOAD") {
        const msg =
          "Cầu dao quá tải làm nổ rơ-le khóa cổng ngoài và đẩy sương tràn vào trạm. Dấu vết danh tính của bạn đã bị ghi nhận trên hệ thống.";
        setPuzzleFeedback({ title: "BẢNG ĐIỀU KHIỂN TẢI · OVERLOAD", detail: msg, tone: "warn" });
        say("BẢNG ĐIỀU KHIỂN TẢI · OVERLOAD", msg, true, false);
      } else if (puzzleId === "PZ-01" && submission.trim().toUpperCase() === "NORMAL") {
        const msg = "Mạch điện vận hành ở tải tiêu chuẩn, nhưng nhiễu cao tần vẫn cản trở radar tại Phòng quan sát.";
        setPuzzleFeedback({ title: "BẢNG ĐIỀU KHIỂN TẢI · NORMAL", detail: msg, tone: "info" });
        say("BẢNG ĐIỀU KHIỂN TẢI · NORMAL", msg, false, false);
      } else {
        const msg = `Sai mật mã ${puzzleId} (lần thử ${result.attemptsUsed}). Hãy đối chiếu kỹ thông số quan sát và vật phẩm trong túi đồ.`;
        setPuzzleFeedback({ title: "MÃ KHÔNG KHỚP", detail: msg, tone: "warn" });
        say("MÃ KHÔNG KHỚP", msg, true, false);
      }
    } else if (result.status === "locked") {
      const msg = `Bạn đã sử dụng hết lượt thử của ${puzzleId}. Cơ cấu không nhận thêm mật mã.`;
      setPuzzleFeedback({ title: "CƠ CẤU BỊ KHÓA", detail: msg, tone: "warn" });
      say("CƠ CẤU BỊ KHÓA", msg);
    } else if (result.status === "missing_items") {
      const msg = `Bạn chưa đáp ứng đủ dữ kiện hoặc điều kiện kỹ thuật để giải ${puzzleId}.`;
      setPuzzleFeedback({ title: "CHƯA ĐỦ ĐIỀU KIỆN", detail: msg, tone: "warn" });
      say("CHƯA ĐỦ ĐIỀU KIỆN", msg, true, false);
    } else if (result.status === "not_found") {
      say("KHÔNG TÌM THẤY CƠ CẤU", `Không xác định được dữ liệu giải đố ${puzzleId}.`);
    } else {
      say("THÔNG BÁO", `Không thể thực hiện ${puzzleId}.`, true, false);
    }

    refreshUI();
  };

  const end = (endingId: string) => {
    if (engine.store.snapshot().activeEndingId !== null) return;
    const events = engine.executor.execute({ effects: [{ type: "TRIGGER_ENDING", endingId }] });
    events.forEach(event => engine.dispatcher.dispatch(event));
    refreshUI();
  };

  const inspectRadarGear = () => {
    if (engine.store.snapshot().activeEndingId !== null) return;
    const currentPowerMode = String(engine.store.snapshot().flags.power_mode);

    perform("USE_OBSERVATION_GEAR", "observation_gear");
    if (currentPowerMode !== "low") {
      const msg =
        "Nguồn điện chưa chuyển sang LOW. Nhiễu sóng mang vẫn che khuất dữ liệu tọa độ. Hãy giải PZ-01 trước.";
      setPuzzleFeedback({ title: "RADAR CHƯA ỔN ĐỊNH · R-07", detail: msg, tone: "warn" });
      say("RADAR CHƯA ỔN ĐỊNH", msg, true, false);
      return;
    }

    const msg =
      "Nguồn tải LOW đã triệt nhiễu sóng mang. Trên màn quét xuất hiện vùng mù của thấu kính tại: Góc phương vị 27° Bắc — Biên độ lệch pha 14′ (đối chiếu Sổ trực Trần Minh C-02 để lập mã tọa độ).";
    setPuzzleFeedback({ title: "DỮ LIỆU QUAN SÁT RADAR", detail: msg, tone: "ok" });
    say("DỮ LIỆU QUAN SÁT RADAR", msg, false, false);
  };

  const getHintText = (): string => {
    if (!has("I-01")) return "Nhặt Đèn pin trên bệ gác Cổng trạm, tuyệt đối không mở cửa ngoài, rồi tiến vào Phòng trực (SC-02).";
    if (state.currentSceneId === "SC-01") return "Bấm 'Tiến tới Phòng trực' để bắt đầu kiểm tra hồ sơ ca trực.";
    if (!discoveredClues.includes("C-01") || !discoveredClues.includes("C-03")) {
      return "Đọc Bản tin nhiệt và Hồ sơ nhân sự trên bàn trực để nắm tình trạng trạm trưởng Lê Văn Hùng.";
    }
    if (state.flags.radio_state === "broadcasting") {
      return "Tạm dừng bộ đàm (PAUSED) để tránh lộ danh tính và đáp ứng khóa liên động buồng đèn.";
    }
    if (!has("I-04")) return "Lấy Chìa khóa tủ (I-02) và Sổ mã tần số (I-06) ở Phòng trực, sau đó sang Khu nghỉ (SC-03) lấy Cầu chì 30A (I-04) và Băng cassette (I-03).";
    if (!solved("PZ-01")) return "Sang Phòng máy (SC-04), đọc Sơ đồ tải điện (C-04) để tìm chế độ tải triệt nhiễu rồi chọn trên bảng PZ-01.";
    if (!has("I-05") || !solved("PZ-03")) {
      return "Tại Phòng quan sát (SC-05), bật Thiết bị quan sát ở chế độ LOW để đo góc phương vị & biên độ lệch pha (PZ-02), đồng thời đối chiếu C-05 và Sổ mã tần số (I-06) để mở khóa tần số Trạm 09 (PZ-03).";
    }
    if (!state.flags.red_filter_installed) {
      return "Lên Buồng đèn (SC-06) và lắp Bộ lọc đỏ vào thấu kính trước khi bước vào vùng sáng trung tâm.";
    }
    if (canRecoverIdentityAtLanternRoom(state)) {
      return "Danh tính của bạn từng bị ghi nhận một lần (1/2). Hãy đọc Bảng hiệu chỉnh bộ lọc (C-07) và dùng thao tác đảo pha tần số tại Buồng đèn (SC-06) để xóa dữ liệu tồn dư.";
    }
    return "Mở Sổ tay đối chiếu các manh mối (đặc biệt là C-01, C-02, C-04, C-07, C-08) để vạch trần các quy tắc giả trước khi quyết định kết thúc ca trực.";
  };

  const handleEnterLanternBeam = () => {
    const installed = Boolean(engine.store.snapshot().flags.red_filter_installed);
    perform("ENTER_LANTERN_BEAM", "central_beam");
    if (installed && engine.store.snapshot().activeEndingId === null) {
      say(
        "VÙNG SÁNG ĐỎ · 620nm",
        "Bộ lọc đỏ đang lọc chùm sáng trên 620nm. Bạn bước qua vùng sáng an toàn và tiếp cận bảng điều khiển tần số phát."
      );
    }
  };

  const handleLocker04Interaction = () => {
    if (!engine.store.snapshot().flags.locker_knocking) {
      setFlag("locker_knocking", true);
      say(
        "TỦ ĐỒ SỐ 04",
        "Từ bên trong cánh tủ thép lạnh buốt vang lên ba tiếng gõ chậm rãi: cốc... cốc... cốc."
      );
      return;
    }
    perform("OPEN_LOCKER_04", "locker_04");
  };

  const stageHotspots: Array<{
    id: string; label: string; x: string; y: string; onClick: () => void;
    done?: boolean; disabled?: boolean;
  }> = (() => {
    switch (scene.id) {
      case "SC-01":
        return [
          { id: "hs1", label: "Khe cổng sắt", x: "28%", y: "58%", onClick: () => say("QUAN SÁT", "Sương trắng đang áp sát hàng rào. Không có bóng người ở vọng gác.") },
          { id: "hs2", label: has("I-01") ? "✓ Đèn pin" : "Đèn pin trên bệ gác", x: "66%", y: "66%", done: has("I-01"), onClick: () => addItem("I-01") },
          {
            id: "hs3",
            label: "Cửa ngoài",
            x: "48%",
            y: "46%",
            disabled: Boolean(state.flags.fog_breached),
            onClick: () => perform("OPEN_EXTERIOR_DOOR", "hs_exterior_door")
          }
        ];
      case "SC-02":
        return [
          { id: "hs1", label: discoveredClues.includes("C-01") ? "✓ Bản tin nhiệt" : "Máy in bản tin", x: "23%", y: "48%", done: discoveredClues.includes("C-01"), onClick: () => discoverClue("C-01", "Bản tin mô tả chính xác trang phục của bạn trước thời điểm hiện tại.") },
          { id: "hs2", label: discoveredClues.includes("C-03") ? "✓ Hồ sơ nhân sự" : "Hồ sơ trên bàn", x: "50%", y: "62%", done: discoveredClues.includes("C-03"), onClick: () => { discoverClue("C-03", "Hồ sơ xác nhận trạm trưởng Lê Văn Hùng đã mất tích."); setFlag("captain_missing_confirmed", true); } },
          { id: "hs3", label: `Bộ đàm (${String(state.flags.radio_state).toUpperCase()})`, x: "76%", y: "48%", done: state.flags.radio_state === "paused", onClick: () => {
            if (state.flags.radio_state === "paused") {
              if (engine.dialogue.isDialogueCompleted("DLG-SC02-RADIO")) {
                engine.dialogue.replayDialogue("DLG-SC02-RADIO");
              } else {
                engine.dialogue.startDialogue("DLG-SC02-RADIO");
              }
              refreshUI();
              return;
            }
            setFlag("radio_state", "paused");
            say("BỘ ĐÀM", "Đã chuyển bộ đàm sang trạng thái TẠM DỪNG (PAUSED).");
          } },
          {
            id: "hs4",
            label: engine.dialogue.isDialogueCompleted("DLG-SC02-PHONE") ? "✓ Điện thoại nội bộ" : "Điện thoại nội bộ",
            x: "38%",
            y: "70%",
            done: engine.dialogue.isDialogueCompleted("DLG-SC02-PHONE"),
            onClick: () => {
              if (engine.dialogue.isDialogueCompleted("DLG-SC02-PHONE")) {
                engine.dialogue.replayDialogue("DLG-SC02-PHONE");
              } else {
                engine.dialogue.startDialogue("DLG-SC02-PHONE");
              }
              refreshUI();
            }
          }
        ];
      case "SC-03":
        return [
          { id: "hs1", label: has("I-04") ? "✓ Cầu chì 30A" : "Hộp dụng cụ", x: "26%", y: "56%", done: has("I-04"), onClick: () => addItem("I-04") },
          { id: "hs2", label: state.flags.locker_knocking ? "Tủ số 04 (Có tiếng gõ)" : "Tủ đồ số 04", x: "72%", y: "48%", onClick: handleLocker04Interaction },
          {
            id: "hs3",
            label: discoveredClues.includes("C-09") ? "✓ Thẻ nhân viên cũ" : "Thẻ nhân viên dưới giường",
            x: "47%",
            y: "76%",
            done: discoveredClues.includes("C-09"),
            onClick: () => {
              discoverClue(
                "C-09",
                "Một thẻ nhân viên cũ nằm khuất dưới chân giường sắt tại SC-03. Tên trên thẻ vẫn đọc được: Phạm Quốc Đạt. Phần ghi chú ở mặt sau đã bị hư hại, chưa đủ dữ kiện để xác định vai trò hoặc chuyện gì đã xảy ra với người này."
              );
            }
          },
          {
            id: "hs4",
            label: engine.dialogue.isDialogueCompleted("DLG-SC03-TRACE") ? "✓ Dãy giường nghỉ" : "Khảo sát giường nghỉ",
            x: "47%",
            y: "50%",
            done: engine.dialogue.isDialogueCompleted("DLG-SC03-TRACE"),
            onClick: () => {
              if (engine.dialogue.isDialogueCompleted("DLG-SC03-TRACE")) {
                engine.dialogue.replayDialogue("DLG-SC03-TRACE");
              } else {
                engine.dialogue.startDialogue("DLG-SC03-TRACE");
              }
              refreshUI();
            }
          }
        ];
      case "SC-04":
        return [
          { id: "hs1", label: discoveredClues.includes("C-04") ? "✓ Sơ đồ tải điện" : "Bảng sơ đồ mạch", x: "28%", y: "44%", done: discoveredClues.includes("C-04"), onClick: () => discoverClue("C-04", "LOW triệt nhiễu cho radar; NORMAL vận hành tiêu chuẩn; OVERLOAD đẩy công suất thấu kính quá ngưỡng.") },
          { id: "hs2", label: solved("PZ-01") ? "✓ Nguồn: LOW" : "Bảng điều khiển tải", x: "68%", y: "54%", done: solved("PZ-01"), onClick: () => setActiveModal("puzzles") }
        ];
      case "SC-05":
        return [
          { id: "hs1", label: discoveredClues.includes("C-06") ? "✓ Camera hành lang" : "Màn hình CCTV", x: "26%", y: "42%", done: discoveredClues.includes("C-06"), onClick: () => discoverClue("C-06", "Camera ghi lại cảnh sương mù bám theo ánh sáng đèn pin dọc hành lang.") },
          { id: "hs2", label: "Màn hình Radar", x: "50%", y: "41%", done: String(state.flags.power_mode) === "low", onClick: inspectRadarGear },
          { id: "hs3", label: discoveredClues.includes("C-07") ? "✓ Bảng bộ lọc" : "Tài liệu hiệu chỉnh", x: "74%", y: "42%", done: discoveredClues.includes("C-07"), onClick: () => discoverClue("C-07", "Ánh sáng đỏ trên 620nm vô hiệu hóa chức năng ghi nhận sinh học.") },
          { id: "hs4", label: solved("PZ-02") ? "✓ Ngăn bí mật" : "Ngăn kéo dưới bàn", x: "50%", y: "68%", done: solved("PZ-02"), onClick: () => setActiveModal("puzzles") }
        ];
      case "SC-06":
        return [
          { id: "hs1", label: state.flags.red_filter_installed ? "✓ Đã lắp bộ lọc đỏ" : "Khay bộ lọc đỏ", x: "31%", y: "48%", done: Boolean(state.flags.red_filter_installed), onClick: () => {
            if (state.flags.red_filter_installed) {
              say("THẤU KÍNH", "Bộ lọc đỏ đã được lắp. Luồng sáng vẫn duy trì ở mức 620nm an toàn.", false, false);
              return;
            }
            if (!has("I-05")) { say("THIẾU VẬT PHẨM", "Bạn chưa có Bộ lọc đỏ (I-05).", true, false); return; }
            setFlag("red_filter_installed", true);
            say("THẤU KÍNH", "Bộ lọc đỏ đã được lắp. Luồng sáng chuyển sang sắc đỏ 620nm an toàn.");
          }},
          { id: "hs2", label: "Vùng sáng trung tâm", x: "68%", y: "46%", onClick: handleEnterLanternBeam }
        ];
      default:
        return [];
    }
  })();

  const choice = (label: string, fn: () => void, opts?: { disabled?: boolean; done?: boolean; nav?: boolean }) => (
    <button
      type="button"
      className={`choice-btn ${opts?.done ? "done" : ""} ${opts?.nav ? "nav-next" : ""}`}
      onClick={fn}
      disabled={opts?.disabled}
    >
      <span>{opts?.done ? `✓ ${label}` : label}</span>
    </button>
  );

  const moveNext = nextScene
    ? choice(`Tiến tới ${nextScene.name} →`, () => go(nextScene.id), { nav: true })
    : null;

  const renderSceneChoices = () => {
    switch (scene.id) {
      case "SC-01":
        return <>
          {choice("Quan sát cổng", () => say("QUAN SÁT", "Sương trắng đang áp sát hàng rào. Không có người ở vọng gác."))}
          {choice("Nhặt đèn pin", () => addItem("I-01"), { done: has("I-01"), disabled: has("I-01") })}
          {choice("Nghe lại bản ghi nhận ca", () => {
            if (engine.dialogue.isDialogueCompleted("DLG-SC01-ARRIVAL")) {
              engine.dialogue.replayDialogue("DLG-SC01-ARRIVAL");
            } else {
              engine.dialogue.startDialogue("DLG-SC01-ARRIVAL");
            }
            refreshUI();
          }, { done: engine.dialogue.isDialogueCompleted("DLG-SC01-ARRIVAL") })}
          {choice("Mở cửa ngoài", () => perform("OPEN_EXTERIOR_DOOR", "hs_exterior_door"), {
            disabled: Boolean(state.flags.fog_breached)
          })}
        </>;
      case "SC-02":
        return <>
          {choice("Đọc bản tin nhiệt", () => discoverClue("C-01", "Bản tin mô tả chính xác trang phục của bạn."), { done: discoveredClues.includes("C-01") })}
          {choice("Đọc sổ Trần Minh", () => discoverClue("C-02", "Trần Minh ghi lại phương pháp ghép góc phương vị + biên độ lệch pha trên radar để xác định góc mù của thấu kính."), { done: discoveredClues.includes("C-02") })}
          {choice("Đọc hồ sơ nhân sự", () => { discoverClue("C-03", "Hồ sơ xác nhận trạm trưởng Lê Văn Hùng đã mất tích."); setFlag("captain_missing_confirmed", true); }, { done: discoveredClues.includes("C-03") })}
          {choice("Phát băng cassette", () => discoverClue("C-05", "Mặt A: Cảnh báo của Trần Minh. Mặt B: Bản ghi âm gốc giọng con gái Hùng, có nhịp thở và ngữ điệu tự nhiên. Giọng nói qua điện thoại là một bản bắt chước, không phải bản ghi trên băng."), { done: discoveredClues.includes("C-05"), disabled: !has("I-03") })}
          {choice("Lấy chìa khóa tủ", () => addItem("I-02"), { done: has("I-02"), disabled: has("I-02") })}
          {choice("Lấy sổ mã tần số", () => addItem("I-06"), { done: has("I-06"), disabled: has("I-06") })}
          {choice("Tạm dừng bộ đàm", () => {
            if (state.flags.radio_state === "paused") {
              say("BỘ ĐÀM", "Bộ đàm hiện đã ở trạng thái TẠM DỪNG (PAUSED).", false, false);
              return;
            }
            setFlag("radio_state", "paused");
            say("BỘ ĐÀM", "Bộ đàm đã tạm dừng.");
          }, { done: state.flags.radio_state === "paused" })}
          {choice("Lắng nghe tần số bộ đàm", () => {
            if (engine.dialogue.isDialogueCompleted("DLG-SC02-RADIO")) {
              engine.dialogue.replayDialogue("DLG-SC02-RADIO");
            } else {
              engine.dialogue.startDialogue("DLG-SC02-RADIO");
            }
            refreshUI();
          }, { done: engine.dialogue.isDialogueCompleted("DLG-SC02-RADIO") })}
          {choice("Trả lời bộ đàm", () => perform("ANSWER_RADIO", "radio_microphone"))}
          {choice("Ký sổ trực", () => perform("SIGN_LOGBOOK", "duty_logbook"))}
          {choice("Báo mã nhân viên", () => perform("REPORT_ID", "radio_microphone"))}
          {choice("Kiểm tra điện thoại nội bộ", () => {
            if (engine.dialogue.isDialogueCompleted("DLG-SC02-PHONE")) {
              engine.dialogue.replayDialogue("DLG-SC02-PHONE");
            } else {
              engine.dialogue.startDialogue("DLG-SC02-PHONE");
            }
            refreshUI();
          }, { done: engine.dialogue.isDialogueCompleted("DLG-SC02-PHONE") })}
          {choice("Nghe điện thoại", () => perform("ANSWER_PHONE", "internal_phone"))}
        </>;
      case "SC-03":
        return <>
          {choice("Kiểm tra tủ dụng cụ", () => say("TỦ DỤNG CỤ", has("I-02") ? "Chìa khóa mở được ngăn dụng cụ." : "Tủ dụng cụ đang khóa.", false, false))}
          {choice("Khảo sát khu giường nghỉ", () => {
            if (engine.dialogue.isDialogueCompleted("DLG-SC03-TRACE")) {
              engine.dialogue.replayDialogue("DLG-SC03-TRACE");
            } else {
              engine.dialogue.startDialogue("DLG-SC03-TRACE");
            }
            refreshUI();
          }, { done: engine.dialogue.isDialogueCompleted("DLG-SC03-TRACE") })}
          {choice("Lấy băng cassette", () => addItem("I-03"), { done: has("I-03"), disabled: !has("I-02") || has("I-03") })}
          {choice("Lấy cầu chì 30A", () => addItem("I-04"), { done: has("I-04"), disabled: has("I-04") })}
          {choice(
            discoveredClues.includes("C-09") ? "Xem lại thẻ nhân viên Phạm Quốc Đạt" : "Kiểm tra thẻ nhân viên dưới giường",
            () => {
              discoverClue(
                "C-09",
                "Một thẻ nhân viên cũ nằm khuất dưới chân giường sắt tại SC-03. Tên trên thẻ vẫn đọc được: Phạm Quốc Đạt. Phần ghi chú ở mặt sau đã bị hư hại, chưa đủ dữ kiện để xác định vai trò hoặc chuyện gì đã xảy ra với người này."
              );
            },
            { done: discoveredClues.includes("C-09") }
          )}
          {choice("Áp tai nghe tủ 04", () => { setFlag("locker_knocking", true); say("TỦ ĐỒ SỐ 04", "Bên trong tủ vang lên ba tiếng gõ chậm. Hơi lạnh rỉ qua khe cửa."); })}
          {choice("Mở tủ số 04", handleLocker04Interaction)}
        </>;
      case "SC-04":
        return <>
          {choice("Đọc sơ đồ tải điện", () => discoverClue("C-04", "LOW triệt nhiễu cho radar; NORMAL vận hành tiêu chuẩn; OVERLOAD đẩy công suất thấu kính quá ngưỡng."), { done: discoveredClues.includes("C-04") })}
          {choice("Đặt nguồn OVERLOAD", () => perform("USE_ITEM", "power_overload_switch"))}
          {choice("Giải mã cân bằng tải", () => setActiveModal("puzzles"), { done: solved("PZ-01"), disabled: !has("I-04") || solved("PZ-01") })}
        </>;
      case "SC-05":
        return <>
          {choice("Xem camera hành lang", () => discoverClue("C-06", "Khi nguồn LOW hoặc sương tràn, sương hướng về nguồn sáng."), { done: discoveredClues.includes("C-06") })}
          {choice("Đọc bảng bộ lọc", () => discoverClue("C-07", "Ánh sáng đỏ trên 620nm vô hiệu hóa chức năng ghi nhận."), { done: discoveredClues.includes("C-07") })}
          {choice("Vận hành thiết bị quan sát", inspectRadarGear)}
          {choice("Mở khóa giải mã (PZ-02 / PZ-03)", () => setActiveModal("puzzles"))}
        </>;
      case "SC-06": {
        const canEndingB = canReachEndingB(state);
        const canEndingS = canReachEndingS(state, engine.investigation);
        const canRecovery = canRecoverIdentityAtLanternRoom(state);
        return <>
          {choice("Lắp bộ lọc đỏ", () => {
            if (state.flags.red_filter_installed) {
              say("THẤU KÍNH", "Bộ lọc đỏ đã được lắp vào thấu kính.", false, false);
              return;
            }
            if (!has("I-05")) { say("THIẾU VẬT PHẨM", "Bạn chưa có Bộ lọc đỏ (I-05).", true, false); return; }
            setFlag("red_filter_installed", true);
            say("THẤU KÍNH", "Bộ lọc đỏ đã được lắp vào thấu kính.");
          }, { done: Boolean(state.flags.red_filter_installed), disabled: Boolean(state.flags.red_filter_installed) })}
          {choice("Bước vào vùng sáng", handleEnterLanternBeam)}
          {canRecovery &&
            choice("Đảo pha tần số xóa dữ liệu tồn dư", () => {
              perform("INVERT_SIGNAL_FREQUENCY", "frequency_panel");
              say(
                "BẢNG TẦN SỐ PHÁT · C-07",
                "Tín hiệu đảo pha đã xóa dữ liệu danh tính tồn dư trong buồng đèn. Hồ sơ vẫn lưu vết ghi đè 1/2."
              );
            })}
          {choice("Ngắt mạch chính (Kết thúc B)", () => end("END-02"), { disabled: !canEndingB })}
          {choice("Đảo tần số tín hiệu (Kết thúc S)", () => end("END-01"), { disabled: !canEndingS, nav: true })}
        </>;
      }
      default:
        return null;
    }
  };

  if (state.activeEndingId) {
    const endings: Record<string, { title: string; text: string; rank: string }> = {
      "END-01": {
        title: "Hồ Sơ Mũi Sương & Sự Thật 1998",
        text: "Tín hiệu đảo pha ở bước sóng 620nm quét ngược qua thấu kính Fresnel. Vòng lặp âm thanh giả mạo con gái trạm trưởng Lê Văn Hùng vỡ tan trong nhiễu trắng, khép lại chuỗi quy tắc giả do ông để lại. Cuốn sổ của Trần Minh vẫn dừng ở trang ghi chép cuối cùng chưa lời giải đáp — nhưng khi ánh bình minh ló rạng ngoài mũi đá, bản ghi của Trạm 09 đã ngừng hoạt động.",
        rank: "HẠNG S · SỰ THẬT TRỌN VẸN"
      },
      "END-02": {
        title: "Ngắt Mạch Cưỡng Bức",
        text: "Cầu dao chính sập xuống, thấu kính tắt lịm và làn sương từ từ rút ra ngoài hàng rào. Bạn sống sót qua đêm trực, nhưng hệ thống chỉ tạm ngừng cấp điện — cuốn sổ trực vẫn còn nguyên những quy tắc giả của Lê Văn Hùng chờ người trực ca kế tiếp.",
        rank: "HẠNG B · SỐNG SÓT"
      },
      "END-03": {
        title: "Bản Tin Thời Tiết Tiếp Theo",
        text: getChapter1DeathReason(state),
        rank: "DEAD · THẤT BẠI"
      }
    };
    const ending = endings[state.activeEndingId] ?? endings["END-03"];
    const isGoodEnding = state.activeEndingId === "END-01" || state.activeEndingId === "END-02";

    return (
      <main className="game-viewport">
        <div className="cctv-scanlines" aria-hidden="true" />
        <div className="cctv-grain" aria-hidden="true" />
        <div className="ending-screen">
          <div className="ending-top-row">
            <div>
              <div className="location-sub">HỒ SƠ TRẠM 09 · KẾT THÚC CA TRỰC · 11/1998</div>
              <h1>{ending.title}</h1>
            </div>
            <div className="seal-box" aria-hidden="true">
              <span>09</span>
              <small>CẤM</small>
            </div>
          </div>

          <div className={`ending-rank ${isGoodEnding ? "ending-good" : ""}`}>{ending.rank}</div>
          {state.activeEndingId === "END-03" && state.identityOverwriteCount >= 2 && (
            <div className="overwrite-status-banner critical" role="status">
              <strong>MỨC GHI ĐÈ: 2/2 — DANH TÍNH ĐÃ BỊ GHI ĐÈ</strong>
            </div>
          )}
          <p className="ending-text">{ending.text}</p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Bắt đầu lại ca trực
          </button>
        </div>
      </main>
    );
  }

  const inventorySlots = Array.from({ length: 6 }, (_, i) => state.inventoryItemIds[i] ?? null);
  const scenePuzzles = engine.puzzles.getPuzzlesForScene(scene.id);
  const unreadArchiveCount = engine.archive.getUnreadCount();
  const activeDialogueNode = engine.dialogue.getCurrentNode();
  const activeDialogue = engine.dialogue.getActiveDialogue();
  const isAnomalyActive =
    Boolean(state.flags.fog_breached) ||
    Boolean(state.flags.identity_exposed) ||
    state.identityOverwriteCount > 0 ||
    String(state.flags.power_mode) === "overload" ||
    state.entityStates["EN-02"] === "stalking" ||
    isViolationMsg;
  const speakerMeta = getSpeakerMeta(speaker, isViolationMsg);

  return (
    <main className={`game-viewport ${flash ? "red-flash" : ""} ${isAnomalyActive ? "anomaly-active" : ""}`}>
      <div className={`stage-backdrop ${state.flags.fog_breached ? "breached" : ""}`}>
        <SceneIllustration
          sceneId={scene.id}
          flags={state.flags}
          hasFlashlightItem={has("I-01")}
          solvedPuzzles={state.solvedPuzzleIds}
        />
      </div>

      {/* Lớp hiển thị CCTV 1998 (mỏng, không che khuất điểm tương tác) */}
      <div className="cctv-scanlines" aria-hidden="true" />
      <div className="cctv-grain" aria-hidden="true" />
      <div className="cctv-tracking-bar" aria-hidden="true" />
      <div className="cctv-reticle-frame" aria-hidden="true">
        <span className="cctv-corner tl" />
        <span className="cctv-corner tr" />
        <span className="cctv-corner bl" />
        <span className="cctv-corner br" />
      </div>

      <header className="hud-top">
        <div className="hud-left-cluster">
          <div className="location-plaque">
            <div className="seal-box" aria-hidden="true">
              <span>09</span>
              <small>CẤM</small>
            </div>
            <div>
              <div className="location-title">{scene.id} · {scene.name}</div>
              <div className="location-sub">TRẠM HẢI ĐĂNG MŨI SƯƠNG · {scene.time}</div>
            </div>
          </div>

          <div className="cctv-telemetry-strip" aria-label="Thông số ghi hình 1998">
            <span className="rec-indicator">
              <span className="rec-dot" aria-hidden="true" />
              <span>REC</span>
            </span>
            <span className="telemetry-sep">|</span>
            <span>CAM-09 · {scene.id}</span>
            <span className="telemetry-sep">|</span>
            <span>11/1998 · {scene.time}</span>
          </div>
        </div>

        <nav className="icon-dock" aria-label="Hồ sơ và công cụ điều tra">
          <button type="button" className="hud-icon-btn" onClick={() => setActiveModal("rules")}>
            <span className="hud-badge">{discoveredRules.length}/10</span>
            <DockIcon kind="rules" />
            <span className="ico-label">Quy tắc</span>
          </button>

          <button type="button" className="hud-icon-btn" onClick={() => setActiveModal("notebook")}>
            <span className="hud-badge">
              {discoveredClues.length}/9{unreadArchiveCount > 0 ? ` · ${unreadArchiveCount}` : ""}
            </span>
            <DockIcon kind="notebook" />
            <span className="ico-label">Sổ tay</span>
          </button>

          <button type="button" className="hud-icon-btn" onClick={() => setActiveModal("puzzles")}>
            <span className="hud-badge">{state.solvedPuzzleIds.length}/3</span>
            <DockIcon kind="puzzles" />
            <span className="ico-label">Giải mã</span>
          </button>

          <button type="button" className="hud-icon-btn" onClick={() => setActiveModal("map")}>
            <DockIcon kind="map" />
            <span className="ico-label">Sơ đồ</span>
          </button>

          <button type="button" className="hud-icon-btn" onClick={() => setActiveModal("logs")}>
            <span className="hud-badge">{state.logs.length}</span>
            <DockIcon kind="logs" />
            <span className="ico-label">Nhật ký</span>
          </button>

          <button type="button" className="hud-icon-btn hint-btn" onClick={() => setActiveModal("hint")}>
            <DockIcon kind="hint" />
            <span className="ico-label">Gợi ý</span>
          </button>
        </nav>
      </header>

      <section className="hotspot-layer" aria-label="Điểm tương tác hiện trường">
        {stageHotspots.map(hs => (
          <button
            key={hs.id}
            type="button"
            className={`hotspot-node ${hs.done ? "done" : ""}`}
            style={{ left: hs.x, top: hs.y }}
            disabled={hs.disabled}
            onClick={hs.onClick}
          >
            <span className="hotspot-reticle" aria-hidden="true">
              <span className="hotspot-reticle-core" />
            </span>
            <span className="hotspot-text-wrap">
              <span className="hotspot-coord">{hs.x.replace("%", "")}·{hs.y.replace("%", "")}</span>
              <span>{hs.label}</span>
            </span>
          </button>
        ))}
      </section>

      <section className="hud-bottom">
        {activeDialogueNode ? (
          <DialoguePanel
            dialogueSystem={engine.dialogue}
            node={activeDialogueNode}
            activeDialogue={activeDialogue}
            onStateChange={refreshUI}
            onCloseDialogue={refreshUI}
            identityOverwriteCount={state.identityOverwriteCount}
            lastOverwriteReason={state.lastOverwriteReason}
          />
        ) : (
          <div className="dialogue-box">
            <div className="dialogue-header">
              <span className={`speaker-tag ${speakerMeta.toneClass}`}>
                <span className="speaker-kind-prefix">{speakerMeta.prefix}</span>
                <span>{speaker}</span>
              </span>
              <div className="status-chips">
                <span className="status-item">
                  Điện: <b>{String(state.flags.power_mode).toUpperCase()}</b>
                </span>
                <span className="status-sep" aria-hidden="true">·</span>
                <span className="status-item">
                  Bộ đàm: <b>{String(state.flags.radio_state).toUpperCase()}</b>
                </span>
                <span className="status-sep" aria-hidden="true">·</span>
                <span className={`status-item ${state.flags.fog_breached ? "bad" : "ok"}`}>
                  Sương: <b>{state.flags.fog_breached ? "TRÀN VÀO" : "NGOÀI RÀO"}</b>
                </span>
                {has("I-01") && (
                  <>
                    <span className="status-sep" aria-hidden="true">·</span>
                    <span className={`status-item ${state.flags.flashlight_on ? "ok" : ""}`}>
                      Đèn pin: <b>{state.flags.flashlight_on ? "BẬT" : "TẮT"}</b>
                    </span>
                  </>
                )}
              </div>
            </div>

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

            <p className={`dialogue-text ${isViolationMsg ? "violation" : ""}`}>{dialogue}</p>

            <div className="choice-actions-row">
              <div className="choice-bar">{renderSceneChoices()}</div>
              {moveNext && <div className="choice-nav-dock">{moveNext}</div>}
            </div>
          </div>
        )}

        <div className="inventory-tray-wrap">
          <div className="inventory-tray-head">
            <span>KHAY VẬT CHỨNG · TRẠM 09</span>
            <span>{state.inventoryItemIds.length}/6 NGĂN CHỨA</span>
          </div>
          <div className="inventory-dock" aria-label="Túi đồ">
            {inventorySlots.map((itemId, idx) => {
              if (!itemId) {
                return (
                  <div className="inv-slot empty" key={`empty-${idx}`}>
                    <div className="inv-slot-top">
                      <span>0{idx + 1}</span>
                    </div>
                    <span className="inv-slot-name">TRỐNG</span>
                  </div>
                );
              }
              const itemMeta = ITEMS[itemId] ?? { name: itemId, note: "" };
              const isSelected = selectedItemId === itemId;
              const isFlashlightActive = itemId === "I-01" && Boolean(state.flags.flashlight_on);
              return (
                <button
                  type="button"
                  className={`inv-slot filled ${isSelected ? "selected" : ""} ${isFlashlightActive ? "active-gear" : ""}`}
                  key={itemId}
                  onClick={() => {
                    setSelectedItemId(itemId);
                    if (itemId === "I-01") {
                      const next = !state.flags.flashlight_on;
                      setFlag("flashlight_on", next);
                      say("ĐÈN PIN (I-01)", next ? "Đã bật đèn pin cầm tay." : "Đã tắt đèn pin cầm tay.");
                    } else {
                      say(`${itemId} · ${itemMeta.name.toUpperCase()}`, itemMeta.note, false, false);
                    }
                  }}
                >
                  <div className="inv-slot-top">
                    <span>{itemId}</span>
                    {itemId === "I-01" && (
                      <span className="inv-slot-state">
                        {state.flags.flashlight_on ? "BẬT" : "TẮT"}
                      </span>
                    )}
                  </div>
                  <span className="inv-slot-name">{itemMeta.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {activeModal && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div
            className={`modal-card ${activeModal === "notebook" ? "modal-wide" : ""}`}
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-head">
              <div className="modal-head-titles">
                <span className="modal-kicker">TRẠM HẢI ĐĂNG MŨI SƯƠNG · HỒ SƠ GIAO CA 1998</span>
                <h3>
                  {activeModal === "rules" && `QUY TẮC ĐÃ PHÁT HIỆN (${discoveredRules.length}/10)`}
                  {activeModal === "notebook" && `SỔ TAY ĐIỀU TRA (${discoveredClues.length}/9)`}
                  {activeModal === "puzzles" && `CƠ CẤU GIẢI MÃ · ${scene.name.toUpperCase()}`}
                  {activeModal === "map" && "SƠ ĐỒ TRẠM HẢI ĐĂNG 09"}
                  {activeModal === "logs" && `NHẬT KÝ CA TRỰC (${state.logs.length})`}
                  {activeModal === "hint" && "MANH MỐI ĐỊNH HƯỚNG"}
                </h3>
              </div>
              <button type="button" className="close-modal" onClick={() => setActiveModal(null)}>
                Đóng (Esc) ✕
              </button>
            </div>

            <div className="modal-body">
              {activeModal === "rules" && (
                <div className="rules-sheet-list">
                  {discoveredRules.map(rule => {
                    const invStatus = engine.investigation.getInvestigationStatus(rule.id);
                    const badge = INV_STATUS_BADGE[invStatus] ?? { text: invStatus, tone: "neutral" };
                    const lifecycle = rules.getRuleLifecycle(rule.id);
                    const stamp = getRuleStampLabel(invStatus, lifecycle, badge.text);
                    return (
                      <article className={`rule-card ${lifecycle === "transformed" ? "transformed" : ""}`} key={rule.id}>
                        <div className="rule-card-top">
                          <div>
                            <span className="rule-card-code">{rule.code} · {rule.scope}</span>
                            <strong className="rule-card-title">{rule.title}</strong>
                          </div>
                          <span className={`stamp-badge ${stamp.stampTone}`}>{stamp.label}</span>
                        </div>
                        <p className="rule-card-text">{rules.getEffectiveRuleText(rule.id)}</p>
                        <div className="rule-card-foot">
                          <span>
                            Trạng thái: {badge.text} · {lifecycle === "transformed" ? "ĐÃ BIẾN ĐỔI" : lifecycle}
                          </span>
                          <button
                            type="button"
                            className="btn-paper-action"
                            onClick={() => {
                              setPreselectedRuleId(rule.id);
                              setActiveModal("notebook");
                            }}
                          >
                            Đối chiếu trong Sổ tay →
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {activeModal === "notebook" && (
                <InvestigationNotebook
                  system={engine.investigation}
                  archiveSystem={engine.archive}
                  dialogueSystem={engine.dialogue}
                  preselectedRuleId={preselectedRuleId}
                  onReplayDialogue={dialogueId => {
                    if (engine.dialogue.replayDialogue(dialogueId)) {
                      setActiveModal(null);
                      refreshUI();
                    }
                  }}
                  onChange={refreshUI}
                />
              )}

              {activeModal === "puzzles" && (
                <PuzzleModalContent
                  scenePuzzles={scenePuzzles}
                  state={state}
                  cluesById={cluesById}
                  itemsMeta={ITEMS}
                  onSubmitPuzzle={submitPuzzle}
                  onScanRadar={inspectRadarGear}
                  feedback={puzzleFeedback}
                />
              )}

              {activeModal === "map" && (
                <div className="map-grid">
                  {SCENES.map(s => {
                    const isLocked = getSceneLockReason(s.id) !== null;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`map-node ${scene.id === s.id ? "current" : ""} ${isLocked ? "locked" : ""}`}
                        onClick={() => go(s.id)}
                      >
                        <small>{s.id} · {s.time} {isLocked ? "· KHÓA" : ""}</small>
                        <strong>{s.name}</strong>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeModal === "logs" && (
                <div>
                  {[...state.logs].reverse().map((entry, idx) => (
                    <p
                      className={`log-line ${entry.includes("VI PHẠM") || entry.includes("BẪY") ? "alert" : ""}`}
                      key={`${state.logs.length - idx}-${entry}`}
                    >
                      {entry}
                    </p>
                  ))}
                </div>
              )}

              {activeModal === "hint" && (
                <div>
                  <div className="hint-paper-card">{getHintText()}</div>
                  <div className="hint-actions-row">
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      onClick={() => {
                        const data = engine.store.exportSave("quick-slot");
                        try {
                          window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
                        } catch { /* ignore quota */ }
                        setSavedSlot(data);
                        setActiveModal(null);
                        say("HỆ THỐNG", "Đã lưu tiến trình vào bộ nhớ trình duyệt (localStorage).", false, false);
                      }}
                    >
                      Lưu nhanh
                    </button>
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      disabled={!savedSlot}
                      onClick={() => {
                        if (!savedSlot) return;
                        engine.dialogue.cancelDialogue();
                        if (engine.store.importSave(savedSlot)) {
                          rules.syncLifecycles();
                          setActiveModal(null);
                          say("HỆ THỐNG", "Đã tải lại bản lưu từ bộ nhớ trình duyệt.", false, false);
                        }
                      }}
                    >
                      Tải bản lưu
                    </button>
                    <button type="button" className="btn-ghost-sm" onClick={() => window.location.reload()}>
                      Chơi lại từ đầu
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}