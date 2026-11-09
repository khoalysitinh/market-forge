package httpserver

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/apperr"
)

func TestDecodeJSON(t *testing.T) {
	type body struct {
		Name string `json:"name"`
	}
	tests := []struct {
		name, contentType, body string
		wantCode                string // "" = success
	}{
		{"ok", "application/json", `{"name":"dojo"}`, ""},
		{"ok with charset", "application/json; charset=utf-8", `{"name":"dojo"}`, ""},
		{"form post rejected", "application/x-www-form-urlencoded", `name=dojo`, "UNSUPPORTED_MEDIA_TYPE"},
		{"missing content type", "", `{"name":"dojo"}`, "UNSUPPORTED_MEDIA_TYPE"},
		{"unknown field", "application/json", `{"name":"x","user_id":1}`, "INVALID_JSON"},
		{"trailing data", "application/json", `{"name":"x"}{"name":"y"}`, "INVALID_JSON"},
		{"malformed", "application/json", `{"name":`, "INVALID_JSON"},
		{"too large", "application/json", `{"name":"` + strings.Repeat("a", maxBodyBytes) + `"}`, "BODY_TOO_LARGE"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(tc.body))
			if tc.contentType != "" {
				r.Header.Set("Content-Type", tc.contentType)
			}
			var dst body
			err := DecodeJSON(httptest.NewRecorder(), r, &dst)
			if tc.wantCode == "" {
				if err != nil {
					t.Fatalf("unexpected error %v", err)
				}
				return
			}
			if ae := apperr.As(err); ae == nil || ae.Code != tc.wantCode {
				t.Fatalf("got %v, want code %s", err, tc.wantCode)
			}
		})
	}
}

func TestWriteErrorMapsKinds(t *testing.T) {
	cases := map[apperr.Kind]int{
		apperr.KindInvalid:       400,
		apperr.KindUnauthorized:  401,
		apperr.KindForbidden:     403,
		apperr.KindNotFound:      404,
		apperr.KindConflict:      409,
		apperr.KindUnprocessable: 422,
	}
	for kind, status := range cases {
		w := httptest.NewRecorder()
		WriteError(w, httptest.NewRequest(http.MethodGet, "/", nil), apperr.New(kind, "SOME_CODE", "msg"))
		if w.Code != status {
			t.Errorf("kind %d -> %d, want %d", kind, w.Code, status)
		}
		var b errorBody
		if err := json.Unmarshal(w.Body.Bytes(), &b); err != nil || b.Error.Code != "SOME_CODE" {
			t.Errorf("bad error body %s", w.Body.String())
		}
	}
}

// Internal errors must not leak details (SQL, secrets) to the client.
func TestWriteErrorHidesInternalDetails(t *testing.T) {
	w := httptest.NewRecorder()
	secret := errors.New("Error 1064: near 'SELECT password_hash FROM users' dsn=root:hunter2@tcp")
	WriteError(w, httptest.NewRequest(http.MethodGet, "/", nil), secret)
	if w.Code != 500 {
		t.Fatalf("status %d", w.Code)
	}
	if strings.Contains(w.Body.String(), "password_hash") || strings.Contains(w.Body.String(), "hunter2") {
		t.Fatalf("internal error leaked: %s", w.Body.String())
	}
}
