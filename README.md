# Vùng Cấm — Checkpoint 01: Core Foundation

Đây là bản nền kỹ thuật đầu tiên, có giao diện demo tương tác tối giản và các module Core độc lập. Chưa phải Chapter 1 hoàn chỉnh.

## Yêu cầu
- Node.js 20 LTS trở lên
- npm

## Cài đặt và chạy
```bash
npm install
npm run dev
```
Mở địa chỉ Vite in ra trong terminal (thường là http://localhost:5173).

## Kiểm tra
```bash
npm run typecheck
npm test
npm run build
```

## Nội dung đã có
- React + TypeScript + Vite
- GameStateStore: flags, inventory, clues, puzzles, entities, rules, scene, ending, logs
- ConditionEvaluator: điều kiện khai báo, không dùng eval
- EffectExecutor: thực thi effect theo thứ tự và hỗ trợ onceId
- EventDispatcher: queue, snapshot điều kiện theo từng event, loop guard
- Save/Load JSON schema version 1
- Demo UI cho SC-01 với trạng thái, vật phẩm và nhật ký

## Lưu ý
- Giao diện demo hiện cho phép thử một số state mutation trực tiếp để kiểm tra Core; chưa áp dụng đầy đủ RuleSystem nên nút “Mở cửa ngoài” chỉ minh họa thay đổi trạng thái.
- `ADD_ITEM` trong Core chặn nhặt lại vật phẩm đã từng thu thập, kể cả sau khi tiêu thụ.
- Chưa tích hợp nội dung đầy đủ của 6 scene, 10 rules, 3 puzzles, clue deduction hoặc ending logic.
- Không có backend, tài khoản hoặc API AI bắt buộc.
