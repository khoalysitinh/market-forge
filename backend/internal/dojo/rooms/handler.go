package rooms

import (
	"net/http"

	"github.com/khoalysitinh/market-forge/backend/internal/audit"
	"github.com/khoalysitinh/market-forge/backend/internal/idempotency"
	"github.com/khoalysitinh/market-forge/backend/internal/identity"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/apperr"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/httpserver"
)

// Handler exposes rooms over HTTP. Every route is behind identity.RequireAuth.
type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Create handles POST /api/v1/rooms.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	actor, err := actorID(r)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	key := r.Header.Get(idempotency.HeaderName)
	if err := idempotency.ValidateKey(key); err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	var in CreateInput
	if err := httpserver.DecodeJSON(w, r, &in); err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	d, replayed, err := h.svc.Create(r.Context(), actor, in, key)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	if replayed {
		w.Header().Set("Idempotent-Replayed", "true")
	}
	httpserver.WriteJSON(w, http.StatusCreated, d)
}

// List handles GET /api/v1/rooms.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	actor, err := actorID(r)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	list, err := h.svc.List(r.Context(), actor)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string][]Room{"rooms": list})
}

// Get handles GET /api/v1/rooms/{id}.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	actor, err := actorID(r)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	id, err := httpserver.PathID(r, "id")
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	d, err := h.svc.Get(r.Context(), actor, id)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, d)
}

// Join handles POST /api/v1/rooms/join. 201 when a new membership was
// created, 200 when the caller was already a member.
func (h *Handler) Join(w http.ResponseWriter, r *http.Request) {
	actor, err := actorID(r)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	var in JoinInput
	if err := httpserver.DecodeJSON(w, r, &in); err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	d, joined, err := h.svc.Join(r.Context(), actor, in)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	status := http.StatusOK
	if joined {
		status = http.StatusCreated
	}
	httpserver.WriteJSON(w, status, d)
}

// Events handles GET /api/v1/rooms/{id}/events?after=SEQ&limit=N.
func (h *Handler) Events(w http.ResponseWriter, r *http.Request) {
	actor, err := actorID(r)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	id, err := httpserver.PathID(r, "id")
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	after, err := httpserver.QueryInt(r, "after", 0)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	limit, err := httpserver.QueryInt(r, "limit", audit.MaxListLimit)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	events, err := h.svc.Events(r.Context(), actor, id, after, int(limit))
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string][]audit.Event{"events": events})
}

func actorID(r *http.Request) (int64, error) {
	u, ok := identity.UserFrom(r.Context())
	if !ok {
		return 0, apperr.ErrUnauthenticated
	}
	return u.ID, nil
}
