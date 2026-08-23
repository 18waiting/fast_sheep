# PACK-002 packaged-worker smoke (clean-room). Real JSONL RPC smoke against the
# packaged fastwork-ai-worker.exe, plus a repo-external copy smoke to prove the
# runtime is self-contained (no system Python, no source-tree PYTHONPATH).
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RebuildRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Exe = Join-Path $RebuildRoot "resources\worker\fastwork-ai-worker.exe"
$SchemasSource = Join-Path $RebuildRoot "packages\contracts\schemas"
$Impl = Join-Path $PSScriptRoot "run-packaged-worker-smoke-impl.mjs"

if (-not (Test-Path $Exe)) { Write-Error "REQUIRED exe missing: $Exe"; exit 1 }
if (-not (Test-Path $SchemasSource)) { Write-Error "schemas source missing: $SchemasSource"; exit 1 }

# Clear any inherited source-tree Python path before launching anything.
Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue
Remove-Item Env:PYTHONHOME -ErrorAction SilentlyContinue

function New-TempDir([string]$prefix) {
  $d = Join-Path ([System.IO.Path]::GetTempPath()) ($prefix + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  return $d
}

function Invoke-Smoke([string]$exe, [string]$dataRoot, [string]$schemasDir, [string]$label) {
  Write-Host "== smoke [$label] =="
  & node $Impl $exe $dataRoot $schemasDir $label
  if ($LASTEXITCODE -ne 0) { Write-Error "smoke [$label] failed (exit $LASTEXITCODE)"; exit 1 }
}

# 1) In-repo packaged-worker smoke (temp data root + staged schemas).
$dataRoot = New-TempDir "pack002-data-"
$schemasDir = New-TempDir "pack002-schemas-"
Copy-Item -Recurse -Force (Join-Path $SchemasSource "*") $schemasDir
try {
  Invoke-Smoke $Exe $dataRoot $schemasDir "in-repo"
} finally {
  Remove-Item -Recurse -Force $dataRoot, $schemasDir -ErrorAction SilentlyContinue
}

# 2) Repo-external copy smoke: copy the whole onedir runtime OUTSIDE the repo.
$externalRoot = New-TempDir "pack002-external-"
$externalWorker = Join-Path $externalRoot "worker"
$externalData = Join-Path $externalRoot "data"
$externalSchemas = Join-Path $externalRoot "schemas"
New-Item -ItemType Directory -Force -Path $externalWorker, $externalData, $externalSchemas | Out-Null
Copy-Item -Recurse -Force (Join-Path $RebuildRoot "resources\worker\*") $externalWorker
Copy-Item -Recurse -Force (Join-Path $SchemasSource "*") $externalSchemas
$externalExe = Join-Path $externalWorker "fastwork-ai-worker.exe"
try {
  if (-not (Test-Path $externalExe)) { Write-Error "external exe missing: $externalExe"; exit 1 }
  Invoke-Smoke $externalExe $externalData $externalSchemas "repo-external"
} finally {
  Remove-Item -Recurse -Force $externalRoot -ErrorAction SilentlyContinue
}

Write-Host "PACK-002 packaged-worker smoke PASS (in-repo + repo-external)."
