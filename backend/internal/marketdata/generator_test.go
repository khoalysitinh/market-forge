package marketdata

import (
	"testing"
	"time"
)

var testStart = time.Date(2000, time.January, 3, 14, 30, 0, 0, time.UTC)

func TestGenerateIsDeterministic(t *testing.T) {
	p := DefaultParams(42, testStart, 600)
	a, err := Generate(p)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := Generate(p)
	if Fingerprint(p, a) != Fingerprint(p, b) {
		t.Fatal("same params produced different data")
	}
	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("candle %d differs: %+v vs %+v", i, a[i], b[i])
		}
	}
}

// Golden value: if this changes, the generator output changed and every
// stored fingerprint would no longer be reproducible. Only update it
// together with a new GeneratorVersion.
func TestGenerateGoldenFingerprint(t *testing.T) {
	p := DefaultParams(42, testStart, 600)
	c, _ := Generate(p)
	const golden = "4f5318f1745b15906f68832b9659c5ec999fc906909747b71a0becbec7f79013"
	if got := Fingerprint(p, c); got != golden {
		t.Fatalf("fingerprint for seed 42 = %s, want %s (generator output changed?)", got, golden)
	}
}

func TestDifferentSeedsDiffer(t *testing.T) {
	p1, p2 := DefaultParams(1, testStart, 100), DefaultParams(2, testStart, 100)
	c1, _ := Generate(p1)
	c2, _ := Generate(p2)
	if Fingerprint(p1, c1) == Fingerprint(p2, c2) {
		t.Fatal("different seeds produced identical data")
	}
}

func TestGeneratedCandlesAreValid(t *testing.T) {
	// Many seeds, long series: OHLC rules, UTC minute spacing, positive prices.
	for seed := uint64(0); seed < 200; seed++ {
		p := DefaultParams(seed, testStart, 2000)
		c, err := Generate(p)
		if err != nil {
			t.Fatal(err)
		}
		if err := Validate(p, c); err != nil {
			t.Fatalf("seed %d: %v", seed, err)
		}
		for i := 1; i < len(c); i++ {
			if c[i].Open != c[i-1].Close {
				t.Fatalf("seed %d candle %d: open %d != previous close %d", seed, i, c[i].Open, c[i-1].Close)
			}
		}
	}
}

func TestValidateRejectsBrokenCandles(t *testing.T) {
	p := DefaultParams(7, testStart, 3)
	base, _ := Generate(p)
	cases := map[string]func(c []Candle){
		"high below close": func(c []Candle) { c[1].High = c[1].Close - 1 },
		"low above open":   func(c []Candle) { c[1].Low = c[1].Open + 1 },
		"wrong time":       func(c []Candle) { c[2].OpenTime = c[2].OpenTime.Add(time.Second) },
		"wrong seq":        func(c []Candle) { c[0].Seq = 5 },
		"non-utc":          func(c []Candle) { c[0].OpenTime = c[0].OpenTime.In(time.FixedZone("ICT", 7*3600)) },
	}
	for name, breakIt := range cases {
		t.Run(name, func(t *testing.T) {
			c := append([]Candle(nil), base...)
			breakIt(c)
			if Validate(p, c) == nil {
				t.Fatal("Validate accepted broken data")
			}
		})
	}
}

func TestGenerateRejectsBadParams(t *testing.T) {
	bad := []Params{
		{Seed: 1, StartTime: testStart, Count: 0, InitialPriceTicks: defaultInitialPriceTicks},
		{Seed: 1, StartTime: testStart.Add(time.Second), Count: 5, InitialPriceTicks: defaultInitialPriceTicks},
		{Seed: 1, StartTime: testStart.In(time.FixedZone("X", 3600)), Count: 5, InitialPriceTicks: defaultInitialPriceTicks},
		{Seed: 1, StartTime: testStart, Count: 5, InitialPriceTicks: 1},
	}
	for i, p := range bad {
		if _, err := Generate(p); err == nil {
			t.Errorf("case %d: expected error", i)
		}
	}
}
