// Thẻ Sự kiện: giải quyết ngay khi rút rồi vào chồng bài bỏ.
// outcomes: chọn dòng ĐẦU TIÊN có tổng xúc xắc >= min (liệt kê từ cao xuống thấp).

export const EVENTS = [
  {
    id: 'ev-whispers', type: 'event', name: 'Tiếng thì thầm sau tường',
    text: 'Có ai đó gọi đúng tên bạn, từ phía bên kia lớp vữa. Đổ Tinh thần.',
    effects: [{ op: 'roll', trait: 'sanity', label: 'Tiếng thì thầm sau tường', outcomes: [
      { min: 4, text: 'Bạn lắng nghe và hiểu ra điều gì đó.', effects: [{ op: 'gain', trait: 'knowledge', amount: 1 }] },
      { min: 2, text: 'Bạn bịt tai và bước tiếp.', effects: [] },
      { min: 0, text: 'Giọng nói ấy theo bạn mãi.', effects: [{ op: 'damage', type: 'mental', amount: 1 }] },
    ] }],
  },
  {
    id: 'ev-rotten-floor', type: 'event', name: 'Sàn gỗ mục',
    text: 'Ván sàn gãy dưới chân. Đổ Tốc độ.',
    effects: [{ op: 'roll', trait: 'speed', label: 'Sàn gỗ mục', outcomes: [
      { min: 4, text: 'Bạn nhảy qua kịp.', effects: [{ op: 'gain', trait: 'speed', amount: 1 }] },
      { min: 2, text: 'Bạn bám được vào mép sàn.', effects: [] },
      { min: 0, text: 'Bạn rơi xuống đống gỗ vụn.', effects: [{ op: 'damage', type: 'physical', amount: 2 }] },
    ] }],
  },
  {
    id: 'ev-cold-hand', type: 'event', name: 'Bàn tay lạnh',
    text: 'Một bàn tay vô hình siết lấy cổ tay bạn. Đổ Sức mạnh.',
    effects: [{ op: 'roll', trait: 'might', label: 'Bàn tay lạnh', outcomes: [
      { min: 4, text: 'Bạn giật ra được.', effects: [{ op: 'gain', trait: 'might', amount: 1 }] },
      { min: 0, text: 'Nó để lại vết bầm tím tái.', effects: [{ op: 'damage', type: 'physical', amount: 1 }] },
    ] }],
  },
  {
    id: 'ev-portrait', type: 'event', name: 'Bức chân dung dõi theo',
    text: 'Đôi mắt trong tranh nhìn về một góc phòng. Đổ Tri thức.',
    effects: [{ op: 'roll', trait: 'knowledge', label: 'Bức chân dung dõi theo', outcomes: [
      { min: 4, text: 'Bạn tìm thấy thứ nó đang nhìn.', effects: [{ op: 'draw', deck: 'item' }] },
      { min: 2, text: 'Chỉ là một bức tranh cũ.', effects: [] },
      { min: 0, text: 'Bạn không thể rời mắt khỏi nó.', effects: [{ op: 'damage', type: 'mental', amount: 1 }] },
    ] }],
  },
  {
    id: 'ev-quiet-moment', type: 'event', name: 'Khoảnh khắc bình yên',
    text: 'Ngôi nhà im lặng một lúc. Tăng 1 nấc cho một chỉ số tuỳ chọn.',
    effects: [{ op: 'gain', choice: 'any', amount: 1 }],
  },
  {
    id: 'ev-lights-out', type: 'event', name: 'Cơn gió tắt đèn',
    text: 'Mọi ngọn đèn tắt cùng lúc. Đổ Tinh thần.',
    effects: [{ op: 'roll', trait: 'sanity', label: 'Cơn gió tắt đèn', outcomes: [
      { min: 3, text: 'Bạn đứng yên chờ mắt quen bóng tối.', effects: [] },
      { min: 0, text: 'Bạn hoảng loạn va vào đồ đạc.', effects: [{ op: 'damage', type: 'general', amount: 1 }] },
    ] }],
  },
  {
    id: 'ev-trapdoor', type: 'event', name: 'Cánh cửa sập',
    text: 'Sàn mở ra, một đường trượt đưa bạn về Sảnh vào.',
    effects: [{ op: 'teleport', tileId: 'entrance-hall' }],
  },
  {
    id: 'ev-music-box', type: 'event', name: 'Hộp nhạc cũ',
    text: 'Hộp nhạc tự lên dây cót. Đổ 2 xúc xắc.',
    effects: [{ op: 'roll', dice: 2, label: 'Hộp nhạc cũ', outcomes: [
      { min: 3, text: 'Giai điệu gợi một ký ức đẹp.', effects: [{ op: 'gain', trait: 'sanity', amount: 1 }] },
      { min: 1, text: 'Nhạc dừng giữa chừng.', effects: [] },
      { min: 0, text: 'Bạn nhận ra bài hát ru của chính mình.', effects: [{ op: 'lose', trait: 'sanity', amount: 1 }] },
    ] }],
  },
  {
    id: 'ev-familiar-scent', type: 'event', name: 'Mùi hương quen thuộc',
    text: 'Mùi trà nhài của mẹ. Hồi phục Tinh thần và Tri thức về mức khởi đầu.',
    effects: [{ op: 'heal', group: 'mental' }],
  },
  {
    id: 'ev-bite', type: 'event', name: 'Vết cắn trong bóng tối',
    text: 'Thứ gì đó nhỏ và nhanh. Chịu 1 sát thương tổng hợp.',
    effects: [{ op: 'damage', type: 'general', amount: 1 }],
  },
  {
    id: 'ev-hidden-drawer', type: 'event', name: 'Ngăn kéo bí mật',
    text: 'Một ngăn kéo bật mở khi bạn đi ngang. Rút 1 thẻ Vật phẩm.',
    effects: [{ op: 'draw', deck: 'item' }],
  },
  {
    id: 'ev-waking-nightmare', type: 'event', name: 'Cơn ác mộng tỉnh',
    text: 'Bạn thấy chính mình đứng cuối hành lang. Đổ Tinh thần.',
    effects: [{ op: 'roll', trait: 'sanity', label: 'Cơn ác mộng tỉnh', outcomes: [
      { min: 5, text: 'Bạn bước tới và nó tan biến.', effects: [
        { op: 'gain', trait: 'sanity', amount: 1 }, { op: 'gain', trait: 'knowledge', amount: 1 }] },
      { min: 2, text: 'Bạn nhắm mắt cho tới khi nó đi.', effects: [{ op: 'damage', type: 'mental', amount: 1 }] },
      { min: 0, text: 'Nó mỉm cười với bạn.', effects: [{ op: 'damage', type: 'mental', amount: 2 }] },
    ] }],
  },

  // ---- Sự kiện bất lợi (bản mở rộng) ----
  {
    id: 'ev-chandelier', type: 'event', name: 'Đèn chùm rơi',
    text: 'Sợi xích rỉ sét đứt phựt trên đầu bạn. Đổ Tốc độ.',
    effects: [{ op: 'roll', trait: 'speed', label: 'Đèn chùm rơi', outcomes: [
      { min: 5, text: 'Bạn lăn người tránh kịp.', effects: [] },
      { min: 2, text: 'Mảnh pha lê cứa vào vai.', effects: [{ op: 'damage', type: 'physical', amount: 1 }] },
      { min: 0, text: 'Cả chùm đèn đổ ập lên người bạn.', effects: [{ op: 'damage', type: 'physical', amount: 3 }] },
    ] }],
  },
  {
    id: 'ev-ghost-wedding', type: 'event', name: 'Đám cưới ma',
    text: 'Một đoàn rước dâu không có mặt đi ngang qua, kèn trống im phăng phắc. Đổ Tinh thần.',
    effects: [{ op: 'roll', trait: 'sanity', label: 'Đám cưới ma', outcomes: [
      { min: 4, text: 'Bạn cúi đầu nhường đường. Họ đi qua.', effects: [] },
      { min: 0, text: 'Cô dâu quay lại nhìn bạn.', effects: [{ op: 'damage', type: 'mental', amount: 2 }] },
    ] }],
  },
  {
    id: 'ev-paper-effigy', type: 'event', name: 'Hình nhân quay đầu',
    text: 'Hình nhân giấy trong góc phòng từ từ quay mặt về phía bạn. Mất 1 Tinh thần.',
    effects: [{ op: 'lose', trait: 'sanity', amount: 1 }],
  },
  {
    id: 'ev-rats', type: 'event', name: 'Đàn chuột',
    text: 'Hàng trăm con chuột tràn ra từ khe tường. Đổ Sức mạnh.',
    effects: [{ op: 'roll', trait: 'might', label: 'Đàn chuột', outcomes: [
      { min: 4, text: 'Bạn đá văng chúng và chạy thoát.', effects: [] },
      { min: 0, text: 'Chúng cắn khắp chân bạn.', effects: [{ op: 'damage', type: 'physical', amount: 2 }] },
    ] }],
  },
  {
    id: 'ev-mold', type: 'event', name: 'Tường mốc',
    text: 'Bức tường phủ mốc đen thở ra một làn hơi ngọt lợm. Đổ Sức mạnh.',
    effects: [{ op: 'roll', trait: 'might', label: 'Tường mốc', outcomes: [
      { min: 3, text: 'Bạn nín thở bước qua.', effects: [] },
      { min: 0, text: 'Bạn ho sặc sụa, người rã rời.', effects: [{ op: 'lose', trait: 'might', amount: 1 }] },
    ] }],
  },
  {
    id: 'ev-weeping', type: 'event', name: 'Tiếng khóc trong tủ',
    text: 'Có tiếng một người đàn bà khóc trong chiếc tủ khoá kín. Đổ Tinh thần.',
    effects: [{ op: 'roll', trait: 'sanity', label: 'Tiếng khóc trong tủ', outcomes: [
      { min: 5, text: 'Bạn nói lời an ủi. Tiếng khóc dịu đi, để lại một bí mật.', effects: [{ op: 'gain', trait: 'knowledge', amount: 1 }] },
      { min: 2, text: 'Bạn bỏ chạy, tiếng khóc đuổi theo.', effects: [{ op: 'damage', type: 'mental', amount: 1 }] },
      { min: 0, text: 'Cánh tủ hé mở.', effects: [{ op: 'damage', type: 'mental', amount: 2 }] },
    ] }],
  },
  {
    id: 'ev-slide-down', type: 'event', name: 'Sàn nghiêng',
    text: 'Sàn nhà nghiêng hẳn đi. Đổ Tốc độ.',
    effects: [{ op: 'roll', trait: 'speed', label: 'Sàn nghiêng', outcomes: [
      { min: 4, text: 'Bạn bám kịp vào khung cửa.', effects: [] },
      { min: 0, text: 'Bạn trượt xuống tận Chiếu nghỉ tầng hầm, va đập khắp người.', effects: [
        { op: 'teleport', tileId: 'basement-landing' }, { op: 'damage', type: 'physical', amount: 1 }] },
    ] }],
  },
  {
    id: 'ev-cold-breath', type: 'event', name: 'Hơi thở sau gáy',
    text: 'Có ai đó thở rất khẽ ngay sau gáy bạn. Bạn cứng người lại. Mất 1 Tốc độ.',
    effects: [{ op: 'lose', trait: 'speed', amount: 1 }],
  },
  {
    id: 'ev-broken-mirror', type: 'event', name: 'Gương vỡ',
    text: 'Chiếc gương nổ tung, mảnh vỡ găm khắp nơi. Chịu 1 sát thương tổng hợp. Đổ Tinh thần.',
    effects: [{ op: 'damage', type: 'general', amount: 1 }, { op: 'roll', trait: 'sanity', label: 'Gương vỡ', outcomes: [
      { min: 3, text: 'Chỉ là gương vỡ thôi.', effects: [] },
      { min: 0, text: 'Trong mỗi mảnh gương là một khuôn mặt khác.', effects: [{ op: 'damage', type: 'mental', amount: 1 }] },
    ] }],
  },
  {
    id: 'ev-overturned-bowl', type: 'event', name: 'Bát cơm úp',
    text: 'Trên bàn có bát cơm cắm đôi đũa, bị ai đó úp ngược. Bạn quên mất mình định làm gì. Mất 1 Tri thức.',
    effects: [{ op: 'lose', trait: 'knowledge', amount: 1 }],
  },
  {
    id: 'ev-sleep-paralysis', type: 'event', name: 'Bóng đè',
    text: 'Bạn chợp mắt một giây và không cử động được nữa. Đổ Sức mạnh.',
    effects: [{ op: 'roll', trait: 'might', label: 'Bóng đè', outcomes: [
      { min: 4, text: 'Bạn vùng dậy được.', effects: [] },
      { min: 0, text: 'Thứ gì đó ngồi trên ngực bạn rất lâu.', effects: [{ op: 'lose', trait: 'speed', amount: 1 }, { op: 'damage', type: 'mental', amount: 1 }] },
    ] }],
  },
  {
    id: 'ev-possessed-doll', type: 'event', name: 'Búp bê biết đi',
    text: 'Một con búp bê sứ lạch cạch đi theo bạn. Đổ Tri thức.',
    effects: [{ op: 'roll', trait: 'knowledge', label: 'Búp bê biết đi', outcomes: [
      { min: 4, text: 'Bạn nhớ ra cách: úp mặt nó xuống. Nó nằm im.', effects: [] },
      { min: 0, text: 'Nó cười khúc khích suốt quãng đường còn lại.', effects: [{ op: 'damage', type: 'mental', amount: 2 }] },
    ] }],
  },
];
