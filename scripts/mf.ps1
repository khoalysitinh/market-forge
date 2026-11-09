# MARKET FORGE developer commands for Windows PowerShell.
#   .\scripts\mf.ps1 test
#   .\scripts\mf.ps1 test-integration
# Reads KEY=VALUE lines from .env (if present) into this process only.
param([Parameter(Position = 0)][string]$Command = "help")

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

$EnvFile = Join-Path $Root ".env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | Where-Object { $_ -match '^\s*[A-Z_]+=.*' } | ForEach-Object {
        $name, $value = $_ -split '=', 2
        [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), "Process")
    }
}

function In($dir, [scriptblock]$block) {
    Push-Location (Join-Path $Root $dir)
    try { & $block; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } } finally { Pop-Location }
}

switch ($Command) {
    "fmt"              { In "backend" { gofmt -w . } }
    "vet"              { In "backend" { go vet ./...; go vet -tags=integration ./... } }
    "test"             { In "backend" { go test -count=1 ./... }; In "frontend" { npm test } }
    "test-integration" { In "backend" { go test -tags=integration -count=1 -v ./tests/integration/... } }
    "migrate"          { In "backend" { go run ./cmd/migrate } }
    "run"              { In "backend" { go run ./cmd/api } }
    "demo"             { In "backend" { go run ./cmd/demo -base http://127.0.0.1:8080 } }
    "web"              { In "frontend" { npm run dev } }
    "up"               { docker compose up --build }
    "down"             { docker compose down }
    default            { Write-Host "Usage: .\scripts\mf.ps1 fmt|vet|test|test-integration|migrate|run|demo|web|up|down" }
}
