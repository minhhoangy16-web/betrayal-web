# Đưa game lên mạng bằng Render

Hướng dẫn này dành cho người chưa từng triển khai web. Không cần viết code, chỉ cần bấm theo thứ tự.
Sau khi xong, bạn có **một đường link** để gửi cho bạn bè; họ mở link là vào game.

Mã nguồn nằm ở kho GitHub `minhhoangy16-web/betrayal-web`. File `render.yaml` trong kho đã ghi sẵn
mọi thiết lập mà Render cần, nên bạn không phải điền lệnh nào.

## Bước 1 – Tạo tài khoản Render

1. Mở <https://render.com> và bấm **Get Started** (hoặc **Sign In** nếu đã có tài khoản).
2. Chọn **GitHub** để đăng nhập bằng chính tài khoản GitHub đang giữ kho mã. Cách này nhanh nhất vì
   Render sẽ thấy được kho của bạn ngay.

## Bước 2 – Tạo dịch vụ từ kho mã

1. Trong trang quản lý của Render (Dashboard), bấm **New** rồi chọn **Blueprint**.
2. Render hỏi quyền truy cập GitHub: bấm cho phép, và chọn kho **betrayal-web**. Nếu không thấy kho
   trong danh sách, bấm vào dòng cấu hình quyền truy cập GitHub (Configure account) và tick thêm kho đó.
3. Chọn kho **betrayal-web** rồi bấm **Connect**.
4. Render đọc file `render.yaml` và hiện một dịch vụ tên `betrayal-web`, gói **Free**. Đặt tên cho
   Blueprint (tuỳ ý) rồi bấm **Apply** / **Deploy Blueprint**.

## Bước 3 – Chờ Render dựng game

1. Bấm vào dịch vụ `betrayal-web` để xem tiến trình. Lần đầu mất vài phút vì Render phải tải thư viện
   và dựng giao diện.
2. Khi trạng thái chuyển sang **Live** (màu xanh), đường link của bạn hiện ở đầu trang, dạng
   `https://betrayal-web-xxxx.onrender.com`.
3. Mở link đó. Nếu thấy màn hình «NGÔI NHÀ TRÊN ĐỒI» với ô nhập tên là đã xong.

## Bước 4 – Chơi

1. Bạn mở link, nhập tên, bấm **Tạo phòng mới**. Game hiện mã phòng 5 ký tự.
2. Gửi link và mã phòng cho bạn bè. Họ mở link, nhập tên và mã phòng rồi bấm **Vào phòng**.
3. Cần từ 3 đến 6 người. Mỗi người chọn một nhân vật, sau đó chủ phòng bấm **Bắt đầu ván chơi**.

## Những điều nên biết

- **Gói miễn phí tự ngủ khi không ai dùng.** Lần đầu mở link sau một thời gian vắng người, trang sẽ
  tải chậm trong lúc Render đánh thức dịch vụ. Hãy mở link trước khi rủ mọi người vào.
- **Ván đang chơi không được lưu lại.** Khi dịch vụ ngủ hoặc khởi động lại, các phòng đang mở sẽ mất.
  Chơi liền một mạch thì không sao.
- **Cập nhật game:** mỗi khi mã nguồn trên GitHub thay đổi, Render tự dựng lại và cập nhật trong vài phút.
  Bạn không phải làm gì thêm.
- **Đổi luật khi cần** (không bắt buộc): trong dịch vụ trên Render, vào **Environment** và thêm biến
  `MIN_PLAYERS` (ví dụ `2` để chơi thử với 2 người) hoặc `HAUNT_THRESHOLD` (ngưỡng Haunt Roll, mặc định `5`).

## Nếu gặp lỗi

- **Trạng thái «Build failed» hoặc «Deploy failed»:** bấm vào tab **Logs** của dịch vụ, chép khoảng 30
  dòng cuối và gửi cho người hỗ trợ (hoặc Claude) để xem lỗi ở đâu.
- **Mở link thấy «Không kết nối được máy chủ»:** dịch vụ đang thức dậy. Chờ khoảng một phút rồi bấm
  **Thử lại**.
- **Không muốn dùng Blueprint:** chọn **New → Web Service**, chọn kho `betrayal-web`, rồi điền
  Build Command `npm install && npm run build`, Start Command `npm start`, gói Free.
