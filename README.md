# Betrayal Web – nhà ma nhiều người chơi thời gian thực

Game web multiplayer theo cơ chế khám phá nhà ma có kẻ phản bội (luật tham chiếu: bản 3rd Edition).
Trạng thái hiện tại: **Bước 1 (kiến trúc + schema), Bước 2 (backend) và Bước 3 (frontend) đã xong.**

- Kiến trúc, schema dữ liệu, giao thức socket: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- JSON Schema: [shared/schemas/](shared/schemas/)

## Chơi online

Server phục vụ luôn giao diện đã build, nên chỉ cần triển khai một dịch vụ và có một đường link.
Hướng dẫn từng bước cho Render: [DEPLOY.md](DEPLOY.md). Chạy kiểu đó trên máy mình:

```bash
npm install && npm run build && npm start    # rồi mở http://localhost:3001
```

## Yêu cầu

Node.js 18.17 trở lên (khuyên dùng 20 hoặc 22).

## Cài đặt và chạy

```bash
npm install          # ở thư mục gốc – cài cho cả server và client (npm workspaces)
npm run server       # terminal 1: http://localhost:3001  (server:dev để tự khởi động lại khi sửa code)
npm run client       # terminal 2: http://localhost:5173
```

Mở `http://localhost:5173` trong **3 tab** (hoặc nhiều hơn): mỗi tab là một người chơi riêng vì phiên chơi
được lưu trong `sessionStorage` của từng tab. Tab đầu tạo phòng, các tab còn lại nhập mã phòng để vào.
Tải lại một tab sẽ tự quay về đúng chỗ trong ván.

Kiểm tra server: mở `http://localhost:3001/health` và `http://localhost:3001/api/catalog`.

| Biến môi trường | Mặc định | Ý nghĩa |
|-----------------|----------|---------|
| `PORT` | `3001` | Cổng server |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Chỉ cần khi giao diện ở địa chỉ khác server (nhiều origin cách nhau bằng dấu phẩy) |
| `MIN_PLAYERS` | `3` | Hạ xuống `2` để thử với ít tab hơn |
| `HAUNT_THRESHOLD` | `5` | Ngưỡng Haunt Roll; đặt `1` để Haunt nổ ngay ở Omen đầu tiên khi test |
| `VITE_SERVER_URL` | cùng địa chỉ trang | (client) Chỉ đặt khi giao diện và server ở hai địa chỉ khác nhau |

Ví dụ (macOS/Linux): `MIN_PLAYERS=2 HAUNT_THRESHOLD=1 npm run server`
Trên Windows PowerShell: `$env:MIN_PLAYERS=2; $env:HAUNT_THRESHOLD=1; npm run server`

## Chạy test

```bash
npm test
```

Test không cần `npm install` (engine không có phụ thuộc ngoài, lớp socket được test bằng io giả).
Bộ test gồm kiểm tra luật từng phần và một bài mô phỏng 300 ván do bot ngẫu nhiên chơi từ đầu tới khi
phân thắng thua, kiểm tra GameState theo JSON Schema trong suốt quá trình.

## Giao diện

| Thành phần | File | Ghi chú |
|------------|------|---------|
| Trang chủ, phòng chờ | `client/src/components/Lobby.jsx` | Tạo/vào phòng, chọn nhân vật, chủ phòng bắt đầu |
| Bàn cờ | `Board.jsx` | Lưới theo tầng; kéo để di chuyển, lăn chuột để zoom; bấm ô sáng để đi / mở cửa |
| Bảng hành động | `ActionPanel.jsx` | Sinh nút từ `view.legal` của server: đi, xoay/đặt gạch, đổ xúc xắc, chia sát thương, tấn công, quái vật |
| Bảng nhân vật | `TraitPanel.jsx` | Chân dung có tên, số thẻ đang giữ; nhóm Thể chất / Trí óc; nấc nguy kịch đỏ, khởi đầu xanh, hiện tại có khung đỏ |
| Người chơi, túi đồ, xúc xắc, nhật ký | `SidePanels.jsx` | |
| Sách Haunt | `HauntBook.jsx` | Tự mở khi Haunt bắt đầu; chỉ hiện cuốn của phe mình |
| Mặt thẻ | `CardFace.jsx` | Kiểu giấy cũ: hình bóng đen, tên in hoa, bảng kết quả theo điểm xúc xắc – dựng từ dữ liệu thẻ |
| Hiệu ứng bàn cờ | `TableEffects.jsx` | Ba chồng bài; thẻ bay ra, lật mặt, hiện nội dung; xúc xắc lăn rồi dừng |
| Mất kết nối | `DisconnectBanner.jsx` | Đếm ngược tự bỏ lượt, nút bỏ qua cho chủ phòng |
| Kết nối và trạng thái | `store/useGameStore.js`, `lib/socket.js` | Zustand + socket.io-client |

Client không tự tính luật: nó gửi `game:action` và vẽ lại theo `game:state` nhận về.

Trên màn hình hẹp hơn 1024px (điện thoại), bàn cờ nằm trên và các bảng chuyển thành tab
(Lượt, Nhân vật, Túi đồ, Nhật ký). Khi tới lượt bạn: có âm báo, điện thoại rung, và tiêu đề tab
nhấp nháy nếu bạn đang ở tab khác.

## Hình ảnh và âm thanh

- **Âm thanh có sẵn:** nhạc nền ambient đổi theo giai đoạn (phòng chờ, khám phá, Haunt, kết thúc) và các
  hiệu ứng (xúc xắc, rút thẻ, mở cửa, trúng đòn, Haunt nổ ra) đều được tổng hợp trong trình duyệt bằng
  Web Audio – không kèm file nhạc nào. Nút tắt tiếng và thanh âm lượng nằm trên thanh trạng thái.
- **Ảnh có sẵn:** bộ SVG gốc cho mọi gạch phòng và thẻ, sinh từ `tools/generate-art.mjs`. Thêm gạch hoặc
  thẻ mới thì thêm bố cục vào bảng `ROOMS` / `GLYPHS` trong script rồi chạy `npm run art`.
- **Ảnh và nhạc của riêng bạn:** đặt file vào `client/public/media/` và khai báo trong `manifest.json`.
  Hướng dẫn đầy đủ: [client/public/media/README.md](client/public/media/README.md).

## Thêm nội dung

- **Thẻ mới:** thêm object vào `server/src/data/cards/{omens,items,events}.js` (định dạng: `shared/schemas/card.schema.json`).
- **Phòng mới:** thêm vào `server/src/data/tiles.js`. Nhớ giữ số thẻ Omen ≥ số phòng Omen (test sẽ báo nếu sai).
- **Nhân vật mới:** thêm vào `server/src/data/characters.js`.
- **Haunt mới:** sao chép `server/src/haunts/haunt01-vong-hon.js`, đổi `id`, rồi thêm vào `HAUNT_LIST` trong `haunts/index.js`.

Chạy `npm test` sau mỗi lần thêm: dữ liệu sai định dạng sẽ bị bắt ngay.
