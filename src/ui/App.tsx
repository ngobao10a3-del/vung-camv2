import { useEffect, useMemo, useRef, useState } from "react";
import { ACTION_TAGS } from "../types/common";
import type { SaveData } from "../types/save";
import {
  CHAPTER1_ITEMS as ITEMS,
  CHAPTER1_SCENES as SCENES,
  attemptSceneTransition,
  canReachEndingB,
  canReachEndingS,
  canRecoverIdentityAtLanternRoom,
  createChapter1Engine,
  getChapter1DeathReason,
  getSceneLockReason,
  type Chapter1Engine
} from "../data/chapter1Runtime";
import { CHAPTER1_CLUES } from "../data/chapter1Investigation";
import {
  StationAudioEngine,
  loadAudioSettings,
  type AudioSettings
} from "../systems/AudioEngine";
import { InvestigationNotebook } from "./InvestigationNotebook";
import { SceneIllustration } from "./SceneIllustration";
import { DialoguePanel } from "./DialoguePanel";
import { PuzzleModalContent, type PuzzleModalFeedback } from "./PuzzleModalContent";
import { CharacterStageOverlay } from "./CharacterStageOverlay";

type ActiveModal = "rules" | "notebook" | "puzzles" | "map" | "logs" | "hint" | null;

interface ContextualAction {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
  done?: boolean;
}

interface ContextualMenuState {
  hotspotId: string;
  title: string;
  subtitle?: string;
  x: string;
  y: string;
  actions: ContextualAction[];
}

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
  if (
    isViolation ||
    speakerLabel.includes("CẢNH BÁO") ||
    speakerLabel.includes("BẪY") ||
    speakerLabel.includes("LỐI ĐI") ||
    speakerLabel.includes("THIẾU") ||
    speakerLabel.includes("KHÓA LIÊN ĐỘNG") ||
    speakerLabel.includes("MÃ KHÔNG KHỚP") ||
    speakerLabel.includes("CƠ CẤU BỊ KHÓA") ||
    speakerLabel.includes("CHƯA ĐỦ ĐIỀU KIỆN") ||
    speakerLabel.includes("RADAR CHƯA ỔN ĐỊNH")
  ) {
    return { toneClass: "tone-warning", prefix: "CẢNH BÁO" };
  }
  if (
    speakerLabel.includes("MANH MỐI MỚI") ||
    speakerLabel.includes("THU THẬP VẬT PHẨM") ||
    speakerLabel.includes("GIẢI MÃ THÀNH CÔNG")
  ) {
    return { toneClass: "tone-discovery", prefix: "PHÁT HIỆN MỚI" };
  }
  if (speakerLabel.includes("C-05") || speakerLabel.includes("BĂNG") || speakerLabel.includes("MẶT B")) {
    return { toneClass: "tone-audio", prefix: "BĂNG GHI ÂM" };
  }
  if (
    speakerLabel.includes("BỘ ĐÀM") ||
    speakerLabel.includes("RADAR") ||
    speakerLabel.includes("GIẢI MÃ") ||
    speakerLabel.includes("HỆ THỐNG") ||
    speakerLabel.includes("ĐÈN PIN") ||
    speakerLabel.includes("THẤU KÍNH") ||
    speakerLabel.includes("ĐIỆN THOẠI") ||
    speakerLabel.includes("BẢNG TẢI ĐIỆN")
  ) {
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

function AudioSpeakerIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg className="ico-svg audio-ico" viewBox="0 0 24 24" aria-hidden="true">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="22" y1="9" x2="16" y2="15" />
        <line x1="16" y1="9" x2="22" y2="15" />
      </svg>
    );
  }
  return (
    <svg className="ico-svg audio-ico" viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.8 5.8a9 9 0 0 1 0 12.4" />
    </svg>
  );
}

function ItemGlyph({ itemId }: { itemId: string }) {
  switch (itemId) {
    case "I-01":
      return (
        <svg viewBox="0 0 24 24" className="inv-glyph" aria-hidden="true">
          <path
            d="M9 3h6v3l-2 3v10a2 2 0 0 1-2 2h0a2 2 0 0 1-2-2V9L7 6V3h2z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <line x1="8" y1="6" x2="16" y2="6" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="14" r="1.2" fill="currentColor" />
          <path
            d="M12 2v-1M7 2L6 1M17 2l1-1"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.65"
          />
        </svg>
      );
    case "I-02":
      return (
        <svg viewBox="0 0 24 24" className="inv-glyph" aria-hidden="true">
          <circle cx="7.5" cy="15.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M11 12l8.5-8.5M16 7l2 2M18 5l2 2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "I-03":
      return (
        <svg viewBox="0 0 24 24" className="inv-glyph" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="8" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="16" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <line x1="8" y1="14.5" x2="16" y2="14.5" stroke="currentColor" strokeWidth="1.4" />
          <rect x="6" y="8" width="12" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
        </svg>
      );
    case "I-04":
      return (
        <svg viewBox="0 0 24 24" className="inv-glyph" aria-hidden="true">
          <rect x="7" y="6" width="10" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="8.5" y="3" width="7" height="3" rx="0.5" fill="currentColor" opacity="0.8" />
          <rect x="8.5" y="18" width="7" height="3" rx="0.5" fill="currentColor" opacity="0.8" />
          <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2" />
        </svg>
      );
    case "I-05":
      return (
        <svg viewBox="0 0 24 24" className="inv-glyph" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle
            cx="12"
            cy="12"
            r="4.8"
            fill="rgba(217, 56, 56, 0.35)"
            stroke="#D93838"
            strokeWidth="1.4"
            strokeDasharray="3 2"
          />
          <line x1="12" y1="3.5" x2="12" y2="20.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
          <line x1="3.5" y1="12" x2="20.5" y2="12" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
        </svg>
      );
    case "I-06":
      return (
        <svg viewBox="0 0 24 24" className="inv-glyph" aria-hidden="true">
          <rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <line x1="8" y1="3" x2="8" y2="21" stroke="currentColor" strokeWidth="1.6" />
          <path d="M11 9q1.5 -3 3 0t3 0" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <line x1="11" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
          <line x1="11" y1="17" x2="15" y2="17" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="inv-glyph" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
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
  const [preselectedClueId, setPreselectedClueId] = useState<string | undefined>(undefined);
  const [examinedClueIds, setExaminedClueIds] = useState<Set<string>>(() => new Set());
  const [speaker, setSpeaker] = useState("NHẬP CA TRỰC · 23:40");
  const [dialogue, setDialogue] = useState(
    "Bạn nhận lệnh trực thay ca đêm tại Trạm Hải Đăng Mũi Sương. Cánh cổng sắt đóng chặt; ngoài hàng rào, một màn sương trắng đang tụ lại phía xa, chưa rõ khoảng cách. Một chiếc đèn pin nằm trên bệ gác."
  );
  const [isViolationMsg, setIsViolationMsg] = useState(false);
  const [puzzleFeedback, setPuzzleFeedback] = useState<PuzzleModalFeedback | null>(null);
  const [flash, setFlash] = useState(false);
  const [savedSlot, setSavedSlot] = useState<SaveData | null>(() => loadSavedFromStorage());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isDialogueCollapsed, setIsDialogueCollapsed] = useState(false);
  const [activeContextualMenu, setActiveContextualMenu] = useState<ContextualMenuState | null>(null);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => loadAudioSettings());
  const audioRef = useRef<StationAudioEngine | null>(null);

  const state = engine.store.snapshot();
  const sceneIdx = SCENES.findIndex(s => s.id === state.currentSceneId);
  const scene = SCENES[sceneIdx >= 0 ? sceneIdx : 0];
  const prevScene = sceneIdx > 0 ? SCENES[sceneIdx - 1] : undefined;
  const nextScene = SCENES[sceneIdx + 1];
  const discoveredClues = state.discoveredClueIds;
  const discoveredRules = rules.getDiscoveredRules();
  const fogApproaching = state.triggeredOnceIds.includes("fog_approaching_door");
  const phoneDisconnected = state.triggeredOnceIds.includes("phone_disconnected");
  const radarScanned = state.triggeredOnceIds.includes("radar_low_scanned");
  const solved = (id: string) => state.solvedPuzzleIds.includes(id);
  const has = (id: string) => state.inventoryItemIds.includes(id);
  const refreshUI = () => refresh(v => v + 1);
  const markClueExamined = (clueId: string) => {
    setExaminedClueIds(prev => {
      if (prev.has(clueId)) return prev;
      const next = new Set(prev);
      next.add(clueId);
      return next;
    });
  };

  useEffect(() => {
    const audio = new StationAudioEngine(audioSettings);
    audio.registerAutoplayUnlock();
    audioRef.current = audio;
    return () => {
      audio.dispose();
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    audioRef.current?.setSettings(audioSettings);
  }, [audioSettings]);

  useEffect(() => {
    audioRef.current?.updateAmbience({
      sceneId: scene.id,
      activeEndingId: state.activeEndingId,
      fogApproaching,
      fogBreached: Boolean(state.flags.fog_breached),
      powerMode: String(state.flags.power_mode ?? "normal"),
      radioState: String(state.flags.radio_state ?? "broadcasting"),
      phoneDisconnected,
      lockerKnocking: Boolean(state.flags.locker_knocking),
      identityExposed: Boolean(state.flags.identity_exposed),
      identityOverwriteCount: state.identityOverwriteCount,
      redFilterInstalled: Boolean(state.flags.red_filter_installed),
      flashlightOn: Boolean(state.flags.flashlight_on)
    });
  }, [
    scene.id,
    state.activeEndingId,
    fogApproaching,
    state.flags.fog_breached,
    state.flags.power_mode,
    state.flags.radio_state,
    phoneDisconnected,
    state.flags.locker_knocking,
    state.flags.identity_exposed,
    state.identityOverwriteCount,
    state.flags.red_filter_installed,
    state.flags.flashlight_on
  ]);

  const toggleAudioMute = () => {
    audioRef.current?.unlockAndSync();
    setAudioSettings(prev => ({
      ...prev,
      muted: !prev.muted
    }));
  };

  const changeAudioVolume = (nextVolume: number) => {
    audioRef.current?.unlockAndSync();
    const clamped = Math.max(0, Math.min(1, Math.round(nextVolume * 100) / 100));
    setAudioSettings({
      muted: clamped === 0,
      volume: clamped
    });
  };

  useEffect(() => {
    const unsubscribe = engine.dispatcher.subscribe(event => {
      if (event.type === "RULE_VIOLATED") {
        setSpeaker(`CẢNH BÁO · ${event.ruleId}`);
        setIsViolationMsg(true);
        setDialogue(`Bạn vừa vi phạm ${event.ruleId}! Hậu quả đã được ghi nhận trong nhật ký.`);
        audioRef.current?.playCue("rule_violation");
      }
      if (event.type === "PUZZLE_SOLVED") {
        audioRef.current?.playCue("puzzle_solved");
      }
      if (event.type === "CLUE_ADDED") {
        audioRef.current?.playCue("clue_discovery");
      }
      if (event.type === "STATE_MUTATED" && "key" in event && event.key === "identityOverwriteCount") {
        audioRef.current?.playCue("rule_violation");
      }
      if (event.type === "FX_REQUESTED" && event.fx === "red_flash") {
        setFlash(true);
        audioRef.current?.playCue("rule_violation");
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
      if (e.key === "Escape") {
        if (activeContextualMenu !== null) {
          setActiveContextualMenu(null);
          return;
        }
        if (activeModal !== null) {
          setActiveModal(null);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeModal, activeContextualMenu]);

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
    setIsDialogueCollapsed(false);
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
    setPreselectedRuleId(undefined);
    setPreselectedClueId(id);
    if (discoveredClues.includes(id)) {
      say(`HỒ SƠ ${id}`, text, false, false);
      setActiveModal("notebook");
      return;
    }
    engine.store.discoverClue(id);
    audioRef.current?.playCue("clue_discovery");
    say(`MANH MỐI MỚI · ${id}`, text);
  };

  const addItem = (id: string) => {
    if (engine.store.snapshot().activeEndingId !== null) return;
    if (has(id)) {
      say("VẬT PHẨM", `Bạn đã cất [${ITEMS[id]?.name ?? id}] trong khay vật chứng.`, false, false);
      return;
    }
    engine.store.addItem(id);
    audioRef.current?.playCue("item_pickup");
    setSelectedItemId(id);
    const totalOwned = engine.store.snapshot().inventoryItemIds.length;
    say(
      "THU THẬP VẬT PHẨM",
      `Đã cất [${ITEMS[id]?.name ?? id}] vào khay vật chứng (${totalOwned}/6). Bấm vào ô vật phẩm bên dưới để kiểm tra công dụng.`
    );
  };

  const checkSceneLock = (id: string): string | null => getSceneLockReason(engine.store.snapshot(), id);

  const go = (id: string) => {
    setActiveContextualMenu(null);
    const res = attemptSceneTransition(engine, id);
    if (!res.ok) {
      if (res.reason === "ended" || res.reason === "same_scene") {
        refreshUI();
        return;
      }
      audioRef.current?.playCue("puzzle_error");
      if (res.reason === "locked") {
        setActiveModal(null);
        say("LỐI ĐI BỊ KHÓA", res.message, true, false);
        return;
      }
      if (res.reason === "r08_interlock") {
        setActiveModal(null);
        say("KHÓA LIÊN ĐỘNG · R-08", res.message, true, false);
        return;
      }
      setActiveModal(null);
      say("CẢNH BÁO · R-10", res.message, true, false);
      return;
    }

    audioRef.current?.playCue("scene_transition");
    const target = SCENES.find(s => s.id === id);
    setPuzzleFeedback(null);
    setActiveModal(null);
    const arrivalText =
      id === "SC-03"
        ? `${target?.description ?? ""} Từ bên trong tủ đồ số 04 vang lên ba tiếng gõ chậm rãi: cốc... cốc... cốc.`
        : target?.description ?? "";
    say(`${target?.id} · ${target?.name.toUpperCase()}`, arrivalText);
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
        audioRef.current?.playCue("item_pickup");
        const msg = "Mạch điện vận hành ở tải tiêu chuẩn, nhưng nhiễu cao tần vẫn cản trở radar tại Phòng quan sát.";
        setPuzzleFeedback({ title: "BẢNG ĐIỀU KHIỂN TẢI · NORMAL", detail: msg, tone: "info" });
        say("BẢNG ĐIỀU KHIỂN TẢI · NORMAL", msg, false, false);
      } else {
        audioRef.current?.playCue("puzzle_error");
        const msg = `Sai mật mã ${puzzleId} (lần thử ${result.attemptsUsed}). Hãy đối chiếu kỹ thông số quan sát và vật phẩm trong túi đồ.`;
        setPuzzleFeedback({ title: "MÃ KHÔNG KHỚP", detail: msg, tone: "warn" });
        say("MÃ KHÔNG KHỚP", msg, true, false);
      }
    } else if (result.status === "locked") {
      audioRef.current?.playCue("puzzle_error");
      const msg = `Bạn đã sử dụng hết lượt thử của ${puzzleId}. Cơ cấu không nhận thêm mật mã.`;
      setPuzzleFeedback({ title: "CƠ CẤU BỊ KHÓA", detail: msg, tone: "warn" });
      say("CƠ CẤU BỊ KHÓA", msg);
    } else if (result.status === "missing_items") {
      audioRef.current?.playCue("puzzle_error");
      const msg =
        puzzleId === "PZ-01"
          ? "Chưa thể chuyển sang chế độ LOW: Cần Cầu chì 30A (I-04), lắp cầu chì vào khe bảo vệ và ngắt nhánh điện phụ (AUX OFF)."
          : `Bạn chưa đáp ứng đủ dữ kiện hoặc điều kiện kỹ thuật để giải ${puzzleId}.`;
      setPuzzleFeedback({ title: "CHƯA ĐỦ ĐIỀU KIỆN", detail: msg, tone: "warn" });
      say("CHƯA ĐỦ ĐIỀU KIỆN", msg, true, false);
    } else if (result.status === "not_found") {
      say("KHÔNG TÌM THẤY CƠ CẤU", `Không xác định được dữ liệu giải đố ${puzzleId}.`);
    } else {
      say("THÔNG BÁO", `Không thể thực hiện ${puzzleId}.`, true, false);
    }

    refreshUI();
  };

  const handleInstallPowerFuse = () => {
    if (engine.store.snapshot().activeEndingId !== null) return;
    if (!has("I-04")) {
      const msg = "Bạn chưa có Cầu chì 30A (I-04) từ Khu nghỉ nhân viên (SC-03).";
      setPuzzleFeedback({ title: "THIẾU CẦU CHÌ 30A", detail: msg, tone: "warn" });
      say("THIẾU VẬT PHẨM", msg, true, false);
      return;
    }
    perform("USE_ITEM", "power_fuse_slot");
    const msg = "Đã lắp Cầu chì 30A (I-04) vào bảng cân bằng tải.";
    setPuzzleFeedback({ title: "ĐÃ LẮP CẦU CHÌ", detail: msg, tone: "ok" });
    say("BẢNG TẢI ĐIỆN · SC-04", msg, false, false);
  };

  const handleToggleAuxBranch = () => {
    if (engine.store.snapshot().activeEndingId !== null) return;
    const currentlyOff = engine.store.snapshot().powerPanelState.auxBranchOff;
    perform("USE_ITEM", currentlyOff ? "aux_branch_on" : "aux_branch_off");
    const nowOff = engine.store.snapshot().powerPanelState.auxBranchOff;
    const msg = nowOff
      ? "Đã ngắt công tắc nhánh điện phụ (AUX OFF)."
      : "Đã đóng lại công tắc nhánh điện phụ (AUX ON).";
    setPuzzleFeedback({ title: "NHÁNH ĐIỆN PHỤ", detail: msg, tone: nowOff ? "ok" : "info" });
    say("BẢNG TẢI ĐIỆN · SC-04", msg, false, false);
  };

  const inspectRadarGear = () => {
    if (engine.store.snapshot().activeEndingId !== null) return;
    const currentPowerMode = String(engine.store.snapshot().flags.power_mode);

    perform("USE_OBSERVATION_GEAR", "observation_gear");
    if (currentPowerMode !== "low") {
      audioRef.current?.playCue("puzzle_error");
      const msg =
        "Nguồn điện chưa chuyển sang LOW. Nhiễu sóng mang vẫn che khuất dữ liệu tọa độ. Hãy giải PZ-01 trước.";
      setPuzzleFeedback({ title: "RADAR CHƯA ỔN ĐỊNH · R-07", detail: msg, tone: "warn" });
      say("RADAR CHƯA ỔN ĐỊNH", msg, true, false);
      return;
    }

    audioRef.current?.playCue("radar_scan");
    const msg =
      "Nguồn tải LOW đã triệt nhiễu sóng mang. Trên màn quét xuất hiện vùng mù của thấu kính tại: Góc phương vị 27° Bắc — Biên độ lệch pha 14′ (đối chiếu Sổ trực Trần Minh C-02 để lập mã tọa độ).";
    setPuzzleFeedback({ title: "DỮ LIỆU QUAN SÁT RADAR", detail: msg, tone: "ok" });
    say("DỮ LIỆU QUAN SÁT RADAR", msg, false, false);
  };

  const getHintText = (): string => {
    if (!has("I-01")) return "Nhặt Đèn pin trên bệ gác Cổng trạm, tuyệt đối không mở cửa ngoài khi sương áp sát, rồi tiến vào Phòng trực (SC-02).";
    if (state.currentSceneId === "SC-01") return "Bấm 'Tiến tới Phòng trực' để bắt đầu kiểm tra hồ sơ ca trực.";
    if (!discoveredClues.includes("C-01") || !discoveredClues.includes("C-03")) {
      return "Đọc Bản tin nhiệt và Hồ sơ nhân sự trên bàn trực để nắm tình trạng trạm trưởng Lê Văn Hùng.";
    }
    if (state.flags.radio_state !== "paused") {
      return "Tạm dừng bộ đàm (PAUSED) để tránh lộ danh tính và đáp ứng khóa liên động buồng đèn.";
    }
    if (!has("I-04") && !state.powerPanelState.fuseInstalled) {
      return "Lấy Chìa khóa tủ (I-02) và Sổ mã tần số (I-06) ở Phòng trực, sau đó sang Khu nghỉ (SC-03) lấy Cầu chì 30A (I-04) và Băng cassette (I-03).";
    }
    if (!solved("PZ-01")) {
      return "Sang Phòng máy (SC-04), đọc Sơ đồ tải điện (C-04), lắp Cầu chì 30A (I-04), ngắt nhánh phụ (AUX OFF) rồi chuyển sang chế độ LOW trên bảng PZ-01.";
    }
    if (!has("I-05") || !solved("PZ-03")) {
      return "Tại Phòng quan sát (SC-05), bật Thiết bị quan sát ở chế độ LOW để đo góc phương vị & biên độ lệch pha (PZ-02), đồng thời đối chiếu Mặt A băng cassette (C-05) và Sổ mã tần số (I-06) để mở khóa tần số Trạm 09 (PZ-03).";
    }
    if (!state.flags.red_filter_installed) {
      return "Lên Buồng đèn (SC-06) và lắp Bộ lọc đỏ vào thấu kính trước khi bước vào vùng sáng trung tâm.";
    }
    if (canRecoverIdentityAtLanternRoom(state)) {
      return "Danh tính của bạn từng bị ghi nhận một lần (1/2). Hãy đọc Bảng hiệu chỉnh bộ lọc (C-07) và dùng thao tác đảo pha tần số tại Buồng đèn (SC-06) để xóa dữ liệu tồn dư.";
    }
    return "Đảm bảo đã nghe cả Mặt A lẫn Mặt B băng cassette tại Phòng trực (SC-02) và đối chiếu đủ các quy tắc (R-03, R-04, R-05) trong Sổ tay trước khi chọn kết thúc tại Buồng đèn.";
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

  const handleInspectExteriorGate = () => {
    perform("INSPECT_OBJECT", "exterior_gate");
    say("QUAN SÁT", "Qua khe cổng sắt, làn sương trắng đang dồn áp sát hàng rào. Không có bóng người ở vọng gác.", false, false);
  };

  const handleOpenExteriorDoor = () => {
    perform("OPEN_EXTERIOR_DOOR", "hs_exterior_door");
    if (engine.store.snapshot().activeEndingId === null) {
      say(
        "CỬA NGOÀI",
        "Cánh cổng sắt vẫn khóa chốt. Màn sương trắng còn lởn vởn ở khoảng sân ngoài.",
        false,
        false
      );
    }
  };

  const handleInspectLocker04 = () => {
    perform("INSPECT_OBJECT", "locker_04");
    const knocking = Boolean(engine.store.snapshot().flags.locker_knocking);
    if (knocking) {
      audioRef.current?.playCue("locker_knock");
    }
    say(
      "TỦ ĐỒ SỐ 04",
      knocking
        ? "Từ bên trong tủ vang lên ba tiếng gõ chậm: cốc... cốc... cốc. Hơi lạnh rỉ qua khe cửa thép."
        : "Cánh tủ thép số 04 đóng kín, lạnh buốt.",
      false,
      false
    );
  };

  const handleOpenLocker04 = () => {
    perform("OPEN_LOCKER_04", "locker_04");
    if (engine.store.snapshot().activeEndingId === null) {
      say("TỦ ĐỒ SỐ 04", "Bên trong tủ trống rỗng, không phát hiện dấu hiệu bất thường.", false, false);
    }
  };

  const handleAnswerPhone = () => {
    if (engine.store.snapshot().triggeredOnceIds.includes("phone_disconnected")) {
      say("ĐIỆN THOẠI NỘI BỘ", "Đường dây điện thoại nội bộ đã bị ngắt kết nối.", false, false);
      return;
    }
    const captainMissing = Boolean(engine.store.snapshot().flags.captain_missing_confirmed);
    perform("ANSWER_PHONE", "internal_phone");
    if (!captainMissing && engine.store.snapshot().activeEndingId === null) {
      say(
        "ĐIỆN THOẠI NỘI BỘ",
        "Đầu dây bên kia chỉ có tiếng rè đường truyền nội bộ; chưa có ai trả lời từ phòng trạm trưởng.",
        false,
        false
      );
    }
  };

  const handleDisconnectPhone = () => {
    if (engine.store.snapshot().triggeredOnceIds.includes("phone_disconnected")) {
      say("ĐIỆN THOẠI NỘI BỘ", "Đường dây điện thoại nội bộ đã được rút phích cắm từ trước.", false, false);
      return;
    }
    perform("DISCONNECT_PHONE", "internal_phone");
    say(
      "ĐIỆN THOẠI NỘI BỘ",
      "Bạn đã rút phích cắm dây điện thoại nội bộ khỏi ổ nối trên bàn trực.",
      false,
      false
    );
  };

  const handlePlayCassetteSideB = () => {
    if (!has("I-03")) {
      say("THIẾU VẬT PHẨM", "Bạn chưa có Băng cassette (I-03).", true, false);
      return;
    }
    perform("USE_ITEM", "cassette_side_b");
    say(
      "MẶT B · BĂNG CASSETTE GỐC",
      "Giữa tiếng rè tĩnh điện là giọng một bé gái: 'Bố nhớ ăn tối nhé... Con về muộn một chút... Chúc bố ngủ ngon.' Âm thanh có nhịp thở và ngữ điệu tự nhiên — hoàn toàn khác giọng bắt chước qua điện thoại nội bộ.",
      false,
      false
    );
  };

  const stageHotspots: Array<{
    id: string; label: string; verb: string; x: string; y: string; onClick: () => void;
    done?: boolean; disabled?: boolean; disabledReason?: string;
  }> = (() => {
    switch (scene.id) {
      case "SC-01":
        return [
          { id: "hs1", verb: "QUAN SÁT", label: "Khe cổng sắt", x: "28%", y: "58%", onClick: handleInspectExteriorGate },
          { id: "hs2", verb: "THU THẬP", label: has("I-01") ? "✓ Đèn pin" : "Đèn pin trên bệ gác", x: "66%", y: "66%", done: has("I-01"), onClick: () => addItem("I-01") },
          {
            id: "hs3",
            verb: "TƯƠNG TÁC",
            label: "Cửa ngoài",
            x: "48%",
            y: "46%",
            disabled: Boolean(state.flags.fog_breached),
            disabledReason: "Cửa ngoài đã bị làn sương đẩy mở.",
            onClick: handleOpenExteriorDoor
          }
        ];
      case "SC-02":
        return [
          { id: "hs1", verb: "ĐỌC", label: discoveredClues.includes("C-01") ? "✓ Bản tin nhiệt" : "Máy in bản tin", x: "23%", y: "48%", done: discoveredClues.includes("C-01"), onClick: () => discoverClue("C-01", "Bản tin mô tả chính xác trang phục của bạn trước thời điểm hiện tại.") },
          { id: "hs2", verb: "ĐỌC", label: discoveredClues.includes("C-03") ? "✓ Hồ sơ nhân sự" : "Hồ sơ trên bàn", x: "50%", y: "62%", done: discoveredClues.includes("C-03"), onClick: () => { discoverClue("C-03", "Hồ sơ xác nhận trạm trưởng Lê Văn Hùng đã mất tích sau một ca trực đêm đơn độc."); setFlag("captain_missing_confirmed", true); } },
          { id: "hs3", verb: "THIẾT BỊ", label: `Bộ đàm (${String(state.flags.radio_state).toUpperCase()})`, x: "76%", y: "48%", done: state.flags.radio_state === "paused", onClick: () => {
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
            verb: "KIỂM TRA",
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
          { id: "hs1", verb: "THU THẬP", label: has("I-04") ? "✓ Cầu chì 30A" : "Hộp dụng cụ", x: "26%", y: "56%", done: has("I-04"), onClick: () => addItem("I-04") },
          { id: "hs2", verb: "TƯƠNG TÁC", label: state.flags.locker_knocking ? "Tủ số 04 (Có tiếng gõ)" : "Tủ đồ số 04", x: "72%", y: "48%", onClick: handleOpenLocker04 },
          {
            id: "hs3",
            verb: "ĐỌC",
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
            verb: "QUAN SÁT",
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
          { id: "hs1", verb: "ĐỌC", label: discoveredClues.includes("C-04") ? "✓ Sơ đồ tải điện" : "Bảng sơ đồ mạch", x: "28%", y: "44%", done: discoveredClues.includes("C-04"), onClick: () => discoverClue("C-04", "LOW triệt nhiễu cho radar; NORMAL vận hành tiêu chuẩn; OVERLOAD đẩy công suất thấu kính quá ngưỡng.") },
          { id: "hs2", verb: "GIẢI MÃ", label: solved("PZ-01") ? "✓ Nguồn: LOW" : "Bảng điều khiển tải", x: "68%", y: "54%", done: solved("PZ-01"), onClick: () => setActiveModal("puzzles") }
        ];
      case "SC-05":
        return [
          { id: "hs1", verb: "QUAN SÁT", label: discoveredClues.includes("C-06") ? "✓ Camera hành lang" : "Màn hình CCTV", x: "26%", y: "42%", done: discoveredClues.includes("C-06"), onClick: () => discoverClue("C-06", "Camera hành lang ghi lại cảnh sương mù đổi hướng bám theo ánh sáng đèn pin khi nguồn điện hạ mức LOW hoặc sương tràn.") },
          { id: "hs2", verb: "THIẾT BỊ", label: "Màn hình Radar", x: "50%", y: "41%", done: String(state.flags.power_mode) === "low" && state.triggeredOnceIds.includes("radar_low_scanned"), onClick: inspectRadarGear },
          { id: "hs3", verb: "ĐỌC", label: discoveredClues.includes("C-07") ? "✓ Bảng bộ lọc" : "Tài liệu hiệu chỉnh", x: "74%", y: "42%", done: discoveredClues.includes("C-07"), onClick: () => discoverClue("C-07", "Bảng hiệu chỉnh xác nhận ánh sáng đỏ trên 620nm vô hiệu hóa chức năng ghi nhận sinh học của thấu kính và nhắc đến thao tác đảo pha tần số.") },
          { id: "hs4", verb: "GIẢI MÃ", label: solved("PZ-02") ? "✓ Ngăn bí mật" : "Ngăn kéo dưới bàn", x: "50%", y: "68%", done: solved("PZ-02"), onClick: () => setActiveModal("puzzles") }
        ];
      case "SC-06":
        return [
          { id: "hs1", verb: "THIẾT BỊ", label: state.flags.red_filter_installed ? "✓ Đã lắp bộ lọc đỏ" : "Khay bộ lọc đỏ", x: "31%", y: "48%", done: Boolean(state.flags.red_filter_installed), onClick: () => {
            if (state.flags.red_filter_installed) {
              say("THẤU KÍNH", "Bộ lọc đỏ đã được lắp. Luồng sáng vẫn duy trì ở mức 620nm an toàn.", false, false);
              return;
            }
            if (!has("I-05")) {
              audioRef.current?.playCue("puzzle_error");
              say("THIẾU VẬT PHẨM", "Bạn chưa có Bộ lọc đỏ (I-05).", true, false);
              return;
            }
            setFlag("red_filter_installed", true);
            audioRef.current?.playCue("filter_install");
            say("THẤU KÍNH", "Bộ lọc đỏ đã được lắp. Luồng sáng chuyển sang sắc đỏ 620nm an toàn.");
          }},
          { id: "hs2", verb: "TƯƠNG TÁC", label: "Vùng sáng trung tâm", x: "68%", y: "46%", onClick: handleEnterLanternBeam }
        ];
      default:
        return [];
    }
  })();

  const handleInventorySlotClick = (itemId: string) => {
    const itemMeta = ITEMS[itemId] ?? { name: itemId, note: "" };
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
      say("VẬT CHỨNG", `Đã bỏ chọn [${itemMeta.name}].`, false, false);
      return;
    }

    setSelectedItemId(itemId);
    if (itemId === "I-01") {
      const next = !state.flags.flashlight_on;
      setFlag("flashlight_on", next);
      audioRef.current?.playCue("flashlight_toggle");
      const lightRiskActive =
        Boolean(state.flags.fog_breached) ||
        state.flags.power_mode === "low" ||
        state.ruleLifecycleStates["R-10"] === "transformed";
      say(
        "ĐÈN PIN (I-01)",
        next
          ? lightRiskActive
            ? "Đã bật đèn pin cầm tay. Lưu ý: hiện trường đang ở trạng thái nhạy cảm với nguồn sáng khi di chuyển (R-10)."
            : "Đã bật đèn pin cầm tay."
          : "Đã tắt đèn pin cầm tay."
      );
    } else {
      say(`${itemId} · ${itemMeta.name.toUpperCase()}`, itemMeta.note, false, false);
    }
  };

  const handleHotspotClick = (hs: {
    id: string;
    verb: string;
    label: string;
    x: string;
    y: string;
    onClick: () => void;
    done?: boolean;
    disabled?: boolean;
    disabledReason?: string;
  }) => {
    if (hs.disabled) {
      if (hs.disabledReason) {
        say("CHÚ Ý", hs.disabledReason, false, false);
      }
      return;
    }

    if (selectedItemId) {
      // 1. I-05 on SC-06 hs1 (Khay bộ lọc đỏ)
      if (selectedItemId === "I-05" && scene.id === "SC-06" && hs.id === "hs1") {
        if (state.flags.red_filter_installed) {
          say("THẤU KÍNH", "Bộ lọc đỏ đã được lắp. Luồng sáng vẫn duy trì ở mức 620nm an toàn.", false, false);
        } else {
          setFlag("red_filter_installed", true);
          audioRef.current?.playCue("filter_install");
          say("THẤU KÍNH", "Bạn đã lắp Bộ lọc đỏ (I-05) vào khay thấu kính. Luồng sáng chuyển sang sắc đỏ 620nm an toàn.");
        }
        setSelectedItemId(null);
        return;
      }

      // 2. I-04 on SC-04 hs2 (Bảng điều khiển tải)
      if (selectedItemId === "I-04" && scene.id === "SC-04" && hs.id === "hs2") {
        if (!state.powerPanelState.fuseInstalled) {
          handleInstallPowerFuse();
        }
        setActiveModal("puzzles");
        setSelectedItemId(null);
        return;
      }

      // 3. I-02 on SC-03 hs1 (Hộp dụng cụ / tủ)
      if (selectedItemId === "I-02" && scene.id === "SC-03" && hs.id === "hs1") {
        if (!has("I-04")) {
          addItem("I-04");
        } else {
          say("HỘP DỤNG CỤ", "Chìa khóa (I-02) đã mở hộp dụng cụ. Bạn đã lấy hết vật phẩm bên trong.", false, false);
        }
        setSelectedItemId(null);
        return;
      }

      // 4. I-03 on SC-02 hs3 (Bộ đàm / máy phát cassette)
      if (selectedItemId === "I-03" && scene.id === "SC-02" && hs.id === "hs3") {
        discoverClue(
          "C-05",
          "[Mặt A · Giọng Trần Minh]: 'Nếu ai nghe được băng này, đừng mở tủ 04 khi có tiếng gõ. Khóa liên động buồng đèn chỉ nhả chốt khi bộ đàm đang ở trạng thái tạm dừng.'"
        );
        setSelectedItemId(null);
        return;
      }

      // Incompatible item use: neutral feedback, then execute standard hotspot click
      const itemMeta = ITEMS[selectedItemId];
      say(
        "SỬ DỤNG VẬT PHẨM",
        `[${itemMeta?.name ?? selectedItemId}] không tương thích với ${hs.label.toLowerCase()}. Thực hiện quan sát thông thường.`,
        false,
        false
      );
      setSelectedItemId(null);
      hs.onClick();
      return;
    }

    hs.onClick();
  };

  const choice = (
    label: string,
    fn: () => void,
    opts?: { disabled?: boolean; done?: boolean; nav?: boolean; hint?: string }
  ) => (
    <button
      type="button"
      className={`choice-btn ${opts?.done ? "done" : ""} ${opts?.nav ? "nav-next" : ""}`}
      onClick={fn}
      disabled={opts?.disabled}
      title={opts?.hint}
    >
      <span>{opts?.done ? `✓ ${label}` : label}</span>
    </button>
  );

  const nextLockReason = nextScene ? checkSceneLock(nextScene.id) : null;
  const prevLockReason = prevScene ? checkSceneLock(prevScene.id) : null;
  const moveNext = nextScene
    ? choice(`Tiến tới ${nextScene.name} →`, () => go(nextScene.id), {
        nav: true,
        hint: nextLockReason ?? `Di chuyển sang ${nextScene.id} · ${nextScene.name}`
      })
    : null;

  const getSceneChoiceNote = (): string | null => {
    switch (scene.id) {
      case "SC-01":
        return state.flags.fog_breached ? "Trạng thái cổng: Cửa ngoài đã bị sương đẩy mở sau vi phạm R-01." : null;
      case "SC-02":
        return !has("I-03") ? "Ghi chú: Cần thu thập Cuộn băng cassette (I-03) tại Khu nghỉ (SC-03) để dùng máy phát băng." : null;
      case "SC-03":
        return !has("I-02") ? "Ghi chú: Tủ dụng cụ đang khóa, cần Chìa khóa tủ (I-02) từ Phòng trực (SC-02)." : null;
      case "SC-04":
        return !has("I-04") && !solved("PZ-01")
          ? "Ghi chú: Cần Cầu chì 30A (I-04) từ Khu nghỉ (SC-03) trước khi mở bảng cân bằng tải."
          : null;
      case "SC-06": {
        const canB = canReachEndingB(state);
        const canS = canReachEndingS(state, engine.investigation);
        if (!canB) {
          return state.flags.identity_exposed
            ? "Điều kiện kết thúc: Đang bị lộ danh tính (cần lắp Bộ lọc đỏ và xóa dữ liệu tồn dư trước khi kết thúc)."
            : "Điều kiện kết thúc: Cần lắp Bộ lọc đỏ (I-05) vào khung thấu kính tại Buồng đèn.";
        }
        if (!canS) {
          return "Kết thúc S cần thêm: thu thập C-05 & C-08, nghe Mặt B cassette và đối chiếu xong R-03, R-04, R-05 trong Sổ tay.";
        }
        return null;
      }
      default:
        return null;
    }
  };

  const renderSceneChoices = () => {
    switch (scene.id) {
      case "SC-01":
        return <>
          {choice("Quan sát cổng", handleInspectExteriorGate, { hint: "Quan sát phía ngoài khe cổng sắt" })}
          {choice("Nhặt đèn pin", () => addItem("I-01"), {
            done: has("I-01"),
            disabled: has("I-01"),
            hint: has("I-01") ? "Bạn đã cất Đèn pin (I-01) vào khay vật chứng." : "Nhặt Đèn pin trên bệ gác"
          })}
          {choice("Nghe lại bản ghi nhận ca", () => {
            if (engine.dialogue.isDialogueCompleted("DLG-SC01-ARRIVAL")) {
              engine.dialogue.replayDialogue("DLG-SC01-ARRIVAL");
            } else {
              engine.dialogue.startDialogue("DLG-SC01-ARRIVAL");
            }
            refreshUI();
          }, { done: engine.dialogue.isDialogueCompleted("DLG-SC01-ARRIVAL") })}
          {choice("Mở cửa ngoài", handleOpenExteriorDoor, {
            disabled: Boolean(state.flags.fog_breached),
            hint: state.flags.fog_breached ? "Cửa ngoài đã mở sau khi sương tràn vào trạm." : undefined
          })}
        </>;
      case "SC-02": {
        const phoneDisconnected = state.triggeredOnceIds.includes("phone_disconnected");
        const sideBHeard = state.triggeredOnceIds.includes("cassette_side_b_heard");
        const missingTapeHint = "Cần thu thập Cuộn băng cassette (I-03) trong tủ dụng cụ tại SC-03.";
        const disconnectedHint = "Đường dây điện thoại nội bộ đã bị ngắt kết nối.";
        return <>
          {choice("Đọc bản tin nhiệt", () => discoverClue("C-01", "Bản tin mô tả chính xác trang phục của bạn trước thời điểm hiện tại."), { done: discoveredClues.includes("C-01") })}
          {choice("Đọc sổ Trần Minh", () => discoverClue("C-02", "Trần Minh ghi lại phương pháp ghép góc phương vị + biên độ lệch pha trên radar để xác định góc mù của thấu kính."), { done: discoveredClues.includes("C-02") })}
          {choice("Đọc hồ sơ nhân sự", () => { discoverClue("C-03", "Hồ sơ xác nhận trạm trưởng Lê Văn Hùng đã mất tích sau một ca trực đêm đơn độc."); setFlag("captain_missing_confirmed", true); }, { done: discoveredClues.includes("C-03") })}
          {choice(
            "Phát băng cassette (Mặt A)",
            () =>
              discoverClue(
                "C-05",
                "[Mặt A · Giọng Trần Minh]: 'Nếu ai nghe được băng này, đừng mở tủ 04 khi có tiếng gõ. Khóa liên động buồng đèn chỉ nhả chốt khi bộ đàm đang ở trạng thái tạm dừng.'"
              ),
            { done: discoveredClues.includes("C-05"), disabled: !has("I-03"), hint: !has("I-03") ? missingTapeHint : undefined }
          )}
          {choice(
            "Phát băng cassette (Mặt B)",
            handlePlayCassetteSideB,
            { done: sideBHeard, disabled: !has("I-03"), hint: !has("I-03") ? missingTapeHint : undefined }
          )}
          {choice("Lấy chìa khóa tủ", () => addItem("I-02"), {
            done: has("I-02"),
            disabled: has("I-02"),
            hint: has("I-02") ? "Đã cất Chìa khóa tủ (I-02) vào khay vật chứng." : undefined
          })}
          {choice("Lấy sổ mã tần số", () => addItem("I-06"), {
            done: has("I-06"),
            disabled: has("I-06"),
            hint: has("I-06") ? "Đã cất Sổ mã tần số (I-06) vào khay vật chứng." : undefined
          })}
          {choice("Tạm dừng bộ đàm (PAUSED)", () => {
            if (state.flags.radio_state === "paused") {
              say("BỘ ĐÀM", "Bộ đàm hiện đã ở trạng thái TẠM DỪNG (PAUSED).", false, false);
              return;
            }
            setFlag("radio_state", "paused");
            say("BỘ ĐÀM", "Bộ đàm đã chuyển sang trạng thái TẠM DỪNG (PAUSED).");
          }, { done: state.flags.radio_state === "paused" })}
          {choice("Tắt nguồn bộ đàm (OFF)", () => {
            if (state.flags.radio_state === "off") {
              say("BỘ ĐÀM", "Bộ đàm hiện đã tắt nguồn hoàn toàn (OFF).", false, false);
              return;
            }
            setFlag("radio_state", "off");
            say("BỘ ĐÀM", "Đã ngắt nguồn bộ đàm (OFF).");
          }, { done: state.flags.radio_state === "off" })}
          {choice("Lắng nghe tần số bộ đàm", () => {
            if (engine.dialogue.isDialogueCompleted("DLG-SC02-RADIO")) {
              engine.dialogue.replayDialogue("DLG-SC02-RADIO");
            } else {
              engine.dialogue.startDialogue("DLG-SC02-RADIO");
            }
            refreshUI();
          }, { done: engine.dialogue.isDialogueCompleted("DLG-SC02-RADIO") })}
          {choice("Trả lời bộ đàm", () => {
            const currentRadio = engine.store.snapshot().flags.radio_state;
            perform("ANSWER_RADIO", "radio_microphone");
            if (currentRadio !== "broadcasting" && engine.store.snapshot().activeEndingId === null) {
              say("BỘ ĐÀM", "Bộ đàm không phát sóng. Không có tín hiệu thu lại qua micro.", false, false);
            }
          })}
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
          {choice("Nghe điện thoại", handleAnswerPhone, {
            disabled: phoneDisconnected,
            hint: phoneDisconnected ? disconnectedHint : undefined
          })}
          {choice("Ngắt kết nối điện thoại nội bộ", handleDisconnectPhone, {
            done: phoneDisconnected,
            disabled: phoneDisconnected,
            hint: phoneDisconnected ? disconnectedHint : undefined
          })}
        </>;
      }
      case "SC-03":
        return <>
          {choice("Kiểm tra tủ dụng cụ", () => say("TỦ DỤNG CỤ", has("I-02") ? "Chìa khóa mở được ngăn dụng cụ chứa Cuộn băng cassette (I-03)." : "Tủ dụng cụ đang khóa. Cần Chìa khóa tủ (I-02) tại Phòng trực.", false, false))}
          {choice("Khảo sát khu giường nghỉ", () => {
            if (engine.dialogue.isDialogueCompleted("DLG-SC03-TRACE")) {
              engine.dialogue.replayDialogue("DLG-SC03-TRACE");
            } else {
              engine.dialogue.startDialogue("DLG-SC03-TRACE");
            }
            refreshUI();
          }, { done: engine.dialogue.isDialogueCompleted("DLG-SC03-TRACE") })}
          {choice("Lấy băng cassette", () => addItem("I-03"), {
            done: has("I-03"),
            disabled: !has("I-02") || has("I-03"),
            hint: has("I-03")
              ? "Đã cất Băng cassette (I-03) vào khay vật chứng."
              : !has("I-02")
                ? "Tủ dụng cụ đang khóa. Cần Chìa khóa tủ (I-02) tại Phòng trực (SC-02)."
                : undefined
          })}
          {choice("Lấy cầu chì 30A", () => addItem("I-04"), {
            done: has("I-04"),
            disabled: has("I-04"),
            hint: has("I-04") ? "Đã cất Cầu chì 30A (I-04) vào khay vật chứng." : undefined
          })}
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
          {choice("Áp tai nghe tủ 04", handleInspectLocker04)}
          {choice("Mở tủ số 04", handleOpenLocker04)}
        </>;
      case "SC-04":
        return <>
          {choice("Đọc sơ đồ tải điện", () => discoverClue("C-04", "LOW triệt nhiễu cho radar; NORMAL vận hành tiêu chuẩn; OVERLOAD đẩy công suất thấu kính quá ngưỡng."), { done: discoveredClues.includes("C-04") })}
          {choice("Đặt nguồn OVERLOAD", () => perform("USE_ITEM", "power_overload_switch"))}
          {choice("Giải mã cân bằng tải", () => setActiveModal("puzzles"), {
            done: solved("PZ-01"),
            disabled: !has("I-04") || solved("PZ-01"),
            hint: solved("PZ-01")
              ? "Bảng cân bằng tải đã ổn định ở chế độ LOW."
              : !has("I-04")
                ? "Cần thu thập Cầu chì 30A (I-04) tại Khu nghỉ (SC-03) trước khi hiệu chỉnh bảng tải."
                : undefined
          })}
        </>;
      case "SC-05":
        return <>
          {choice("Xem camera hành lang", () => discoverClue("C-06", "Camera hành lang ghi lại cảnh sương mù đổi hướng bám theo ánh sáng đèn pin khi nguồn điện hạ mức LOW hoặc sương tràn."), { done: discoveredClues.includes("C-06") })}
          {choice("Đọc bảng bộ lọc", () => discoverClue("C-07", "Bảng hiệu chỉnh xác nhận ánh sáng đỏ trên 620nm vô hiệu hóa chức năng ghi nhận sinh học của thấu kính và nhắc đến thao tác đảo pha tần số."), { done: discoveredClues.includes("C-07") })}
          {choice("Vận hành thiết bị quan sát", inspectRadarGear)}
          {choice("Mở khóa giải mã (PZ-02 / PZ-03)", () => setActiveModal("puzzles"), {
            done: solved("PZ-02") && solved("PZ-03")
          })}
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
            if (!has("I-05")) {
              audioRef.current?.playCue("puzzle_error");
              say("THIẾU VẬT PHẨM", "Bạn chưa có Bộ lọc đỏ (I-05).", true, false);
              return;
            }
            setFlag("red_filter_installed", true);
            audioRef.current?.playCue("filter_install");
            say("THẤU KÍNH", "Bộ lọc đỏ đã được lắp vào thấu kính.");
          }, {
            done: Boolean(state.flags.red_filter_installed),
            disabled: Boolean(state.flags.red_filter_installed),
            hint: state.flags.red_filter_installed ? "Bộ lọc đỏ đã được lắp cố định vào khung thấu kính." : undefined
          })}
          {choice("Bước vào vùng sáng", handleEnterLanternBeam)}
          {canRecovery &&
            choice("Đảo pha tần số xóa dữ liệu tồn dư", () => {
              perform("INVERT_SIGNAL_FREQUENCY", "frequency_recovery_panel");
              say(
                "BẢNG TẦN SỐ PHÁT · C-07",
                "Tín hiệu đảo pha đã xóa dữ liệu danh tính tồn dư trong buồng đèn. Hồ sơ vẫn lưu vết ghi đè 1/2."
              );
            })}
          {choice("Ngắt mạch chính (Kết thúc B)", () => perform("CUT_MAIN_RELAY", "main_relay"), {
            disabled: !canEndingB,
            hint: !canEndingB
              ? "Cần lắp Bộ lọc đỏ (I-05) và không còn tình trạng lộ danh tính để chọn Kết thúc B."
              : undefined
          })}
          {choice("Đảo tần số tín hiệu (Kết thúc S)", () => perform("INVERT_SIGNAL_FREQUENCY", "frequency_ending_s"), {
            disabled: !canEndingS,
            nav: true,
            hint: !canEndingS
              ? "Cần đáp ứng Kết thúc B, có C-05 & C-08, nghe Mặt B cassette và đối chiếu xong R-03, R-04, R-05."
              : undefined
          })}
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
          <div className="ending-actions-row">
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              Bắt đầu lại ca trực
            </button>
            <div className="audio-control-bar" aria-label="Điều khiển âm thanh môi trường">
              <button
                type="button"
                className={`audio-mute-btn ${audioSettings.muted ? "muted" : ""}`}
                onClick={toggleAudioMute}
                aria-label={audioSettings.muted ? "Bật âm thanh" : "Tắt âm thanh"}
                aria-pressed={audioSettings.muted}
                title={audioSettings.muted ? "Bật âm thanh môi trường" : "Tắt âm thanh môi trường"}
              >
                <AudioSpeakerIcon muted={audioSettings.muted || audioSettings.volume === 0} />
              </button>
              <input
                type="range"
                className="audio-slider"
                min={0}
                max={1}
                step={0.05}
                value={audioSettings.muted ? 0 : audioSettings.volume}
                onChange={e => changeAudioVolume(Number(e.target.value))}
                aria-label="Âm lượng"
              />
              <span className="audio-level-text">
                {audioSettings.muted || audioSettings.volume === 0
                  ? "TẮT"
                  : `${Math.round(audioSettings.volume * 100)}%`}
              </span>
            </div>
          </div>
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

  const sceneChoiceNote = getSceneChoiceNote();

  const redFilterClimax = scene.id === "SC-06" && Boolean(state.flags.red_filter_installed);

  return (
    <main
      className={`game-viewport scene-ambient-${scene.id.toLowerCase()} power-${String(
        state.flags.power_mode ?? "normal"
      )} ${flash ? "red-flash" : ""} ${isAnomalyActive ? "anomaly-active" : ""} ${
        redFilterClimax ? "red-filter-active" : ""
      }`}
    >
      {/* TOP SLIM HUD */}
      <header className="hud-top">
        <div className="hud-left-cluster">
          <div className="location-plaque location-plaque-compact">
            <div className="seal-box" aria-hidden="true">
              <span>09</span>
              <small>CẤM</small>
            </div>
            <div className="location-info">
              <div className="location-title">{scene.id} · {scene.name}</div>
              <div className="location-sub">TRẠM HẢI ĐĂNG MŨI SƯƠNG · {scene.time}</div>
            </div>
          </div>

          <div className="hud-telemetry-audio-row">
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

            <div className="audio-control-bar" aria-label="Điều khiển âm thanh môi trường">
              <button
                type="button"
                className={`audio-mute-btn ${audioSettings.muted ? "muted" : ""}`}
                onClick={toggleAudioMute}
                aria-label={audioSettings.muted ? "Bật âm thanh" : "Tắt âm thanh"}
                aria-pressed={audioSettings.muted}
                title={audioSettings.muted ? "Bật âm thanh môi trường" : "Tắt âm thanh môi trường"}
              >
                <AudioSpeakerIcon muted={audioSettings.muted || audioSettings.volume === 0} />
              </button>
              <input
                type="range"
                className="audio-slider"
                min={0}
                max={1}
                step={0.05}
                value={audioSettings.muted ? 0 : audioSettings.volume}
                onChange={e => changeAudioVolume(Number(e.target.value))}
                aria-label="Âm lượng"
              />
              <span className="audio-level-text">
                {audioSettings.muted || audioSettings.volume === 0
                  ? "TẮT"
                  : `${Math.round(audioSettings.volume * 100)}%`}
              </span>
            </div>
          </div>
        </div>

        <nav className="icon-dock" aria-label="Hồ sơ và công cụ điều tra">
          <button type="button" className="hud-icon-btn" onClick={() => setActiveModal("rules")}>
            <span className="hud-badge">{discoveredRules.length}/10</span>
            <DockIcon kind="rules" />
            <span className="ico-label">Quy tắc</span>
          </button>

          <button
            type="button"
            className="hud-icon-btn"
            title={`Sổ tay điều tra (${discoveredClues.length}/9 manh mối · ${unreadArchiveCount} tư liệu chưa đọc)`}
            onClick={() => {
              setPreselectedRuleId(undefined);
              setActiveModal("notebook");
            }}
          >
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

      {/* STAGE WORKBENCH: FULL-STAGE MAIN AREA + SEPARATED RIGHT INVENTORY DOCK */}
      <div className="stage-workbench">
        <section className="stage-main-area" aria-label="Khu vực hiện trường">
          <div className={`stage-backdrop ${state.flags.fog_breached ? "breached" : ""}`}>
            <div key={scene.id} className="stage-scene-fade">
              <SceneIllustration
                sceneId={scene.id}
                flags={state.flags}
                hasFlashlightItem={has("I-01")}
                solvedPuzzles={state.solvedPuzzleIds}
                fogApproaching={fogApproaching}
                phoneDisconnected={phoneDisconnected}
                powerFuseInstalled={state.powerPanelState.fuseInstalled}
                identityOverwriteCount={state.identityOverwriteCount}
                radarScanned={radarScanned}
              />
              <div className="scene-shutter-sweep" aria-hidden="true" />
            </div>
          </div>

          {/* Lớp hiển thị CCTV 1998 */}
          <div className="cctv-scanlines" aria-hidden="true" />
          <div className="cctv-grain" aria-hidden="true" />
          <div className="cctv-tracking-bar" aria-hidden="true" />
          <div className="cctv-reticle-frame" aria-hidden="true">
            <span className="cctv-corner tl" />
            <span className="cctv-corner tr" />
            <span className="cctv-corner bl" />
            <span className="cctv-corner br" />
          </div>

          {/* Điều hướng chuyển cảnh cạnh màn hình */}
          <div className="stage-edge-nav" aria-label="Điều hướng chuyển cảnh nhanh">
            {prevScene && (
              <button
                type="button"
                className={`stage-edge-btn stage-edge-prev ${prevLockReason ? "locked" : ""}`}
                onClick={() => go(prevScene.id)}
                title={prevLockReason ?? `Quay lại ${prevScene.id} · ${prevScene.name}`}
                aria-label={`Quay lại ${prevScene.id} · ${prevScene.name}`}
              >
                <span className="edge-btn-arrow" aria-hidden="true">‹</span>
                <span className="edge-btn-text">
                  <span className="edge-btn-code">{prevScene.id}</span>
                  <span className="edge-btn-label">{prevScene.name}</span>
                </span>
              </button>
            )}
            {nextScene && (
              <button
                type="button"
                className={`stage-edge-btn stage-edge-next ${nextLockReason ? "locked" : ""}`}
                onClick={() => go(nextScene.id)}
                title={nextLockReason ?? `Tiến tới ${nextScene.id} · ${nextScene.name}`}
                aria-label={`Tiến tới ${nextScene.id} · ${nextScene.name}`}
              >
                <span className="edge-btn-text">
                  <span className="edge-btn-code">{nextScene.id}</span>
                  <span className="edge-btn-label">{nextScene.name}</span>
                </span>
                <span className="edge-btn-arrow" aria-hidden="true">›</span>
              </button>
            )}
          </div>

          {/* Điểm tương tác hiện trường */}
          <section className="hotspot-layer" aria-label="Điểm tương tác hiện trường">
            {stageHotspots.map(hs => (
              <button
                key={hs.id}
                type="button"
                className={`hotspot-node ${hs.done ? "done" : ""} ${selectedItemId ? "hotspot-targetable" : ""}`}
                style={{ left: hs.x, top: hs.y }}
                disabled={hs.disabled}
                title={hs.disabled && hs.disabledReason ? hs.disabledReason : `${hs.verb}: ${hs.label}`}
                onClick={() => handleHotspotClick(hs)}
              >
                <span className="hotspot-reticle" aria-hidden="true">
                  <span className="hotspot-reticle-core" />
                </span>
                <span className="hotspot-text-wrap">
                  <span className="hotspot-coord">{hs.verb} · {hs.x.replace("%", "")}·{hs.y.replace("%", "")}</span>
                  <span>{hs.label}</span>
                </span>
              </button>
            ))}
          </section>

          {/* Dải đối thoại và lệnh tương tác dưới đáy sân khấu */}
          <section className="stage-bottom-strip" aria-label="Thanh thông tin và đối thoại">
            {isDialogueCollapsed ? (
              <button
                type="button"
                className="dialogue-collapsed-tab"
                onClick={() => setIsDialogueCollapsed(false)}
                title="Bấm để mở rộng Ghi chép ca trực"
              >
                <span className="collapsed-tab-icon" aria-hidden="true">▲</span>
                <span className="collapsed-tab-title">GHI CHÉP CA TRỰC</span>
                <span className="collapsed-tab-sep" aria-hidden="true">·</span>
                <span className="collapsed-tab-speaker">{speaker}</span>
              </button>
            ) : (
              <div className="dialogue-strip-card">
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
                      <button
                        type="button"
                        className="dialogue-collapse-toggle"
                        onClick={() => setIsDialogueCollapsed(true)}
                        title="Thu gọn dải đối thoại"
                      >
                        <span>▼ Thu gọn</span>
                      </button>
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

                    <div className="choice-actions-row" style={{ display: "none" }}>
                      <div className="choice-bar">{renderSceneChoices()}</div>
                      {moveNext && <div className="choice-nav-dock">{moveNext}</div>}
                    </div>
                    {sceneChoiceNote && (
                      <div className="choice-lock-note" role="note">{sceneChoiceNote}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Chân dung nhân vật đặt tại vùng dự phòng 110px dưới đáy sân khấu */}
            <div className="portrait-reserved-slot" aria-label="Khu vực chân dung nhân vật">
              <CharacterStageOverlay
                characterId={
                  activeDialogueNode
                    ? activeDialogueNode.speakerId
                    : state.flags.captain_missing_confirmed
                      ? "CHAR-HUNG"
                      : "CHAR-PLAYER"
                }
                expression={activeDialogueNode?.expression ?? (state.flags.identity_exposed ? "distorted" : "tense")}
                isIdentityExposed={Boolean(state.flags.identity_exposed) || state.identityOverwriteCount > 0}
                isEntityPresent={scene.id === "SC-03" && Boolean(state.flags.locker_knocking)}
              />
            </div>
          </section>

          {/* Contextual Action Menu Overlay */}
          {activeContextualMenu && (
            <>
              <div
                className="contextual-action-overlay"
                onClick={() => setActiveContextualMenu(null)}
              />
              <div
                className="contextual-action-panel"
                style={{ left: activeContextualMenu.x, top: activeContextualMenu.y }}
                role="dialog"
                aria-modal="true"
                onClick={e => e.stopPropagation()}
              >
                <div className="contextual-panel-head">
                  <div className="contextual-panel-titles">
                    <span className="contextual-panel-kicker">HIỆN TRƯỜNG · {scene.id}</span>
                    <h4 className="contextual-panel-title">{activeContextualMenu.title}</h4>
                  </div>
                  <button
                    type="button"
                    className="contextual-close-btn"
                    onClick={() => setActiveContextualMenu(null)}
                    title="Đóng (Esc)"
                  >
                    ✕
                  </button>
                </div>
                <div className="contextual-action-list">
                  {activeContextualMenu.actions.map((act, i) => (
                    <button
                      type="button"
                      key={act.id}
                      className={`contextual-action-btn ${act.done ? "done" : ""}`}
                      disabled={act.disabled}
                      title={act.disabled && act.disabledReason ? act.disabledReason : act.label}
                      onClick={() => {
                        setActiveContextualMenu(null);
                        act.onClick();
                      }}
                    >
                      <span className="contextual-btn-bullet" aria-hidden="true">
                        {act.done ? "✓" : `0${i + 1}›`}
                      </span>
                      <span className="contextual-btn-label">{act.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {/* Khay vật chứng 6 ô thẳng đứng bên phải */}
        <aside className="inventory-dock inventory-dock-vertical" aria-label="Túi đồ">
          <div className="inv-dock-header">
            <span className="inv-dock-title">VẬT CHỨNG</span>
            <span className="inv-dock-count">{state.inventoryItemIds.length}/6</span>
          </div>
          <div className="inv-slots-list">
            {inventorySlots.map((itemId, idx) => {
              if (!itemId) {
                return (
                  <div className="inv-slot inv-slot-vertical empty" key={`empty-${idx}`} title={`Ngăn 0${idx + 1} trống`}>
                    <div className="inv-slot-top">
                      <span className="inv-slot-num">0{idx + 1}</span>
                    </div>
                    <div className="inv-slot-glyph-placeholder" aria-hidden="true">
                      <span className="glyph-empty-cross">+</span>
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
                  className={`inv-slot inv-slot-vertical filled ${isSelected ? "selected" : ""} ${
                    isFlashlightActive ? "active-gear" : ""
                  }`}
                  key={itemId}
                  title={`${itemId} · ${itemMeta.name}: ${itemMeta.note}`}
                  onClick={() => handleInventorySlotClick(itemId)}
                  aria-pressed={isSelected}
                >
                  <div className="inv-slot-top">
                    <span className="inv-slot-code">{itemId}</span>
                    {itemId === "I-01" && (
                      <span className={`inv-slot-state ${state.flags.flashlight_on ? "on" : "off"}`}>
                        {state.flags.flashlight_on ? "BẬT" : "TẮT"}
                      </span>
                    )}
                  </div>
                  <div className="inv-slot-glyph-box">
                    <ItemGlyph itemId={itemId} />
                  </div>
                  <span className="inv-slot-name">{itemMeta.name}</span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

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
                              setPreselectedClueId(undefined);
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
                  preselectedClueId={preselectedClueId}
                  examinedClueIds={examinedClueIds}
                  onMarkClueExamined={markClueExamined}
                  rulesMeta={discoveredRules.map(r => ({ id: r.id, code: r.code, title: r.title }))}
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
                  onInstallPowerFuse={handleInstallPowerFuse}
                  onToggleAuxBranch={handleToggleAuxBranch}
                  feedback={puzzleFeedback}
                />
              )}

              {activeModal === "map" && (
                <div className="map-grid">
                  {SCENES.map(s => {
                    const lockReason = checkSceneLock(s.id);
                    const isLocked = lockReason !== null;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`map-node ${scene.id === s.id ? "current" : ""} ${isLocked ? "locked" : ""}`}
                        title={lockReason ?? `Di chuyển tới ${s.id} · ${s.name}`}
                        onClick={() => go(s.id)}
                      >
                        <small>{s.id} · {s.time} {isLocked ? "· KHÓA" : scene.id === s.id ? "· HIỆN TẠI" : ""}</small>
                        <strong>{s.name}</strong>
                        {isLocked && <span className="map-lock-hint">{lockReason}</span>}
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