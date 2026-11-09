-- Identity: users and server-side sessions.

CREATE TABLE users (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username      VARCHAR(32)     NOT NULL,           -- stored lowercase
    display_name  VARCHAR(64)     NOT NULL,
    password_hash VARCHAR(255)    NOT NULL,           -- bcrypt hash, never the password
    created_at    DATETIME(6)     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The browser holds a random session token in an HttpOnly cookie.
-- We only store SHA-256(token): a leaked database dump cannot be replayed
-- as a login cookie.
CREATE TABLE sessions (
    token_hash CHAR(64)        CHARACTER SET ascii NOT NULL,
    user_id    BIGINT UNSIGNED NOT NULL,
    csrf_token CHAR(64)        CHARACTER SET ascii NOT NULL,
    created_at DATETIME(6)     NOT NULL,
    expires_at DATETIME(6)     NOT NULL,
    revoked_at DATETIME(6)     NULL,
    PRIMARY KEY (token_hash),
    KEY idx_sessions_user (user_id),
    KEY idx_sessions_expires (expires_at),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
