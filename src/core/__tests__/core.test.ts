import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTION_TAGS } from "../../types/common";
import type { EventDefinition, GameEvent } from "../../types/events";
import { ConditionEvaluator } from "../ConditionEvaluator";
import { EffectExecutor } from "../EffectExecutor";
import { EventDispatcher } from "../EventDispatcher";
import { createInitialState, GameStateStore } from "../GameStateStore";

describe("Checkpoint 02 — Core Systems Suite (CORE-01 to CORE-16)", () => {
  let store: GameStateStore;
  let evaluator: ConditionEvaluator;
  let executor: EffectExecutor;
  let dispatcher: EventDispatcher;

  beforeEach(() => {
    store = new GameStateStore(createInitialState("CH-01", "SC-01"));
    evaluator = new ConditionEvaluator();
    executor = new EffectExecutor(store);
    dispatcher = new EventDispatcher(store, evaluator, executor);
  });

  // =========================================================================
  // NHÓM 1: NGHIỆP VỤ CHƯƠNG 1 & TRẠNG THÁI BLACKBOARD (CORE-01 -> CORE-09)
  // =========================================================================

  it("CORE-01: Khởi tạo 8 biến Blackboard khóa cứng và đánh giá điều kiện khai báo không dùng eval", () => {
    const state = store.snapshot();
    expect(Object.keys(state.flags)).toHaveLength(8);
    expect(state.flags.power_mode).toBe("normal");
    expect(state.flags.radio_state).toBe("broadcasting");

    const valid = evaluator.evaluate(
      {
        all: [
          { flagEquals: { key: "power_mode", value: "normal" } },
          { not: { hasItem: "I-05" } },
          { inScene: "SC-01" }
        ]
      },
      state
    );
    expect(valid).toBe(true);
  });

  it("CORE-02: Ký tên vào sổ trực kích hoạt bẫy R-04 đặt identity_exposed = true", () => {
    const events: EventDefinition[] = [
      {
        id: "evt_trap_r04",
        triggerEvent: "PLAYER_ACTION_PERFORMED",
        eventFilter: { actionTags: [ACTION_TAGS.SIGN_LOGBOOK, ACTION_TAGS.REPORT_ID] },
        result: {
          onceId: "trap_identity_r04",
          effects: [{ type: "SET_FLAG", key: "identity_exposed", value: true }]
        }
      }
    ];
    dispatcher.registerEventDefinitions(events);

    dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.SIGN_LOGBOOK,
      targetId: "hs_logbook",
      sceneId: "SC-02"
    });

    expect(store.snapshot().flags.identity_exposed).toBe(true);
    expect(store.snapshot().triggeredOnceIds).toContain("trap_identity_r04");
  });

  it("CORE-03: Đẩy điện lên OVERLOAD kích hoạt chuỗi sự kiện R-05 làm sương mù tràn vào", () => {
    const events: EventDefinition[] = [
      {
        id: "evt_trap_r05",
        triggerEvent: "STATE_MUTATED",
        condition: { flagEquals: { key: "power_mode", value: "overload" } },
        result: {
          onceId: "trap_overload_r05",
          effects: [
            { type: "SET_FLAG", key: "fog_breached", value: true },
            { type: "SET_ENTITY_STATE", entityId: "EN-02", state: "stalking" }
          ]
        }
      }
    ];
    dispatcher.registerEventDefinitions(events);

    const followUps = executor.execute({
      effects: [{ type: "SET_FLAG", key: "power_mode", value: "overload" }]
    });
    followUps.forEach(e => dispatcher.dispatch(e));

    expect(store.snapshot().flags.fog_breached).toBe(true);
    expect(store.snapshot().entityStates["EN-02"]).toBe("stalking");
  });

  it("CORE-04: Mở tủ sắt số 04 khi có tiếng gõ kích hoạt bẫy EN-02 và kết thúc END-03", () => {
    store.setFlag("locker_knocking", true);
    store.changeScene("SC-03");

    dispatcher.registerEventDefinitions([
      {
        id: "evt_trap_r06",
        triggerEvent: "PLAYER_ACTION_PERFORMED",
        eventFilter: { actionTags: [ACTION_TAGS.OPEN_LOCKER_04], sceneIds: ["SC-03"] },
        condition: { flagEquals: { key: "locker_knocking", value: true } },
        result: {
          onceId: "trap_locker_04",
          effects: [
            { type: "SET_ENTITY_STATE", entityId: "EN-02", state: "active" },
            { type: "TRIGGER_ENDING", endingId: "END-03" }
          ]
        }
      }
    ]);

    dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.OPEN_LOCKER_04,
      targetId: "hs_locker_04",
      sceneId: "SC-03"
    });

    expect(store.snapshot().entityStates["EN-02"]).toBe("active");
    expect(store.snapshot().activeEndingId).toBe("END-03");
  });

  it("CORE-05: Hạ điện xuống LOW mở khóa điều kiện R-07 và tạm ngắt radio mở điều kiện R-08", () => {
    const r07Condition = { flagEquals: { key: "power_mode", value: "low" } };
    expect(evaluator.evaluate(r07Condition, store.snapshot())).toBe(false);

    executor.execute({
      effects: [
        { type: "SET_FLAG", key: "power_mode", value: "low" },
        { type: "MARK_PUZZLE_SOLVED", puzzleId: "PZ-03" }
      ]
    });
    expect(evaluator.evaluate(r07Condition, store.snapshot())).toBe(true);

    const canOpenLanternDoor = {
      all: [
        { puzzleSolved: "PZ-03" },
        { flagEquals: { key: "radio_state", value: "paused" } }
      ]
    };
    expect(evaluator.evaluate(canOpenLanternDoor, store.snapshot())).toBe(false);

    executor.execute({
      effects: [{ type: "SET_FLAG", key: "radio_state", value: "paused" }]
    });
    expect(evaluator.evaluate(canOpenLanternDoor, store.snapshot())).toBe(true);
  });

  it("CORE-06: Lắp kính lọc đỏ tiêu thụ I-05 và đặt red_filter_installed = true hóa giải R-03", () => {
    const r03ViolationCond = { flagEquals: { key: "red_filter_installed", value: false } };
    expect(evaluator.evaluate(r03ViolationCond, store.snapshot())).toBe(true);

    executor.execute({
      effects: [{ type: "ADD_ITEM", itemId: "I-05" }]
    });
    expect(store.snapshot().inventoryItemIds).toContain("I-05");

    executor.execute({
      effects: [
        { type: "REMOVE_ITEM", itemId: "I-05" },
        { type: "SET_FLAG", key: "red_filter_installed", value: true }
      ]
    });

    expect(store.snapshot().inventoryItemIds).not.toContain("I-05");
    expect(store.snapshot().flags.red_filter_installed).toBe(true);
    expect(evaluator.evaluate(r03ViolationCond, store.snapshot())).toBe(false);
  });

  it("CORE-07: Đọc hồ sơ Trạm Trưởng biến đổi R-09 và bật đèn pin khi R-10 biến đổi kích hoạt vi phạm", () => {
    dispatcher.registerEventDefinitions([
      {
        id: "evt_transform_r09",
        triggerEvent: "STATE_MUTATED",
        condition: { flagEquals: { key: "captain_missing_confirmed", value: true } },
        result: {
          onceId: "transform_ch01_r09",
          effects: [{ type: "SET_RULE_LIFECYCLE", ruleId: "R-09", state: "transformed" as const }]
        }
      }
    ]);

    const emitted = executor.execute({
      effects: [{ type: "SET_FLAG", key: "captain_missing_confirmed", value: true }]
    });
    emitted.forEach(e => dispatcher.dispatch(e));
    expect(store.snapshot().ruleLifecycleStates["R-09"]).toBe("transformed");

    const r10ViolationCond = {
      all: [
        { ruleLifecycleIs: { ruleId: "R-10", state: "transformed" as const } },
        { flagEquals: { key: "flashlight_on", value: true } }
      ]
    };

    executor.execute({
      effects: [
        { type: "SET_RULE_LIFECYCLE", ruleId: "R-10", state: "transformed" as const },
        { type: "SET_FLAG", key: "flashlight_on", value: true }
      ]
    });
    expect(evaluator.evaluate(r10ViolationCond, store.snapshot())).toBe(true);
  });

  it("CORE-08: Xuất và khôi phục SaveData hợp lệ theo engineSchemaVersion", () => {
    store.setFlag("fog_breached", true);
    const save = store.exportSave("slot-test", { "CH-01": "1.0.0" });

    const second = new GameStateStore(createInitialState());
    expect(second.importSave(save)).toBe(true);
    expect(second.snapshot().flags.fog_breached).toBe(true);

    const invalidSave = { ...save, engineSchemaVersion: 999 };
    expect(second.importSave(invalidSave)).toBe(false);
  });

  it("CORE-09: Khóa onceId trước khi chạy EffectBlock ngăn chặn thực thi lặp lại", () => {
    const block = {
      onceId: "once-r04-trap",
      effects: [{ type: "INC_FLAG" as const, key: "alert_count", amount: 1 }]
    };

    executor.execute(block);
    executor.execute(block);

    expect(store.snapshot().flags.alert_count).toBe(1);
    expect(store.snapshot().triggeredOnceIds).toEqual(["once-r04-trap"]);
  });

  // =========================================================================
  // NHÓM 2: KIỂM THỬ KỸ THUẬT & BIÊN KIẾN TRÚC (CORE-10 -> CORE-16)
  // =========================================================================

  it("CORE-10: Nhặt vật phẩm, tiêu thụ, quay lại Scene không thể nhặt lại", () => {
    const firstPickup = executor.execute({
      effects: [{ type: "ADD_ITEM", itemId: "I-04" }]
    });
    expect(firstPickup).toHaveLength(1);
    expect(store.snapshot().inventoryItemIds).toEqual(["I-04"]);
    expect(store.snapshot().collectedItemIds).toEqual(["I-04"]);

    executor.execute({
      effects: [{ type: "REMOVE_ITEM", itemId: "I-04" }]
    });
    expect(store.snapshot().inventoryItemIds).toEqual([]);

    const secondPickup = executor.execute({
      effects: [{ type: "ADD_ITEM", itemId: "I-04" }]
    });
    expect(secondPickup).toHaveLength(0);
    expect(store.snapshot().inventoryItemIds).toEqual([]);
  });

  it("CORE-11: Biến đổi một Rule hai lần chỉ phát duy nhất một sự kiện RULE_TRANSFORMED", () => {
    const firstTransform = executor.execute({
      effects: [{ type: "SET_RULE_LIFECYCLE", ruleId: "R-09", state: "transformed" as const }]
    });
    const secondTransform = executor.execute({
      effects: [{ type: "SET_RULE_LIFECYCLE", ruleId: "R-09", state: "transformed" as const }]
    });

    expect(firstTransform.filter(e => e.type === "RULE_TRANSFORMED")).toHaveLength(1);
    expect(secondTransform).toHaveLength(0);
  });

  it("CORE-12: Subscriber phát sinh lỗi không làm sập hàng đợi hay ảnh hưởng subscriber khác", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const receivedByHealthySubscriber: GameEvent[] = [];

    dispatcher.subscribe(() => {
      throw new Error("Simulated broken Entity subscriber");
    });
    dispatcher.subscribe(event => {
      receivedByHealthySubscriber.push(event);
    });

    dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.INSPECT_OBJECT,
      targetId: "hs_desk",
      sceneId: "SC-01"
    });

    expect(receivedByHealthySubscriber).toHaveLength(1);
    expect(receivedByHealthySubscriber[0].type).toBe("PLAYER_ACTION_PERFORMED");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("CORE-13: Chuỗi sự kiện chuyển Scene giữ đúng ngữ cảnh scene trước, trong và sau CHANGE_SCENE", () => {
    store.changeScene("SC-02");
    const capturedEvents: GameEvent[] = [];
    dispatcher.subscribe(event => capturedEvents.push(event));

    dispatcher.registerEventDefinitions([
      {
        id: "evt_on_enter_sc03",
        triggerEvent: "SCENE_ENTERED",
        eventFilter: { sceneIds: ["SC-03"] },
        result: {
          onceId: "enter_sc03_log",
          effects: [{ type: "SET_FLAG", key: "entered_sc03_verified", value: true }]
        }
      }
    ]);

    const initialBatch = executor.execute({
      effects: [
        { type: "DISCOVER_CLUE", clueId: "C-01" },
        { type: "CHANGE_SCENE", sceneId: "SC-03" },
        { type: "SET_FLAG", key: "flag_after_scene_change", value: true }
      ]
    });
    initialBatch.forEach(e => dispatcher.dispatch(e));

    const clueEvent = capturedEvents.find(e => e.type === "CLUE_ADDED");
    const sceneEnterEvent = capturedEvents.find(e => e.type === "SCENE_ENTERED");
    const flagBeforeEnterEvent = capturedEvents.find(
      e => e.type === "STATE_MUTATED" && e.changedFlags.includes("flag_after_scene_change")
    );
    const flagAfterEnterEvent = capturedEvents.find(
      e => e.type === "STATE_MUTATED" && e.changedFlags.includes("entered_sc03_verified")
    );

    expect(clueEvent?.sceneId).toBe("SC-02");
    expect(flagBeforeEnterEvent?.sceneId).toBe("SC-02");
    expect(sceneEnterEvent?.sceneId).toBe("SC-03");
    expect(flagAfterEnterEvent?.sceneId).toBe("SC-03");
  });

  it("CORE-14: Snapshot trả về độc lập, sửa trực tiếp không làm thay đổi trạng thái thật", () => {
    const snapshot = store.snapshot() as unknown as {
      flags: Record<string, unknown>;
      inventoryItemIds: string[];
    };

    snapshot.flags.power_mode = "overload";
    snapshot.inventoryItemIds.push("HACKED_ITEM");

    expect(store.snapshot().flags.power_mode).toBe("normal");
    expect(store.snapshot().inventoryItemIds).not.toContain("HACKED_ITEM");
  });

  it("CORE-15: EventDispatcher ngắt vòng lặp vô hạn khi vượt quá 50 sự kiện/lượt và ghi log lỗi", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    dispatcher.registerEventDefinitions([
      {
        id: "loop_a_to_b",
        triggerEvent: "STATE_MUTATED",
        condition: { flagEquals: { key: "power_mode", value: "normal" } },
        result: { effects: [{ type: "SET_FLAG", key: "power_mode", value: "low" }] }
      },
      {
        id: "loop_b_to_a",
        triggerEvent: "STATE_MUTATED",
        condition: { flagEquals: { key: "power_mode", value: "low" } },
        result: { effects: [{ type: "SET_FLAG", key: "power_mode", value: "normal" }] }
      }
    ]);

    dispatcher.dispatch({
      type: "STATE_MUTATED",
      changedFlags: ["power_mode"],
      sceneId: "SC-04"
    });

    const logs = store.snapshot().logs;
    expect(logs.some(l => l.includes("Loop guard triggered"))).toBe(true);
    errorSpy.mockRestore();
  });

  it("CORE-16: Bảo vệ kết luận điều tra không hạ cấp và chuyển sang conflicted khi đối nghịch", () => {
    executor.execute({
      effects: [{ type: "SET_INVESTIGATION_STATUS", ruleId: "R-04", status: "verified" }]
    });
    expect(store.snapshot().investigationStatuses["R-04"]).toBe("verified");

    // Không cho phép hạ cấp xuống 'supported'
    executor.execute({
      effects: [{ type: "SET_INVESTIGATION_STATUS", ruleId: "R-04", status: "supported" }]
    });
    expect(store.snapshot().investigationStatuses["R-04"]).toBe("verified");

    // Kết luận trái chiều ('debunked_fake') đẩy trạng thái sang 'conflicted'
    executor.execute({
      effects: [{ type: "SET_INVESTIGATION_STATUS", ruleId: "R-04", status: "debunked_fake" }]
    });
    expect(store.snapshot().investigationStatuses["R-04"]).toBe("conflicted");
  });
});