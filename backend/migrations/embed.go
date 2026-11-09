// Package migrations embeds the versioned SQL files into the Go binary so the
// API and the migrate command always ship with the schema they expect.
package migrations

import "embed"

// FS contains every *.sql migration in this directory.
//
//go:embed *.sql
var FS embed.FS
