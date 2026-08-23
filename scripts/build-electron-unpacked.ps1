# PACK-004: build the Electron Windows x64 unpacked application (clean-room).
#
# Flow:
#   1. resolve rebuild root; preflight PACK-002 Worker + PACK-003 launcher source
#   2. workspace + contracts + desktop build (existing build system)
#   3. stage runtime resources (worker/contracts/persistence)
#   4. electron-builder --win --x64 --dir (offline local electronDist, no signing)
#   5. in-repo packaged structure audit
#   6. repo-external copy structure audit (same audit on a temp copy)
#
# Produces ONLY dist\packaging\win-unpacked. No installer, no portable zip,
# no manifest, no signing, no PACK-005 smoke.
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RebuildRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$DesktopDir = Join-Path $RebuildRoot "apps\desktop"
$OutputRoot = Join-Path $RebuildRoot "dist\packaging"
$WinUnpacked = Join-Path $OutputRoot "win-unpacked"
$StageScript = Join-Path $PSScriptRoot "stage-electron-runtime-resources.mjs"
$AuditScript = Join-Path $PSScriptRoot "audit-electron-unpacked.mjs"

function Invoke-Step([string]$name, [scriptblock]$block) {
  Write-Host "== $name =="
  & $block
  if ($LASTEXITCODE -ne 0) { Write-Error "$name failed (exit $LASTEXITCODE)"; exit 1 }
}

function New-TempDir([string]$prefix) {
  $d = Join-Path ([System.IO.Path]::GetTempPath()) ($prefix + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  return $d
}

# ---- 1) preflight ----
$WorkerExe = Join-Path $RebuildRoot "resources\worker\fastwork-ai-worker.exe"
if (-not (Test-Path $WorkerExe)) { Write-Error "PACK-002 Worker executable missing: $WorkerExe"; exit 1 }
$LauncherJs = Join-Path $DesktopDir "dist\main\worker-runtime.js"
$MainIndexJs = Join-Path $DesktopDir "dist\main\index.js"
if (-not (Test-Path $LauncherJs)) { Write-Error "PACK-003 launcher build missing: $LauncherJs (run desktop build first)"; exit 1 }
if (-not (Test-Path $MainIndexJs)) { Write-Error "PACK-003 Main build missing: $MainIndexJs"; exit 1 }

# ---- 2) builds (existing build system; no competing build) ----
Invoke-Step "workspace build" { Push-Location $RebuildRoot; try { pnpm -r run build } finally { Pop-Location } }
Invoke-Step "contracts build" { Push-Location $RebuildRoot; try { pnpm --filter @fastwork/contracts run build } finally { Pop-Location } }
Invoke-Step "desktop build" { Push-Location $RebuildRoot; try { pnpm --filter @fastwork/desktop run build } finally { Pop-Location } }

# ---- 3) runtime resource staging ----
Invoke-Step "runtime resource staging" { node $StageScript }

# ---- 4) clean own output + electron-builder --dir ----
if (Test-Path $OutputRoot) {
  Remove-Item -LiteralPath $OutputRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
Invoke-Step "electron-builder (win x64 --dir)" {
  Push-Location $DesktopDir
  try {
    $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
    $env:ELECTRON_DISABLE_SECURITY_WARNINGS = "true"
    npx electron-builder --win --x64 --dir --config electron-builder.yml
  } finally {
    Pop-Location
  }
}

# ---- 5) post-build exact-path checks ----
if (-not (Test-Path $WinUnpacked)) { Write-Error "REQUIRED win-unpacked missing: $WinUnpacked"; exit 1 }
$AppExe = Join-Path $WinUnpacked "FastWork-Rebuild.exe"
if (-not (Test-Path $AppExe)) { Write-Error "REQUIRED application exe missing: $AppExe"; exit 1 }
if (-not (Test-Path (Join-Path $WinUnpacked "resources\worker\fastwork-ai-worker.exe"))) { Write-Error "REQUIRED packaged worker missing"; exit 1 }
if (-not (Test-Path (Join-Path $WinUnpacked "resources\contracts\schemas"))) { Write-Error "REQUIRED packaged contracts schemas missing"; exit 1 }
if (-not (Test-Path (Join-Path $WinUnpacked "resources\persistence\migrations\0001_initial.sql"))) { Write-Error "REQUIRED packaged migrations missing"; exit 1 }

# ---- 6) in-repo packaged structure audit ----
Invoke-Step "in-repo packaged structure audit" { node $AuditScript }

# ---- 7) repo-external copy structure audit ----
$externalRoot = New-TempDir "pack004-external-"
$externalCopy = Join-Path $externalRoot "win-unpacked"
New-Item -ItemType Directory -Force -Path $externalCopy | Out-Null
Write-Host "== repo-external copy audit =="
try {
  Copy-Item -Recurse -Force (Join-Path $WinUnpacked "*") $externalCopy
  & node $AuditScript $externalCopy
  if ($LASTEXITCODE -ne 0) { Write-Error "repo-external copy audit failed"; exit 1 }
} finally {
  Remove-Item -Recurse -Force $externalRoot -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "PACK-004 build-electron-unpacked PASS."
Write-Host "  win-unpacked: $WinUnpacked"
Write-Host "  app exe:      $AppExe"

