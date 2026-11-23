import type { DialogueDefinition } from "../types/dialogue";

export const CHAPTER1_DIALOGUES: DialogueDefinition[] = [
  {
    id: "DLG-SC01-ARRIVAL",
    title: "Nhận ca tại Cổng trạm (SC-01)",
    sceneId: "SC-01",
    channel: "SYSTEM",
    entryNodeId: "sc01-entry",
    nodes: [
      {
        id: "sc01-entry",
        speakerId: "CHAR-SYS",
        expression: "neutral",
        channel: "SYSTEM",
        text: "GHI NHẬN CA TRỰC · 23:40 — Trạm Hải Đăng Mũi Sương (Trạm 09). Gió biển lặng bất thường; ngoài hàng rào có một màn sương trắng đang tụ lại ở phía xa, chưa rõ đã áp sát chân cổng hay chưa.",
        choices: [
          {
            id: "sc01-inspect-gate",
            label: "Quan sát bệ gác và khoảng sân sau cổng",
            onceId: "dlg_sc01_inspect_gate_once",
            effects: {
              onceId: "dlg_sc01_inspect_gate_fx",
              effects: [
                {
                  type: "SHOW_LOG",
                  message: "[HỘI THOẠI SC-01] Bệ gác trống không. Không có nhân viên tiền nhiệm nào chờ bàn giao ca lúc 23:40."
                }
              ]
            },
            nextNodeId: "sc01-gate-note"
          },
          {
            id: "sc01-check-flashlight",
            label: "Kiểm tra chiếc đèn pin trên tay",
            condition: { hasItem: "I-01" },
            nextNodeId: "sc01-flashlight-note"
          },
          {
            id: "sc01-check-fog-breach",
            label: "Quan sát làn sương đang lọt qua khe cổng",
            condition: { flagEquals: { key: "fog_breached", value: true } },
            isRisky: true,
            nextNodeId: "sc01-fog-note"
          },
          {
            id: "sc01-proceed",
            label: "Ghi nhớ quy tắc cổng trạm trước khi vào trong",
            nextNodeId: "sc01-end"
          }
        ]
      },
      {
        id: "sc01-gate-note",
        speakerId: "CHAR-PLAYER",
        expression: "tense",
        channel: "MONO",
        text: "Không thấy ai ở vọng gác, chỉ còn ánh đèn hải đăng quay đều phía trên mái trạm. Mọi chỉ dẫn còn lại nằm trong phòng trực.",
        nextNodeId: "sc01-end"
      },
      {
        id: "sc01-flashlight-note",
        speakerId: "CHAR-PLAYER",
        expression: "tense",
        channel: "MONO",
        text: "Đèn pin vẫn hoạt động bình thường. Tờ giấy dán cạnh cửa nhắc rõ chỉ giữ ánh sáng khi điều kiện trong trạm còn an toàn.",
        nextNodeId: "sc01-end"
      },
      {
        id: "sc01-fog-note",
        speakerId: "CHAR-SYS",
        expression: "distorted",
        channel: "SYSTEM",
        text: "Cảnh báo hiện trường: sương trắng đã vượt qua ranh giới cổng ngoài. Cần lưu ý đặc biệt việc sử dụng nguồn sáng khi rời khu vực.",
        nextNodeId: "sc01-end"
      },
      {
        id: "sc01-end",
        speakerId: "CHAR-PLAYER",
        expression: "tense",
        channel: "MONO",
        text: "Ca trực đêm đã bắt đầu. Trước khi chạm vào thiết bị nào, cần đối chiếu từng quy tắc với chứng cứ thực tế.",
        isEnd: true
      }
    ]
  },
  {
    id: "DLG-SC02-RADIO",
    title: "Tần số bộ đàm Phòng trực (SC-02)",
    sceneId: "SC-02",
    channel: "RADIO · 00:15",
    entryNodeId: "sc02-radio-entry",
    nodes: [
      {
        id: "sc02-radio-entry",
        speakerId: "CHAR-SYS",
        expression: "static",
        channel: "RADIO · 00:15",
        text: "Máy bộ đàm trên bàn trực phát ra tiếng rè tĩnh điện đều đặn giữa các nhịp sóng ngắn.",
        choices: [
          {
            id: "sc02-radio-listen-live",
            label: "Lắng nghe phần phát thanh đang chạy",
            condition: { flagEquals: { key: "radio_state", value: "broadcasting" } },
            isRisky: true,
            nextNodeId: "sc02-radio-live"
          },
          {
            id: "sc02-radio-observe-paused",
            label: "Kiểm tra bảng mạch bộ đàm đang tạm dừng",
            condition: { flagEquals: { key: "radio_state", value: "paused" } },
            nextNodeId: "sc02-radio-paused"
          },
          {
            id: "sc02-radio-compare-tape",
            label: "Đối chiếu với đoạn ghi âm Mặt A của Trần Minh",
            condition: { hasClue: "C-05" },
            nextNodeId: "sc02-radio-tape"
          },
          {
            id: "sc02-radio-leave",
            label: "Giữ khoảng cách với micro và kết thúc kiểm tra",
            nextNodeId: "sc02-radio-end"
          }
        ]
      },
      {
        id: "sc02-radio-live",
        speakerId: "CHAR-SYS",
        expression: "distorted",
        channel: "RADIO · 00:15",
        text: "...Bản tin thời tiết khu vực Trạm 09: sương mù dày vào nửa đêm. Dải giấy nhiệt vừa in thêm một dòng nhắc đến trang phục tối màu của nhân viên trực.",
        choices: [
          {
            id: "sc02-radio-keep-silent",
            label: "Giữ im lặng, không chạm vào nút phát micro",
            onceId: "dlg_sc02_radio_silent_once",
            effects: {
              onceId: "dlg_sc02_radio_silent_fx",
              effects: [
                {
                  type: "SHOW_LOG",
                  message: "[HỘI THOẠI SC-02] Bạn giữ im lặng trước micro trong lúc bản tin vô tuyến và cuộn giấy nhiệt xuất hiện dấu hiệu lệch giờ."
                }
              ]
            },
            nextNodeId: "sc02-radio-silent-note"
          },
          {
            id: "sc02-radio-step-away",
            label: "Lùi khỏi bàn vô tuyến",
            nextNodeId: "sc02-radio-end"
          }
        ]
      },
      {
        id: "sc02-radio-silent-note",
        speakerId: "CHAR-PLAYER",
        expression: "tense",
        channel: "MONO",
        text: "Bản tin nhiệt ghi sớm hơn đồng hồ treo tường hơn hai tiếng. Không phản hồi qua micro là cách giữ an toàn cho danh tính người trực.",
        nextNodeId: "sc02-radio-end"
      },
      {
        id: "sc02-radio-paused",
        speakerId: "CHAR-PLAYER",
        expression: "neutral",
        channel: "MONO",
        text: "Đèn báo phát sóng đã tắt. Không còn tín hiệu nhiễu phát ra từ loa bàn trực.",
        nextNodeId: "sc02-radio-end"
      },
      {
        id: "sc02-radio-tape",
        speakerId: "CHAR-MINH",
        expression: "static",
        channel: "TAPE",
        text: "[Nội dung bản ghi Mặt A]: 'Khóa liên động buồng đèn chỉ nhả chốt khi bộ đàm đang ở trạng thái tạm dừng.'",
        nextNodeId: "sc02-radio-end"
      },
      {
        id: "sc02-radio-end",
        speakerId: "CHAR-PLAYER",
        expression: "tense",
        channel: "MONO",
        text: "Tín hiệu bộ đàm liên quan trực tiếp đến cả an toàn cá nhân lẫn khóa liên động trong trạm.",
        isEnd: true
      }
    ]
  },
  {
    id: "DLG-SC02-PHONE",
    title: "Điện thoại nội bộ Phòng trực (SC-02)",
    sceneId: "SC-02",
    channel: "INTERCOM",
    entryNodeId: "sc02-phone-entry",
    nodes: [
      {
        id: "sc02-phone-entry",
        speakerId: "CHAR-SYS",
        expression: "static",
        channel: "INTERCOM",
        text: "Chiếc điện thoại nội bộ màu đen đặt cạnh cuốn sổ trực. Vỏ máy lạnh ngắt dù đèn báo nguồn vẫn sáng mờ.",
        choices: [
          {
            id: "sc02-phone-before-dossier",
            label: "Xem nhãn nối dây tới phòng trạm trưởng",
            condition: { not: { flagEquals: { key: "captain_missing_confirmed", value: true } } },
            nextNodeId: "sc02-phone-unconfirmed"
          },
          {
            id: "sc02-phone-after-dossier",
            label: "Đối chiếu với hồ sơ nhân sự của Lê Văn Hùng",
            condition: { flagEquals: { key: "captain_missing_confirmed", value: true } },
            nextNodeId: "sc02-phone-confirmed"
          },
          {
            id: "sc02-phone-confession",
            label: "Đọc lại đoạn viết tay về điện thoại nội bộ",
            condition: { hasClue: "C-08" },
            nextNodeId: "sc02-phone-confession-node"
          },
          {
            id: "sc02-phone-step-back",
            label: "Không chạm vào ống nghe",
            nextNodeId: "sc02-phone-end"
          }
        ]
      },
      {
        id: "sc02-phone-unconfirmed",
        speakerId: "CHAR-PLAYER",
        expression: "tense",
        channel: "MONO",
        text: "Quy tắc treo tường nhắc nhấc điện thoại để nhận chỉ thị từ trạm trưởng, nhưng tình trạng hiện tại của ông Lê Văn Hùng vẫn chưa được kiểm chứng trong hồ sơ.",
        nextNodeId: "sc02-phone-end"
      },
      {
        id: "sc02-phone-confirmed",
        speakerId: "CHAR-HUNG",
        expression: "shadowed",
        channel: "INTERCOM",
        text: "[Trích hồ sơ nhân sự Trạm 09]: Trạm trưởng Lê Văn Hùng đã mất tích sau một ca trực đêm đơn độc. Trước khi mất tích, ông thường ngồi hàng giờ bên điện thoại nội bộ.",
        effects: {
          onceId: "dlg_sc02_phone_dossier_fx",
          effects: [
            {
              type: "SHOW_LOG",
              message: "[HỘI THOẠI SC-02] Hồ sơ xác nhận trạm trưởng đã mất tích từ trước; cần cảnh giác với mọi chỉ thị qua điện thoại nội bộ."
            }
          ]
        },
        nextNodeId: "sc02-phone-end"
      },
      {
        id: "sc02-phone-confession-node",
        speakerId: "CHAR-HUNG",
        expression: "distorted",
        channel: "INTERCOM",
        text: "[Bản nháp viết tay]: 'Bản ghi ở mặt B là giọng thật của con bé. Nhưng giọng nói qua điện thoại không phải con bé... Tôi đã viết thêm những quy tắc giả vào sổ trực.'",
        nextNodeId: "sc02-phone-end"
      },
      {
        id: "sc02-phone-end",
        speakerId: "CHAR-PLAYER",
        expression: "tense",
        channel: "MONO",
        text: "Đường dây nội bộ này không còn là kênh liên lạc đáng tin cậy.",
        isEnd: true
      }
    ]
  },
  {
    id: "DLG-SC03-TRACE",
    title: "Dấu vết tại Khu nghỉ nhân viên (SC-03)",
    sceneId: "SC-03",
    channel: "MONO",
    entryNodeId: "sc03-trace-entry",
    nodes: [
      {
        id: "sc03-trace-entry",
        speakerId: "CHAR-PLAYER",
        expression: "tense",
        channel: "MONO",
        text: "Khu nghỉ nhân viên tĩnh lặng dưới ánh đèn mờ. Dãy giường sắt xếp thẳng hàng đối diện các tủ cá nhân dọc hành lang.",
        choices: [
          {
            id: "sc03-observe-bunks",
            label: "Quan sát tổng thể khu giường nghỉ",
            onceId: "dlg_sc03_observe_bunks_once",
            effects: {
              onceId: "dlg_sc03_observe_bunks_fx",
              effects: [
                {
                  type: "SHOW_LOG",
                  message: "[HỘI THOẠI SC-03] Dãy giường sắt gọn gàng một cách gượng gạo; dưới gầm giường có những vệt bụi xước nhẹ."
                }
              ]
            },
            nextNodeId: "sc03-bunks-note"
          },
          {
            id: "sc03-review-dat-card",
            label: "Xem lại thông tin trên thẻ nhân viên Phạm Quốc Đạt",
            condition: { hasClue: "C-09" },
            nextNodeId: "sc03-dat-note"
          },
          {
            id: "sc03-note-knocking",
            label: "Ghi nhận tiếng động phát ra từ góc tủ số 04",
            condition: { flagEquals: { key: "locker_knocking", value: true } },
            isRisky: true,
            nextNodeId: "sc03-knock-warning"
          },
          {
            id: "sc03-leave-trace",
            label: "Khép lại quan sát tại khu nghỉ",
            nextNodeId: "sc03-trace-end"
          }
        ]
      },
      {
        id: "sc03-bunks-note",
        speakerId: "CHAR-PLAYER",
        expression: "tense",
        channel: "MONO",
        text: "Không có ghi chép bàn giao nào ở đầu giường. Nếu từng có nhân viên ở lại đây, phần còn sót chỉ là những mảnh dấu vết rời rạc.",
        nextNodeId: "sc03-trace-end"
      },
      {
        id: "sc03-dat-note",
        speakerId: "CHAR-DAT",
        expression: "shadowed",
        channel: "MONO",
        text: "[Dữ liệu thẻ nhân viên C-09]: Phạm Quốc Đạt — ghi chú mặt sau đã hư hại. Tài liệu hiện có chưa đủ để xác định vai trò, thời điểm rời đi hay điều gì đã xảy ra với người này.",
        nextNodeId: "sc03-trace-end"
      },
      {
        id: "sc03-knock-warning",
        speakerId: "CHAR-MINH",
        expression: "static",
        channel: "TAPE",
        text: "[Nhắc lại cảnh báo từ băng ghi âm Mặt A]: 'Nếu ai nghe được băng này, đừng mở tủ 04 khi có tiếng gõ.'",
        nextNodeId: "sc03-trace-end"
      },
      {
        id: "sc03-trace-end",
        speakerId: "CHAR-PLAYER",
        expression: "neutral",
        channel: "MONO",
        text: "Chưa đủ căn cứ để kết luận về những người từng trực tại đây ngoài các hồ sơ đã được xác thực.",
        isEnd: true
      }
    ]
  }
];
