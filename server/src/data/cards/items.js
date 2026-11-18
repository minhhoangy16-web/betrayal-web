// Thẻ Vật phẩm: người rút giữ lại.
// onGain / onLose: hiệu ứng khi nhận / khi mất thẻ.
// weapon: { trait, bonusDice } – dùng khi tấn công bằng chỉ số đó.
// use: { effects, consume } – hành động "dùng vật phẩm" (mỗi thẻ 1 lần/lượt).

export const ITEMS = [
  { id: 'it-fire-axe', type: 'item', name: 'Rìu cứu hoả',
    text: 'Vũ khí. +1 xúc xắc khi tấn công bằng Sức mạnh.',
    weapon: { trait: 'might', bonusDice: 1 } },
  { id: 'it-old-revolver', type: 'item', name: 'Súng lục cũ',
    text: 'Vũ khí. Cho phép tấn công bằng Tốc độ, +1 xúc xắc.',
    weapon: { trait: 'speed', bonusDice: 1 } },
  { id: 'it-first-aid', type: 'item', name: 'Hộp sơ cứu',
    text: 'Dùng rồi bỏ: hồi phục Tốc độ và Sức mạnh về mức khởi đầu.',
    use: { consume: true, effects: [{ op: 'heal', group: 'physical' }] } },
  { id: 'it-calming-tea', type: 'item', name: 'Trà an thần',
    text: 'Dùng rồi bỏ: hồi phục Tinh thần và Tri thức về mức khởi đầu.',
    use: { consume: true, effects: [{ op: 'heal', group: 'mental' }] } },
  { id: 'it-charm', type: 'item', name: 'Bùa hộ mệnh',
    text: '+1 Tinh thần khi nhận; -1 Tinh thần khi mất.',
    onGain: [{ op: 'gain', trait: 'sanity', amount: 1 }],
    onLose: [{ op: 'lose', trait: 'sanity', amount: 1 }] },
  { id: 'it-soft-shoes', type: 'item', name: 'Giày đế mềm',
    text: '+1 Tốc độ khi nhận; -1 Tốc độ khi mất.',
    onGain: [{ op: 'gain', trait: 'speed', amount: 1 }],
    onLose: [{ op: 'lose', trait: 'speed', amount: 1 }] },
  { id: 'it-magnifier', type: 'item', name: 'Kính lúp đồng',
    text: '+1 Tri thức khi nhận; -1 Tri thức khi mất.',
    onGain: [{ op: 'gain', trait: 'knowledge', amount: 1 }],
    onLose: [{ op: 'lose', trait: 'knowledge', amount: 1 }] },
  { id: 'it-leather-gloves', type: 'item', name: 'Găng tay da',
    text: '+1 Sức mạnh khi nhận; -1 Sức mạnh khi mất.',
    onGain: [{ op: 'gain', trait: 'might', amount: 1 }],
    onLose: [{ op: 'lose', trait: 'might', amount: 1 }] },
  { id: 'it-strong-liquor', type: 'item', name: 'Chai rượu mạnh',
    text: 'Dùng rồi bỏ: +1 Sức mạnh, -1 Tri thức.',
    use: { consume: true, effects: [
      { op: 'gain', trait: 'might', amount: 1 }, { op: 'lose', trait: 'knowledge', amount: 1 }] } },
  { id: 'it-bone-dice', type: 'item', name: 'Xúc xắc xương',
    text: 'Mỗi lượt một lần: đổ 2 xúc xắc. 3+: +1 chỉ số tuỳ chọn. 0: chịu 1 sát thương tổng hợp.',
    use: { consume: false, effects: [{ op: 'roll', dice: 2, label: 'Xúc xắc xương', outcomes: [
      { min: 3, text: 'Vận may mỉm cười.', effects: [{ op: 'gain', choice: 'any', amount: 1 }] },
      { min: 1, text: 'Không có gì xảy ra.', effects: [] },
      { min: 0, text: 'Xương đòi nợ.', effects: [{ op: 'damage', type: 'general', amount: 1 }] },
    ] }] } },

  // ---- Vật phẩm bị nguyền (bản mở rộng): có lợi nhưng kèm cái giá ----
  { id: 'it-hell-coin', type: 'item', name: 'Đồng tiền âm phủ',
    text: 'Khi nhận: -1 Tinh thần. Dùng rồi bỏ: +1 Tri thức và +1 Sức mạnh.',
    onGain: [{ op: 'lose', trait: 'sanity', amount: 1 }],
    use: { consume: true, effects: [{ op: 'gain', trait: 'knowledge', amount: 1 }, { op: 'gain', trait: 'might', amount: 1 }] } },
  { id: 'it-rusty-machete', type: 'item', name: 'Mã tấu han gỉ',
    text: 'Vũ khí. +2 xúc xắc khi tấn công bằng Sức mạnh. Khi nhận: -1 Tốc độ (nặng tay).',
    weapon: { trait: 'might', bonusDice: 2 },
    onGain: [{ op: 'lose', trait: 'speed', amount: 1 }],
    onLose: [{ op: 'gain', trait: 'speed', amount: 1 }] },
];
