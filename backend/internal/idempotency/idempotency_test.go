package idempotency

import (
	"strings"
	"testing"
)

func TestValidateKey(t *testing.T) {
	valid := []string{"", "a", "550e8400-e29b-41d4-a716-446655440000", strings.Repeat("k", 128)}
	for _, k := range valid {
		if err := ValidateKey(k); err != nil {
			t.Errorf("ValidateKey(%q) = %v, want nil", k, err)
		}
	}
	invalid := []string{strings.Repeat("k", 129), "has space", "tab\t", "ünicode", "new\nline"}
	for _, k := range invalid {
		if err := ValidateKey(k); err == nil {
			t.Errorf("ValidateKey(%q) accepted an invalid key", k)
		}
	}
}

func TestHashRequestSemantics(t *testing.T) {
	type req struct {
		RoundID int64
		Thesis  string
	}
	a, _ := HashRequest(req{1, "same"})
	b, _ := HashRequest(req{1, "same"})
	c, _ := HashRequest(req{1, "different"})
	d, _ := HashRequest(req{2, "same"})
	if a != b {
		t.Error("identical requests must hash identically (retry returns original result)")
	}
	if a == c || a == d {
		t.Error("different body or path must hash differently (reuse must be rejected)")
	}
}
