package marketdata

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/database"
)

// Dataset is the stored metadata of a generated dataset.
// Seed is intentionally excluded from JSON: knowing it reveals the future.
type Dataset struct {
	ID               int64     `json:"id"`
	Label            string    `json:"label"`
	Symbol           string    `json:"symbol"`
	Timeframe        string    `json:"timeframe"`
	GeneratorVersion string    `json:"generator_version"`
	Seed             uint64    `json:"-"`
	StartTime        time.Time `json:"start_time"`
	CandleCount      int       `json:"candle_count"`
	PriceScale       int       `json:"price_scale"`
	Fingerprint      string    `json:"fingerprint"`
}

// ErrDatasetNotFound is returned when a dataset id does not exist.
var ErrDatasetNotFound = errors.New("dataset not found")

// insertBatchSize keeps each multi-row INSERT well below max_allowed_packet.
const insertBatchSize = 200

// GenerateAndStore creates a dataset and all its candles inside tx.
func GenerateAndStore(ctx context.Context, tx *sql.Tx, p Params, now time.Time) (Dataset, error) {
	candles, err := Generate(p)
	if err != nil {
		return Dataset{}, err
	}
	if err := Validate(p, candles); err != nil {
		return Dataset{}, fmt.Errorf("generated data failed validation: %w", err)
	}
	ds := Dataset{
		Label: Label, Symbol: Symbol, Timeframe: Timeframe, GeneratorVersion: GeneratorVersion,
		Seed: p.Seed, StartTime: p.StartTime, CandleCount: p.Count, PriceScale: PriceScale,
		Fingerprint: Fingerprint(p, candles),
	}
	res, err := tx.ExecContext(ctx, `INSERT INTO datasets
		(label, symbol, timeframe, generator_version, seed, start_time, candle_count,
		 price_scale, initial_price_ticks, fingerprint, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		ds.Label, ds.Symbol, ds.Timeframe, ds.GeneratorVersion, ds.Seed, ds.StartTime, ds.CandleCount,
		ds.PriceScale, p.InitialPriceTicks, ds.Fingerprint, now)
	if err != nil {
		return Dataset{}, fmt.Errorf("insert dataset: %w", err)
	}
	if ds.ID, err = res.LastInsertId(); err != nil {
		return Dataset{}, err
	}

	for start := 0; start < len(candles); start += insertBatchSize {
		batch := candles[start:min(start+insertBatchSize, len(candles))]
		// Build "(?,?,...),(?,?,...)" — only placeholders are concatenated,
		// never values, so this is still fully parameterised SQL.
		placeholders := strings.TrimSuffix(strings.Repeat("(?,?,?,?,?,?,?,?),", len(batch)), ",")
		args := make([]any, 0, len(batch)*8)
		for _, c := range batch {
			args = append(args, ds.ID, c.Seq, c.OpenTime, c.Open, c.High, c.Low, c.Close, c.Volume)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO candles
			(dataset_id, seq, open_time, open_ticks, high_ticks, low_ticks, close_ticks, volume)
			VALUES `+placeholders, args...); err != nil {
			return Dataset{}, fmt.Errorf("insert candles: %w", err)
		}
	}
	return ds, nil
}

// GetDataset loads dataset metadata.
func GetDataset(ctx context.Context, q database.Querier, id int64) (Dataset, error) {
	var ds Dataset
	err := q.QueryRowContext(ctx, `SELECT id, label, symbol, timeframe, generator_version, seed,
			start_time, candle_count, price_scale, fingerprint
		FROM datasets WHERE id = ?`, id).
		Scan(&ds.ID, &ds.Label, &ds.Symbol, &ds.Timeframe, &ds.GeneratorVersion, &ds.Seed,
			&ds.StartTime, &ds.CandleCount, &ds.PriceScale, &ds.Fingerprint)
	if errors.Is(err, sql.ErrNoRows) {
		return Dataset{}, ErrDatasetNotFound
	}
	if err != nil {
		return Dataset{}, fmt.Errorf("get dataset: %w", err)
	}
	return ds, nil
}

// ListCandlesUpTo returns candles with fromSeq <= seq <= cutoffSeq, oldest
// first. cutoffSeq MUST come from the server-owned replay clock; this is the
// only function that reads candles for players.
func ListCandlesUpTo(ctx context.Context, q database.Querier, datasetID int64, fromSeq, cutoffSeq int) ([]Candle, error) {
	rows, err := q.QueryContext(ctx, `SELECT seq, open_time, open_ticks, high_ticks, low_ticks, close_ticks, volume
		FROM candles
		WHERE dataset_id = ? AND seq >= ? AND seq <= ?
		ORDER BY seq`, datasetID, fromSeq, cutoffSeq)
	if err != nil {
		return nil, fmt.Errorf("list candles: %w", err)
	}
	defer rows.Close()
	out := []Candle{}
	for rows.Next() {
		var c Candle
		if err := rows.Scan(&c.Seq, &c.OpenTime, &c.Open, &c.High, &c.Low, &c.Close, &c.Volume); err != nil {
			return nil, fmt.Errorf("scan candle: %w", err)
		}
		c.OpenTime = c.OpenTime.UTC()
		out = append(out, c)
	}
	return out, rows.Err()
}
