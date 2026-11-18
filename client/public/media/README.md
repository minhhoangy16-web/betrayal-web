# Ảnh và nhạc tuỳ chọn

Thư mục này chứa bộ ảnh SVG gốc cho 35 gạch phòng (`tiles/`) và 31 thẻ (`cards/`), do script
`tools/generate-art.mjs` sinh ra (`npm run art` ở thư mục gốc để vẽ lại sau khi sửa script hoặc thêm
gạch/thẻ mới). Nhạc nền và hiệu ứng thì được tổng hợp bằng Web Audio, không cần file.

Bạn có thể thay bất kỳ ảnh hay âm thanh nào bằng file **của riêng bạn** (tự vẽ, tự thu, hoặc có giấy
phép cho phép dùng). Lưu ý `npm run art` sẽ ghi đè các mục ảnh trong manifest về lại file SVG.

Khai báo file trong `manifest.json`. Đường dẫn tính từ thư mục `media/`; cũng có thể dùng URL đầy đủ.

```json
{
  "images": {
    "tiles": { "kitchen": "tiles/kitchen.webp", "foyer": "tiles/foyer.webp" },
    "cards": { "it-fire-axe": "cards/fire-axe.webp" }
  },
  "audio": {
    "music": { "explore": "audio/explore.mp3", "haunt": "audio/haunt.mp3" },
    "sfx": { "dice": "audio/dice.mp3" }
  }
}
```

## Ảnh

- **Khoá** là `id` của gạch (`server/src/data/tiles.js`) hoặc của thẻ (`server/src/data/cards/*.js`).
- **Ảnh gạch:** hình vuông, khoảng 512×512. Vẽ ở góc xoay 0, tức là cửa nằm đúng các cạnh ghi trong
  `doors` của gạch đó (0 = cạnh trên, 1 = phải, 2 = dưới, 3 = trái). Game tự xoay ảnh theo gạch.
  Tên phòng, biểu tượng và vạch cửa vẫn được vẽ đè lên ảnh.
- **Ảnh thẻ:** tỉ lệ tuỳ ý (thẻ dọc khoảng 5:7 là đẹp), hiện ở ô «thẻ vừa rút» và trong túi đồ.
  Tên và nội dung thẻ vẫn hiện bằng chữ bên dưới ảnh, vì luật của thẻ nằm ở dữ liệu server chứ không
  nằm trong ảnh.
- Gạch hoặc thẻ không có trong manifest (hoặc file bị thiếu) sẽ dùng giao diện vẽ sẵn.

## Chân dung nhân vật

- `portraits/<id>.webp`: chân dung (khoảng 640×460) cho bảng nhân vật và màn chọn nhân vật; nên để mặt
  ở khoảng 1/5 phía trên ảnh vì giao diện cắt theo chiều ngang.
- `portraits/<id>-face.webp`: ảnh vuông nhỏ (160×160) quanh khuôn mặt, dùng làm quân cờ và trong danh
  sách người chơi.
- Khai báo trong `manifest.json` ở nhóm `images.portraits` và `images.faces`, khoá là `id` nhân vật.
  Muốn đổi ảnh thì chỉ cần ghi đè file cùng tên.

## Âm thanh

| Nhóm | Khoá | Khi nào phát |
|------|------|--------------|
| `music` | `lobby` | Trang chủ và phòng chờ |
| `music` | `explore` | Giai đoạn khám phá |
| `music` | `haunt` | Sau khi Haunt bắt đầu |
| `music` | `ended` | Ván kết thúc |
| `sfx` | `dice` | Mỗi lần đổ xúc xắc |
| `sfx` | `card` | Rút thẻ |
| `sfx` | `door` | Một phòng mới được đặt xuống |
| `sfx` | `hit` | Chỉ số của bạn bị giảm |
| `sfx` | `haunt` | Haunt bắt đầu |
| `sfx` | `end` | Phân định thắng thua |
| `sfx` | `turn` | Tới lượt bạn (hoặc bạn cần đổ xúc xắc, chia sát thương…) |

Nhạc nền được phát lặp lại và chuyển mượt giữa các giai đoạn. Khoá nào không khai báo, hoặc file không
phát được, sẽ dùng âm thanh tổng hợp. Định dạng: bất kỳ thứ gì trình duyệt phát được (mp3, ogg, wav).

Muốn chỉnh nhạc tổng hợp (cao độ, độ tối, nhịp tim…), sửa bảng `MOODS` trong `client/src/lib/audio.js`.
