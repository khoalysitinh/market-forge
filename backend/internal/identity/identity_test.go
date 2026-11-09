package identity

import (
	"errors"
	"strings"
	"testing"
)

func TestRegisterInputValidate(t *testing.T) {
	tests := []struct {
		name string
		in   RegisterInput
		want error
	}{
		{"ok", RegisterInput{Username: "Khoa_01", Password: "correct horse battery"}, nil},
		{"short username", RegisterInput{Username: "ab", Password: "correct horse battery"}, ErrInvalidUsername},
		{"username with dash", RegisterInput{Username: "kho-a", Password: "correct horse battery"}, ErrInvalidUsername},
		{"short password", RegisterInput{Username: "khoa", Password: "123456789"}, ErrInvalidPassword},
		{"password over 72 bytes", RegisterInput{Username: "khoa", Password: strings.Repeat("p", 73)}, ErrInvalidPassword},
		{"long display name", RegisterInput{Username: "khoa", Password: "correct horse battery",
			DisplayName: strings.Repeat("d", 65)}, ErrInvalidDisplayName},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			in := tc.in
			in.Normalize()
			if err := in.Validate(); !errors.Is(err, tc.want) {
				t.Fatalf("got %v, want %v", err, tc.want)
			}
		})
	}
}

func TestNormalizeDefaultsDisplayName(t *testing.T) {
	in := RegisterInput{Username: "  KHOA  "}
	in.Normalize()
	if in.Username != "khoa" || in.DisplayName != "khoa" {
		t.Fatalf("got %+v", in)
	}
}

func TestHashTokenIsStableAndNotIdentity(t *testing.T) {
	if hashToken("abc") != hashToken("abc") {
		t.Fatal("hash not stable")
	}
	if hashToken("abc") == "abc" || len(hashToken("abc")) != 64 {
		t.Fatal("token must be stored as a SHA-256 hex digest")
	}
}
