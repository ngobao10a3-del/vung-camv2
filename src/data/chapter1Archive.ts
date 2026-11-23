import type { ArchiveDocumentCategory, ArchiveDocumentDefinition } from "../types/archive";
import { CHAPTER1_CLUES } from "./chapter1Investigation";

const CLUE_ARCHIVE_METADATA: Record<
  string,
  { sourceLabel: string; category: ArchiveDocumentCategory; relatedSceneId: string }
> = {
  "C-01": {
    sourceLabel: "Máy in nhiệt thời tiết · Phòng trực (SC-02)",
    category: "broadcast",
    relatedSceneId: "SC-02"
  },
  "C-02": {
    sourceLabel: "Sổ trực tiền nhiệm · Phòng trực (SC-02)",
    category: "diary",
    relatedSceneId: "SC-02"
  },
  "C-03": {
    sourceLabel: "Hồ sơ niêm phong Trạm 09 · Phòng trực (SC-02)",
    category: "dossier",
    relatedSceneId: "SC-02"
  },
  "C-04": {
    sourceLabel: "Bảng sơ đồ kỹ thuật · Phòng máy (SC-04)",
    category: "technical",
    relatedSceneId: "SC-04"
  },
  "C-05": {
    sourceLabel: "Cuộn băng hai mặt · Phòng trực (SC-02)",
    category: "tape",
    relatedSceneId: "SC-02"
  },
  "C-06": {
    sourceLabel: "Màn hình trích xuất CCTV · Phòng quan sát (SC-05)",
    category: "cctv",
    relatedSceneId: "SC-05"
  },
  "C-07": {
    sourceLabel: "Tài liệu phòng thí nghiệm quang học · Phòng quan sát (SC-05)",
    category: "technical",
    relatedSceneId: "SC-05"
  },
  "C-08": {
    sourceLabel: "Ngăn bí mật dưới bàn · Phòng quan sát (SC-05)",
    category: "dossier",
    relatedSceneId: "SC-05"
  },
  "C-09": {
    sourceLabel: "Dưới chân giường sắt · Khu nghỉ nhân viên (SC-03)",
    category: "dossier",
    relatedSceneId: "SC-03"
  }
};

const CLUE_BACKED_ARCHIVE_DOCUMENTS: ArchiveDocumentDefinition[] = CHAPTER1_CLUES.map(clue => {
  const meta = CLUE_ARCHIVE_METADATA[clue.id] ?? {
    sourceLabel: "Hồ sơ lưu trữ Trạm 09",
    category: "dossier" as const,
    relatedSceneId: "SC-02"
  };

  return {
    id: `ARC-${clue.id}`,
    title: clue.title,
    sourceLabel: meta.sourceLabel,
    category: meta.category,
    relatedSceneId: meta.relatedSceneId,
    relatedClueIds: [clue.id],
    unlockCondition: { hasClue: clue.id },
    content: clue.detailContent
  };
});

export const V4_ORIGINAL_ARCHIVE_DOCUMENTS: ArchiveDocumentDefinition[] = [
  {
    id: "DOC-SC01-SHIFT-NOTICE",
    title: "THÔNG BÁO NHÂN VIÊN TRỰC ĐÊM",
    sourceLabel: "SC-01 · Bảng thông báo",
    category: "dossier",
    relatedSceneId: "SC-01",
    relatedClueIds: [],
    unlockCondition: { inScene: "SC-01" },
    content: `TRẠM HẢI ĐĂNG MŨI SƯƠNG – TRẠM 09

THÔNG BÁO NHÂN VIÊN TRỰC ĐÊM

1. Ca trực đêm bắt đầu lúc 23:40 và kết thúc lúc 06:00.
2. Nhân viên phải hoàn tất thủ tục giao ca trước khi rời trạm.
3. Không tự ý mở cổng ngoài khi sương mù tiến sát hàng rào.
4. Mọi trường hợp mất liên lạc phải được ghi vào sổ trực.
5. Nhân viên không được tự ý thay đổi chế độ vận hành thấu kính.

Lưu ý: Không có ngoại lệ đối với nhân viên mới.`
  },
  {
    id: "DOC-SC01-TRANSPORT-HANDOVER",
    title: "PHIẾU BÀN GIAO VẬN CHUYỂN",
    sourceLabel: "SC-01 · Ghế lái xe bỏ trống",
    category: "dossier",
    relatedSceneId: "SC-01",
    relatedClueIds: [],
    unlockCondition: { inScene: "SC-01" },
    content: `PHIẾU BÀN GIAO VẬN CHUYỂN

Tuyến: Trụ sở – Trạm 09.

Người vận chuyển: Không ghi nhận.

Hành khách: Nhân viên điều tra mới.

Thời gian đến: 23:40.

Thời gian rời trạm: 23:40.

Ghi chú viết tay:

"Không chờ hành khách hoàn tất nhiệm vụ. Không nhận yêu cầu quay lại sau khi đã qua cổng."`
  },
  {
    id: "DOC-DAT-DIARY",
    title: "Nhật ký Phạm Quốc Đạt",
    sourceLabel: "SC-03 – Khu nghỉ nhân viên · Tài liệu cá nhân",
    category: "diary",
    relatedSceneId: "SC-03",
    relatedClueIds: ["C-09"],
    unlockCondition: {
      all: [
        { hasClue: "C-09" },
        { flagEquals: { key: "locker_knocking", value: true } }
      ]
    },
    content: `Vị trí: SC-03 – Khu nghỉ nhân viên
Loại: Tài liệu cá nhân
Tình trạng: Một phần bị ẩm, một số trang không đọc được.

Trang 1 – 12/11/1998

Ca trực hôm nay vẫn bình thường.
Máy phát điện hoạt động không ổn định. Phòng quan sát báo nhiễu hình ảnh trong khoảng ba phút, sau đó tự khôi phục.
Trần Minh nói đó chỉ là lỗi đồng bộ của Lens Array.
Tôi không tin lắm, nhưng cũng chẳng có lý do gì để tranh luận.

Trang 2 – 13/11/1998

Tôi nghe tiếng gõ ở tủ số 04.
Ba tiếng, cách nhau đều nhau.
Ban đầu tôi nghĩ có ai đó đang đùa. Tôi kiểm tra hành lang nhưng không thấy người.
Camera cũng không ghi nhận ai đi vào khu nghỉ.
Tôi đặt tay lên cánh tủ.
Tiếng gõ vẫn tiếp tục.
Tôi không kiểm tra lần thứ hai.

Trang 3 – 14/11/1998

Có người gọi tên tôi từ phía bên kia bức tường.
Giọng nói giống hệt tôi.
Nó hỏi:
"Anh đã bàn giao ca chưa?"
Tôi không trả lời.
Sau đó điện thoại phòng trực reo. Tôi nghe thấy giọng mình ở đầu dây bên kia.
Tôi đã ở khu nghỉ suốt thời gian đó.
Vậy người nào đang nói chuyện?

Trang cuối – Không ghi ngày

Nếu có người đến thay ca, đừng ký sổ ngay.
Đừng tin bản tin radio.
Đừng mở tủ số 04 chỉ vì có ai đó bảo anh phải kiểm tra.
Và nếu nghe thấy giọng của chính mình...
Đừng trả lời.`
  },
  {
    id: "DOC-MINH-NOTES",
    title: "Nhật ký Trần Minh",
    sourceLabel: "SC-02 – Phòng trực · Ghi chép kỹ thuật cá nhân",
    category: "diary",
    relatedSceneId: "SC-02",
    relatedClueIds: ["C-02"],
    unlockCondition: {
      all: [
        { hasClue: "C-02" },
        {
          any: [
            { hasClue: "C-01" },
            { itemCollected: "I-02" },
            { itemCollected: "I-03" }
          ]
        }
      ]
    },
    content: `Vị trí: SC-02 – Phòng trực
Loại: Ghi chép kỹ thuật cá nhân
Tình trạng: Có thể đọc được phần lớn.

Ghi chép 01

Hệ thống camera và hệ thống nhận diện tín hiệu đang hoạt động độc lập.
Điều này có nghĩa là hệ thống có thể xác định một khu vực đang có người mà không cần xác định được danh tính của người đó.
Không được nhầm lẫn hai loại dữ liệu này.

Ghi chép 02

Đạt báo rằng có người gọi tên cậu ấy từ phòng nghỉ.
Camera không ghi nhận bất kỳ ai đi vào.
Tôi đã kiểm tra nhật ký truy cập. Không có lỗi đăng nhập.
Tôi đề nghị tạm ngừng sử dụng hệ thống nhận diện giọng nói cho đến khi tìm ra nguyên nhân.
Đề nghị chưa được phê duyệt.

Ghi chép 03

Chế độ LOW giảm đáng kể nhiễu trong vùng quét.
Tôi chưa thể kết luận LOW loại bỏ hoàn toàn hiện tượng bất thường. Tuy nhiên, đây là chế độ duy nhất cho kết quả ổn định trong các lần kiểm tra gần nhất.
Không chuyển sang OVERLOAD nếu không có giám sát trực tiếp.

Ghi chép 04

Tôi đã lưu một bản ghi âm gốc vào ngăn tủ không đánh số tại khu nghỉ.
Bản ghi này không được đưa vào hệ thống Lens Array.
Nếu ai đó tìm thấy nó, hãy so sánh với âm thanh phát ra từ thấu kính.
Đừng chỉ nghe nội dung.
Hãy chú ý đến những đoạn âm thanh không xuất hiện trong bản gốc.`
  },
  {
    id: "DOC-DAT-HR",
    title: "Hồ sơ nhân sự Phạm Quốc Đạt",
    sourceLabel: "SC-02 – Phòng trực · Mã hồ sơ: HR-09-014",
    category: "dossier",
    relatedSceneId: "SC-02",
    relatedClueIds: ["C-09", "C-03"],
    unlockCondition: {
      all: [
        { hasClue: "C-03" },
        { flagEquals: { key: "captain_missing_confirmed", value: true } },
        {
          any: [
            { hasClue: "C-09" },
            { itemCollected: "I-02" }
          ]
        }
      ]
    },
    content: `Vị trí: SC-02 – Phòng trực
Mã hồ sơ: HR-09-014

- Họ tên: Phạm Quốc Đạt
- Hình thức làm việc: Nhân viên hợp đồng
- Đơn vị: Trạm Hải đăng Mũi Sương – Trạm 09
- Vị trí: Nhân viên trực vận hành
- Ngày ghi nhận ca cuối: 14/11/1998
- Người xác nhận bàn giao: Không có dữ liệu
- Tình trạng hiện tại: Để trống

Ghi chú hành chính:

Hồ sơ bàn giao ca cuối cùng chưa được xác nhận.
Không tìm thấy biên bản nghỉ việc hoặc quyết định điều chuyển.
Các yêu cầu bổ sung thông tin đã được gửi đến đơn vị quản lý nhưng chưa có phản hồi.`
  },
  {
    id: "DOC-HUNG-HR",
    title: "Hồ sơ Lê Văn Hùng",
    sourceLabel: "SC-03 hoặc SC-05 · Hồ sơ đội trưởng",
    category: "dossier",
    relatedSceneId: "SC-05",
    relatedClueIds: ["C-03", "C-08"],
    unlockCondition: {
      all: [
        { hasClue: "C-03" },
        { hasClue: "C-08" }
      ]
    },
    content: `Vị trí: SC-03 hoặc SC-05
Loại: Hồ sơ đội trưởng
Tình trạng: Bị thiếu trang cuối.

- Họ tên: Lê Văn Hùng
- Vị trí: Đội trưởng vận hành Trạm 09
- Phạm vi phụ trách: Hệ thống kỹ thuật và quy trình trực đêm
- Tình trạng liên lạc: Mất liên lạc
- Ngày liên lạc cuối: Không xác định được

Ghi chú nội bộ:

Ông Hùng có quyền truy cập vào hệ thống phát thanh nội bộ và quy trình vận hành Lens Array.
Một số chỉ thị được phát đi dưới quyền xác nhận của ông Hùng không trùng với tài liệu vận hành đã ban hành.
Chưa xác định được người phát lệnh.

Ghi chú viết tay ở cuối trang:

"Tôi đã làm theo những gì họ yêu cầu.
Nhưng không có lệnh nào trong số đó được gửi từ trung tâm."`
  },
  {
    id: "DOC-RADIO-0015",
    title: "Bản tin Radio – 00:15",
    sourceLabel: "SC-02 · Bản ghi âm tự động",
    category: "broadcast",
    relatedSceneId: "SC-02",
    relatedClueIds: ["C-01"],
    unlockCondition: { hasClue: "C-01" },
    unlockRequiresAnyOf: {
      conditions: [
        { flagEquals: { key: "radio_state", value: "paused" } },
        { flagEquals: { key: "identity_exposed", value: true } }
      ],
      completedDialogueIds: ["DLG-SC02-RADIO"]
    },
    content: `Vị trí: SC-02
Loại: Bản ghi âm tự động.

"Đây là bản tin dành cho nhân viên đang có mặt tại Trạm 09."

"Một nhân viên mặc áo khoác tối màu vừa bước qua cổng phía Đông."

"Nhân viên này chưa hoàn tất đăng ký danh tính."

"Đề nghị nhân viên đọc rõ họ tên vào micro để hoàn tất thủ tục giao ca."

[Tiếng nhiễu kéo dài]

"Chúng tôi đang chờ."

[Hết bản ghi]`
  },
  {
    id: "DOC-ORIGINAL-CASSETTE",
    title: "Băng Cassette gốc",
    sourceLabel: "SC-03 – Ngăn tủ không đánh số · Bản ghi âm cá nhân",
    category: "tape",
    relatedSceneId: "SC-03",
    relatedClueIds: ["C-05"],
    unlockCondition: {
      all: [
        { itemCollected: "I-03" },
        { triggeredOnce: "cassette_side_b_heard" }
      ]
    },
    content: `Vị trí: SC-03 – Ngăn tủ không đánh số
Loại: Bản ghi âm cá nhân
Người ghi âm: Không xác định trong hồ sơ

[Tiếng rè nhẹ, tiếng vật dụng đặt xuống bàn]

Giọng cô bé:

"Bố nhớ ăn tối nhé."
"Con về muộn một chút."
"Chúc bố ngủ ngon."

[Tiếng ghế dịch chuyển]

[Đoạn ghi âm kết thúc]

Ghi chú trên nhãn băng:

Bản gốc. Không sao chép vào hệ thống.`
  },
  {
    id: "DOC-LENS-ARRAY",
    title: "Tài liệu kỹ thuật Lens Array",
    sourceLabel: "SC-04 – Phòng máy · Mã tài liệu: LA-09-02",
    category: "technical",
    relatedSceneId: "SC-04",
    relatedClueIds: ["C-04", "C-07"],
    unlockCondition: {
      all: [
        { hasClue: "C-04" },
        {
          any: [
            { puzzleSolved: "PZ-01" },
            { hasClue: "C-07" }
          ]
        }
      ]
    },
    content: `Vị trí: SC-04 – Phòng máy
Mã tài liệu: LA-09-02

Các chế độ vận hành

LOW

- Giảm nhiễu tín hiệu.
- Thu hẹp vùng quét.
- Cho kết quả quan sát ổn định hơn trong điều kiện bất thường.

NORMAL

- Chế độ vận hành thông thường.
- Dùng cho hoạt động giám sát tiêu chuẩn.

OVERLOAD

- Mở rộng vùng quét vượt giới hạn vận hành thông thường.
- Có nguy cơ gây mất đồng bộ tín hiệu.
- Không được duy trì khi không có nhân viên giám sát.

Ghi chú kỹ thuật

Hệ thống có thể ghi nhận tín hiệu mà không xác định được nguồn phát.
Không sử dụng dữ liệu nhận diện giọng nói làm bằng chứng duy nhất để xác minh danh tính nhân viên.`
  },
  {
    id: "DOC-CAMERA-R04",
    title: "Bản ghi Camera khu nghỉ",
    sourceLabel: "SC-05 – Phòng quan sát · Mã camera: CAM-R04",
    category: "cctv",
    relatedSceneId: "SC-05",
    relatedClueIds: ["C-06"],
    unlockCondition: {
      all: [
        { hasClue: "C-06" },
        {
          any: [
            { puzzleSolved: "PZ-01" },
            { flagEquals: { key: "power_mode", value: "low" } },
            { flagEquals: { key: "locker_knocking", value: true } }
          ]
        }
      ]
    },
    content: `Vị trí: SC-05 – Phòng quan sát
Mã camera: CAM-R04

Thời gian | Nội dung ghi nhận

23:58 | Phạm Quốc Đạt rời khỏi khu nghỉ
00:15 | Không ghi nhận người đi vào
00:42 | Một người xuất hiện trong phòng
00:43 | Người này ngồi trên giường
00:47 | Người này đứng lên
00:49 | Hình ảnh mất ổn định

Kết luận kỹ thuật:

Không đủ dữ liệu để xác định danh tính người xuất hiện lúc 00:42.
Không ghi nhận chuyển động mở cửa tương ứng với thời điểm xuất hiện.

Ghi chú của người kiểm tra:

"Tôi đã xem lại đoạn phim sáu lần.
Không có ai bước vào.
Nhưng người đó vẫn ở trong phòng."`
  }
];

export const CHAPTER1_ARCHIVE_DOCUMENTS: ArchiveDocumentDefinition[] = [
  ...CLUE_BACKED_ARCHIVE_DOCUMENTS,
  ...V4_ORIGINAL_ARCHIVE_DOCUMENTS
];
