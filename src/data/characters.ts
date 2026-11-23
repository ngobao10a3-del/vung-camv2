import type { CharacterDefinition } from "../types/dialogue";

export const CHAPTER1_CHARACTERS: CharacterDefinition[] = [
  {
    id: "CHAR-SYS",
    name: "Hệ thống Trạm 09 / Bản tin tự động",
    role: "Hệ thống liên lạc và in nhiệt tự động",
    recordedStatus: "automated_system",
    statusNote: "Thiết bị trực trạm vẫn tự động in bản tin nhiệt và phát sóng vô tuyến trong ca đêm tháng 11/1998.",
    description:
      "Tổ hợp máy in nhiệt thời tiết, bộ đàm VHF và điện thoại nội bộ tại Trạm Hải Đăng Mũi Sương – Trạm 09. Thời gian in trên cuộn giấy chạy sớm hơn đồng hồ thực tế.",
    defaultExpression: "neutral",
    portraitTag: "system_terminal"
  },
  {
    id: "CHAR-PLAYER",
    name: "Nhân viên trực thay thế",
    role: "Nhân viên trực ca đêm",
    recordedStatus: "active_duty",
    statusNote: "Đang nhận ca trực đêm thay thế tại Trạm 09 vào tháng 11/1998.",
    description:
      "Người tiếp nhận ca trực lúc 23:40 trong bộ áo khoác tối màu. Chưa gặp trực tiếp nhân viên tiền nhiệm lúc bàn giao.",
    defaultExpression: "tense",
    portraitTag: "duty_officer"
  },
  {
    id: "CHAR-MINH",
    name: "Trần Minh",
    role: "Nhân viên trực tiền nhiệm",
    recordedStatus: "unconfirmed_archive",
    statusNote: "Hồ sơ chỉ ghi nhận sổ trực viết dở và bản ghi âm Mặt A; tung tích hiện tại chưa được xác minh.",
    description:
      "Người ghi chép về góc khuất thấu kính Fresnel và để lại cảnh báo không bật đèn pin khi sương đã lọt qua cổng. Trang cuối sổ trực của anh bị xé dở.",
    defaultExpression: "tense",
    portraitTag: "archival_tape"
  },
  {
    id: "CHAR-HUNG",
    name: "Lê Văn Hùng",
    role: "Trạm trưởng Trạm 09",
    recordedStatus: "missing",
    statusNote: "Biên bản niêm phong ghi nhận ông đã mất tích sau một ca trực đêm đơn độc trước thời điểm hiện tại.",
    description:
      "Trạm trưởng Trạm Hải Đăng Mũi Sương. Hồ sơ tâm lý cho biết ông suy sụp sau tai nạn của con gái nhỏ và thường ngồi hàng giờ bên điện thoại nội bộ.",
    defaultExpression: "shadowed",
    portraitTag: "personnel_dossier"
  },
  {
    id: "CHAR-DAT",
    name: "Phạm Quốc Đạt",
    role: "Nhân viên cũ được ghi trên thẻ tại SC-03",
    recordedStatus: "unconfirmed_archive",
    statusNote: "Chỉ tìm thấy một thẻ nhân viên cũ dưới giường sắt ở SC-03 với ghi chú mặt sau bị hư hại; chưa rõ vai trò và thời điểm rời trạm.",
    description:
      "Tên xuất hiện trên tấm thẻ nhân viên phủ bụi bên dưới giường sắt khu nghỉ. Tài liệu hiện có chưa đủ để xác định chuyện gì đã xảy ra với người này.",
    defaultExpression: "shadowed",
    portraitTag: "worn_id_card"
  }
];
