# Kế hoạch: 15 Haunt mới + định dạng sách mới + 2 thẻ kịch bản

Yêu cầu của chủ dự án (19/11/2026):

1. Bỏ kịch bản 9 (Bùa ngải), 13 (Phán quan), 14 (Tranh mộ) trong bản kế hoạch trước; làm 10, 11, 12.
2. Đổi sách Haunt sang bố cục kiểu sách luật gốc: tiêu đề + số, dòng «Kịch bản / Điềm báo kích hoạt /
   Kẻ phản bội», khung «Đọc trước!» (Giới thiệu, Chuẩn bị), cột trái (Mục tiêu, Vật dụng cần), cột phải
   (hành động «Mỗi lượt một lần, bạn có thể…» kèm bảng kết quả đổ xúc xắc, luật đặc biệt), khung quái vật
   có chỉ số. Đoạn «Nếu bạn thắng / thua» KHÔNG hiện trong sách; chỉ hiện thành khung thông báo khi
   ván kết thúc, đúng theo phe thắng / thua.
3. Kịch bản 12 (Tượng nhà mồ) làm theo luật Haunt 5 của sách gốc (tượng chỉ đi khi không bị nhìn, «ú òa»
   hai tượng nhìn nhau thì cùng hoá đá, nhìn thấy tượng thì bị sát thương).
4. Làm bản tiếng Việt của Haunt 2, 3, 4, 9, 15, 18, 22, 25, 30, 34, 35, 40 (không cần màu dân gian).

Nguyên tắc bản quyền (đã chốt từ đầu dự án): theo đúng CƠ CHẾ và CON SỐ của luật gốc, nhưng mọi câu chữ
(giới thiệu, đoạn kết, tên nhân vật) tự viết bằng tiếng Việt, không dịch nguyên văn. Không đưa chữ của sách
gốc vào kho code.

## Khái niệm cần thêm vào máy chủ

| Khái niệm | Dùng cho |
| --- | --- |
| Tầm nhìn (line of sight): các phòng nối thẳng hàng qua cửa, cùng tầng | 5/12, 18 |
| Vị trí người chơi bị giấu với một người xem | 10 |
| Phe bí mật bằng thẻ số (mỗi người cầm thẻ số kín) | 2, 3 |
| Đổi phe giữa ván (bị nhiễm / bị điều khiển) | 3, 35 |
| Kéo người chơi đi theo đường ngắn nhất | 11, 30 |
| Kẻ phản bội chơi bằng nhiều quân ảo ảnh | 18 |
| Free-for-all (ai cũng là địch, người cuối cùng thắng) | 9 |
| Đoạn kết theo phe khi ván kết thúc | tất cả |

## Tóm tắt cơ chế (lời của dự án)

- **2 – Vòng lặp thời gian** (Kẻ phản bội ẩn, Nhẫn). Mỗi người nhận thẻ số kín 1..n, ai cầm số 1 là Kẻ
  phản bội. Thanh đếm bắt đầu 6/5/4/3 (3/4/5/6 người). Cuối lượt người lật Haunt: thanh −1; người sống sót
  không về một phòng chiếu nghỉ/sảnh thì chịu 2 sát thương tinh thần. Hành động: người cầm Nhẫn đổ Tốc độ
  hoặc Tri thức, +1 cho mỗi người sống sót đang đứng ở «phòng có nhiễu loạn thời gian» (5 phòng định
  trước); 7+: phá Nhẫn (Kẻ phản bội chưa lộ thì phải lộ; nếu đã chết thì thắng ngay); 0–6: 6 sát thương
  tổng hợp và về một phòng chiếu nghỉ. Kẻ phản bội có thể lộ mặt ngay trước khi người khác phá Nhẫn để đưa
  mọi người về chiếu nghỉ; lộ mặt thì hồi đầy chỉ số, +1 Sức mạnh. Thắng: phá được Nhẫn và Kẻ phản bội
  chết. Thua: mọi người sống sót chết hoặc thanh đếm về 0.
- **3 – Bụi dịch** (Kẻ phản bội ẩn, lây lan). Mỗi người 3 thẻ «bệnh» kín; có 1 thẻ số 1 (2 thẻ khi 6 người).
  Ai từng cầm thẻ 1 là Kẻ phản bội vĩnh viễn. Cuối lượt: đứng chung phòng với ai thì đổi ngẫu nhiên một thẻ
  với từng người đó; lượt nào không đổi thẻ thì chịu 2 xúc xắc sát thương tổng hợp. «Tìm thuốc» ở phòng
  Điềm báo (Tri thức/Tinh thần 5+ → đặt dấu Nghiên cứu, mỗi phòng một dấu; trượt → đổi một thẻ với người
  bên trái). «Chế thuốc» ở phòng làm được (4 phòng định trước): đổ chỉ số bất kỳ +2 mỗi dấu Nghiên cứu,
  13+ thắng. Kẻ phản bội chết vì sát thương cuối lượt thì thành quái «Kẻ sốt» (Sức mạnh 6, Tốc độ 5).
  Thua: mọi người đều đã nhiễm hoặc chết.
- **4 – Giải nguyền người môi giới** (hợp tác). Quỷ môi giới ở Sảnh vào (Sức mạnh 5, Tốc độ 3, Tinh thần 6,
  không bị choáng; đánh trúng thì đẩy nó đi số phòng bằng sát thương; đánh bằng Tinh thần; cuối lượt quái,
  ai cùng tầng chịu 1 xúc xắc sát thương tinh thần). Dấu Thanh tẩy: đặt sẵn 3/2/1/0 dấu trên phòng có người.
  Hành động: Tìm hiểu lời nguyền (phòng nghiên cứu, Tri thức 5+ → thẻ Hiểu biết); Thanh tẩy phòng (phòng
  Sự kiện, Tốc độ 6+, +2 nếu có Hiểu biết); Chuẩn bị bùa hộ thân (phòng hộ vệ, Sức mạnh 6+, +2 nếu có Hiểu
  biết → thêm 2 xúc xắc khi đánh nhau với quỷ); Làm lễ (cùng phòng với quỷ, Tinh thần +1 mỗi dấu Thanh tẩy
  trên cùng tầng, +1 nếu ở Phòng tế lễ, +2 nếu có Hiểu biết; 13+ thắng; 9–12 không gì; 0–8 mọi người −1
  Tinh thần).
- **5 → 12 – Tượng nhà mồ** (hợp tác). Mỗi người đặt một tượng ở phòng mình đứng, thêm 3/4/5/6 tượng ở
  phòng không ai nhìn thấy. Tượng không đánh và không bị đánh. Lượt quái: tượng tiến về người gần nhất,
  dừng ngay khi vào tầm nhìn của ai đó; tượng đang bị nhìn từ đầu lượt thì đứng yên. Cuối lượt quái: mỗi
  người chịu 1 xúc xắc sát thương tổng hợp cho mỗi tượng trong tầm nhìn. Bước vào phòng thấy một tượng
  mới (lúc đầu lượt chưa thấy): 2 xúc xắc sát thương tổng hợp (tối đa một lần mỗi lượt). Hành động «Ú
  òa»: đứng cùng phòng một tượng mà có tượng khác trong tầm nhìn, đổ Tri thức 4+ → bỏ cả hai tượng;
  trượt → 2 xúc xắc sát thương tổng hợp. Thắng: hết tượng. Thua: mọi người chết.
- **9 – Tượng thần tranh đoạt** (free-for-all). Ai cũng là địch. Thanh đếm bắt đầu 1. Người cầm tượng thần
  cộng giá trị thanh đếm vào đòn Sức mạnh; giết được ai thì thanh +1. Đánh thắng người cầm tượng có thể
  cướp tượng thay vì gây sát thương. «Lục kệ» ở phòng Vật phẩm (Tri thức 5+ → rút Vật phẩm). Đánh tay
  không có thể bỏ Vật phẩm để +1 mỗi món. Thắng: người cuối cùng còn sống.
- **10 – Trốn tìm với Ma xó** (đã duyệt ở bản kế hoạch trước).
- **11 – Đám cưới ma** (đã duyệt ở bản kế hoạch trước).
- **15 – Ba con quái** (Kẻ phản bội là người lật Haunt, đã chết, điều khiển 1/2/2/3 quái ngẫu nhiên trong
  Hồn ma / Ma cà rồng / Người sói xuất hiện ở chỗ xác). Hồn ma: Sức mạnh 4, Tốc độ 4, đi xuyên tường, không
  bị choáng, «Hù»: đòn Tinh thần rồi đẩy người đó đi tối đa số ô bằng Tốc độ của họ. Ma cà rồng: Sức mạnh 5,
  «Hút máu»: đòn Sức mạnh +1 mỗi dấu Máu đang có, rồi thêm 1 dấu. Người sói: Sức mạnh 6, đánh từng người
  trong phòng. Người sống sót: «Tìm vũ khí» ở phòng Vật phẩm/Điềm báo (Tri thức 4+ → xem 4 thẻ trên cùng,
  lấy 1). Diệt Hồn ma bằng Biểu tượng thánh (đấu Tinh thần), Ma cà rồng bằng nỏ, Người sói bằng dao găm;
  thắng thì quái bị diệt. Thắng: diệt hết quái.
- **18 – Nhẫn ảo ảnh** (người lật Haunt). Kẻ phản bội rời bàn cờ, có n thẻ ảo ảnh (thẻ 1 là thật) đặt trong
  phạm vi Tốc độ. Mỗi lượt chơi bằng các ảo ảnh hoặc bằng bản thân, không cả hai. Ảo ảnh có chỉ số của Kẻ
  phản bội, đi đúng bằng Tốc độ, không mở phòng mới, không bị choáng. Người sống sót «Đối mặt ảo ảnh» (Tri
  thức 5+, +2 nếu có Gương → xua tan; trượt 1 xúc xắc tinh thần); đánh thắng ảo ảnh cũng xua tan. Xua tan
  trúng thẻ 1: Kẻ phản bội hiện ra, mọi ảo ảnh thu về, bỏ thẻ số lớn nhất. «Gọi ảo ảnh» (Kẻ phản bội): rải
  lại ảo ảnh, kết thúc lượt. «Gọi Nhẫn» ở Hầm két: Tinh thần +1 mỗi Điềm báo, 8+ → 1 xúc xắc tinh thần cho
  Kẻ phản bội đã lộ hoặc xua một ảo ảnh. Thắng: giết Kẻ phản bội.
- **22 – Chiến dịch dưới hầm** (người bên trái người lật). Kẻ phản bội ở Phòng thí nghiệm (tầng trệt), không
  được rời đi cho tới khi có người sống sót lên tầng trệt. Mọi người sống sót bị đưa xuống Chiếu nghỉ tầng
  hầm; các phòng tầng hầm khác trả lại chồng gạch. Cuối lượt Kẻ phản bội: thêm 0/0/1/1 xác sống ở chiếu
  nghỉ hầm; nếu đang ở Phòng thí nghiệm thì thêm một xác sống ở mỗi phòng tầng hầm còn cửa mở. Xác sống:
  Sức mạnh 5, Tốc độ 2, chết thay vì choáng. «Đánh lạc hướng»: lật gạch tới khi ra một gạch tầng hầm và đặt
  nó. Người sống sót: «Thoát ra» ở Sảnh vào (Tốc độ 6+, +2 nếu có chìa/thuốc nổ) → thắng. «Xem bản đồ» khi
  cầm Hộp sọ (Tri thức 5+ → xem gạch tầng hầm kế tiếp, đặt lên trên hoặc dưới chồng).
- **25 – Bộ giáp mượn thời** (người bên trái người lật). Kẻ phản bội đánh thắng bằng Sức mạnh khi đang mặc
  Giáp: không gây sát thương mà trao Giáp cho người đó. Cuối lượt Kẻ phản bội: ai đang mặc Giáp thì −1 mọi
  chỉ số, Kẻ phản bội +1 mọi chỉ số. Kẻ phản bội chết: đầu lượt sống lại ở chỗ Giáp, hồi đầy. Người sống sót
  «Tìm nguyên liệu» (4 loại theo chỉ số, mỗi loại ở 3 phòng định trước, 4+); «Phá bùa giáp» ở Kho vũ khí hoặc
  Phòng tế lễ khi đã có 1/2/3/4 nguyên liệu: Tinh thần 5+ thắng, trượt −1 Tinh thần.
- **30 – Hôn lễ hồn ma** (Tinh thần thấp nhất trừ người lật). Kẻ phản bội bị nhập, đứng ở Sảnh vào, có 1/2/3/4
  quái «Đoàn rước» ở phòng Điềm báo. Kẻ phản bội tìm Nhẫn: đánh trúng thì lật một Điềm báo của người đó; chỉ
  số không tụt dưới mức ban đầu. Điềm báo của người sống sót bị giấu với Kẻ phản bội. Gạch còn lại rút gọn
  còn 4/6/9/12; gạch cuối cùng được mở là nơi đặt Bàn thờ. Người sống sót cầm Nhẫn «Dẫn hồn» (Tri thức →
  kéo Kẻ phản bội tối đa ngần ấy phòng); «Làm lễ» ở Bàn thờ cùng Kẻ phản bội (Tinh thần 6+ thắng). Kẻ phản bội
  vào phòng Bàn thờ thì không ra được nữa. Kẻ phản bội thắng khi lấy được Nhẫn.
- **34 – Chiều không gian thứ hai** (Tri thức cao nhất). Bản gốc gom mọi gạch về một tầng và cho Kẻ phản bội
  dời gạch; bản web giữ nguyên các tầng nhưng nối thông chúng (đơn giản hoá, ghi rõ trong sách). Người sống
  sót tìm cô bạn mất tích ở phòng Điềm báo (đổ số xúc xắc bằng thanh đếm, 9+), rồi thoát ở Sảnh vào (9+).
  Thanh đếm bắt đầu 6/3/1/0, +1 mỗi phòng Điềm báo mới mở (tối đa 8). Kẻ phản bội: «Nhảy cửa» (Tinh thần 3+
  → tới phòng còn cửa mở bất kỳ), «Bóp méo không gian» 1/1/2/2 lần mỗi lượt (+1 nếu có người đang cõng cô
  bạn): mỗi người sống sót chịu 1 xúc xắc sát thương tổng hợp và bị đẩy đi ngần ấy ô, HOẶC Kẻ phản bội +2
  một chỉ số. Chết thì sống lại ở phòng còn cửa mở.
- **35 – Sên vũ trụ** (người lật Haunt). 2 tổ sên (một ở tầng hầm, một ở tầng trên), 2/3/4/5 sên ở chỗ Kẻ phản
  bội. Sên: Sức mạnh 3, Tốc độ 4, đánh bằng Tinh thần, +1 mỗi sên khác cùng phòng, đánh xong cả đàn trong
  phòng chết; thắng thì người đó bị điều khiển, đổi sang phe Kẻ phản bội. «Gọi đàn» ở tổ: +2 sên. Người
  sống sót «Tìm muối» (Tri thức/Tốc độ 5+ lấy muối; 0–1 thêm một sên), «Phá tổ» (Tốc độ +2 mỗi muối bỏ ra,
  9+ phá; 0–4 thêm sên). Thắng: phá cả hai tổ. Thua: mọi người chết hoặc bị điều khiển.
- **40 – Song trùng** (người lật Haunt). 2/3/4/5 «bản sao» ở chỗ Kẻ phản bội, mỗi bản sao mang danh tính một
  người sống sót và có chỉ số ban đầu của người đó, đi đúng bằng Tốc độ, đánh bằng chỉ số bất kỳ. Bản sao bị
  chính chủ hoặc người cầm Mặt nạ gây sát thương thì chết, còn lại thì choáng. Kẻ phản bội «Bảo vệ gia đình»:
  dựng dậy bản sao đang choáng cùng phòng. Người sống sót «Soi cầu» ở Tháp/Phòng tế lễ (Tri thức 5+ → làm
  choáng một bản sao); đánh thắng Kẻ phản bội có thể cướp Mặt nạ. Thắng: giết hết bản sao.

## Thứ tự làm (đánh dấu khi xong)

- [x] Đợt 1: định dạng sách mới + khung thông báo kết thúc; đổi 8 kịch bản cũ sang định dạng mới
- [ ] Đợt 2: tầm nhìn + Tượng nhà mồ (5/12), Giải nguyền (4), Tượng thần tranh đoạt (9)
- [ ] Đợt 3: Ba con quái (15), Chiến dịch dưới hầm (22), Bộ giáp (25), Song trùng (40), Sên vũ trụ (35)
- [ ] Đợt 4: Đám cưới ma (11), Hôn lễ hồn ma (30), Chiều không gian (34), Nhẫn ảo ảnh (18)
- [ ] Đợt 5: Kẻ phản bội ẩn bằng thẻ số: Vòng lặp (2), Bụi dịch (3); Trốn tìm (10)
- [ ] Đợt 6: 2 thẻ kịch bản mới, xếp lại bảng của 6 thẻ cũ, đo cân bằng toàn bộ
