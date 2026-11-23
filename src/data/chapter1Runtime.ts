import { ACTION_TAGS, type PuzzleDefinition, type PuzzleSolution } from "../types/common";
import type { EventDefinition } from "../types/events";
import type { RuleDefinition } from "../types/rules";
import type { GameState } from "../types/save";
import { ConditionEvaluator } from "../core/ConditionEvaluator";
import { EffectExecutor } from "../core/EffectExecutor";
import { EventDispatcher } from "../core/EventDispatcher";
import { createInitialState, GameStateStore, type DeepReadonly } from "../core/GameStateStore";
import { ArchiveSystem } from "../systems/ArchiveSystem";
import { DialogueSystem } from "../systems/DialogueSystem";
import { InvestigationSystem } from "../systems/InvestigationSystem";
import { PuzzleSystem } from "../systems/PuzzleSystem";
import { RuleSystem } from "../systems/RuleSystem";
import { CHAPTER1_ARCHIVE_DOCUMENTS } from "./chapter1Archive";
import { CHAPTER1_DIALOGUES } from "./chapter1Dialogues";
import { CHAPTER1_CLUES, CHAPTER1_DEDUCTION_GROUPS } from "./chapter1Investigation";
import { CHAPTER1_CHARACTERS } from "./characters";

export interface SceneMeta {
  id: string;
  name: string;
  time: string;
  description: string;
  detail: string;
}

export const CHAPTER1_SCENES: readonly SceneMeta[] = [
  {
    id: "SC-01",
    name: "Cổng trạm",
    time: "23:40",
    description:
      "Cánh cổng sắt ngăn cách bạn với con đường dẫn vào trạm. Sương trắng đang áp sát hàng rào. Một chiếc đèn pin cũ nằm trên bệ gác.",
    detail: "Phía sau lớp sương, ánh đèn hải đăng vẫn quay đều. Không có bóng người ở vọng gác."
  },
  {
    id: "SC-02",
    name: "Phòng trực",
    time: "00:15",
    description:
      "Máy bộ đàm phát ra tiếng rè đều đặn. Cuốn sổ trực, hồ sơ nhân sự và máy phát băng cassette nằm trên mặt bàn gỗ.",
    detail: "Bản tin thời tiết vừa in ra có một dòng mô tả chính xác bộ quần áo bạn đang mặc."
  },
  {
    id: "SC-03",
    name: "Khu nghỉ nhân viên",
    time: "00:35",
    description:
      "Những chiếc giường sắt xếp ngay ngắn dọc vách tường. Dãy tủ cá nhân đứng im lìm trong ánh đèn mờ.",
    detail: "Tủ dụng cụ bên trái bị khóa chặt. Ở góc hành lang, tủ đồ số 04 thỉnh thoảng rung nhẹ."
  },
  {
    id: "SC-04",
    name: "Phòng máy",
    time: "01:10",
    description:
      "Tổ máy phát điện kêu trầm đục. Sơ đồ tải điện được ghim ngay cạnh bảng điều khiển trung tâm.",
    detail: "Một nhánh điện phụ đang dao động bất thường. Công tắc OVERLOAD được đặt cạnh công tắc tải thường."
  },
  {
    id: "SC-05",
    name: "Phòng quan sát",
    time: "01:55",
    description:
      "Màn hình radar phủ đầy nhiễu tĩnh điện. Một vết xước hình bán nguyệt hằn sâu trên mặt kính.",
    detail: "Dưới gầm bàn thiết bị có một ngăn kéo khóa chốt số. Màn hình CCTV hành lang vẫn đang ghi hình."
  },
  {
    id: "SC-06",
    name: "Buồng đèn",
    time: "02:30",
    description:
      "Thấu kính Fresnel khổng lồ chiếm trọn trung tâm căn phòng, xoay đều phát ra luồng sáng lạnh lẽo.",
    detail: "Bên cạnh trụ thấu kính có khay lắp kính lọc quang học và bảng điều khiển tần số phát."
  }
];

export const CHAPTER1_SCENE_RULE_UNLOCKS: Record<string, string[]> = {
  "SC-01": ["R-01", "R-10"],
  "SC-02": ["R-02", "R-04", "R-09"],
  "SC-03": ["R-06"],
  "SC-04": ["R-05"],
  "SC-05": ["R-07", "R-08"],
  "SC-06": ["R-03"]
};

export const CHAPTER1_ITEMS: Record<string, { name: string; note: string }> = {
  "I-01": {
    name: "Đèn pin",
    note: "Đèn pin cầm tay. Bấm vào ô vật phẩm để Bật/Tắt (lưu ý Quy tắc 10 khi sương tràn hoặc điện LOW)."
  },
  "I-02": {
    name: "Chìa khóa tủ",
    note: "Chìa khóa đồng khắc số 03, dùng mở tủ dụng cụ tại Khu nghỉ nhân viên (SC-03)."
  },
  "I-03": {
    name: "Băng cassette",
    note: "Cuộn băng ghi âm hai mặt tìm thấy trong tủ dụng cụ. Phát bằng máy cassette tại Phòng trực (SC-02)."
  },
  "I-04": {
    name: "Cầu chì 30A",
    note: "Cầu chì công nghiệp chịu tải cao dùng cho bảng mạch Phòng máy (SC-04)."
  },
  "I-05": {
    name: "Bộ lọc đỏ",
    note: "Kính lọc quang học bước sóng > 620nm. Lắp vào khay thấu kính tại Buồng đèn (SC-06)."
  },
  "I-06": {
    name: "Sổ mã tần số",
    note: "Bảng hiệu chuẩn liên động chuỗi hải đăng: Trạm 07 = 6162 Hz | Trạm 08 = 6185 Hz | Trạm 09 = [Tần số Trạm 08 cộng thêm bước sóng chuẩn +23 Hz]."
  }
};

export const CHAPTER1_DEATH_REASONS = {
  R01_EXTERIOR_DOOR:
    "Bạn đã mở cửa ngoài khi sương trắng áp sát hàng rào (Vi phạm R-01). Làn sương tràn thẳng vào trạm và cắt đứt mọi lối thoát.",
  R02_RADIO:
    "Bạn đã trả lời micro bộ đàm khi bản tin thời tiết đang phát sóng (Vi phạm R-02). Sóng vô tuyến đã thu giữ giọng nói và ghi đè danh tính của bạn.",
  R03_LANTERN_BEAM:
    "Bạn đã bước vào chùm sáng trắng nguyên bản của thấu kính khi chưa lắp kính lọc quang học đỏ (Vi phạm R-03). Cảm biến buồng đèn đã ghi nhận toàn bộ dấu vết sinh học của bạn.",
  R04_SIGN:
    "Bạn đã ký tên vào sổ trực (Bẫy R-04). Mực trên trang giấy đã ghi nhận chữ ký và hoàn tất ghi đè danh tính của bạn.",
  R04_REPORT:
    "Bạn đã đọc mã nhân viên qua bộ đàm (Bẫy R-04). Tín hiệu phản hồi đã sao chép mã định danh và hoàn tất ghi đè danh tính của bạn.",
  R05_OVERLOAD:
    "Bạn đã đẩy nguồn điện sang chế độ OVERLOAD (Bẫy R-05). Thấu kính Fresnel quét xuyên vách ngăn toàn trạm, làm nổ rơ-le khóa cổng và hoàn tất ghi đè danh tính của bạn.",
  R06_LOCKER_04:
    "Bạn đã mở tủ đồ số 04 khi nghe tiếng gõ ba nhịp (Bẫy R-06). Thực thể bên trong (EN-02) lập tức đoạt lấy bóng dáng của bạn.",
  R09_PHONE:
    "Bạn đã nhấc điện thoại nội bộ (Vi phạm R-09). Đầu dây bên kia gọi đúng tên bạn bằng giọng trẻ nhỏ và hoàn tất ghi đè danh tính của bạn."
} as const;

export const CHAPTER1_RULES: RuleDefinition[] = [
  {
    id: "R-01",
    code: "QUY TẮC 01",
    title: "Cánh cổng trong sương",
    type: "true",
    scope: "Toàn trạm",
    baseText: "Không mở cửa ra ngoài khi sương mù đang áp sát chân tường trạm.",
    violationTriggers: [
      {
        actionTag: ACTION_TAGS.OPEN_EXTERIOR_DOOR,
        condition: {
          any: [
            { triggeredOnce: "fog_approaching_door" },
            { flagEquals: { key: "fog_breached", value: true } }
          ]
        }
      }
    ],
    maxViolations: 1,
    onViolate: {
      effects: [
        { type: "SET_FLAG", key: "fog_breached", value: true },
        { type: "SET_ENTITY_STATE", entityId: "EN-01", state: "stalking" },
        { type: "TRIGGER_FX", fx: "red_flash", durationMs: 650 },
        {
          type: "SHOW_LOG",
          message: "[VI PHẠM R-01] Cửa ngoài bật mở: sương trắng (EN-01) tràn thẳng vào trạm và cắt đứt lối thoát."
        },
        { type: "SET_DEATH_REASON", reason: CHAPTER1_DEATH_REASONS.R01_EXTERIOR_DOOR },
        { type: "TRIGGER_ENDING", endingId: "END-03" }
      ]
    },
    countermeasureHint: "Không mở cửa ngoài."
  },
  {
    id: "R-02",
    code: "QUY TẮC 02",
    title: "Bản tin vô tuyến",
    type: "true",
    scope: "SC-02 · Phòng trực",
    baseText: "Khi bản tin mô tả bạn, hãy tạm dừng bộ đàm. Không trả lời micro.",
    violationTriggers: [
      {
        actionTag: ACTION_TAGS.ANSWER_RADIO,
        condition: { flagEquals: { key: "radio_state", value: "broadcasting" } }
      }
    ],
    maxViolations: 1,
    onViolate: {
      effects: [
        { type: "SHOW_LOG", message: "[VI PHẠM R-02] Bộ đàm đã ghi nhận giọng nói của bạn." },
        {
          type: "RECORD_IDENTITY_OVERWRITE",
          onceKey: "overwrite_r02_radio",
          reason: CHAPTER1_DEATH_REASONS.R02_RADIO
        }
      ]
    },
    countermeasureHint: "Tạm dừng bộ đàm trước khi tương tác."
  },
  {
    id: "R-03",
    code: "QUY TẮC 03",
    title: "Vùng sáng trung tâm",
    type: "true",
    scope: "SC-06 · Buồng đèn",
    baseText: "Không bước vào vùng sáng trung tâm trước khi lắp bộ lọc đỏ.",
    violationTriggers: [
      {
        actionTag: ACTION_TAGS.ENTER_LANTERN_BEAM,
        condition: { flagEquals: { key: "red_filter_installed", value: false } }
      }
    ],
    maxViolations: 1,
    onViolate: {
      effects: [
        { type: "TRIGGER_FX", fx: "red_flash", durationMs: 650 },
        {
          type: "SHOW_LOG",
          message: "[VI PHẠM R-03] Chùm sáng trắng nguyên bản của thấu kính Fresnel đã quét trực tiếp qua bạn."
        },
        { type: "SET_DEATH_REASON", reason: CHAPTER1_DEATH_REASONS.R03_LANTERN_BEAM },
        { type: "TRIGGER_ENDING", endingId: "END-03" }
      ]
    },
    countermeasureHint: "Lắp bộ lọc đỏ trước khi tiếp cận thấu kính."
  },
  {
    id: "R-04",
    code: "QUY TẮC 04",
    title: "Sổ đăng ký nhân sự",
    type: "fake",
    scope: "SC-02 · Phòng trực",
    baseText: "Hãy ký tên vào sổ trực và báo mã nhân viên qua bộ đàm.",
    violationTriggers: [],
    countermeasureHint: "Không cung cấp danh tính."
  },
  {
    id: "R-05",
    code: "QUY TẮC 05",
    title: "Chế độ quá tải",
    type: "fake",
    scope: "SC-04 · Phòng máy",
    baseText: "Khi đèn hành lang chuyển đỏ, hãy đặt nguồn điện ở chế độ OVERLOAD.",
    violationTriggers: [],
    countermeasureHint: "Đối chiếu sơ đồ tải điện trước khi đổi chế độ."
  },
  {
    id: "R-06",
    code: "QUY TẮC 06",
    title: "Tủ đồ số 04",
    type: "fake",
    scope: "SC-03 · Khu nghỉ",
    baseText: "Khi nghe ba tiếng gõ, hãy mở tủ đồ số 04.",
    violationTriggers: [],
    countermeasureHint: "Không mở tủ khi có tiếng gõ."
  },
  {
    id: "R-07",
    code: "QUY TẮC 07",
    title: "Thiết bị quan sát",
    type: "conditional",
    scope: "SC-05 · Phòng quan sát",
    baseText: "Thiết bị quan sát chỉ hoạt động an toàn khi nguồn điện ở chế độ LOW.",
    activeCondition: {
      any: [{ inScene: "SC-05" }, { flagEquals: { key: "power_mode", value: "low" } }]
    },
    violationTriggers: [
      {
        actionTag: ACTION_TAGS.USE_OBSERVATION_GEAR,
        condition: { not: { flagEquals: { key: "power_mode", value: "low" } } }
      }
    ],
    maxViolations: 1,
    onViolate: {
      effects: [
        { type: "SHOW_LOG", message: "[VI PHẠM R-07] Thiết bị bị nhiễu cao tần và không thể đọc dữ liệu." }
      ]
    },
    countermeasureHint: "Chuyển nguồn điện về LOW."
  },
  {
    id: "R-08",
    code: "QUY TẮC 08",
    title: "Khóa liên động",
    type: "true",
    scope: "SC-05 → SC-06",
    baseText: "Cửa buồng đèn chỉ được mở khi bộ đàm đã tạm dừng.",
    violationTriggers: [
      {
        actionTag: ACTION_TAGS.OPEN_LANTERN_DOOR,
        condition: { not: { flagEquals: { key: "radio_state", value: "paused" } } }
      }
    ],
    maxViolations: 1,
    onViolate: {
      effects: [{ type: "SHOW_LOG", message: "[VI PHẠM R-08] Khóa liên động từ chối mở cửa buồng đèn." }]
    },
    countermeasureHint: "Tạm dừng bộ đàm."
  },
  {
    id: "R-09",
    code: "QUY TẮC 09",
    title: "Điện thoại nội bộ",
    type: "transforming",
    scope: "SC-02 · Phòng trực",
    baseText: "Hãy nhấc điện thoại nội bộ để nhận chỉ thị từ trạm trưởng.",
    transformCondition: { flagEquals: { key: "captain_missing_confirmed", value: true } },
    transformedText: "Trạm trưởng đã mất tích. Không nghe điện thoại nội bộ; hãy ngắt kết nối.",
    violationTriggers: [
      {
        actionTag: ACTION_TAGS.ANSWER_PHONE,
        condition: {
          all: [
            { flagEquals: { key: "captain_missing_confirmed", value: true } },
            { not: { triggeredOnce: "phone_disconnected" } }
          ]
        }
      }
    ],
    maxViolations: 1,
    onViolate: {
      effects: [
        {
          type: "SHOW_LOG",
          message: "[VI PHẠM R-09] Đầu dây bên kia gọi đúng tên bạn bằng giọng trẻ nhỏ."
        },
        {
          type: "RECORD_IDENTITY_OVERWRITE",
          onceKey: "overwrite_r09_phone",
          reason: CHAPTER1_DEATH_REASONS.R09_PHONE
        }
      ]
    },
    countermeasureHint: "Xác minh hồ sơ nhân sự trước khi nghe máy."
  },
  {
    id: "R-10",
    code: "QUY TẮC 10",
    title: "Nguồn sáng nhân tạo",
    type: "transforming",
    scope: "Toàn trạm",
    baseText: "Luôn bật đèn pin khi di chuyển trong khu vực tối.",
    transformCondition: {
      any: [
        { flagEquals: { key: "fog_breached", value: true } },
        { flagEquals: { key: "power_mode", value: "low" } }
      ]
    },
    transformedText: "Tắt mọi nguồn sáng nhân tạo trước khi di chuyển. Sương đang hướng về phía ánh sáng.",
    violationTriggers: [
      {
        actionTag: ACTION_TAGS.LEAVE_SCENE,
        condition: {
          all: [
            {
              any: [
                { ruleLifecycleIs: { ruleId: "R-10", state: "transformed" } },
                { flagEquals: { key: "fog_breached", value: true } },
                { flagEquals: { key: "power_mode", value: "low" } }
              ]
            },
            { flagEquals: { key: "flashlight_on", value: true } }
          ]
        }
      }
    ],
    maxViolations: 1,
    onViolate: {
      effects: [{ type: "SHOW_LOG", message: "[VI PHẠM R-10] Sương bắt đầu di chuyển theo ánh đèn pin." }]
    },
    countermeasureHint: "Tắt đèn pin trước khi rời cảnh."
  }
];

export const R05_OVERLOAD_EFFECT_BLOCK = {
  onceId: "once_r05_overload",
  effects: [
    { type: "SET_FLAG" as const, key: "power_mode", value: "overload" },
    { type: "SET_FLAG" as const, key: "fog_breached", value: true },
    { type: "SET_ENTITY_STATE" as const, entityId: "EN-01", state: "stalking" as const },
    { type: "TRIGGER_FX" as const, fx: "red_flash" as const, durationMs: 650 },
    {
      type: "SHOW_LOG" as const,
      message: "[BẪY QUY TẮC R-05] Cầu dao quá tải làm nổ khóa cổng ngoài. Sương tràn vào hành lang!"
    },
    {
      type: "RECORD_IDENTITY_OVERWRITE" as const,
      onceKey: "overwrite_r05_overload",
      reason: CHAPTER1_DEATH_REASONS.R05_OVERLOAD
    }
  ]
};

export const CHAPTER1_EVENT_DEFINITIONS: EventDefinition[] = [
  {
    id: "EV-SC01-FOG-APPROACH",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: { actionTags: [ACTION_TAGS.INSPECT_OBJECT], targetIds: ["exterior_gate"], sceneIds: ["SC-01"] },
    result: {
      onceId: "fog_approaching_door",
      effects: [
        {
          type: "SHOW_LOG",
          message: "[HIỆN TRƯỜNG SC-01] Qua khe cổng sắt, làn sương trắng đã dồn áp sát chân tường trạm."
        }
      ]
    }
  },
  {
    id: "EV-SC01-FOG-SURROUNDS",
    triggerEvent: "SCENE_ENTERED",
    eventFilter: { sceneIds: ["SC-02", "SC-03", "SC-04", "SC-05", "SC-06"] },
    result: {
      onceId: "fog_approaching_door",
      effects: [
        {
          type: "SHOW_LOG",
          message: "[HIỆN TRƯỜNG] Màn sương trắng bên ngoài đã dồn áp sát toàn bộ hàng rào và cửa ngoài Trạm 09."
        }
      ]
    }
  },
  {
    id: "EV-SC01-DOOR-SAFE",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: { actionTags: [ACTION_TAGS.OPEN_EXTERIOR_DOOR], sceneIds: ["SC-01"] },
    condition: {
      not: {
        any: [
          { triggeredOnce: "fog_approaching_door" },
          { flagEquals: { key: "fog_breached", value: true } }
        ]
      }
    },
    result: {
      effects: [
        {
          type: "SHOW_LOG",
          message: "[CỬA NGOÀI SC-01] Chốt cổng sắt vẫn khóa từ bên ngoài. Ngoài sân, màn sương trắng bắt đầu tụ lại."
        }
      ]
    }
  },
  {
    id: "EV-SC02-PHONE-INITIAL",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: { actionTags: [ACTION_TAGS.ANSWER_PHONE], sceneIds: ["SC-02"] },
    condition: {
      all: [
        { not: { flagEquals: { key: "captain_missing_confirmed", value: true } } },
        { not: { triggeredOnce: "phone_disconnected" } }
      ]
    },
    result: {
      effects: [
        {
          type: "SHOW_LOG",
          message:
            "[ĐIỆN THOẠI NỘI BỘ SC-02] Chỉ có tiếng rè đường truyền nội bộ; chưa thấy ai trả lời từ phòng trạm trưởng."
        }
      ]
    }
  },
  {
    id: "EV-SC02-DISCONNECT-PHONE",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: { actionTags: [ACTION_TAGS.DISCONNECT_PHONE], sceneIds: ["SC-02"] },
    result: {
      onceId: "phone_disconnected",
      effects: [
        {
          type: "SHOW_LOG",
          message: "[ĐỐI PHÓ R-09] Bạn đã rút phích cắm dây điện thoại nội bộ khỏi ổ nối bàn trực."
        }
      ]
    }
  },
  {
    id: "EV-SC02-CASSETTE-SIDE-B",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: { actionTags: [ACTION_TAGS.USE_ITEM], targetIds: ["cassette_side_b"], sceneIds: ["SC-02"] },
    condition: { hasItem: "I-03" },
    result: {
      onceId: "cassette_side_b_heard",
      effects: [
        {
          type: "SHOW_LOG",
          message:
            "[MẶT B · BĂNG CASSETTE GỐC] Bản ghi âm gốc giọng con gái Lê Văn Hùng có nhịp thở và ngữ điệu tự nhiên — hoàn toàn khác giọng bắt chước qua điện thoại nội bộ."
        }
      ]
    }
  },
  {
    id: "EV-SC03-LOCKER-KNOCKING",
    triggerEvent: "SCENE_ENTERED",
    eventFilter: { sceneIds: ["SC-03"] },
    result: {
      onceId: "once_sc03_enter_knocking",
      effects: [
        { type: "SET_FLAG", key: "locker_knocking", value: true },
        {
          type: "SHOW_LOG",
          message: "[HIỆN TRƯỜNG SC-03] Từ bên trong tủ đồ số 04 vang lên ba tiếng gõ chậm rãi: cốc... cốc... cốc."
        }
      ]
    }
  },
  {
    id: "EV-SC03-LOCKER04-SAFE",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: { actionTags: [ACTION_TAGS.OPEN_LOCKER_04], sceneIds: ["SC-03"] },
    condition: { not: { flagEquals: { key: "locker_knocking", value: true } } },
    result: {
      effects: [
        {
          type: "SHOW_LOG",
          message: "[TỦ ĐỒ SỐ 04] Bên trong cánh tủ thép trống rỗng, không phát hiện chuyển động bất thường."
        }
      ]
    }
  },
  {
    id: "EV-SC04-INSTALL-FUSE",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: { actionTags: [ACTION_TAGS.USE_ITEM], targetIds: ["power_fuse_slot"], sceneIds: ["SC-04"] },
    condition: { hasItem: "I-04" },
    result: {
      onceId: "once_sc04_install_fuse",
      effects: [
        { type: "INSTALL_POWER_FUSE" },
        {
          type: "SHOW_LOG",
          message: "[PHÒNG MÁY SC-04] Đã lắp Cầu chì 30A (I-04) vào khe bảo vệ trên bảng cân bằng tải."
        }
      ]
    }
  },
  {
    id: "EV-SC04-AUX-OFF",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: { actionTags: [ACTION_TAGS.USE_ITEM], targetIds: ["aux_branch_off"], sceneIds: ["SC-04"] },
    result: {
      effects: [
        { type: "SET_AUX_BRANCH_OFF", value: true },
        {
          type: "SHOW_LOG",
          message: "[PHÒNG MÁY SC-04] Đã ngắt công tắc nhánh điện phụ (AUX OFF)."
        }
      ]
    }
  },
  {
    id: "EV-SC04-AUX-ON",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: { actionTags: [ACTION_TAGS.USE_ITEM], targetIds: ["aux_branch_on"], sceneIds: ["SC-04"] },
    result: {
      effects: [
        { type: "SET_AUX_BRANCH_OFF", value: false },
        {
          type: "SHOW_LOG",
          message: "[PHÒNG MÁY SC-04] Đã đóng lại công tắc nhánh điện phụ (AUX ON)."
        }
      ]
    }
  },
  {
    id: "EV-R04-SIGN",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: { actionTags: [ACTION_TAGS.SIGN_LOGBOOK], sceneIds: ["SC-02"] },
    result: {
      onceId: "once_r04_sign",
      effects: [
        {
          type: "SHOW_LOG",
          message:
            "[BẪY QUY TẮC R-04] Mực trên trang sổ trực thấm ngược vào giấy. Danh tính của bạn đã bị ghi nhận."
        },
        {
          type: "RECORD_IDENTITY_OVERWRITE",
          onceKey: "overwrite_r04_sign",
          reason: CHAPTER1_DEATH_REASONS.R04_SIGN
        }
      ]
    }
  },
  {
    id: "EV-R04-REPORT",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: { actionTags: [ACTION_TAGS.REPORT_ID], sceneIds: ["SC-02"] },
    result: {
      onceId: "once_r04_report",
      effects: [
        {
          type: "SHOW_LOG",
          message: "[BẪY QUY TẮC R-04] Tín hiệu phản hồi lặp lại đúng mã nhân viên bạn vừa đọc."
        },
        {
          type: "RECORD_IDENTITY_OVERWRITE",
          onceKey: "overwrite_r04_report",
          reason: CHAPTER1_DEATH_REASONS.R04_REPORT
        }
      ]
    }
  },
  {
    id: "EV-R05-OVERLOAD",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: {
      actionTags: [ACTION_TAGS.USE_ITEM],
      targetIds: ["power_overload_switch"],
      sceneIds: ["SC-04"]
    },
    result: R05_OVERLOAD_EFFECT_BLOCK
  },
  {
    id: "EV-R06-LOCKER04",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: { actionTags: [ACTION_TAGS.OPEN_LOCKER_04], sceneIds: ["SC-03"] },
    condition: { flagEquals: { key: "locker_knocking", value: true } },
    result: {
      onceId: "once_r06_locker04",
      effects: [
        { type: "SET_ENTITY_STATE", entityId: "EN-02", state: "stalking" },
        { type: "TRIGGER_FX", fx: "red_flash", durationMs: 650 },
        {
          type: "SHOW_LOG",
          message: "[BẪY QUY TẮC R-06] Bóng đen (EN-02) trườn ra từ khe tủ số 04 trước khi bạn kịp sập cửa!"
        },
        { type: "SET_DEATH_REASON", reason: CHAPTER1_DEATH_REASONS.R06_LOCKER_04 },
        { type: "TRIGGER_ENDING", endingId: "END-03" }
      ]
    }
  },
  {
    id: "EV-SC06-ENDING-S",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: {
      actionTags: [ACTION_TAGS.INVERT_SIGNAL_FREQUENCY],
      targetIds: ["frequency_ending_s", "frequency_panel"],
      sceneIds: ["SC-06"]
    },
    condition: {
      all: [
        { inScene: "SC-06" },
        { flagEquals: { key: "red_filter_installed", value: true } },
        { flagEquals: { key: "identity_exposed", value: false } },
        { hasClue: "C-05" },
        { hasClue: "C-08" },
        { triggeredOnce: "cassette_side_b_heard" },
        { ruleStatusIs: { ruleId: "R-03", status: "verified" } },
        { ruleStatusIs: { ruleId: "R-04", status: "debunked_fake" } },
        { ruleStatusIs: { ruleId: "R-05", status: "debunked_fake" } }
      ]
    },
    result: {
      effects: [
        {
          type: "SHOW_LOG",
          message: "[BUỒNG ĐÈN SC-06] Tín hiệu đảo pha ở bước sóng 620nm xóa sạch vòng lặp âm thanh giả mạo tại Trạm 09."
        },
        { type: "TRIGGER_ENDING", endingId: "END-01" }
      ]
    }
  },
  {
    id: "EV-SC06-INVERT-RECOVERY",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: {
      actionTags: [ACTION_TAGS.INVERT_SIGNAL_FREQUENCY],
      targetIds: ["frequency_recovery_panel", "frequency_panel"],
      sceneIds: ["SC-06"]
    },
    condition: {
      all: [
        { flagEquals: { key: "red_filter_installed", value: true } },
        { hasClue: "C-07" },
        { flagEquals: { key: "identity_exposed", value: true } }
      ]
    },
    result: {
      onceId: "once_sc06_invert_recovery",
      effects: [
        { type: "SET_FLAG", key: "identity_exposed", value: false },
        {
          type: "SHOW_LOG",
          message:
            "[ĐẢO PHA TẦN SỐ · C-07] Dữ liệu danh tính tồn dư trong buồng đèn đã được xóa (hồ sơ vẫn lưu vết ghi đè 1/2)."
        }
      ]
    }
  },
  {
    id: "EV-SC06-ENDING-B",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: { actionTags: [ACTION_TAGS.CUT_MAIN_RELAY], sceneIds: ["SC-06"] },
    condition: {
      all: [
        { inScene: "SC-06" },
        { flagEquals: { key: "red_filter_installed", value: true } },
        { flagEquals: { key: "identity_exposed", value: false } }
      ]
    },
    result: {
      effects: [
        {
          type: "SHOW_LOG",
          message: "[BUỒNG ĐÈN SC-06] Cầu dao chính sập xuống, thấu kính tắt lịm và làn sương từ từ rút ra ngoài hàng rào."
        },
        { type: "TRIGGER_ENDING", endingId: "END-02" }
      ]
    }
  },
  {
    id: "EV-SC05-RADAR-SCAN",
    triggerEvent: "PLAYER_ACTION_PERFORMED",
    eventFilter: { actionTags: [ACTION_TAGS.USE_OBSERVATION_GEAR], sceneIds: ["SC-05"] },
    condition: { flagEquals: { key: "power_mode", value: "low" } },
    result: {
      onceId: "radar_low_scanned",
      effects: [
        {
          type: "SHOW_LOG",
          message:
            "[RADAR · LOW] Tín hiệu ổn định. Điểm mù thấu kính ghi nhận: Góc phương vị 27° Bắc — Biên độ lệch pha 14′."
        }
      ]
    }
  }
];

export const CHAPTER1_PUZZLE_DEFINITIONS: PuzzleDefinition[] = [
  {
    id: "PZ-01",
    sceneId: "SC-04",
    title: "Cân bằng tải điện",
    description: "Chọn chế độ tải điện trên bảng điều khiển Phòng máy sau khi đối chiếu Sơ đồ tải điện (C-04).",
    solutionType: "passcode"
  },
  {
    id: "PZ-02",
    sceneId: "SC-05",
    title: "Tọa độ điểm mù",
    description:
      "Kết hợp quét radar ở chế độ LOW với Sổ trực của Trần Minh (C-02) để ghép 4 chữ số mở ngăn bí mật: góc phương vị (2 chữ số) + biên độ lệch pha (2 chữ số).",
    solutionType: "passcode"
  },
  {
    id: "PZ-03",
    sceneId: "SC-05",
    title: "Khóa tần số buồng đèn",
    description:
      "Giải mã 4 chữ số tần số cộng hưởng Trạm 09 từ Sổ mã tần số (I-06) và đối chiếu cảnh báo khóa liên động trong Băng cassette (C-05) để nhả chốt cơ khí cửa buồng đèn.",
    solutionType: "passcode"
  }
];

export const CHAPTER1_PUZZLE_SOLUTIONS: PuzzleSolution[] = [
  {
    puzzleId: "PZ-01",
    expectedSolution: "LOW",
    solveCondition: {
      all: [
        { hasItem: "I-04" },
        { powerFuseInstalled: true },
        { auxBranchOff: true }
      ]
    },
    onSolve: {
      effects: [
        { type: "SET_FLAG", key: "power_mode", value: "low" },
        { type: "DISCOVER_RULE", ruleId: "R-07" },
        {
          type: "SHOW_LOG",
          message: "Nguồn điện đã chuyển sang LOW. Thiết bị quan sát được cấp nguồn ổn định."
        }
      ]
    },
    onFailBySubmission: {
      OVERLOAD: R05_OVERLOAD_EFFECT_BLOCK,
      NORMAL: {
        effects: [
          { type: "SET_FLAG", key: "power_mode", value: "normal" },
          {
            type: "SHOW_LOG",
            message: "[PZ-01] Chế độ NORMAL giữ mạch tải tiêu chuẩn, nhưng chưa triệt được nhiễu cao tần cho radar."
          }
        ]
      }
    }
  },
  {
    puzzleId: "PZ-02",
    expectedSolution: "2714",
    solveCondition: {
      all: [
        { flagEquals: { key: "power_mode", value: "low" } },
        { triggeredOnce: "radar_low_scanned" },
        { hasClue: "C-02" }
      ]
    },
    onSolve: {
      effects: [
        { type: "ADD_ITEM", itemId: "I-05" },
        { type: "SET_FLAG", key: "red_filter_installed", value: false },
        { type: "DISCOVER_CLUE", clueId: "C-08" },
        {
          type: "SHOW_LOG",
          message: "Ngăn bí mật mở ra. Bạn tìm thấy Bộ lọc đỏ (I-05) và Bản nháp viết tay của Lê Văn Hùng (C-08)."
        }
      ]
    }
  },
  {
    puzzleId: "PZ-03",
    expectedSolution: "6208",
    solveCondition: {
      all: [{ hasItem: "I-06" }, { hasClue: "C-05" }]
    },
    onSolve: {
      effects: [
        {
          type: "SHOW_LOG",
          message: "Tần số mở khóa được chấp nhận. Chốt cơ khí cửa buồng đèn đã nhả."
        }
      ]
    }
  }
];

export function createChapter1InitialState(): GameState {
  const state = createInitialState("CH-01", "SC-01");
  state.discoveredRuleIds = ["R-01", "R-10"];
  state.ruleLifecycleStates = Object.fromEntries(
    CHAPTER1_RULES.map(r => [r.id, r.id === "R-07" ? "inactive" : "active"])
  ) as typeof state.ruleLifecycleStates;
  state.flags = {
    power_mode: "normal",
    radio_state: "broadcasting",
    fog_breached: false,
    identity_exposed: false,
    locker_knocking: false,
    flashlight_on: false,
    red_filter_installed: false,
    captain_missing_confirmed: false
  };
  state.logs = ["23:40 · Bắt đầu ca trực thay thế tại Trạm Hải Đăng Mũi Sương (Trạm 09)."];
  state.identityOverwriteCount = 0;
  return state;
}

export interface Chapter1Engine {
  store: GameStateStore;
  evaluator: ConditionEvaluator;
  executor: EffectExecutor;
  dispatcher: EventDispatcher;
  rules: RuleSystem;
  investigation: InvestigationSystem;
  puzzles: PuzzleSystem;
  dialogue: DialogueSystem;
  archive: ArchiveSystem;
}

export function canTriggerChapter1Ending(endingId: string, state: DeepReadonly<GameState>): boolean {
  if (endingId === "END-03") return true;
  if (state.currentSceneId !== "SC-06") return false;
  if (endingId === "END-02") {
    return canReachEndingB(state);
  }
  if (endingId === "END-01") {
    return (
      canReachEndingB(state) &&
      state.discoveredClueIds.includes("C-05") &&
      state.discoveredClueIds.includes("C-08") &&
      state.triggeredOnceIds.includes("cassette_side_b_heard") &&
      state.investigationStatuses["R-03"] === "verified" &&
      state.investigationStatuses["R-04"] === "debunked_fake" &&
      state.investigationStatuses["R-05"] === "debunked_fake"
    );
  }
  return false;
}

export function createChapter1Engine(): Chapter1Engine {
  const store = new GameStateStore(createChapter1InitialState());
  const evaluator = new ConditionEvaluator();
  const executor = new EffectExecutor(store, canTriggerChapter1Ending);
  const dispatcher = new EventDispatcher(store, evaluator, executor, CHAPTER1_EVENT_DEFINITIONS);
  const rules = new RuleSystem(store, evaluator, executor, dispatcher, CHAPTER1_RULES);
  const investigation = new InvestigationSystem(
    store,
    executor,
    dispatcher,
    CHAPTER1_CLUES,
    CHAPTER1_DEDUCTION_GROUPS
  );
  const puzzles = new PuzzleSystem(
    store,
    executor,
    dispatcher,
    CHAPTER1_PUZZLE_DEFINITIONS,
    CHAPTER1_PUZZLE_SOLUTIONS,
    evaluator
  );
  const dialogue = new DialogueSystem(
    store,
    evaluator,
    executor,
    CHAPTER1_DIALOGUES,
    dispatcher,
    CHAPTER1_CHARACTERS
  );
  const archive = new ArchiveSystem(store, evaluator, CHAPTER1_ARCHIVE_DOCUMENTS);
  return { store, evaluator, executor, dispatcher, rules, investigation, puzzles, dialogue, archive };
}

export function canReachEndingB(state: DeepReadonly<GameState>): boolean {
  return Boolean(state.flags.red_filter_installed) && !state.flags.identity_exposed;
}

export function canReachEndingS(
  state: DeepReadonly<GameState>,
  investigation: InvestigationSystem
): boolean {
  return (
    canReachEndingB(state) &&
    state.discoveredClueIds.includes("C-05") &&
    state.discoveredClueIds.includes("C-08") &&
    state.triggeredOnceIds.includes("cassette_side_b_heard") &&
    investigation.getInvestigationStatus("R-03") === "verified" &&
    investigation.getInvestigationStatus("R-04") === "debunked_fake" &&
    investigation.getInvestigationStatus("R-05") === "debunked_fake"
  );
}

export function getSceneLockReason(state: DeepReadonly<GameState>, targetSceneId: string): string | null {
  if (
    targetSceneId === "SC-03" &&
    !state.discoveredClueIds.includes("C-01") &&
    !state.inventoryItemIds.includes("I-02")
  ) {
    return "Hãy kiểm tra tài liệu hoặc lấy chìa khóa tại Phòng trực (SC-02) trước khi sang Khu nghỉ.";
  }
  if (
    targetSceneId === "SC-04" &&
    !state.inventoryItemIds.includes("I-04") &&
    !state.powerPanelState.fuseInstalled
  ) {
    return "Cửa Phòng máy cần Cầu chì công nghiệp 30A (I-04) tìm thấy tại Khu nghỉ (SC-03).";
  }
  if (targetSceneId === "SC-05" && !state.solvedPuzzleIds.includes("PZ-01")) {
    return "Phòng quan sát chưa ổn định nguồn. Hãy giải Cân bằng tải điện (PZ-01) tại Phòng máy trước.";
  }
  if (targetSceneId === "SC-06" && !state.solvedPuzzleIds.includes("PZ-03")) {
    return "Cửa buồng đèn đang khóa. Hãy giải Khóa tần số (PZ-03) tại Phòng quan sát trước.";
  }
  return null;
}

export type SceneTransitionResult =
  | { ok: true; sceneId: string }
  | { ok: false; reason: "ended" | "same_scene" | "locked" | "r08_interlock" | "r10_flashlight"; message: string };

export function attemptSceneTransition(
  engine: Chapter1Engine,
  targetSceneId: string
): SceneTransitionResult {
  const initialState = engine.store.snapshot();
  if (initialState.activeEndingId !== null) {
    return { ok: false, reason: "ended", message: "Ca trực đã kết thúc." };
  }
  if (targetSceneId === initialState.currentSceneId) {
    return { ok: false, reason: "same_scene", message: "Bạn đang ở khu vực này." };
  }

  const lockReason = getSceneLockReason(initialState, targetSceneId);
  if (lockReason) {
    return { ok: false, reason: "locked", message: lockReason };
  }

  if (targetSceneId === "SC-06") {
    const beforeR08 = engine.rules.getViolationCount("R-08");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.OPEN_LANTERN_DOOR,
      targetId: "lantern_door",
      sceneId: initialState.currentSceneId
    });
    const postR08 = engine.store.snapshot();
    if (
      postR08.activeEndingId !== null ||
      engine.rules.getViolationCount("R-08") > beforeR08 ||
      postR08.flags.radio_state !== "paused" ||
      !postR08.solvedPuzzleIds.includes("PZ-03")
    ) {
      return {
        ok: false,
        reason: "r08_interlock",
        message:
          "Cửa buồng đèn vẫn đóng chặt. Khóa liên động chỉ nhả khi bộ đàm đang ở trạng thái TẠM DỪNG (PAUSED)."
      };
    }
  }

  const currentSceneId = engine.store.snapshot().currentSceneId;
  const beforeR10 = engine.rules.getViolationCount("R-10");
  engine.dispatcher.dispatch({
    type: "PLAYER_ACTION_PERFORMED",
    actionTag: ACTION_TAGS.LEAVE_SCENE,
    targetId: `leave_${currentSceneId}`,
    sceneId: currentSceneId
  });
  const postLeaveState = engine.store.snapshot();
  const r10ActiveRisk =
    (postLeaveState.ruleLifecycleStates["R-10"] === "transformed" ||
      Boolean(postLeaveState.flags.fog_breached) ||
      postLeaveState.flags.power_mode === "low") &&
    Boolean(postLeaveState.flags.flashlight_on);

  if (
    postLeaveState.activeEndingId !== null ||
    engine.rules.getViolationCount("R-10") > beforeR10 ||
    r10ActiveRisk
  ) {
    return {
      ok: false,
      reason: "r10_flashlight",
      message: "Sương đang hướng về phía ánh sáng (R-10). Hãy tắt đèn pin trước khi di chuyển sang khu vực khác."
    };
  }

  engine.store.changeScene(targetSceneId);
  engine.dispatcher.dispatch({ type: "SCENE_ENTERED", sceneId: targetSceneId });

  const unlockRules = CHAPTER1_SCENE_RULE_UNLOCKS[targetSceneId] ?? [];
  for (const rId of unlockRules) {
    if (!engine.store.snapshot().discoveredRuleIds.includes(rId)) {
      engine.store.discoverRule(rId);
    }
  }

  return { ok: true, sceneId: targetSceneId };
}

export function canRecoverIdentityAtLanternRoom(state: DeepReadonly<GameState>): boolean {
  return (
    state.currentSceneId === "SC-06" &&
    state.activeEndingId === null &&
    Boolean(state.flags.red_filter_installed) &&
    state.discoveredClueIds.includes("C-07") &&
    Boolean(state.flags.identity_exposed) &&
    state.identityOverwriteCount === 1
  );
}

export function getChapter1DeathReason(state: DeepReadonly<GameState>): string {
  if (state.deathReason) return state.deathReason;
  if (state.lastOverwriteReason) return state.lastOverwriteReason;
  if (!state.flags.red_filter_installed && state.currentSceneId === "SC-06") {
    return CHAPTER1_DEATH_REASONS.R03_LANTERN_BEAM;
  }
  if (state.flags.fog_breached) {
    return "Làn sương trắng đã tràn qua hàng rào bảo vệ của trạm và bao vây hành lang.";
  }
  if (state.flags.identity_exposed) {
    return "Danh tính của bạn đã bị ghi lại trên hồ sơ ca trực. Trạm 09 đã khóa tên bạn vào vòng lặp kế tiếp.";
  }
  if (state.entityStates["EN-02"] === "stalking") {
    return CHAPTER1_DEATH_REASONS.R06_LOCKER_04;
  }
  return "Trạm 09 đã ghi nhận sự hiện diện của bạn. Máy in nhiệt bắt đầu chạy dòng mô tả ca trực tiếp theo.";
}
