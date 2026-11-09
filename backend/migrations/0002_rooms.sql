-- Dojo rooms and membership.

CREATE TABLE rooms (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name           VARCHAR(80)     NOT NULL,
    owner_id       BIGINT UNSIGNED NOT NULL,
    invite_code    CHAR(10)        CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status         ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    -- Counter used to give every audit event of this room a gap-free
    -- sequence number. Incrementing it also serialises event writers.
    last_event_seq BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at     DATETIME(6)     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_rooms_invite_code (invite_code),
    KEY idx_rooms_owner (owner_id),
    CONSTRAINT fk_rooms_owner FOREIGN KEY (owner_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE room_members (
    room_id   BIGINT UNSIGNED NOT NULL,
    user_id   BIGINT UNSIGNED NOT NULL,
    role      ENUM('OWNER', 'MEMBER') NOT NULL,
    joined_at DATETIME(6)     NOT NULL,
    PRIMARY KEY (room_id, user_id),          -- a user joins a room at most once
    KEY idx_room_members_user (user_id),     -- "which rooms am I in?"
    CONSTRAINT fk_room_members_room FOREIGN KEY (room_id) REFERENCES rooms (id),
    CONSTRAINT fk_room_members_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
