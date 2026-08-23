# PACK-002 build script (clean-room). Builds the standalone AI Worker runtime
# (PyInstaller onedir) into resources\worker\fastwork-ai-worker.exe using
# Python 3.12 (py -3.12). No Electron packaging here.
$ErrorActionPreference = "Continue"
Set-StrictMode -Version Latest

$RebuildRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$WorkerSrc = Join-Path $RebuildRoot "services\ai-worker"
$Spec = Join-Path $WorkerSrc "packaging\fastwork-ai-worker.spec"
$Resources = Join-Path $RebuildRoot "resources"
$WorkerOut = Join-Path $Resources "worker"
$WorkPath = Join-Path $RebuildRoot ".packaging-build\worker"
$BuildLog = Join-Path $RebuildRoot ".packaging-build\build.log"

if (-not (Test-Path $Spec)) { Write-Error "spec missing: $Spec"; exit 1 }

# 1) Python 3.12 prerequisite
$pyOut = (& py -3.12 --version 2>$null | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or -not $pyOut) { Write-Error "py -3.12 not available"; exit 1 }
Write-Host "Python: $pyOut"

$piv = (& py -3.12 -m PyInstaller --version 2>$null | Select-Object -Last 1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or -not $piv) { Write-Error "PyInstaller not installed for py -3.12"; exit 1 }
Write-Host "PyInstaller: $piv"

# 2) Clean old worker packaging output + build intermediates (avoid stale-DLL false pass)
if (Test-Path $WorkerOut) { Remove-Item -Recurse -Force $WorkerOut }
if (Test-Path $WorkPath) { Remove-Item -Recurse -Force $WorkPath }
if (Test-Path (Split-Path $BuildLog)) { Remove-Item -Recurse -Force (Split-Path $BuildLog) }
New-Item -ItemType Directory -Force -Path $WorkerOut | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $WorkPath) | Out-Null

# 3) Invoke PyInstaller spec (onedir -> resources/worker/fastwork-ai-worker.exe)
Write-Host "Building worker runtime with PyInstaller (onedir)..."
$out = & py -3.12 -m PyInstaller --noconfirm --clean --distpath $Resources --workpath $WorkPath $Spec 2>&1
$code = $LASTEXITCODE
$out | Out-File -FilePath $BuildLog -Encoding utf8
$out | Select-Object -Last 25 | ForEach-Object { Write-Host $_ }
if ($code -ne 0) { Write-Error "PyInstaller build failed (exit $code); log: $BuildLog"; exit 1 }

# 4) Verify the REQUIRED executable
$Exe = Join-Path $WorkerOut "fastwork-ai-worker.exe"
if (-not (Test-Path $Exe)) { Write-Error "REQUIRED executable missing: $Exe"; exit 1 }
Write-Host "Worker EXE: $Exe"
Write-Host "Build complete."
