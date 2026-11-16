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
];
