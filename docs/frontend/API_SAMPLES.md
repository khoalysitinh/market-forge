# API Samples — response THẬT từ MARKET FORGE v0.1

> Ghi lại ngày 2026-11-11 bằng cách chạy một round thật với hai user (An = OWNER, Bình = MEMBER) trên API + MariaDB.
> Dùng làm tham chiếu khi dựng UI và làm fixture cho test (**ghi rõ là mock** nếu hiển thị — luật F14).
> Hợp đồng đầy đủ: [API.md](../api/API.md). Nếu file này lệch với API.md hoặc với server thật, **server thật đúng** — hãy mở Issue.

Mọi giá là **số nguyên ticks**; giá hiển thị = `ticks / 10^price_scale`. Mọi thời gian là UTC.

## POST /auth/login → 200

Lưu `csrf_token` trong bộ nhớ JS (biến module), **không** localStorage. Cookie `mf_session` do trình duyệt tự giữ (HttpOnly — JS không đọc được).

HTTP `200`

```json
{
  "user": {
    "id": 3,
    "username": "an_215435",
    "display_name": "An",
    "created_at": "2026-11-11T14:54:36.031328Z"
  },
  "csrf_token": "<64 ký tự hex — đã ẩn>",
  "expires_at": "2026-11-18T14:54:36.309846Z"
}
```

## GET /auth/me khi chưa đăng nhập → 401

Khi tải trang: gọi `/auth/me`. 401 → hiện màn hình đăng nhập. 200 → lấy lại `csrf_token`.

HTTP `401`

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Login required"
  }
}
```

## POST /rooms → 201 (RoomDetail)

`my_role` quyết định có hiện nút của owner hay không.

HTTP `201`

```json
{
  "room": {
    "id": 2,
    "name": "Phòng luyện sáng thứ 7",
    "owner_id": 3,
    "invite_code": "862TWRYDWU",
    "status": "ACTIVE",
    "created_at": "2026-11-11T14:54:36.924876Z"
  },
  "my_role": "OWNER",
  "members": [
    {
      "user_id": 3,
      "username": "an_215435",
      "display_name": "An",
      "role": "OWNER",
      "joined_at": "2026-11-11T14:54:36.924876Z"
    }
  ]
}
```

## POST /trials/{id}/start → 200 (TrialView)

`current_round_id` là round đang diễn ra. `clock_index` đổi ⇒ tải lại nến. `dataset` không bao giờ có seed.

HTTP `200`

```json
{
  "trial": {
    "id": 2,
    "room_id": 2,
    "dataset_id": 2,
    "dataset_fingerprint": "4a54f5f8c1a89a5fc4fdbd814a2126a56573122d4323a955b4b484980675b480",
    "engine_version": "dojo-engine-v1",
    "status": "RUNNING",
    "clock_index": 119,
    "round_bars": 30,
    "created_by": 3,
    "created_at": "2026-11-11T14:54:36.985032Z",
    "updated_at": "2026-11-11T14:54:37.040182Z"
  },
  "dataset": {
    "id": 2,
    "label": "SYNTHETIC MARKET DATA — NOT REAL NAS100",
    "symbol": "SYN-IDX",
    "timeframe": "M1",
    "generator_version": "synth-rw-v1",
    "start_time": "2000-01-03T14:30:00Z",
    "candle_count": 600,
    "price_scale": 2,
    "fingerprint": "4a54f5f8c1a89a5fc4fdbd814a2126a56573122d4323a955b4b484980675b480"
  },
  "clock_time": "2000-01-03T16:29:00Z",
  "my_role": "OWNER",
  "rounds": [
    {
      "id": 3,
      "trial_id": 2,
      "round_no": 1,
      "status": "DECISION_OPEN",
      "decision_clock_index": 119,
      "reveal_clock_index": null,
      "opened_at": "2026-11-11T14:54:37.040182Z",
      "locked_at": null,
      "revealed_at": null,
      "completed_at": null
    }
  ],
  "current_round_id": 3
}
```

## GET /trials/{id}/candles → 200

Giá là số nguyên ticks: `1800089` với `price_scale: 2` = `18000.89`. Chỉ có nến tới `clock_index`.

HTTP `200`

```json
{
  "trial_id": 2,
  "clock_index": 119,
  "label": "SYNTHETIC MARKET DATA — NOT REAL NAS100",
  "symbol": "SYN-IDX",
  "timeframe": "M1",
  "price_scale": 2,
  "candles": [
    {
      "seq": 0,
      "open_time": "2000-01-03T14:30:00Z",
      "o": 1800000,
      "h": 1800089,
      "l": 1799690,
      "c": 1800089,
      "v": 201
    },
    {
      "seq": 1,
      "open_time": "2000-01-03T14:31:00Z",
      "o": 1800089,
      "h": 1800343,
      "l": 1799562,
      "c": 1799562,
      "v": 229
    },
    {
      "...": "117 nến ở giữa được lược bỏ trong ví dụ"
    },
    {
      "seq": 119,
      "open_time": "2000-01-03T16:29:00Z",
      "o": 1814257,
      "h": 1814257,
      "l": 1814068,
      "c": 1814117,
      "v": 231
    }
  ]
}
```

## GET /rounds/{id} — DECISION_OPEN, chưa ai commit

Hiện form quyết định (vì `my_decision` = null và status = DECISION_OPEN).

HTTP `200`

```json
{
  "round": {
    "id": 3,
    "trial_id": 2,
    "round_no": 1,
    "status": "DECISION_OPEN",
    "decision_clock_index": 119,
    "reveal_clock_index": null,
    "opened_at": "2026-11-11T14:54:37.040182Z",
    "locked_at": null,
    "revealed_at": null,
    "completed_at": null
  },
  "room_id": 2,
  "my_role": "MEMBER",
  "participants": [
    {
      "user_id": 3,
      "display_name": "An",
      "role": "OWNER",
      "committed": false
    },
    {
      "user_id": 4,
      "display_name": "Bình",
      "role": "MEMBER",
      "committed": false
    }
  ],
  "my_decision": null,
  "decisions_sealed": true,
  "decisions": [],
  "reviews": [],
  "outcome": null
}
```

## POST /rounds/{id}/decisions → 201

Server tự điền `user_id`, `known_at_*`, `dataset_fingerprint`, `committed_at`.

HTTP `201`

```json
{
  "decision": {
    "id": 4,
    "round_id": 3,
    "user_id": 3,
    "author_name": "An",
    "direction": "LONG",
    "thesis": "Giá quét đáy range rồi đóng nến trở lại, kỳ vọng tiếp diễn tăng",
    "invalidation": "Đóng nến M1 dưới đáy range",
    "confidence": 3,
    "risk_note": "0.5R, chưa tính phí",
    "dataset_fingerprint": "4a54f5f8c1a89a5fc4fdbd814a2126a56573122d4323a955b4b484980675b480",
    "known_at_clock_index": 119,
    "known_at_candle_time": "2000-01-03T16:29:00Z",
    "committed_at": "2026-11-11T14:54:37.075315Z"
  }
}
```

## GET /rounds/{id} — DECISION_OPEN, góc nhìn của Bình sau khi An commit

**Sealed:** Bình chỉ thấy `committed: true` của An; `decisions` rỗng.

HTTP `200`

```json
{
  "round": {
    "id": 3,
    "trial_id": 2,
    "round_no": 1,
    "status": "DECISION_OPEN",
    "decision_clock_index": 119,
    "reveal_clock_index": null,
    "opened_at": "2026-11-11T14:54:37.040182Z",
    "locked_at": null,
    "revealed_at": null,
    "completed_at": null
  },
  "room_id": 2,
  "my_role": "MEMBER",
  "participants": [
    {
      "user_id": 3,
      "display_name": "An",
      "role": "OWNER",
      "committed": true
    },
    {
      "user_id": 4,
      "display_name": "Bình",
      "role": "MEMBER",
      "committed": false
    }
  ],
  "my_decision": null,
  "decisions_sealed": true,
  "decisions": [],
  "reviews": [],
  "outcome": null
}
```

## GET /rounds/{id} — REVIEW_BLIND

Sau lock: `decisions_sealed: false`, thấy mọi quyết định + review. `outcome` vẫn null (tương lai còn ẩn).

HTTP `200`

```json
{
  "round": {
    "id": 3,
    "trial_id": 2,
    "round_no": 1,
    "status": "REVIEW_BLIND",
    "decision_clock_index": 119,
    "reveal_clock_index": null,
    "opened_at": "2026-11-11T14:54:37.040182Z",
    "locked_at": "2026-11-11T14:54:37.101199Z",
    "revealed_at": null,
    "completed_at": null
  },
  "room_id": 2,
  "my_role": "MEMBER",
  "participants": [
    {
      "user_id": 3,
      "display_name": "An",
      "role": "OWNER",
      "committed": true
    },
    {
      "user_id": 4,
      "display_name": "Bình",
      "role": "MEMBER",
      "committed": true
    }
  ],
  "my_decision": {
    "id": 6,
    "round_id": 3,
    "user_id": 4,
    "author_name": "Bình",
    "direction": "SHORT",
    "thesis": "Cấu trúc giảm, hồi về vùng cung rồi bị từ chối",
    "invalidation": "Phá đỉnh gần nhất",
    "confidence": 4,
    "risk_note": "",
    "dataset_fingerprint": "4a54f5f8c1a89a5fc4fdbd814a2126a56573122d4323a955b4b484980675b480",
    "known_at_clock_index": 119,
    "known_at_candle_time": "2000-01-03T16:29:00Z",
    "committed_at": "2026-11-11T14:54:37.090904Z"
  },
  "decisions_sealed": false,
  "decisions": [
    {
      "id": 4,
      "round_id": 3,
      "user_id": 3,
      "author_name": "An",
      "direction": "LONG",
      "thesis": "Giá quét đáy range rồi đóng nến trở lại, kỳ vọng tiếp diễn tăng",
      "invalidation": "Đóng nến M1 dưới đáy range",
      "confidence": 3,
      "risk_note": "0.5R, chưa tính phí",
      "dataset_fingerprint": "4a54f5f8c1a89a5fc4fdbd814a2126a56573122d4323a955b4b484980675b480",
      "known_at_clock_index": 119,
      "known_at_candle_time": "2000-01-03T16:29:00Z",
      "committed_at": "2026-11-11T14:54:37.075315Z"
    },
    {
      "id": 6,
      "round_id": 3,
      "user_id": 4,
      "author_name": "Bình",
      "direction": "SHORT",
      "thesis": "Cấu trúc giảm, hồi về vùng cung rồi bị từ chối",
      "invalidation": "Phá đỉnh gần nhất",
      "confidence": 4,
      "risk_note": "",
      "dataset_fingerprint": "4a54f5f8c1a89a5fc4fdbd814a2126a56573122d4323a955b4b484980675b480",
      "known_at_clock_index": 119,
      "known_at_candle_time": "2000-01-03T16:29:00Z",
      "committed_at": "2026-11-11T14:54:37.090904Z"
    }
  ],
  "reviews": [
    {
      "id": 2,
      "round_id": 3,
      "decision_id": 4,
      "reviewer_id": 4,
      "reviewer_name": "Bình",
      "thesis_clear": true,
      "invalidation_defined": true,
      "risk_defined": false,
      "evidence_based": true,
      "feedback": "Nên ghi rõ khối lượng vào lệnh.",
      "created_at": "2026-11-11T14:54:37.116332Z"
    }
  ],
  "outcome": null
}
```

## POST /rounds/{id}/reveal → 200 — REVEALED

`outcome.move_ticks: 2646` = `+26.46`. Luôn hiển thị `outcome.note` (không phải P&L).

HTTP `200`

```json
{
  "round": {
    "id": 3,
    "trial_id": 2,
    "round_no": 1,
    "status": "REVEALED",
    "decision_clock_index": 119,
    "reveal_clock_index": 149,
    "opened_at": "2026-11-11T14:54:37.040182Z",
    "locked_at": "2026-11-11T14:54:37.101199Z",
    "revealed_at": "2026-11-11T14:54:37.127397Z",
    "completed_at": null
  },
  "room_id": 2,
  "my_role": "OWNER",
  "participants": [
    {
      "user_id": 3,
      "display_name": "An",
      "role": "OWNER",
      "committed": true
    },
    {
      "user_id": 4,
      "display_name": "Bình",
      "role": "MEMBER",
      "committed": true
    }
  ],
  "my_decision": {
    "id": 4,
    "round_id": 3,
    "user_id": 3,
    "author_name": "An",
    "direction": "LONG",
    "thesis": "Giá quét đáy range rồi đóng nến trở lại, kỳ vọng tiếp diễn tăng",
    "invalidation": "Đóng nến M1 dưới đáy range",
    "confidence": 3,
    "risk_note": "0.5R, chưa tính phí",
    "dataset_fingerprint": "4a54f5f8c1a89a5fc4fdbd814a2126a56573122d4323a955b4b484980675b480",
    "known_at_clock_index": 119,
    "known_at_candle_time": "2000-01-03T16:29:00Z",
    "committed_at": "2026-11-11T14:54:37.075315Z"
  },
  "decisions_sealed": false,
  "decisions": [
    {
      "id": 4,
      "round_id": 3,
      "user_id": 3,
      "author_name": "An",
      "direction": "LONG",
      "thesis": "Giá quét đáy range rồi đóng nến trở lại, kỳ vọng tiếp diễn tăng",
      "invalidation": "Đóng nến M1 dưới đáy range",
      "confidence": 3,
      "risk_note": "0.5R, chưa tính phí",
      "dataset_fingerprint": "4a54f5f8c1a89a5fc4fdbd814a2126a56573122d4323a955b4b484980675b480",
      "known_at_clock_index": 119,
      "known_at_candle_time": "2000-01-03T16:29:00Z",
      "committed_at": "2026-11-11T14:54:37.075315Z"
    },
    {
      "id": 6,
      "round_id": 3,
      "user_id": 4,
      "author_name": "Bình",
      "direction": "SHORT",
      "thesis": "Cấu trúc giảm, hồi về vùng cung rồi bị từ chối",
      "invalidation": "Phá đỉnh gần nhất",
      "confidence": 4,
      "risk_note": "",
      "dataset_fingerprint": "4a54f5f8c1a89a5fc4fdbd814a2126a56573122d4323a955b4b484980675b480",
      "known_at_clock_index": 119,
      "known_at_candle_time": "2000-01-03T16:29:00Z",
      "committed_at": "2026-11-11T14:54:37.090904Z"
    }
  ],
  "reviews": [
    {
      "id": 2,
      "round_id": 3,
      "decision_id": 4,
      "reviewer_id": 4,
      "reviewer_name": "Bình",
      "thesis_clear": true,
      "invalidation_defined": true,
      "risk_defined": false,
      "evidence_based": true,
      "feedback": "Nên ghi rõ khối lượng vào lệnh.",
      "created_at": "2026-11-11T14:54:37.116332Z"
    }
  ],
  "outcome": {
    "from_clock_index": 119,
    "to_clock_index": 149,
    "decision_close": 1814117,
    "reveal_close": 1816763,
    "window_high": 1817107,
    "window_low": 1813672,
    "move_ticks": 2646,
    "price_scale": 2,
    "note": "Market move only. No P&L is computed: entries, exits, spread, commission and slippage are not modelled in v0.1. Synthetic data — not real trading performance."
  }
}
```

## GET /trials/{id} sau khi complete round 1

Round 1 COMPLETED, round 2 DECISION_OPEN tại clock mới; `current_round_id` trỏ sang round 2.

HTTP `200`

```json
{
  "trial": {
    "id": 2,
    "room_id": 2,
    "dataset_id": 2,
    "dataset_fingerprint": "4a54f5f8c1a89a5fc4fdbd814a2126a56573122d4323a955b4b484980675b480",
    "engine_version": "dojo-engine-v1",
    "status": "RUNNING",
    "clock_index": 149,
    "round_bars": 30,
    "created_by": 3,
    "created_at": "2026-11-11T14:54:36.985032Z",
    "updated_at": "2026-11-11T14:54:37.127397Z"
  },
  "dataset": {
    "id": 2,
    "label": "SYNTHETIC MARKET DATA — NOT REAL NAS100",
    "symbol": "SYN-IDX",
    "timeframe": "M1",
    "generator_version": "synth-rw-v1",
    "start_time": "2000-01-03T14:30:00Z",
    "candle_count": 600,
    "price_scale": 2,
    "fingerprint": "4a54f5f8c1a89a5fc4fdbd814a2126a56573122d4323a955b4b484980675b480"
  },
  "clock_time": "2000-01-03T16:59:00Z",
  "my_role": "MEMBER",
  "rounds": [
    {
      "id": 3,
      "trial_id": 2,
      "round_no": 1,
      "status": "COMPLETED",
      "decision_clock_index": 119,
      "reveal_clock_index": 149,
      "opened_at": "2026-11-11T14:54:37.040182Z",
      "locked_at": "2026-11-11T14:54:37.101199Z",
      "revealed_at": "2026-11-11T14:54:37.127397Z",
      "completed_at": "2026-11-11T14:54:37.133307Z"
    },
    {
      "id": 4,
      "trial_id": 2,
      "round_no": 2,
      "status": "DECISION_OPEN",
      "decision_clock_index": 149,
      "reveal_clock_index": null,
      "opened_at": "2026-11-11T14:54:37.133307Z",
      "locked_at": null,
      "revealed_at": null,
      "completed_at": null
    }
  ],
  "current_round_id": 4
}
```

## GET /rooms/{id}/events → 200

Timeline. Dùng `?after=<sequence cuối>` để chỉ lấy event mới.

HTTP `200`

```json
{
  "events": [
    {
      "id": 13,
      "room_id": 2,
      "sequence": 1,
      "type": "ROOM_CREATED",
      "actor_id": 3,
      "subject_type": "ROOM",
      "subject_id": 2,
      "payload": {
        "name": "Phòng luyện sáng thứ 7"
      },
      "created_at": "2026-11-11T14:54:36.924876Z"
    },
    {
      "id": 14,
      "room_id": 2,
      "sequence": 2,
      "type": "MEMBER_JOINED",
      "actor_id": 4,
      "subject_type": "ROOM",
      "subject_id": 2,
      "payload": {
        "user_id": 4
      },
      "created_at": "2026-11-11T14:54:36.98001Z"
    },
    {
      "id": 15,
      "room_id": 2,
      "sequence": 3,
      "type": "TRIAL_CREATED",
      "actor_id": 3,
      "subject_type": "TRIAL",
      "subject_id": 2,
      "payload": {
        "clock_index": 119,
        "dataset_fingerprint": "4a54f5f8c1a89a5fc4fdbd814a2126a56573122d4323a955b4b484980675b480",
        "engine_version": "dojo-engine-v1"
      },
      "created_at": "2026-11-11T14:54:36.985032Z"
    },
    {
      "...": "còn 9 event nữa"
    }
  ]
}
```

## Lỗi 409 — commit lần hai

Quyết định đã commit không sửa được.

HTTP `409`

```json
{
  "error": {
    "code": "DECISION_ALREADY_COMMITTED",
    "message": "You already committed a decision for this round; committed decisions cannot be changed"
  }
}
```

## Lỗi 400 — thesis quá ngắn

Validate ở client cho thân thiện, nhưng server mới là người quyết định.

HTTP `400`

```json
{
  "error": {
    "code": "INVALID_THESIS",
    "message": "thesis must be 10-2000 characters"
  }
}
```

## Lỗi 403 — member bấm lock

Đừng hiện nút owner cho member; nếu vẫn gọi, server trả lỗi này.

HTTP `403`

```json
{
  "error": {
    "code": "OWNER_ONLY",
    "message": "Only the room owner can do this"
  }
}
```

## Lỗi 409 — reveal khi chưa lock

Chỉ hiện nút hợp lệ với `round.status` hiện tại.

HTTP `409`

```json
{
  "error": {
    "code": "INVALID_ROUND_TRANSITION",
    "message": "This action is not allowed in the round's current state"
  }
}
```

## Lỗi 403 — thiếu/sai X-CSRF-Token

Thường do quên gọi `/auth/me` sau khi reload trang.

HTTP `403`

```json
{
  "error": {
    "code": "CSRF_TOKEN_INVALID",
    "message": "Missing or invalid CSRF token"
  }
}
```
