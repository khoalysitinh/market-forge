-- Append-only audit log. In v0.1 the aggregate is the room: every dojo
-- event belongs to exactly one room and gets the next room sequence number.
CREATE TABLE audit_events (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    room_id       BIGINT UNSIGNED NOT NULL,      -- aggregate id
    sequence      BIGINT UNSIGNED NOT NULL,      -- 1, 2, 3 ... per room, no gaps
    event_type    VARCHAR(64)     NOT NULL,
    actor_user_id BIGINT UNSIGNED NOT NULL,
    subject_type  VARCHAR(32)     NOT NULL,      -- ROOM, TRIAL, ROUND, DECISION, REVIEW
    subject_id    BIGINT UNSIGNED NOT NULL,
    payload       JSON            NOT NULL,
    created_at    DATETIME(6)     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_audit_room_sequence (room_id, sequence),
    CONSTRAINT fk_audit_room  FOREIGN KEY (room_id)       REFERENCES rooms (id),
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Idempotency-Key records. The row is inserted at the START of the business
-- transaction (claim) and filled with result_id before COMMIT, so a
-- concurrent request with the same key blocks on the row lock and then sees
-- the committed result.
CREATE TABLE idempotency_keys (
    user_id      BIGINT UNSIGNED NOT NULL,
    operation    VARCHAR(64)     CHARACTER SET ascii NOT NULL,
    idem_key     VARCHAR(128)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_hash CHAR(64)        CHARACTER SET ascii NOT NULL,
    result_id    BIGINT UNSIGNED NULL,
    created_at   DATETIME(6)     NOT NULL,
    PRIMARY KEY (user_id, operation, idem_key),
    CONSTRAINT fk_idem_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
