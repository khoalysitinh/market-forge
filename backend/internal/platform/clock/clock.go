// Package clock provides the wall-clock function services use for
// server timestamps. Services receive it through their constructor so tests
// can inject a fixed time.
package clock

import "time"

// Func returns "now". Production uses System.
type Func func() time.Time

// System returns the current UTC time truncated to microseconds, which is
// the precision of our DATETIME(6) columns. Truncating up front means the
// value we return to the client equals the value we stored.
func System() time.Time {
	return time.Now().UTC().Truncate(time.Microsecond)
}
