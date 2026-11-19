// Thẻ kịch bản (Scenario Card): đọc lúc bắt đầu ván để biết vì sao cả nhóm bước vào ngôi nhà.
// Mỗi thẻ có một bảng Haunt riêng: Haunt nào nổ ra tuỳ thẻ Điềm báo vừa rút và tầng của căn phòng
//   table[omenId] = [rút ở tầng trệt hoặc tầng trên, rút ở tầng hầm]
// Nội dung viết mới hoàn toàn cho game này.

const H = {
  damcuoi: 'haunt-dam-cuoi-ma',
  honle: 'haunt-hon-le-hon-ma',
  sen: 'haunt-sen-vu-tru',
  duoiham: 'haunt-duoi-ham',
  songtrung: 'haunt-song-trung',
  bogiap: 'haunt-bo-giap',
  quaivat: 'haunt-hoi-quai-vat',
  vong: 'haunt-01', trung: 'haunt-trung-tang', mada: 'haunt-ma-da', loban: 'haunt-lo-ban',
  malai: 'haunt-ma-lai', cohon: 'haunt-co-hon', giucua: 'haunt-ma-giu-cua', trucvong: 'haunt-truc-vong',
  tuong: 'haunt-tuong-nha-mo', giainguyen: 'haunt-giai-nguyen', tuongthan: 'haunt-tuong-than',
};

const table = (rows) => ({
  'om-leather-journal': rows[0],
  'om-porcelain-mask': rows[1],
  'om-ritual-knife': rows[2],
  'om-engraved-ring': rows[3],
  'om-stray-dog': rows[4],
  'om-crystal-orb': rows[5],
  'om-cracked-skull': rows[6],
  'om-silver-necklace': rows[7],
  'om-girl-in-mirror': rows[8],
  'om-black-cat': rows[9],
  'om-funeral-portrait': rows[10],
  'om-dead-hairpin': rows[11],
});

export const SCENARIOS = [
  {
    id: 'di-chuc',
    title: 'Bản di chúc trên đồi',
    icon: 'scroll',
    tagline: 'Một lá thư của văn phòng luật sư, gửi tới từng người trong nhóm.',
    story:
      'Ông Phán Lâm, người đàn ông giàu có mà mỗi người trong các bạn chỉ gặp đúng một lần, đã qua đời không người thân thích. ' +
      'Văn phòng luật sư mời các bạn tới căn biệt thự kiểu Pháp trên đồi để nghe đọc di chúc, đúng mười hai giờ đêm, theo yêu cầu của người đã khuất. ' +
      'Người làng dưới chân đồi đồn rằng ông chôn cả gia tài dưới nền nhà, và chưa người thợ nào làm cho ông được trả đủ công.',
    purpose: 'Tìm ra bản di chúc và hiểu vì sao ông chọn chính các bạn.',
    table: table([
      [H.loban, H.tuong], [H.trucvong, H.malai], [H.giainguyen, H.trung], [H.giucua, H.trucvong], [H.tuongthan, H.vong],
      [H.loban, H.mada], [H.bogiap, H.quaivat], [H.damcuoi, H.cohon], [H.trucvong, H.mada],
      [H.honle, H.sen], [H.mada, H.loban], [H.duoiham, H.songtrung],
    ]),
  },
  {
    id: 'livestream',
    title: 'Đêm livestream săn ma',
    icon: 'video',
    tagline: 'Kênh «Đi Đâu Cũng Gặp Ma» cần một tập thật đặc biệt cho rằm tháng Bảy.',
    story:
      'Mười vạn người đang chờ xem. Cả nhóm mang đèn pin, máy quay hồng ngoại và một bàn cầu cơ mua trên mạng, ' +
      'leo rào vào ngôi nhà bỏ hoang nổi tiếng nhất vùng. Tín hiệu điện thoại tắt ngúm ngay khi cánh cổng khép lại, ' +
      'nhưng máy quay vẫn đang ghi, và có ai đó vừa thả tim trong phần bình luận.',
    purpose: 'Quay được thứ gì đó thật, rồi sống sót để đăng lên.',
    table: table([
      [H.trucvong, H.vong], [H.trucvong, H.malai], [H.quaivat, H.giainguyen], [H.giucua, H.trucvong], [H.cohon, H.tuongthan],
      [H.duoiham, H.tuong], [H.damcuoi, H.trung], [H.songtrung, H.bogiap], [H.trucvong, H.mada],
      [H.cohon, H.trucvong], [H.honle, H.sen], [H.loban, H.malai],
    ]),
  },
  {
    id: 'mua-lu',
    title: 'Mưa lũ trên đèo',
    icon: 'rain',
    tagline: 'Đèo sạt lở, xe chết máy, và chỉ còn một ngôi nhà còn sáng đèn.',
    story:
      'Chuyến xe khách cuối ngày dừng hẳn giữa đèo khi một mảng núi đổ xuống chắn ngang đường. Nước suối dâng lên từng phút. ' +
      'Phía trên con dốc là một ngôi nhà cổ, cửa không khoá, bếp còn ấm như có người vừa nấu cơm. ' +
      'Không ai trả lời khi các bạn gọi. Chỉ có tiếng nước nhỏ giọt ở đâu đó dưới sàn.',
    purpose: 'Trú qua đêm nay, chờ trời sáng để tìm đường xuống núi.',
    table: table([
      [H.damcuoi, H.tuongthan], [H.malai, H.trucvong], [H.vong, H.tuong], [H.giucua, H.trucvong], [H.sen, H.giainguyen],
      [H.mada, H.loban], [H.bogiap, H.quaivat], [H.honle, H.cohon], [H.trucvong, H.mada],
      [H.trucvong, H.trung], [H.giucua, H.mada], [H.duoiham, H.songtrung],
    ]),
  },
  {
    id: 'mat-tich',
    title: 'Người bạn mất tích',
    icon: 'search',
    tagline: 'Tin nhắn cuối cùng của Hạnh: «Trong nhà này có người. Đừng tới.»',
    story:
      'Ba ngày trước, Hạnh, người bạn chung của cả nhóm, nhận việc dọn dẹp cho một ngôi nhà trên đồi rồi không về nữa. ' +
      'Công an nói chưa đủ bốn mươi tám giờ, gia đình thì đã thắp hương. ' +
      'Các bạn tìm thấy xe máy của Hạnh dựng ngay trước cổng, chìa khoá vẫn cắm trong ổ.',
    purpose: 'Tìm Hạnh, hoặc ít nhất là tìm ra chuyện gì đã xảy ra.',
    table: table([
      [H.trung, H.tuong], [H.trucvong, H.malai], [H.duoiham, H.giainguyen], [H.trucvong, H.giucua], [H.quaivat, H.tuongthan],
      [H.damcuoi, H.honle], [H.malai, H.vong], [H.cohon, H.sen], [H.trucvong, H.malai],
      [H.songtrung, H.bogiap], [H.loban, H.trucvong], [H.mada, H.giucua],
    ]),
  },
  {
    id: 'cung-nha',
    title: 'Lễ cúng nhà mới',
    icon: 'flame',
    tagline: 'Gia chủ mới mua lại căn nhà với giá rẻ đến khó tin.',
    story:
      'Gia đình ông Tư mua căn nhà trên đồi chỉ bằng một phần ba giá thị trường, và đã có hai người thợ bỏ việc giữa chừng. ' +
      'Ông thuê các bạn, mỗi người một nghề, tới ở lại một đêm để dọn dẹp, sửa sang và làm lễ cúng trước ngày cả nhà dọn về. ' +
      'Mâm lễ đã bày sẵn ở sảnh. Ba nén nhang vừa thắp đã tắt cùng một lúc.',
    purpose: 'Làm xong lễ và giữ lời hứa với gia chủ: ở lại tới sáng.',
    table: table([
      [H.loban, H.giainguyen], [H.trucvong, H.trung], [H.tuongthan, H.vong], [H.tuong, H.giucua], [H.cohon, H.damcuoi],
      [H.bogiap, H.quaivat], [H.honle, H.sen], [H.cohon, H.trung], [H.trucvong, H.mada],
      [H.vong, H.malai], [H.duoiham, H.songtrung], [H.trucvong, H.mada],
    ]),
  },
  {
    id: 'thu-thach',
    title: 'Thử thách một đêm',
    icon: 'moon',
    tagline: 'Một trăm triệu cho ai dám ở lại ngôi nhà tới khi gà gáy.',
    story:
      'Một tài khoản ẩn danh đăng lời thách trên mạng: ở trọn một đêm trong ngôi nhà trên đồi, có camera làm chứng, ' +
      'sẽ nhận một trăm triệu đồng. Các bạn không quen nhau, mỗi người tới vì một lý do riêng. ' +
      'Đúng nửa đêm, người đưa các bạn tới khoá cổng ngoài lại, rồi lái xe đi mất.',
    purpose: 'Ở lại tới sáng. Đừng tin ai quá nhiều.',
    table: table([
      [H.loban, H.tuongthan], [H.trucvong, H.malai], [H.tuong, H.trung], [H.giucua, H.trucvong], [H.giainguyen, H.sen],
      [H.loban, H.mada], [H.bogiap, H.quaivat], [H.mada, H.cohon], [H.trucvong, H.mada],
      [H.damcuoi, H.honle], [H.trucvong, H.vong], [H.duoiham, H.songtrung],
    ]),
  },
];

export const SCENARIOS_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
export const DEFAULT_SCENARIO_ID = 'thu-thach';
