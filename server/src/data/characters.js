// Nhân vật (Explorer). Nội dung tự sáng tác – thay bằng dữ liệu của bạn nếu muốn.
// Mỗi chỉ số có "track" 8 nấc (index 0 = nấc thấp nhất/critical, index 7 = cao nhất).
// Đầu lâu nằm dưới nấc 0 (index -1 trong state) – chạm đầu lâu sau khi Haunt bắt đầu là chết.
// "start" là index khởi đầu trên track.

export const CHARACTERS = [
  {
    id: 'lam-khai',
    name: 'Bác sĩ Lâm Khải',
    age: 52,
    bio: 'Bác sĩ pháp y về hưu, tin rằng mọi hồn ma đều có lời giải thích.',
    color: '#b91c1c',
    traits: {
      speed: { track: [2, 3, 3, 4, 4, 5, 6, 6], start: 2 },
      might: { track: [2, 2, 3, 3, 4, 5, 5, 6], start: 2 },
      sanity: { track: [3, 3, 4, 5, 5, 6, 7, 7], start: 3 },
      knowledge: { track: [3, 4, 5, 5, 6, 6, 7, 8], start: 3 },
    },
  },
  {
    id: 'to-uyen',
    name: 'Tô Uyên',
    age: 19,
    bio: 'Sinh viên mỹ thuật, đến ngôi nhà để vẽ ký hoạ và không định ở lại lâu.',
    color: '#7c3aed',
    traits: {
      speed: { track: [3, 4, 4, 5, 6, 6, 7, 8], start: 3 },
      might: { track: [1, 2, 2, 3, 3, 4, 5, 6], start: 3 },
      sanity: { track: [2, 3, 4, 4, 5, 6, 6, 7], start: 2 },
      knowledge: { track: [2, 3, 3, 4, 5, 5, 6, 6], start: 3 },
    },
  },
  {
    id: 'dinh-manh',
    name: 'Đinh Mạnh',
    age: 34,
    bio: 'Cựu lính cứu hoả. Phá cửa trước, hỏi sau.',
    color: '#ea580c',
    traits: {
      speed: { track: [2, 3, 4, 4, 5, 5, 6, 7], start: 3 },
      might: { track: [3, 4, 4, 5, 6, 6, 7, 8], start: 3 },
      sanity: { track: [2, 2, 3, 4, 4, 5, 6, 6], start: 3 },
      knowledge: { track: [1, 2, 3, 3, 4, 4, 5, 6], start: 2 },
    },
  },
  {
    id: 'ba-tu',
    name: 'Bà Tư Hạnh',
    age: 68,
    bio: 'Thầy cúng của làng bên. Bà biết ngôi nhà này từ trước khi nó có tên.',
    color: '#0f766e',
    traits: {
      speed: { track: [1, 2, 2, 3, 3, 4, 5, 5], start: 3 },
      might: { track: [1, 2, 2, 3, 4, 4, 5, 5], start: 2 },
      sanity: { track: [4, 4, 5, 5, 6, 7, 7, 8], start: 3 },
      knowledge: { track: [3, 3, 4, 5, 5, 6, 6, 7], start: 3 },
    },
  },
  {
    id: 'be-nam',
    name: 'Bé Nam',
    age: 11,
    bio: 'Lẻn theo người lớn vào nhà. Chạy nhanh hơn bất kỳ ai, và sợ ít hơn nên có.',
    color: '#ca8a04',
    traits: {
      speed: { track: [3, 4, 5, 5, 6, 7, 7, 8], start: 3 },
      might: { track: [1, 1, 2, 3, 3, 4, 4, 5], start: 3 },
      sanity: { track: [2, 3, 3, 4, 5, 5, 6, 7], start: 3 },
      knowledge: { track: [2, 2, 3, 4, 4, 5, 5, 6], start: 2 },
    },
  },
  {
    id: 'vu-thach',
    name: 'Giáo sư Vũ Thạch',
    age: 45,
    bio: 'Nhà sử học đi tìm cuốn gia phả thất lạc của dòng họ chủ nhà.',
    color: '#1d4ed8',
    traits: {
      speed: { track: [2, 2, 3, 4, 4, 5, 5, 6], start: 3 },
      might: { track: [2, 3, 3, 4, 4, 5, 6, 6], start: 2 },
      sanity: { track: [2, 3, 3, 4, 5, 5, 6, 6], start: 3 },
      knowledge: { track: [4, 4, 5, 6, 6, 7, 8, 8], start: 2 },
    },
  },
];
