// Package marketdata generates and stores SYNTHETIC OHLCV candles.
//
// Prices are int64 "ticks": price = ticks / 10^PriceScale. Using integers
// means NaN and Infinity cannot exist, and the same seed produces exactly the
// same bytes on every machine and every Go version.
package marketdata

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
)

// Labels shown everywhere the data appears. The symbol is fictional on
// purpose: this is not data from any real exchange or data vendor.
const (
	Label            = "SYNTHETIC MARKET DATA — NOT REAL NAS100"
	Symbol           = "SYN-IDX"
	Timeframe        = "M1"
	GeneratorVersion = "synth-rw-v1"
	PriceScale       = 2 // 1 tick = 0.01 price units
)

// Generator tuning. All values are in ticks (0.01 points).
const (
	defaultInitialPriceTicks = 1_800_000 // 18 000.00
	stepsPerCandle           = 6         // intra-candle path steps used to build H/L
	minPriceTicks            = 100_000   // floor so prices stay positive (1 000.00)
	regimeChangeOneIn        = 60        // ~ once per hour of M1 candles
	baseVolume               = 100
)

// Volatility (max step size) and drift (ticks per step) regimes.
var (
	volatilityRegimes = []int64{150, 300, 600}
	driftRegimes      = []int64{-40, -15, 0, 15, 40}
)

// Params fully determine a dataset. Same Params => same candles.
type Params struct {
	Seed              uint64
	StartTime         time.Time // UTC, aligned to the minute
	Count             int
	InitialPriceTicks int64
}

// Candle is one M1 bar. Seq is its 0-based index in the dataset.
type Candle struct {
	Seq      int       `json:"seq"`
	OpenTime time.Time `json:"open_time"`
	Open     int64     `json:"o"`
	High     int64     `json:"h"`
	Low      int64     `json:"l"`
	Close    int64     `json:"c"`
	Volume   int64     `json:"v"`
}

// DefaultParams returns params for a fresh dataset with the given seed.
func DefaultParams(seed uint64, start time.Time, count int) Params {
	return Params{Seed: seed, StartTime: start.UTC().Truncate(time.Minute), Count: count,
		InitialPriceTicks: defaultInitialPriceTicks}
}

// Generate produces Count candles: a random walk with occasional changes of
// volatility and drift so the chart shows trends and ranges.
func Generate(p Params) ([]Candle, error) {
	if p.Count <= 0 {
		return nil, errors.New("count must be positive")
	}
	if p.InitialPriceTicks < minPriceTicks {
		return nil, fmt.Errorf("initial price must be >= %d ticks", minPriceTicks)
	}
	if !p.StartTime.Equal(p.StartTime.UTC().Truncate(time.Minute)) || p.StartTime.Location() != time.UTC {
		return nil, errors.New("start time must be UTC and aligned to the minute")
	}

	rng := splitMix64{state: p.Seed}
	vol := volatilityRegimes[1]
	drift := int64(0)
	price := p.InitialPriceTicks
	out := make([]Candle, p.Count)

	for i := range p.Count {
		if rng.intn(regimeChangeOneIn) == 0 {
			vol = volatilityRegimes[rng.intn(len(volatilityRegimes))]
			drift = driftRegimes[rng.intn(len(driftRegimes))]
		}
		open := price
		high, low := open, open
		for range stepsPerCandle {
			step := int64(rng.intn(int(2*vol+1))) - vol // uniform in [-vol, +vol]
			price = max(price+drift+step, minPriceTicks)
			high = max(high, price)
			low = min(low, price)
		}
		move := price - open
		if move < 0 {
			move = -move
		}
		out[i] = Candle{
			Seq:      i,
			OpenTime: p.StartTime.Add(time.Duration(i) * time.Minute),
			Open:     open,
			High:     high,
			Low:      low,
			Close:    price,
			Volume:   baseVolume + int64(rng.intn(400)) + move/10,
		}
	}
	return out, nil
}

// Validate checks the OHLCV invariants. Generate always satisfies them; the
// function exists so tests and loaders can verify any candle slice.
func Validate(p Params, candles []Candle) error {
	if len(candles) != p.Count {
		return fmt.Errorf("expected %d candles, got %d", p.Count, len(candles))
	}
	for i, c := range candles {
		switch {
		case c.Seq != i:
			return fmt.Errorf("candle %d: seq is %d", i, c.Seq)
		case !c.OpenTime.Equal(p.StartTime.Add(time.Duration(i) * time.Minute)):
			return fmt.Errorf("candle %d: open time %s is not start+%d minutes", i, c.OpenTime, i)
		case c.OpenTime.Location() != time.UTC:
			return fmt.Errorf("candle %d: open time is not UTC", i)
		case c.High < max(c.Open, c.Close):
			return fmt.Errorf("candle %d: high below open/close", i)
		case c.Low > min(c.Open, c.Close):
			return fmt.Errorf("candle %d: low above open/close", i)
		case c.High < c.Low:
			return fmt.Errorf("candle %d: high below low", i)
		case c.Low <= 0:
			return fmt.Errorf("candle %d: non-positive price", i)
		case c.Volume < 0:
			return fmt.Errorf("candle %d: negative volume", i)
		}
	}
	return nil
}

// Fingerprint is SHA-256 over a canonical text form of the dataset content.
// It identifies "exactly this data": decisions store it, so we can later
// prove which dataset a decision was made on. The seed is deliberately NOT
// part of the input.
func Fingerprint(p Params, candles []Candle) string {
	h := sha256.New()
	fmt.Fprintf(h, "%s|%s|%s|%d|%d|%d|%d\n", GeneratorVersion, Symbol, Timeframe, PriceScale,
		p.StartTime.Unix(), p.Count, p.InitialPriceTicks)
	for _, c := range candles {
		fmt.Fprintf(h, "%d,%d,%d,%d,%d,%d,%d\n", c.Seq, c.OpenTime.Unix(), c.Open, c.High, c.Low, c.Close, c.Volume)
	}
	return hex.EncodeToString(h.Sum(nil))
}

// splitMix64 is a tiny, well-known PRNG (Steele, Lea & Flood 2014).
// We implement it ourselves instead of using math/rand so the output is
// fixed forever by this source code, not by a library version.
// It is NOT cryptographically secure — it only drives synthetic prices.
type splitMix64 struct{ state uint64 }

func (s *splitMix64) next() uint64 {
	s.state += 0x9E3779B97F4A7C15
	z := s.state
	z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9
	z = (z ^ (z >> 27)) * 0x94D049BB133111EB
	return z ^ (z >> 31)
}

// intn returns a value in [0, n). The modulo bias is below 2^-50 for the
// small n we use, which is irrelevant for synthetic data.
func (s *splitMix64) intn(n int) int {
	return int(s.next() % uint64(n))
}
