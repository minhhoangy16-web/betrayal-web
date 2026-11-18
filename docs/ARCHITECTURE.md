# Kiến trúc dự án (Bước 1)

## 1. Cấu trúc thư mục

```
betrayal-web/
├── package.json                  # npm workspaces (server, sau này thêm client)
├── README.md                     # Cách cài đặt và chạy
├── docs/
│   └── ARCHITECTURE.md           # Tài liệu này
├── shared/
│   └── schemas/                  # JSON Schema – hợp đồng dữ liệu giữa server và client
│       ├── character.schema.json
│       ├── roomTile.schema.json
│       ├── card.schema.json
│       └── gameState.schema.json
├── server/
│   ├── package.json
│   ├── src/
│   │   ├── index.js              # Express + Socket.io bootstrap, biến môi trường
│   │   ├── socket/
│   │   │   └── handlers.js       # Sự kiện socket -> RoomManager / engine -> phát state
│   │   ├── rooms/
│   │   │   └── RoomManager.js    # Lobby: mã phòng, người chơi, token kết nối lại
│   │   ├── engine/               # Logic game thuần, không phụ thuộc mạng
│   │   │   ├── Game.js           # createGame / applyAction / getView (điểm vào)
│   │   │   ├── actions.js        # Handler cho từng hành động của người chơi
│   │   │   ├── legal.js          # Liệt kê hành động hợp lệ (cho UI và bot test)
│   │   │   ├── effects.js        # Hàng đợi hiệu ứng + pending (đổ xúc xắc, chia sát thương)
│   │   │   ├── turn.js           # Vòng lượt, lượt quái vật
│   │   │   ├── combat.js         # Chiến đấu theo chỉ số
│   │   │   ├── haunt.js          # Haunt Roll, chọn Traitor, kiểm tra thắng thua
│   │   │   ├── board.js          # Lưới gạch, cửa, góc xoay hợp lệ
│   │   │   ├── traits.js         # Thanh chỉ số, critical, cái chết
│   │   │   ├── view.js           # Lọc thông tin bí mật theo từng người chơi
│   │   │   ├── dice.js  rng.js  log.js  constants.js  errors.js
│   │   ├── data/                 # Nội dung game (chỉ là dữ liệu)
│   │   │   ├── characters.js  tiles.js  index.js
│   │   │   └── cards/ omens.js  items.js  events.js
│   │   └── haunts/               # Mỗi kịch bản Haunt là một module
│   │       ├── index.js          # Sổ đăng ký + chọn kịch bản
│   │       ├── helpers.js
│   │       └── haunt01-vong-hon.js
│   ├── test/                     # node:test – engine.test.js, socket.test.js
│   └── test-support/             # Bot ngẫu nhiên, bộ kiểm tra schema tối giản
└── client/                       # React 19 + Vite + Tailwind v4 + Zustand + lucide-react
    ├── index.html  vite.config.js  package.json
    └── src/
        ├── main.jsx  App.jsx  index.css      # index.css: @theme Gothic của Tailwind
        ├── lib/        socket.js  constants.js
        ├── store/      useGameStore.js       # kết nối, phiên chơi, lobby, view game
        └── components/ Lobby  GameScreen  Board  ActionPanel  TraitPanel  SidePanels  HauntBook
                        CardFace (mặt thẻ)  TableEffects (chồng bài, rút thẻ, xúc xắc)  DisconnectBanner  ui
```

## 2. Nguyên tắc thiết kế

**Server là nguồn sự thật duy nhất.** Client chỉ gửi *ý định* (`game:action`) và nhận lại *góc nhìn* của
mình (`game:state`). Mọi lần đổ xúc xắc, rút gạch, rút thẻ đều diễn ra trên server.

**Engine tách khỏi mạng.** `engine/` không import Socket.io hay Express, nên chạy được trong test, trong bot,
và sau này trong worker khác. Ba hàm là toàn bộ giao diện:

```js
const state = createGame({ code, players, seed, rules });
applyAction(state, playerId, { type: 'move', dir: 0 });   // ném GameError nếu không hợp lệ
const view = getView(state, playerId);                     // đã lọc bí mật
```

**GameState là JSON thuần.** Không class, không hàm, không Map/Set. RNG có seed nằm ngay trong state
(`rngState`). Chuyển sang Redis chỉ là `JSON.stringify` / `JSON.parse`; bộ test mô phỏng đã serialize state
qua lại giữa ván để bảo đảm điều này.

**Mỗi hành động là một giao dịch.** `applyAction` chạy trên bản sao của state và chỉ ghi đè khi thành công,
nên một hành động lỗi không bao giờ để lại state dở dang.

**Nội dung là dữ liệu.** Thẻ, phòng, nhân vật được mô tả bằng object; hiệu ứng là danh sách `op`
(`gain`, `damage`, `roll`...). Thêm thẻ mới thường không cần viết code.

## 3. Luồng xử lý một hành động

```
client ── game:action {type:'move', dir:1} ──▶ socket/handlers.js
                                                 │  tìm phòng + người chơi từ socket.data
                                                 ▼
                                         engine/Game.applyAction
                                                 │  1. actions.js kiểm tra & thay đổi state
                                                 │  2. effects.runQueue chạy hàng đợi op
                                                 │     └ dừng nếu cần người chơi quyết định (state.pending)
                                                 │  3. haunt.checkVictory
                                                 ▼
                         với mỗi người chơi: view.getView(state, playerId)
client ◀── game:state (riêng từng người) ────────┘
```

### Hàng đợi hiệu ứng và `pending`

Khám phá một phòng Omen sinh ra chuỗi op: `[hiệu ứng phòng] → draw omen → [onGain của thẻ] → hauntRoll → finish`.
`runQueue` chạy tuần tự. Khi một op cần người chơi (đổ xúc xắc, chia sát thương, chọn chỉ số, xoay gạch),
nó đặt `state.pending` và dừng; mọi hành động khác bị khoá cho tới khi đúng người đó trả lời.

| `pending.type`   | Người chơi trả lời bằng                         |
|------------------|--------------------------------------------------|
| `placeTile`      | `rotateTile {rotation}` (xem trước), `placeTile {rotation}` |
| `roll`           | `roll {}`                                        |
| `allocateDamage` | `allocateDamage {allocation: {might: 1, speed: 1}}` |
| `chooseTrait`    | `chooseTrait {trait}`                            |

## 4. Schema dữ liệu

Bản đầy đủ nằm ở `shared/schemas/*.schema.json`. Bộ test kiểm tra toàn bộ dữ liệu tĩnh và GameState
(trong suốt 300 ván mô phỏng) theo đúng các schema này.

### Character

```json
{
  "id": "lam-khai",
  "name": "Bác sĩ Lâm Khải",
  "age": 52,
  "bio": "Bác sĩ pháp y về hưu…",
  "color": "#b91c1c",
  "traits": {
    "speed":     { "track": [2, 3, 3, 4, 4, 5, 6, 6], "start": 2 },
    "might":     { "track": [2, 2, 3, 3, 4, 5, 5, 6], "start": 2 },
    "sanity":    { "track": [3, 3, 4, 5, 5, 6, 7, 7], "start": 3 },
    "knowledge": { "track": [3, 4, 5, 5, 6, 6, 7, 8], "start": 3 }
  }
}
```

`track` có đúng 8 nấc, index 0 là nấc thấp nhất (critical). Đầu lâu nằm dưới nấc 0 và được biểu diễn
bằng index `-1` trong `PlayerState.traits`. Giá trị tại nấc hiện tại là số xúc xắc được đổ.

### RoomTile

```json
{
  "id": "crypt",
  "name": "Hầm mộ",
  "floors": ["basement"],
  "doors": [0, 2],
  "symbol": "omen",
  "text": "Kết thúc lượt tại đây: chịu 1 sát thương tinh thần.",
  "effect": { "trigger": "endTurn", "effects": [{ "op": "damage", "type": "mental", "amount": 1 }] }
}
```

`doors` dùng 0 = Bắc, 1 = Đông, 2 = Nam, 3 = Tây ở góc xoay 0. Gạch khởi đầu có thêm
`start: {floor, x, y}`; cầu thang có `links: [tileId]`.

### Card

```json
{
  "id": "ev-whispers",
  "type": "event",
  "name": "Tiếng thì thầm sau tường",
  "text": "Có ai đó gọi đúng tên bạn… Đổ Tinh thần.",
  "effects": [{
    "op": "roll", "trait": "sanity", "label": "Tiếng thì thầm sau tường",
    "outcomes": [
      { "min": 4, "text": "…", "effects": [{ "op": "gain", "trait": "knowledge", "amount": 1 }] },
      { "min": 2, "text": "…", "effects": [] },
      { "min": 0, "text": "…", "effects": [{ "op": "damage", "type": "mental", "amount": 1 }] }
    ]
  }]
}
```

Omen và Item dùng `onGain` / `onLose` / `weapon {trait, bonusDice}` / `use {effects, consume}` thay cho `effects`.

| `op`       | Trường                              | Ý nghĩa |
|------------|-------------------------------------|---------|
| `gain`     | `trait` hoặc `choice`, `amount`     | Tăng chỉ số; `choice`: `any` / `physical` / `mental` / mảng chỉ số để người chơi chọn |
| `lose`     | `trait`, `amount`                   | Giảm một chỉ số cụ thể |
| `damage`   | `type`, `amount` hoặc `dice`        | Sát thương `physical` / `mental` / `general`, người chịu tự chia |
| `heal`     | `group` hoặc `traits`               | Đưa chỉ số về mức khởi đầu nếu đang thấp hơn |
| `roll`     | `trait` hoặc `dice`, `outcomes`     | Đổ xúc xắc, áp dụng dòng `min` cao nhất đạt được |
| `draw`     | `deck`                              | Rút một thẻ |
| `teleport` | `tileId`                            | Tới một gạch đã có trên bàn |
| `log`      | `text`                              | Ghi nhật ký |

### GameState (rút gọn)

```json
{
  "version": 1,
  "code": "K7QXM",
  "phase": "haunt",
  "round": 6,
  "rules": { "hauntRollThreshold": 5, "maxDice": 8, "minPlayers": 3, "maxPlayers": 6 },
  "rngState": -1838291544,
  "players": {
    "<playerId>": {
      "id": "<playerId>", "name": "An", "characterId": "lam-khai",
      "traits": { "speed": 2, "might": 1, "sanity": 3, "knowledge": 4 },
      "pos": { "floor": "ground", "x": 1, "y": -1 },
      "alive": true, "side": "hero", "cards": ["om-leather-journal"]
    }
  },
  "turnOrder": ["<playerId>", "…"],
  "turn": {
    "number": 23, "playerId": "<playerId>", "phase": "explorer",
    "movesLeft": 2, "hasAttacked": false, "usedSpecial": false, "usedCards": [], "monsters": {}
  },
  "board": {
    "tiles": {
      "ground:0:0": { "tileId": "entrance-hall", "floor": "ground", "x": 0, "y": 0, "rotation": 0, "items": [] }
    },
    "index": { "entrance-hall": "ground:0:0" }
  },
  "tileStack": ["attic", "…"],
  "decks": { "omen": ["…"], "item": ["…"], "event": ["…"] },
  "discards": { "omen": [], "item": [], "event": [] },
  "omensRevealed": 4,
  "pending": null,
  "queue": [],
  "haunt": {
    "id": "haunt-01", "name": "Vong hồn dưới hầm",
    "revealerId": "<playerId>", "traitorId": "<playerId>",
    "startedOnTurn": 19, "pendingFirstTurn": false,
    "data": { "sealed": ["upper:1:0"], "sealsRequired": 3 }
  },
  "monsters": {
    "wraith-1": {
      "id": "wraith-1", "type": "wraith", "name": "Vong hồn 1",
      "traits": { "speed": 2, "might": 4, "sanity": 3 },
      "pos": { "floor": "basement", "x": 0, "y": 0 }, "stunned": false, "recovering": false
    }
  },
  "lastRoll": { "seq": 41, "kind": "haunt", "dice": [2, 1, 2, 0], "total": 5, "threshold": 5, "triggered": true },
  "lastCard": { "seq": 12, "cardId": "om-ritual-knife", "playerId": "<playerId>" },
  "log": [{ "seq": 301, "kind": "haunt", "text": "…", "turn": 19 }],
  "logSeq": 301, "rollSeq": 41, "cardSeq": 12,
  "winner": null
}
```

Toạ độ: mỗi tầng là một lưới riêng, `x` tăng về Đông, `y` tăng về Nam. Khoá của gạch là `"floor:x:y"`.

### View gửi cho client

`getView(state, playerId)` trả về GameState trừ đi các trường bí mật (`rngState`, `tileStack`, `decks`,
`discards`, `queue`, `board.index`) và cộng thêm:

| Trường | Nội dung |
|--------|----------|
| `you` | `playerId` của người nhận |
| `players[id].traitValues` | Giá trị hiện tại của 4 chỉ số (đã tra track) |
| `stacks` | Số gạch còn lại theo tầng, số thẻ còn lại mỗi chồng |
| `haunt.publicIntro`, `haunt.data` | Phần công khai của kịch bản |
| `haunt.book` | **Chỉ một** cuốn: `traitorTome` cho Traitor, `survivalSecrets` cho người sống sót |
| `legal` | Mọi hành động hợp lệ của người nhận ngay lúc này (để bật/tắt nút) |
| `log` | 120 dòng nhật ký gần nhất |

## 5. Giao thức Socket.io

Mọi sự kiện client → server đều có ack `{ ok: true, ...data }` hoặc `{ ok: false, error, code }`.

| Sự kiện | Payload | Ghi chú |
|---------|---------|---------|
| `room:create` | `{ name }` | Trả `{ code, playerId, token }` |
| `room:join` | `{ code, name }` | Trả `{ code, playerId, token }` |
| `room:rejoin` | `{ code, token }` | Kết nối lại sau khi tải lại trang |
| `room:selectCharacter` | `{ characterId \| null }` | Mỗi nhân vật một người |
| `room:kick` | `{ playerId }` | Chủ phòng, chỉ trong lobby |
| `room:start` | `{}` | Chủ phòng; cần 3–6 người đã chọn nhân vật |
| `room:leave` | `{}` | |
| `game:skip` | `{}` | Chủ phòng; chỉ khi người cần hành động đang mất kết nối |
| `game:action` | `{ type, ... }` | Xem bảng dưới |

**Người chơi mất kết nối giữa ván.** Nếu người cần hành động mất kết nối (đóng tab, rớt mạng, bấm Rời),
server chờ 60 giây rồi chơi thay họ bằng hành động an toàn nhất (`engine/legal.js → defaultAction`: đổ
xúc xắc, đặt gạch ở góc xoay đang chọn, chia sát thương đều nhất, rồi kết thúc lượt). Nếu họ vẫn chưa
quay lại, các lượt sau của họ chỉ chờ 5 giây. `room:state.autoSkip = { playerId, inMs }` cho giao diện
đếm ngược; chủ phòng có thể bỏ qua ngay bằng `game:skip`. Kết nối lại (`room:rejoin`) huỷ đếm ngược.

Server → client: `room:state` (lobby, giống nhau cho cả phòng), `game:state` (riêng từng người),
`room:kicked`, `room:replaced` (người chơi mở tab khác bằng cùng token).

| `game:action.type` | Trường | Khi nào |
|--------------------|--------|---------|
| `move` | `dir` (0–3) hoặc `linkTo` (tileId) | Lượt của mình, còn bước |
| `rotateTile` / `placeTile` | `rotation` (0–3) | Đang chờ đặt gạch |
| `roll` | – | Đang chờ đổ xúc xắc |
| `allocateDamage` | `allocation` | Đang chờ chia sát thương |
| `chooseTrait` | `trait` | Đang chờ chọn chỉ số |
| `useItem` | `cardId` | Thẻ có `use`, mỗi thẻ 1 lần/lượt |
| `giveItem` | `cardId`, `toPlayerId` | Cùng phòng, cùng phe |
| `pickupItem` | `cardId` | Thẻ nằm trên sàn phòng đang đứng |
| `attack` | `targetType`, `targetId`, `trait?`, `weaponCardId?` | Sau Haunt, 1 lần/lượt |
| `special` | `actionId`, ... | Hành động riêng của kịch bản Haunt |
| `endTurn` | – | |
| `monsterMove` | `monsterId`, `dir` hoặc `linkTo` | Traitor, lượt quái vật |
| `monsterAttack` | `monsterId`, `targetId` | Traitor, lượt quái vật |
| `endMonsterTurn` | – | |

HTTP: `GET /api/catalog` trả dữ liệu tĩnh (nhân vật, gạch, thẻ, luật) để client vẽ giao diện;
`GET /health`.

## 6. Luật đã cài đặt và các quyết định cần biết

| Luật | Cài đặt |
|------|---------|
| Xúc xắc | 8 viên, mỗi viên 0-0-1-1-2-2; không bao giờ đổ quá 8 viên |
| Di chuyển | Số bước = Tốc độ hiện tại; cầu thang tốn 1 bước |
| Khám phá | Rút gạch trên cùng đặt được ở tầng hiện tại; chỉ cho phép góc xoay có cửa nối về phòng vừa rời; **lượt kết thúc** sau khi giải quyết xong phòng mới |
| Sát thương | Thể chất → Tốc độ/Sức mạnh; tinh thần → Tinh thần/Tri thức; tổng hợp → bất kỳ. Người chịu tự chia |
| Trước Haunt | Không ai chết: chỉ số dừng ở nấc thấp nhất |
| Haunt Roll | Tự động sau mỗi thẻ Omen: số xúc xắc = tổng Omen đã lật; **5+** thì Haunt bắt đầu |
| Sau Haunt | Chạm đầu lâu là chết, thẻ rơi lại trong phòng; lượt đầu thuộc về người bên trái Traitor |
| Chiến đấu | 1 lần/lượt, hai bên đổ cùng chỉ số, bên thấp hơn chịu phần chênh; quái vật thua thì choáng |
| Quái vật | Hành động ngay sau lượt Traitor; đổ Tốc độ để lấy số bước (tối thiểu 1) |
| Cản đường | Mỗi đối thủ cùng phòng khiến việc rời phòng tốn thêm 1 bước |

Các điểm khác với yêu cầu ban đầu hoặc đã đơn giản hoá:

- **Ngưỡng Haunt Roll là 5+, không phải 6+.** Các bản tóm tắt luật 3rd Edition đều ghi 5+; con số 6+ thuộc
  về một bản Betrayal khác. Đổi bằng biến môi trường `HAUNT_THRESHOLD=6` nếu bạn vẫn muốn 6.
- **Nội dung là tự sáng tác.** Tên nhân vật, lời thẻ, kịch bản Haunt và hai cuốn sách bí mật đều được viết
  mới thay vì chép từ bộ game gốc. Cơ chế thì theo luật; nội dung nằm hết trong `data/` và `haunts/`.
- **Cầu thang lớn nối cả lên tầng trên lẫn xuống tầng hầm**, để tầng hầm luôn tới được trong bản MVP.
- **Chọn kịch bản Haunt:** hiện chỉ có một kịch bản nên `selectHaunt` luôn trả về nó. Bản gốc chọn theo
  thẻ kịch bản và thẻ Omen; chỗ để cài điều đó là `haunts/index.js`.
- **Chưa có:** năng lực riêng của từng nhân vật, đổ lại xúc xắc, tầm nhìn (line of sight), mang xác/đồ vật.
