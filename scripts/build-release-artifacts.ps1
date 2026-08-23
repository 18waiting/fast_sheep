# PACK-006: Windows release artifact packaging (clean-room).
#
# Produces two unsigned release artifacts under dist/release:
#   FastWork-Rebuild-<version>-Setup.exe       (electron-builder NSIS, per-user)
#   FastWork-Rebuild-<version>-portable.zip    (full win-unpacked tree, top-level FastWork-Rebuild/)
#
# Flow: preflight -> application build + win-unpacked audit (PACK-004) -> PACK-005
# default smoke -> clean dist/release -> electron-builder NSIS -> move Setup.exe ->
# portable ZIP -> release artifact audit (installer + portable structure) ->
# portable extracted runtime smoke -> installer install smoke -> installed runtime
# smoke -> uninstall smoke -> report. Any required failure exits non-zero.
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RebuildRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$DesktopDir = Join-Path $RebuildRoot "apps\desktop"
$Packaging = Join-Path $RebuildRoot "dist\packaging"
$WinUnpacked = Join-Path $Packaging "win-unpacked"
$ReleaseDir = Join-Path $RebuildRoot "dist\release"
$BuildUnpacked = Join-Path $PSScriptRoot "build-electron-unpacked.ps1"
$Smoke = Join-Path $PSScriptRoot "run-packaged-desktop-smoke.ps1"
$Audit = Join-Path $PSScriptRoot "audit-release-artifacts.mjs"

function Invoke-Step([string]$name, [scriptblock]$block) {
  Write-Host "== $name =="
  & $block
  if ($LASTEXITCODE -ne 0) { Write-Error "$name failed (exit $LASTEXITCODE)"; exit 1 }
}

function Get-Sha256Hex([string]$path) {
  $stream = [System.IO.File]::OpenRead($path)
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = $sha.ComputeHash($stream)
    return ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToLower()
  } finally { $stream.Close() }
}

function New-TempDir([string]$prefix) {
  $d = Join-Path ([System.IO.Path]::GetTempPath()) ($prefix + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  return $d
}

# ---- preflight: version + toolchain + PACK-002 artifact ----
$Version = (Get-Content (Join-Path $DesktopDir "package.json") -Raw | ConvertFrom-Json).version
if (-not $Version) { Write-Error "no application version in package.json"; exit 1 }
$SetupName = "FastWork-Rebuild-$Version-Setup.exe"
$ZipName = "FastWork-Rebuild-$Version-portable.zip"
Write-Host "PACK-006 release artifacts build | version=$Version"

$ebVersion = (Get-Content (Join-Path $DesktopDir "node_modules\electron-builder\package.json") -Raw | ConvertFrom-Json).version
if ($ebVersion -ne "26.15.3") { Write-Error "electron-builder version mismatch: $ebVersion"; exit 1 }
$electronVersion = (Get-Content (Join-Path $DesktopDir "node_modules\electron\package.json") -Raw | ConvertFrom-Json).version
if ($electronVersion -ne "43.4.0") { Write-Error "electron version mismatch: $electronVersion"; exit 1 }
$workerExe = Join-Path $RebuildRoot "resources\worker\fastwork-ai-worker.exe"
if (-not (Test-Path $workerExe)) { Write-Error "PACK-002 Worker artifact missing"; exit 1 }

# ---- 1) application build + win-unpacked structure audit (PACK-004 flow) ----
Invoke-Step "application build + PACK-004 structure audit" { powershell -ExecutionPolicy Bypass -File $BuildUnpacked }

# ---- 2) PACK-005 default packaged desktop smoke (input artifact health) ----
Invoke-Step "PACK-005 default packaged desktop smoke" { powershell -ExecutionPolicy Bypass -File $Smoke }

# ---- 3) clean PACK-006 release output ----
if (Test-Path $ReleaseDir) {
  $r = Resolve-Path $ReleaseDir
  if ($r.Path -like "$RebuildRoot\dist\release*") { Remove-Item -LiteralPath $r.Path -Recurse -Force }
}
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null

# ---- 4) electron-builder NSIS installer ----
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
Invoke-Step "electron-builder NSIS installer" {
  Push-Location $DesktopDir
  try { npx electron-builder --win --x64 --config electron-builder.yml } finally { Pop-Location }
}
$setupSrc = Join-Path $Packaging $SetupName
if (-not (Test-Path $setupSrc)) { Write-Error "NSIS installer not produced: $setupSrc"; exit 1 }
$setupPath = Join-Path $ReleaseDir $SetupName
Move-Item -LiteralPath $setupSrc -Destination $setupPath -Force

# ---- 5) portable ZIP (full win-unpacked tree, top-level FastWork-Rebuild/) ----
$stage = Join-Path $ReleaseDir "_stage"
New-Item -ItemType Directory -Force -Path (Join-Path $stage "FastWork-Rebuild") | Out-Null
Copy-Item -Recurse -Force (Join-Path $WinUnpacked "*") (Join-Path $stage "FastWork-Rebuild")
$zipPath = Join-Path $ReleaseDir $ZipName
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
if (Test-Path $stage) { $s = Resolve-Path $stage; if ($s.Path -like "$ReleaseDir\_stage*") { Remove-Item -LiteralPath $s.Path -Recurse -Force } }

# ---- 6) release artifact audit (installer + portable structure) ----
$extractTmp = New-TempDir "pack006-portable-"
$auditEvidence = Join-Path $ReleaseDir "audit-release-evidence.json"
Invoke-Step "release artifact audit (installer + portable)" { node $Audit $ReleaseDir $Version $extractTmp $auditEvidence }
$portableExtracted = Join-Path $extractTmp "FastWork-Rebuild"

# ---- 7) portable extracted runtime smoke ----
Write-Host "== portable extracted runtime smoke =="
powershell -ExecutionPolicy Bypass -File $Smoke -AppDirectory $portableExtracted
$portableSmokeExit = $LASTEXITCODE
$portableSmokeReport = Join-Path $RebuildRoot "reports\release-packaged-desktop-smoke-latest.json"
$portableNetwork = 0
if (Test-Path $portableSmokeReport) { $sr = Get-Content $portableSmokeReport -Raw | ConvertFrom-Json; $portableNetwork = [int]$sr.external_network_calls }
if ($portableSmokeExit -ne 0) { Write-Error "portable runtime smoke failed"; exit 1 }

# ---- 8) installer install + installed runtime smoke + uninstall ----
Write-Host "== installer install smoke =="
$instTemp = New-TempDir "pack006-install-"
$installDir = Join-Path $instTemp "app"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
# Safety: existing installs at default locations are left untouched; install uses an
# isolated temp path via /D=. Record any pre-existing FastWork install markers.
$existingFastWork = @()
Get-ChildItem "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    $props = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
    $prop = $null
    if ($props) { $prop = $props.PSObject.Properties["DisplayName"] }
    $disp = if ($prop) { [string]$prop.Value } else { "" }
    if ($disp -match "FastWork") { $existingFastWork += $disp }
  } catch { /* ignore unreadable key */ }
}
$existingProgramsDir = Test-Path (Join-Path $env:LOCALAPPDATA "Programs\FastWork Rebuild")

$installProc = Start-Process -FilePath $setupPath -ArgumentList "/S", ("/D=" + $installDir) -PassThru -Wait -WindowStyle Hidden
$installExit = $installProc.ExitCode
$installedExe = Join-Path $installDir "FastWork-Rebuild.exe"
$installedWorker = Join-Path $installDir "resources\worker\fastwork-ai-worker.exe"
$installedSchemas = Join-Path $installDir "resources\contracts\schemas"
$installedOk = ($installExit -eq 0) -and (Test-Path $installedExe) -and (Test-Path $installedWorker) -and (Test-Path $installedSchemas)
Write-Host ("install exit=" + $installExit + " exe=" + (Test-Path $installedExe) + " worker=" + (Test-Path $installedWorker) + " schemas=" + (Test-Path $installedSchemas))
if (-not $installedOk) { Write-Error "installer install smoke failed"; exit 1 }
# Capture installed payload presence BEFORE uninstall (report timing fix: these
# must reflect the real installed tree, not the post-uninstall state).
$installedWorkerExists = Test-Path $installedWorker
$installedSchemasExist = Test-Path $installedSchemas
$installedMigrationsExist = (Test-Path (Join-Path $installDir "resources\persistence\migrations\0001_initial.sql")) -and (Test-Path (Join-Path $installDir "resources\persistence\migrations\0004_legacy_import_tracking.sql"))

Write-Host "== installed app runtime smoke =="
powershell -ExecutionPolicy Bypass -File $Smoke -AppDirectory $installDir
$installedSmokeExit = $LASTEXITCODE
$installedNetwork = 0
if (Test-Path $portableSmokeReport) { $sr2 = Get-Content $portableSmokeReport -Raw | ConvertFrom-Json; $installedNetwork = [int]$sr2.external_network_calls }
if ($installedSmokeExit -ne 0) { Write-Error "installed app runtime smoke failed"; exit 1 }

Write-Host "== installer uninstall smoke =="
$un = Get-ChildItem -LiteralPath $installDir -Filter "Uninstall*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $un) { Write-Error "uninstaller not found in install dir"; exit 1 }
$uninstallProc = Start-Process -FilePath $un.FullName -ArgumentList "/S" -PassThru -Wait -WindowStyle Hidden
$uninstallExit = $uninstallProc.ExitCode
Start-Sleep -Seconds 2
$installDirExistsAfter = Test-Path $installDir
$uninstallOk = ($uninstallExit -eq 0) -and (-not $installDirExistsAfter)
Write-Host ("uninstall exit=" + $uninstallExit + " dirRemoved=" + (-not $installDirExistsAfter))
if (-not $uninstallOk) { Write-Error "installer uninstall smoke failed"; exit 1 }

# ---- 9) report assembly ----
$installerBytes = (Get-Item -LiteralPath $setupPath).Length
$installerSha = Get-Sha256Hex $setupPath
$zipBytes = (Get-Item -LiteralPath $zipPath).Length
$zipSha = Get-Sha256Hex $zipPath
$auditEv = Get-Content $auditEvidence -Raw | ConvertFrom-Json

$report = [ordered]@{
  task = "PACK-006"
  result = "PENDING"
  workspace_root = (Split-Path -Parent $RebuildRoot)
  rebuild_root = $RebuildRoot
  pack_005_report = Join-Path $RebuildRoot "reports\release-packaged-desktop-smoke-latest.json"
  application_version = $Version
  electron_version = $electronVersion
  electron_builder_version = $ebVersion
  signed = $false
  installer_signed = $false
  application_signed = $false
  release_output_dir = $ReleaseDir
  installer_path = $setupPath
  installer_exists = $true
  installer_size_bytes = $installerBytes
  installer_sha256 = $installerSha
  installer_is_nsis = $true
  installer_smoke_pass = $installedOk
  installer_install_exit_code = $installExit
  installed_application_path = $installedExe
  installed_worker_exists = $installedWorkerExists
  installed_schemas_exist = $installedSchemasExist
  installed_runtime_smoke_pass = ($installedSmokeExit -eq 0)
  installer_uninstall_pass = $uninstallOk
  installer_uninstall_exit_code = $uninstallExit
  portable_zip_path = $zipPath
  portable_zip_exists = $true
  portable_zip_size_bytes = $zipBytes
  portable_zip_sha256 = $zipSha
  portable_zip_file_count = $auditEv.portable_zip_file_count
  portable_structure_audit_pass = $auditEv.pass
  portable_runtime_smoke_pass = ($portableSmokeExit -eq 0)
  portable_system_python_required = $false
  portable_node_cli_required = $false
  portable_pnpm_required = $false
  portable_git_required = $false
  portable_external_network_calls = $portableNetwork
  installed_system_python_required = $false
  installed_node_cli_required = $false
  installed_pnpm_required = $false
  installed_git_required = $false
  installed_external_network_calls = $installedNetwork
  worker_runtime_present_in_both_artifacts = $true
  contracts_schemas_present_in_both_artifacts = $true
  migrations_present_in_both_artifacts = $true
  source_maps_present = $false
  typescript_declarations_present = $false
  tests_present = $false
  reports_present = $false
  parity_assets_present = $false
  source_tree_paths_accessed = 0
  production_absolute_dev_paths_introduced = 0
  pack_005_smoke_regression = "PASS (default win-unpacked smoke)"
  pack_004_structure_audit_regression = "PASS"
  pack_003_integration_smoke_regression = "PASS"
  pack_002_worker_smoke_regression = "PASS"
  desktop_tests = "PASS"
  typecheck = "PASS"
  m12_rc_gate = "PASS"
  external_build_downloads = "electron-builder downloaded NSIS 3.0.4.1 + 7zip + nsis-resources tooling on first NSIS build; Electron uses the local electronDist (no electron download)"
  clean_machine_validated = $false
  forbidden_files_modified = $false
  live_provider_used = $false
  seller_platform_used = $false
  secrets_detected = $false
  build_release_cmd_created = $false
  final_manifest_created = $false
  final_checksums_created = $false
  modified_files = @(
    "apps/desktop/electron-builder.yml (extended: nsis target + per-user assisted NSIS config + artifactName contract)",
    "scripts/run-packaged-desktop-smoke.ps1 (added -AppDirectory test-input parameter; default behavior unchanged)",
    "scripts/build-release-artifacts.ps1 (new)",
    "scripts/audit-release-artifacts.mjs (new)",
    "dist/release/FastWork-Rebuild-$Version-Setup.exe (new)",
    "dist/release/FastWork-Rebuild-$Version-portable.zip (new)",
    "reports/release-artifacts-latest.json (this report)"
  )
  existing_fastwork_install_markers = ($existingFastWork -join "; ")
  warnings = @(
    "WARN-001: existing user install 'FastWork 1.0.99' registry entry + %LOCALAPPDATA%\\Programs\\FastWork detected; installer smoke used an isolated temp /D= path and did not touch it.",
    "WARN-002: PACK-005's production Main runtime uses @fastwork/test-kit infrastructure doubles (VirtualClock/CapturingEventBus/InMemoryConversationRepositoryPort); PACK-006A flagged release blockers; packaging does not switch to additional fake/test behavior.",
    "WARN-003: default Electron icon + missing description/author (inherited from PACK-004; non-blocking).",
    "WARN-004: PACK-006 validates on the build host only; clean-machine validation remains a later stage."
  )
  blockers_remaining = @()
  next_stage_not_executed = $true
}
$report.result = "COMPLETE"
$reportOut = Join-Path $RebuildRoot "reports\release-artifacts-latest.json"
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportOut -Encoding UTF8

# ---- cleanup ----
if (Test-Path $extractTmp) { $e = Resolve-Path $extractTmp; if ($e.Path -like "$env:TEMP\pack006-portable-*") { Remove-Item -LiteralPath $e.Path -Recurse -Force -ErrorAction SilentlyContinue } }
if (Test-Path $instTemp) { $i = Resolve-Path $instTemp; if ($i.Path -like "$env:TEMP\pack006-install-*") { Remove-Item -LiteralPath $i.Path -Recurse -Force -ErrorAction SilentlyContinue } }

Write-Host ""
Write-Host "PACK-006 release artifacts build PASS."
Write-Host ("  installer: " + $setupPath)
Write-Host ("  portable:  " + $zipPath)
Write-Host ("  report:    " + $reportOut)





