# Builds and runs the e2e suite in an isolated copy of the repo, so a running `npm run dev`
# (which shares .next) is never disturbed and never slows the build down.
# Usage: powershell -File scripts/verify.ps1 [-Grep "pattern"] [-SkipBuild]
param([string]$Grep = "", [switch]$SkipBuild)
$ErrorActionPreference = "Continue"
$src = Split-Path -Parent $PSScriptRoot
$b = Join-Path (Split-Path -Parent $src) ".archirift-build"

Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

robocopy $src $b /MIR /XD node_modules .next out .git test-results playwright-report /XF build.log *.tmp.mjs *.tmp.ts /NFL /NDL /NJH /NJS /NP | Out-Null
if (-not (Test-Path "$b\node_modules")) {
  New-Item -ItemType Junction -Path "$b\node_modules" -Target "$src\node_modules" | Out-Null
}

Push-Location $b
try {
  if (-not $SkipBuild) {
    npx next build *> build.log
    if ($LASTEXITCODE -ne 0) { Get-Content build.log -Tail 40; exit 1 }
    "Build OK: $((Get-ChildItem out\levels -Directory).Count) level pages"
  }
  if ($Grep) { npx playwright test --reporter=line -g $Grep } else { npx playwright test --reporter=line }
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
