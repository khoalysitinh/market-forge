-- Synthetic market data. Prices are stored as integer ticks:
--   price = ticks / 10^price_scale
-- No floating point is used for prices anywhere in storage.

CREATE TABLE datasets (
    id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    label               VARCHAR(128)     NOT NULL,  -- 'SYNTHETIC MARKET DATA — NOT REAL NAS100'
    symbol              VARCHAR(32)      NOT NULL,  -- fictional symbol, e.g. 'SYN-IDX'
    timeframe           ENUM('M1')       NOT NULL,
    generator_version   VARCHAR(32)      NOT NULL,
    -- SECRET: seed + generator reproduces the whole future of the dataset.
    -- It must never be returned by the API.
    seed                BIGINT UNSIGNED  NOT NULL,
    start_time          DATETIME         NOT NULL,  -- UTC open time of candle 0
    candle_count        INT UNSIGNED     NOT NULL,
    price_scale         TINYINT UNSIGNED NOT NULL,
    initial_price_ticks BIGINT           NOT NULL,
    fingerprint         CHAR(64)         CHARACTER SET ascii NOT NULL,  -- SHA-256 of params + candles
    created_at          DATETIME(6)      NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_datasets_fingerprint (fingerprint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE candles (
    dataset_id  BIGINT UNSIGNED NOT NULL,
    seq         INT UNSIGNED    NOT NULL,           -- 0-based index inside the dataset
    open_time   DATETIME        NOT NULL,           -- UTC
    open_ticks  BIGINT          NOT NULL,
    high_ticks  BIGINT          NOT NULL,
    low_ticks   BIGINT          NOT NULL,
    close_ticks BIGINT          NOT NULL,
    volume      BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, seq),
    CONSTRAINT chk_candles_ohlc CHECK (
        high_ticks >= GREATEST(open_ticks, close_ticks)
        AND low_ticks <= LEAST(open_ticks, close_ticks)
        AND low_ticks > 0
    ),
    CONSTRAINT fk_candles_dataset FOREIGN KEY (dataset_id) REFERENCES datasets (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
