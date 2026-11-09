package trials

import (
	"net/http"

	"github.com/khoalysitinh/market-forge/backend/internal/idempotency"
	"github.com/khoalysitinh/market-forge/backend/internal/identity"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/apperr"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/httpserver"
)

// Handler exposes trials, rounds, decisions and reviews over HTTP.
// Handlers only parse input, call the service, and write the response.
type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// request holds what every handler needs: the actor and a path ID.
type request struct {
	actorID int64
	id      int64
}

func parse(w http.ResponseWriter, r *http.Request) (request, bool) {
	u, ok := identity.UserFrom(r.Context())
	if !ok {
		httpserver.WriteError(w, r, apperr.ErrUnauthenticated)
		return request{}, false
	}
	id, err := httpserver.PathID(r, "id")
	if err != nil {
		httpserver.WriteError(w, r, err)
		return request{}, false
	}
	return request{actorID: u.ID, id: id}, true
}

func idemKey(w http.ResponseWriter, r *http.Request) (string, bool) {
	key := r.Header.Get(idempotency.HeaderName)
	if err := idempotency.ValidateKey(key); err != nil {
		httpserver.WriteError(w, r, err)
		return "", false
	}
	return key, true
}

func markReplayed(w http.ResponseWriter, replayed bool) {
	if replayed {
		w.Header().Set("Idempotent-Replayed", "true")
	}
}

// CreateTrial handles POST /api/v1/rooms/{id}/trials (no body).
func (h *Handler) CreateTrial(w http.ResponseWriter, r *http.Request) {
	req, ok := parse(w, r)
	if !ok {
		return
	}
	key, ok := idemKey(w, r)
	if !ok {
		return
	}
	v, replayed, err := h.svc.CreateTrial(r.Context(), req.actorID, req.id, key)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	markReplayed(w, replayed)
	httpserver.WriteJSON(w, http.StatusCreated, v)
}

// ListRoomTrials handles GET /api/v1/rooms/{id}/trials.
func (h *Handler) ListRoomTrials(w http.ResponseWriter, r *http.Request) {
	req, ok := parse(w, r)
	if !ok {
		return
	}
	list, err := h.svc.ListRoomTrials(r.Context(), req.actorID, req.id)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string][]Trial{"trials": list})
}

// GetTrial handles GET /api/v1/trials/{id}.
func (h *Handler) GetTrial(w http.ResponseWriter, r *http.Request) {
	req, ok := parse(w, r)
	if !ok {
		return
	}
	v, err := h.svc.GetTrial(r.Context(), req.actorID, req.id)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, v)
}

// StartTrial handles POST /api/v1/trials/{id}/start (no body).
func (h *Handler) StartTrial(w http.ResponseWriter, r *http.Request) {
	req, ok := parse(w, r)
	if !ok {
		return
	}
	v, err := h.svc.StartTrial(r.Context(), req.actorID, req.id)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, v)
}

// Candles handles GET /api/v1/trials/{id}/candles. Query parameters are
// ignored on purpose: the server clock is the only cutoff.
func (h *Handler) Candles(w http.ResponseWriter, r *http.Request) {
	req, ok := parse(w, r)
	if !ok {
		return
	}
	v, err := h.svc.Candles(r.Context(), req.actorID, req.id)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, v)
}

// GetRound handles GET /api/v1/rounds/{id}.
func (h *Handler) GetRound(w http.ResponseWriter, r *http.Request) {
	req, ok := parse(w, r)
	if !ok {
		return
	}
	v, err := h.svc.GetRound(r.Context(), req.actorID, req.id)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, v)
}

// CommitDecision handles POST /api/v1/rounds/{id}/decisions.
func (h *Handler) CommitDecision(w http.ResponseWriter, r *http.Request) {
	req, ok := parse(w, r)
	if !ok {
		return
	}
	key, ok := idemKey(w, r)
	if !ok {
		return
	}
	var in DecisionInput
	if err := httpserver.DecodeJSON(w, r, &in); err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	d, replayed, err := h.svc.CommitDecision(r.Context(), req.actorID, req.id, in, key)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	markReplayed(w, replayed)
	httpserver.WriteJSON(w, http.StatusCreated, map[string]Decision{"decision": d})
}

// SubmitReview handles POST /api/v1/rounds/{id}/reviews.
func (h *Handler) SubmitReview(w http.ResponseWriter, r *http.Request) {
	req, ok := parse(w, r)
	if !ok {
		return
	}
	key, ok := idemKey(w, r)
	if !ok {
		return
	}
	var in ReviewInput
	if err := httpserver.DecodeJSON(w, r, &in); err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	v, replayed, err := h.svc.SubmitReview(r.Context(), req.actorID, req.id, in, key)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	markReplayed(w, replayed)
	httpserver.WriteJSON(w, http.StatusCreated, map[string]Review{"review": v})
}

// Transition returns a handler for POST /api/v1/rounds/{id}/{lock|reveal|complete}.
func (h *Handler) Transition(action Action) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req, ok := parse(w, r)
		if !ok {
			return
		}
		v, err := h.svc.Transition(r.Context(), req.actorID, req.id, action)
		if err != nil {
			httpserver.WriteError(w, r, err)
			return
		}
		httpserver.WriteJSON(w, http.StatusOK, v)
	}
}
