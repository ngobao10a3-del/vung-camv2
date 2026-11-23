import type { ClueDefinition, DeductionGroup } from "../types/investigation";

export const CHAPTER1_CLUES: ClueDefinition[] = [
  {
    id: "C-01",
    title: "Bản tin nhiệt 02:15",
    category: "document",
    summary: "Bản tin thời tiết in trước thời điểm thực tế, mô tả chính xác trang phục của bạn.",
    detailContent:
      "Dải giấy nhiệt in lúc 02:15 ghi rõ: 'Nhân viên trực thay thế mặc áo khoác tối màu sẽ báo cáo danh tính qua vô tuyến'. Dấu thời gian trên cuộn giấy chạy sớm hơn đồng hồ treo tường hơn hai tiếng.",
    relatedRuleIds: ["R-02", "R-04"],
  },
  {
    id: "C-02",
    title: "Sổ trực của Trần Minh",
    category: "document",
    summary: "Ghi chép thực địa của nhân viên tiền nhiệm Trần Minh về phương pháp đo vùng mù của thấu kính.",
    detailContent:
      "Trần Minh ghi lại danh sách ba nhân viên mất tích đúng 10 phút sau khi tên họ xuất hiện trên bản tin nhiệt. Anh phát hiện chùm sáng từ thấu kính có một góc khuất cơ học khi ghép liền chỉ số góc phương vị và biên độ lệch pha trên màn radar. Dòng cuối viết vội bằng bút chì: 'Đừng bật đèn pin khi sương đã lọt qua cổng — nó bám theo ánh sáng.' Trang sau bị xé dở, không rõ anh đã rời đi đâu.",
    relatedRuleIds: ["R-01", "R-03", "R-10"],
  },
  {
    id: "C-03",
    title: "Hồ sơ nhân sự Trạm 09",
    category: "document",
    summary: "Hồ sơ xác nhận trạm trưởng Lê Văn Hùng đã mất tích sau một ca trực đêm đơn độc.",
    detailContent:
      "Biên bản niêm phong ghi nhận trạm trưởng Lê Văn Hùng mất tích sau một ca trực đêm đơn độc. Ghi chú tâm lý đính kèm cho biết ông suy sụp kéo dài kể từ tai nạn khiến con gái nhỏ qua đời một năm trước. Những ghi chép cuối cùng còn cho thấy ông thường xuyên ngồi hàng giờ bên điện thoại nội bộ.",
    relatedRuleIds: ["R-04", "R-09"],
  },
  {
    id: "C-04",
    title: "Sơ đồ tải điện và thấu kính",
    category: "blueprint",
    summary: "Bản vẽ kỹ thuật mô tả ba chế độ tải điện LOW, NORMAL, OVERLOAD và ảnh hưởng lên radar cùng thấu kính.",
    detailContent:
      "Bản vẽ kỹ thuật phân rõ ba chế độ tải điện tại Phòng máy:\n• LOW (Chế độ tải thấp): Hạ áp nhánh phụ để triệt tiêu nhiễu cao tần, là mức tải bắt buộc giúp thiết bị radar quan sát ở SC-05 đo được vùng mù thấu kính.\n• NORMAL (Chế độ tải tiêu chuẩn): Duy trì vận hành thông thường của trạm nhưng không lọc được nhiễu cao tần, khiến màn hình radar bị nhiễu sóng mang.\n• OVERLOAD (Chế độ quá tải): Đẩy công suất thấu kính Fresnel vượt ngưỡng để khuếch đại chùm quét xuyên qua vách ngăn toàn trạm và làm quá tải rơ-le khóa cổng.",
    relatedRuleIds: ["R-05", "R-07"],
  },
  {
    id: "C-05",
    title: "Băng cassette (Mặt A & Mặt B)",
    category: "audio_transcript",
    summary: "Mặt A chứa cảnh báo của Trần Minh; Mặt B lưu bản ghi âm gốc giọng con gái Hùng.",
    detailContent:
      "[Mặt A - Giọng Trần Minh]: 'Nếu ai nghe được băng này, đừng mở tủ 04 khi có tiếng gõ. Khóa liên động buồng đèn chỉ nhả chốt khi bộ đàm đang ở trạng thái tạm dừng.' — [Mặt B - Bản ghi âm gốc]: Giữa tiếng rè tĩnh điện là giọng một bé gái gọi 'Bố Hùng ơi, mở cửa cho con...'. Âm thanh có nhịp thở tự nhiên, ngắt nghỉ và biến đổi ngữ điệu như một bản ghi âm đời thực. Đây là giọng nói thật được lưu trên băng, không phải giọng nói phát ra từ điện thoại nội bộ.",
    relatedRuleIds: ["R-06", "R-08"],
  },
  {
    id: "C-06",
    title: "Dữ liệu Camera hành lang",
    category: "cctv",
    summary: "Bản lưu hình ảnh cho thấy làn sương trắng di chuyển có chủ đích theo ánh đèn.",
    detailContent:
      "Đoạn băng trích xuất từ camera hành lang ghi lại cảnh một nhân viên cũ bật đèn pin chạy dọc hành lang khi điện trạm hạ tải. Làn sương lập tức đổi hướng, uốn lượn bám sát vệt sáng đèn pin cho tới khi nuốt trọn góc khuất.",
    relatedRuleIds: ["R-01", "R-10"],
  },
  {
    id: "C-07",
    title: "Bảng hiệu chỉnh bộ lọc quang học",
    category: "blueprint",
    summary: "Thông số bước sóng vô hiệu hóa khả năng quét sinh học của thấu kính.",
    detailContent:
      "Tài liệu phòng thí nghiệm xác nhận chùm sáng trắng nguyên bản của thấu kính hoạt động như một máy quét ghi nhận thực thể sống. Lắp kính lọc đỏ có bước sóng trên 620nm sẽ triệt tiêu phổ ghi nhận này. Tài liệu cũng đề cập chức năng đảo pha tần số để xóa dữ liệu tồn dư trong buồng đèn.",
    relatedRuleIds: ["R-03"],
  },
  {
    id: "C-08",
    title: "Bản nháp viết tay bị giấu",
    category: "document",
    summary: "Lời thú nhận của trạm trưởng Lê Văn Hùng về giọng nói giả mạo và nguồn gốc các quy tắc giả.",
    detailContent:
      "Nét chữ run rẩy của Lê Văn Hùng: 'Bản ghi ở mặt B là giọng thật của con bé. Nhưng giọng nói qua điện thoại không phải con bé. Tôi biết có thứ gì đó đang bắt chước giọng con bé, nhưng tôi không nỡ ngắt máy. Nó bảo chỉ cần thêm vài cái tên vào sổ trực và bật quá tải thấu kính, nó sẽ trả con bé lại. Tôi đã viết thêm những quy tắc giả vào sổ trực. Nếu có người đến sau đọc được tờ giấy này, xin hãy đảo ngược tần số buồng đèn.'",
    relatedRuleIds: ["R-04", "R-05", "R-06"],
  },
  {
    id: "C-09",
    title: "Thẻ nhân viên Phạm Quốc Đạt",
    category: "document",
    summary: "Thẻ nhân viên cũ mang tên Phạm Quốc Đạt được tìm thấy bên dưới giường tại SC-03.",
    detailContent: "Một thẻ nhân viên cũ nằm khuất dưới giường sắt tại SC-03. Tên Phạm Quốc Đạt vẫn có thể đọc được. Phần ghi chú ở mặt sau đã bị hư hại. Dữ kiện hiện có chưa đủ để xác định vai trò của người này, thời điểm rời đi hoặc chuyện gì đã xảy ra với người đó.",
    relatedRuleIds: [],
  },
];

export const CHAPTER1_DEDUCTION_GROUPS: DeductionGroup[] = [
  {
    id: "DG-R01",
    ruleId: "R-01",
    requiredClueIds: ["C-02", "C-06"],
    resultingStatus: "verified",
    deductionNote: "Sương mù là thực thể săn mồi bên ngoài hàng rào; tuyệt đối giữ kín cửa ngoài.",
  },
  {
    id: "DG-R02",
    ruleId: "R-02",
    requiredClueIds: ["C-01"],
    resultingStatus: "verified",
    deductionNote: "Bản tin nhiệt phản chiếu trước hành động của người trực. Phải tạm dừng bộ đàm khi bản tin xuất hiện.",
  },
  {
    id: "DG-R03",
    ruleId: "R-03",
    requiredClueIds: ["C-02", "C-07"],
    resultingStatus: "verified",
    deductionNote: "Chùm sáng trắng ghi nhận sinh vật sống; phải lắp bộ lọc đỏ (> 620nm) trước khi bước vào vùng chiếu.",
  },
  {
    id: "DG-R04",
    ruleId: "R-04",
    requiredClueIds: ["C-01", "C-08"],
    resultingStatus: "debunked_fake",
    deductionNote: "Quy tắc yêu cầu ký sổ và đọc mã nhân viên là bẫy do Lê Văn Hùng viết thêm để dâng danh tính cho dị thường.",
  },
  {
    id: "DG-R05",
    ruleId: "R-05",
    requiredClueIds: ["C-04", "C-08"],
    resultingStatus: "debunked_fake",
    deductionNote: "Chế độ OVERLOAD là bẫy kích hoạt quét xuyên trạm và phá khóa cổng, trái ngược hoàn toàn với an toàn kỹ thuật.",
  },
  {
    id: "DG-R06",
    ruleId: "R-06",
    requiredClueIds: ["C-05", "C-08"],
    resultingStatus: "debunked_fake",
    deductionNote: "Tiếng gõ ba nhịp trong tủ số 04 là mồi nhử bắt chước của thực thể bên trong trạm.",
  },
  {
    id: "DG-R07",
    ruleId: "R-07",
    requiredClueIds: ["C-04"],
    resultingStatus: "conditional_confirmed",
    deductionNote: "Thiết bị radar quan sát chỉ hoạt động chính xác khi nguồn điện được hạ về mức tải LOW.",
  },
  {
    id: "DG-R08",
    ruleId: "R-08",
    requiredClueIds: ["C-05"],
    resultingStatus: "conditional_confirmed",
    deductionNote: "Khóa liên động cửa buồng đèn chỉ nhả chốt khi bộ đàm đang tạm dừng (PAUSED).",
  },
  {
    id: "DG-R09",
    ruleId: "R-09",
    requiredClueIds: ["C-03"],
    resultingStatus: "verified",
    deductionNote: "Việc trạm trưởng Lê Văn Hùng đã mất tích từ trước khiến các chỉ thị qua điện thoại nội bộ cần được kiểm chứng thận trọng. Hồ sơ C-03 chưa đủ để kết luận mọi cuộc gọi đều là giả mạo.",
  },
  {
    id: "DG-R10",
    ruleId: "R-10",
    requiredClueIds: ["C-02", "C-06"],
    resultingStatus: "conditional_confirmed",
    deductionNote: "Khi sương lọt vào trạm hoặc điện hạ mức LOW, phải tắt đèn pin trước khi di chuyển giữa các phòng.",
  },
];