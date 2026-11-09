-- Trials, rounds, sealed decisions and blind reviews.

CREATE TABLE trials (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    room_id             BIGINT UNSIGNED NOT NULL,
    dataset_id          BIGINT UNSIGNED NOT NULL,
    dataset_fingerprint CHAR(64)        CHARACTER SET ascii NOT NULL,
    engine_version      VARCHAR(32)     NOT NULL,
    status              ENUM('CREATED', 'RUNNING', 'FINISHED') NOT NULL,
    -- Server-owned replay clock: candles with seq <= clock_index are visible.
    -- Only the server moves it, and only forward.
    clock_index         INT UNSIGNED    NOT NULL,
    round_bars          INT UNSIGNED    NOT NULL,   -- candles revealed per round
    created_by          BIGINT UNSIGNED NOT NULL,
    created_at          DATETIME(6)     NOT NULL,
    updated_at          DATETIME(6)     NOT NULL,
    -- NULL once the trial is FINISHED. A UNIQUE index ignores NULLs, so this
    -- enforces "at most one unfinished trial per room" inside the database.
    active_room_id      BIGINT UNSIGNED AS (IF(status IN ('CREATED', 'RUNNING'), room_id, NULL)) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_trials_one_active_per_room (active_room_id),
    KEY idx_trials_room (room_id),
    CONSTRAINT fk_trials_room    FOREIGN KEY (room_id)    REFERENCES rooms (id),
    CONSTRAINT fk_trials_dataset FOREIGN KEY (dataset_id) REFERENCES datasets (id),
    CONSTRAINT fk_trials_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rounds (
    id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    trial_id             BIGINT UNSIGNED NOT NULL,
    round_no             INT UNSIGNED    NOT NULL,
    status               ENUM('DECISION_OPEN', 'REVIEW_BLIND', 'REVEALED', 'COMPLETED') NOT NULL,
    decision_clock_index INT UNSIGNED    NOT NULL,  -- clock when decisions were made
    reveal_clock_index   INT UNSIGNED    NULL,      -- clock after reveal
    opened_at            DATETIME(6)     NOT NULL,
    locked_at            DATETIME(6)     NULL,
    revealed_at          DATETIME(6)     NULL,
    completed_at         DATETIME(6)     NULL,
    -- At most one not-yet-completed round per trial (same NULL trick as above).
    open_trial_id        BIGINT UNSIGNED AS (IF(status <> 'COMPLETED', trial_id, NULL)) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_rounds_trial_no (trial_id, round_no),
    UNIQUE KEY uq_rounds_one_open_per_trial (open_trial_id),
    CONSTRAINT fk_rounds_trial FOREIGN KEY (trial_id) REFERENCES trials (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A row in this table IS a committed decision (there are no drafts in v0.1).
CREATE TABLE decisions (
    id                   BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    round_id             BIGINT UNSIGNED  NOT NULL,
    user_id              BIGINT UNSIGNED  NOT NULL,
    direction            ENUM('LONG', 'SHORT', 'WAIT') NOT NULL,
    thesis               VARCHAR(2000)    NOT NULL,
    invalidation         VARCHAR(1000)    NULL,
    -- 1..5: "how confident am I that this plan is right for the next
    -- reveal window" (1 = guess, 5 = very high conviction).
    confidence           TINYINT UNSIGNED NOT NULL,
    risk_note            VARCHAR(500)     NULL,
    -- Copied by the server, never sent by the client:
    dataset_fingerprint  CHAR(64)         CHARACTER SET ascii NOT NULL,
    known_at_clock_index INT UNSIGNED     NOT NULL,
    known_at_candle_time DATETIME         NOT NULL,
    committed_at         DATETIME(6)      NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_decisions_round_user (round_id, user_id),   -- invariant #1
    KEY idx_decisions_user (user_id),
    CONSTRAINT chk_decisions_confidence CHECK (confidence BETWEEN 1 AND 5),
    CONSTRAINT fk_decisions_round FOREIGN KEY (round_id) REFERENCES rounds (id),
    CONSTRAINT fk_decisions_user  FOREIGN KEY (user_id)  REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reviews (
    id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    round_id             BIGINT UNSIGNED NOT NULL,
    decision_id          BIGINT UNSIGNED NOT NULL,
    reviewer_id          BIGINT UNSIGNED NOT NULL,
    -- Checklist rubric, answered only from information visible at decision time.
    thesis_clear         BOOLEAN         NOT NULL,
    invalidation_defined BOOLEAN         NOT NULL,
    risk_defined         BOOLEAN         NOT NULL,
    evidence_based       BOOLEAN         NOT NULL,
    feedback             VARCHAR(2000)   NULL,
    created_at           DATETIME(6)     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_reviews_decision_reviewer (decision_id, reviewer_id),
    KEY idx_reviews_round (round_id),
    CONSTRAINT fk_reviews_round    FOREIGN KEY (round_id)    REFERENCES rounds (id),
    CONSTRAINT fk_reviews_decision FOREIGN KEY (decision_id) REFERENCES decisions (id),
    CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
