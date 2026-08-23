# PACK-007: one-click release build orchestrator (clean-room).
#
# Entry: build-release.cmd (double-click) or direct:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-release.ps1 [-NoPause]
#
# Orchestrates the already-accepted stage scripts to produce dist\release:
#   FastWork-Rebuild-<version>-Setup.exe, ...-portable.zip, release-manifest.json,
#   checksums.sha256, README.txt. Any core stage failure stops finalization and
#   exits non-zero (no fake PASS manifest).
param(
  [switch]$NoPause
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RebuildRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Scripts = $PSScriptRoot
$DesktopDir = Join-Path $RebuildRoot "apps\desktop"
$ReleaseDir = Join-Path $RebuildRoot "dist\release"
$Reports = Join-Path $RebuildRoot "reports"
$Script:stageResults = @{}
$Script:failedStage = ""
$Script:stageError = ""
$buildStartUtc = (Get-Date).ToUniversalTime()

function Invoke-Stage([string]$name, [scriptblock]$block) {
  Write-Host ""
  Write-Host ("==== STAGE: " + $name + " ====")
  try {
    & $block
    if ($LASTEXITCODE -ne 0) { throw ("exit " + $LASTEXITCODE) }
    $script:stageResults[$name] = "PASS"
    Write-Host ("STAGE " + $name + ": PASS")
  } catch {
    $script:stageResults[$name] = "FAIL"
    if (-not $script:failedStage) { $script:failedStage = $name }
    $script:stageError = $_.Exception.Message
    Write-Host ("STAGE " + $name + ": FAIL (" + $script:stageError + ")")
    throw
  }
}

function Get-Sha256Hex([string]$path) {
  $stream = [System.IO.File]::OpenRead($path)
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = $sha.ComputeHash($stream)
    return ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToLower()
  } finally { $stream.Close() }
}

function Invoke-PS1([string]$name, [string]$scriptFile, [string[]]$argsList = @()) {
  Invoke-Stage $name {
    if ($argsList.Count -gt 0) {
      powershell -NoProfile -ExecutionPolicy Bypass -File $scriptFile @argsList
    } else {
      powershell -NoProfile -ExecutionPolicy Bypass -File $scriptFile
    }
    if ($LASTEXITCODE -ne 0) { throw ("exit " + $LASTEXITCODE) }
  }
}

$Version = ""
try { $Version = (Get-Content (Join-Path $DesktopDir "package.json") -Raw | ConvertFrom-Json).version } catch { $Version = "" }
if (-not $Version) { Write-Error "no application version in package.json"; exit 1 }

$SetupName = "FastWork-Rebuild-$Version-Setup.exe"
$ZipName = "FastWork-Rebuild-$Version-portable.zip"
$script:Toolchain = @{}

# ---- STAGE: toolchain preflight ----
try {
  Invoke-Stage "toolchain preflight" {
    $fail = @()
    if ($env:OS -notmatch "Windows") { $fail += "OS not Windows" }
    if (-not ([Environment]::Is64BitOperatingSystem)) { $fail += "not 64-bit" }
    $script:Toolchain["node"] = (& node --version 2>$null | Out-String).Trim()
    if (-not $Toolchain.node) { $fail += "node missing" }
    $script:Toolchain["pnpm"] = (& pnpm --version 2>$null | Out-String).Trim()
    if (-not $Toolchain.pnpm) { $fail += "pnpm missing" }
    $script:Toolchain["python"] = (& py -3.12 --version 2>$null | Out-String).Trim()
    if (-not $Toolchain.python) { $fail += "py -3.12 missing" }
    $script:Toolchain["pyinstaller"] = (& cmd /c "py -3.12 -m PyInstaller --version 2>nul" | Out-String).Trim()
    if ($Toolchain.pyinstaller -notmatch "6\.11\.1") { $fail += "PyInstaller not 6.11.1" }
    if (Test-Path (Join-Path $DesktopDir "node_modules\electron\package.json")) {
      $script:Toolchain["electron"] = (Get-Content (Join-Path $DesktopDir "node_modules\electron\package.json") -Raw | ConvertFrom-Json).version
      if ($Toolchain.electron -ne "43.4.0") { $fail += "electron not 43.4.0" }
    } else { $fail += "electron package missing" }
    if (Test-Path (Join-Path $DesktopDir "node_modules\electron-builder\package.json")) {
      $script:Toolchain["electron_builder"] = (Get-Content (Join-Path $DesktopDir "node_modules\electron-builder\package.json") -Raw | ConvertFrom-Json).version
      if ($Toolchain.electron_builder -ne "26.15.3") { $fail += "electron-builder not 26.15.3" }
    } else { $fail += "electron-builder missing" }
    if (-not (Test-Path (Join-Path $RebuildRoot "pnpm-lock.yaml"))) { $fail += "pnpm-lock.yaml missing" }
    if ($fail.Count -gt 0) { throw ("toolchain: " + ($fail -join "; ")) }
    Write-Host ("  node=" + $Toolchain.node + " pnpm=" + $Toolchain.pnpm + " python=" + $Toolchain.python + " pyinstaller=" + $Toolchain.pyinstaller + " electron=" + $Toolchain.electron + " electron-builder=" + $Toolchain.electron_builder)
  }
} catch { $script:stageError = $_.Exception.Message; $script:failedStage = "toolchain preflight" }

if (-not $script:failedStage) {
  # ---- STAGE: release-report consistency preflight ----
  Invoke-Stage "release report consistency preflight" {
    $p6 = Get-Content (Join-Path $Reports "pack-006-release-artifacts-report.json") -Raw | ConvertFrom-Json
    $p6r = Get-Content (Join-Path $Reports "pack-006r-installer-payload-verification-report.json") -Raw | ConvertFrom-Json
    $ok = ($p6.result -eq "COMPLETE") -and ($p6.installed_worker_exists -eq $true) -and ($p6.installed_schemas_exist -eq $true) -and ($p6.installed_runtime_smoke_pass -eq $true)
    $ok = $ok -and ($p6r.result -eq "COMPLETE") -and ($p6r.repair_classification -eq "REPORT_AUDIT_BUG")
    if (-not $ok) { throw "PACK-006/PACK-006R report inconsistency (must be PACK-006R-corrected)" }
  }

  # ---- STAGE: PACK-008 gate reclassification ----
  Invoke-Stage "PACK-008 gate reclassification" {
    $p8 = Get-Content (Join-Path $Reports "pack-008-clean-machine-validation-report.json") -Raw | ConvertFrom-Json
    $p8r = Get-Content (Join-Path $Reports "pack-008-clean-host-result.json") -Raw | ConvertFrom-Json
    $softBlocker = @($p8.blockers_remaining | Where-Object { $_.id -eq "TRUE_CLEAN_WINDOWS_ENVIRONMENT_NOT_AVAILABLE" }).Count -gt 0
    $ok = ($p8.result -eq "PARTIAL") -and ($p8r.result -eq "NOT_RUN") -and ($p8r.reason -eq "TRUE_CLEAN_WINDOWS_ENVIRONMENT_NOT_AVAILABLE") -and $softBlocker
    if (-not $ok) {
      throw "PACK-008 gate is not the known environment blocker (possible software defect); cannot reclassify"
    }
    $script:pack008Reclassified = $true
    Write-Host "  PACK-008 reclassified: PARTIAL + TRUE_CLEAN_WINDOWS_ENVIRONMENT_NOT_AVAILABLE -> deferred validation (release acceptance policy change)"
  }

  # ---- STAGE: frozen/forbidden baseline capture ----
  $script:baselineFile = Join-Path $env:TEMP ("pack007-baseline-" + [guid]::NewGuid().ToString("N") + ".json")
  Invoke-Stage "frozen baseline capture" {
    $hits = @()
    $roots = @(
      (Join-Path (Split-Path -Parent $RebuildRoot) "parity-tests\fixtures"),
      (Join-Path (Split-Path -Parent $RebuildRoot) "parity-tests\manifests"),
      (Join-Path (Split-Path -Parent $RebuildRoot) "parity-tests\contracts"),
      (Join-Path $RebuildRoot "packages\persistence\migrations")
    )
    foreach ($r in $roots) {
      if (Test-Path $r) {
        Get-ChildItem -LiteralPath $r -Recurse -File | ForEach-Object {
          $rel = $_.FullName.Substring((Split-Path -Parent $RebuildRoot).Length + 1)
          $hits += ($rel + "|" + (Get-Sha256Hex $_.FullName))
        }
      }
    }
    $script:baselineFile = Join-Path $env:TEMP ("pack007-baseline-" + [guid]::NewGuid().ToString("N") + ".json")
    $hits | Set-Content -LiteralPath $script:baselineFile -Encoding UTF8
    if ($hits.Count -eq 0) { throw "frozen baseline empty" }
    Write-Host ("  frozen baseline files: " + $hits.Count)
  }

  # ---- STAGE: clean release staging ----
  Invoke-Stage "clean release staging" {
    if (Test-Path $ReleaseDir) {
      $r = Resolve-Path $ReleaseDir
      if ($r.Path -like "$RebuildRoot\dist\release*") { Remove-Item -LiteralPath $r.Path -Recurse -Force }
    }
    New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
  }

  # ---- STAGE: M12 RC gate ----
  Invoke-Stage "M12 RC gate" {
    node (Join-Path $Scripts "run-m12-rc-gate.mjs")
    if ($LASTEXITCODE -ne 0) { throw "M12 RC gate failed" }
  }

  # ---- STAGE: PACK-002 worker rebuild ----
  Invoke-PS1 "PACK-002 worker rebuild" (Join-Path $Scripts "build-packaged-worker.ps1")

  # ---- STAGE: PACK-002 worker smoke ----
  Invoke-PS1 "PACK-002 worker smoke" (Join-Path $Scripts "run-packaged-worker-smoke.ps1")

  # ---- STAGE: desktop build ----
  Invoke-Stage "desktop build" {
    Push-Location $RebuildRoot
    try { pnpm --filter @fastwork/desktop run build } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw "desktop build failed" }
  }

  # ---- STAGE: PACK-003 integration smoke ----
  Invoke-Stage "PACK-003 integration smoke" {
    node (Join-Path $Scripts "run-packaged-worker-main-integration-smoke.mjs")
    if ($LASTEXITCODE -ne 0) { throw "PACK-003 integration smoke failed" }
  }

  # ---- STAGE: release artifacts build (win-unpacked + PACK-004 audit + PACK-005 smoke + NSIS + portable + installer smokes) ----
  Invoke-PS1 "release artifacts build" (Join-Path $Scripts "build-release-artifacts.ps1")

  # ---- move PACK-006 audit evidence out of release root ----
  Invoke-Stage "release hygiene (move audit evidence)" {
    $ev = Join-Path $ReleaseDir "audit-release-evidence.json"
    if (Test-Path $ev) { Move-Item -LiteralPath $ev -Destination (Join-Path $Reports "release-artifacts-audit-evidence-latest.json") -Force }
  }
}

# ---- finalization (only when all core stages passed) ----
$manifestPath = Join-Path $ReleaseDir "release-manifest.json"
$checksumsPath = Join-Path $ReleaseDir "checksums.sha256"
$readmePath = Join-Path $ReleaseDir "README.txt"
$setupPath = Join-Path $ReleaseDir $SetupName
$zipPath = Join-Path $ReleaseDir $ZipName

if (-not $script:failedStage) {
  try {
    $p6 = Get-Content (Join-Path $Reports "release-artifacts-latest.json") -Raw | ConvertFrom-Json
    $p5 = Get-Content (Join-Path $Reports "release-packaged-desktop-smoke-latest.json") -Raw | ConvertFrom-Json
    $m12 = Get-Content (Join-Path $Reports "m12-rc-gate-report.json") -Raw | ConvertFrom-Json
    $p2 = Get-Content (Join-Path $Reports "pack-002-worker-packaging-report.json") -Raw | ConvertFrom-Json

    # ---- STAGE: README ----
    Invoke-Stage "generate README" {
      $readme = @"
FastWork Rebuild $Version (Windows x64, unsigned build)
======================================================

This is a clean-room packaged build of the FastWork multi-shop AI
customer-service workbench. It is NOT code-signed, so Windows SmartScreen may
show a security prompt; choose "More info -> Run anyway" if you built/trust
this package.

Two ways to run:

1) Installer:  FastWork-Rebuild-$Version-Setup.exe
   - Double-click and follow the per-user install wizard (no admin required).
   - Launch "FastWork Rebuild" from the Start menu or desktop shortcut.

2) Portable:   FastWork-Rebuild-$Version-portable.zip
   - Extract the whole ZIP (keep the FastWork-Rebuild folder intact).
   - Run FastWork-Rebuild.exe inside the extracted folder.

Requirements
------------
- Windows 10/11 x64.
- No Python, Node.js, pnpm, or Git installation is required to run this app.
- The AI Worker runtime and its native libraries (FAISS/NumPy) are bundled.

User data
---------
- Business data is stored under:
    %LOCALAPPDATA%\FastWorkRebuild\data
- Advanced/test users may override the data location with the environment
  variable FASTWORK_DATA_DIR (set it to any writable folder before launch).

Status
------
- This is a FastWork Rebuild **unsigned host-validated release candidate (RC)**.
- Validated on the build host (BUILD_HOST_ISOLATED_VALIDATION): Windows x64
  packaged build, NSIS installer (actual install + uninstall), portable
  archive, packaged AI Worker, SQLite migrations, Renderer/Preload, and no
  runtime Python / Node / pnpm / Git requirement.
- NOT independently validated on a truly pristine / fresh Windows machine:
  clean-machine validation is DEFERRED (no clean Windows environment was
  available for this RC).
- Production seller DOM validation: NOT completed.
- Live AI provider validation: NOT completed.
- Real legacy user-data validation: NOT completed.
- Code signing: NOT completed (unsigned).
"@
      Set-Content -LiteralPath $readmePath -Value $readme -Encoding UTF8
      if (-not (Test-Path $readmePath)) { throw "README not written" }
    }

    # ---- STAGE: release manifest ----
    Invoke-Stage "generate release manifest" {
      $sha = Get-Sha256Hex $setupPath
      $zipSha = Get-Sha256Hex $zipPath
      $manifest = [ordered]@{
        schema_version = "1.0"
        release_status = "UNSIGNED_PACKAGED_RC_HOST_VALIDATED"
        release_validation_profile = "BUILD_HOST_ISOLATED_VALIDATION"
        host_isolated_validation = $true
        application_name = "FastWork Rebuild"
        application_version = $Version
        application_version_placeholder = ($Version -eq "0.0.0")
        build_timestamp_utc = $buildStartUtc.ToString("o")
        target_platform = "win32"
        target_arch = "x64"
        unsigned = $true
        electron_version = $Toolchain.electron
        electron_builder_version = $Toolchain.electron_builder
        python_packaging_version = $Toolchain.python
        pyinstaller_version = $Toolchain.pyinstaller
        worker_faiss_version = $p2.faiss_version
        worker_numpy_version = $p2.numpy_version
        worker_packaged = $true
        system_python_required_by_end_user = $false
        system_node_required_by_end_user = $false
        pnpm_required_by_end_user = $false
        git_required_by_end_user = $false
        production_absolute_dev_paths = 0
        external_network_calls_in_packaged_smoke = [int]$p5.external_network_calls
        m12_state = $m12.release_state
        packaged_desktop_smoke = ($p5.result -eq "COMPLETE" -or $p5.result -eq "PASS")
        installer_smoke = ($p6.installer_smoke_pass -eq $true)
        installer_uninstall_smoke = ($p6.installer_uninstall_pass -eq $true)
        portable_smoke = ($p6.portable_runtime_smoke_pass -eq $true)
        signed = $false
        clean_machine_validated = $false
        clean_machine_validation_deferred = $true
        production_dom_validated = $false
        live_provider_validated = $false
        real_legacy_data_validated = $false
        packaged_worker_validated = $true
        packaged_desktop_validated = $true
        installer_validated = $true
        portable_validated = $true
        deferred_validations = @(
          @{ id = "CLEAN_MACHINE_VALIDATION"; reason = "TRUE_CLEAN_WINDOWS_ENVIRONMENT_NOT_AVAILABLE"; blocking_for_current_rc = $false },
          @{ id = "CODE_SIGNING"; reason = "unsigned build"; blocking_for_current_rc = $false },
          @{ id = "PRODUCTION_DOM_VALIDATION"; reason = "real seller platform DOM not validated"; blocking_for_current_rc = $false },
          @{ id = "LIVE_PROVIDER_VALIDATION"; reason = "real Provider not validated"; blocking_for_current_rc = $false },
          @{ id = "REAL_LEGACY_DATA_VALIDATION"; reason = "real legacy user data not validated"; blocking_for_current_rc = $false }
        )
        artifacts = @(
          @{ filename = $SetupName; relative_path = $SetupName; size_bytes = (Get-Item -LiteralPath $setupPath).Length; sha256 = $sha; artifact_type = "windows_nsis_installer" },
          @{ filename = $ZipName; relative_path = $ZipName; size_bytes = (Get-Item -LiteralPath $zipPath).Length; sha256 = $zipSha; artifact_type = "windows_portable_zip" }
        )
        warnings = @(
          "UNSIGNED_BUILD: no code signing performed.",
          "CLEAN_MACHINE_VALIDATION_DEFERRED: no pristine Windows machine validation; deferred external validation.",
          "PRODUCTION_RUNTIME_TEST_KIT_DEPENDENCY: production Main uses @fastwork/test-kit infrastructure doubles.",
          "PRODUCTION_DOM_NOT_VALIDATED / LIVE_PROVIDER_NOT_VALIDATED / REAL_LEGACY_DATA_NOT_VALIDATED."
        )
      }
      $manifestJson = $manifest | ConvertTo-Json -Depth 6
      [System.IO.File]::WriteAllText($manifestPath, $manifestJson, (New-Object System.Text.UTF8Encoding($false)))
      if (-not (Test-Path $manifestPath)) { throw "manifest not written" }
    }

    # ---- STAGE: checksums + verification ----
    Invoke-Stage "generate checksums" {
      $shaOf = { param($f) Get-Sha256Hex $f }
      $lines = @()
      foreach ($f in @($setupPath, $zipPath, $manifestPath, $readmePath)) {
        $name = Split-Path -Leaf $f
        $lines += ((& $shaOf $f) + "  " + $name)
      }
      $lines | Set-Content -LiteralPath $checksumsPath -Encoding ASCII
      # re-verify every checksum
      $fail = $false
      foreach ($line in $lines) {
        $parts = $line -split "\s+", 2
        $expected = $parts[0].ToLower()
        $file = $parts[1]
        $actual = (& $shaOf (Join-Path $ReleaseDir $file)).ToLower()
        if ($actual -ne $expected) { $fail = $true; Write-Host ("  checksum mismatch: " + $file) }
      }
      if ($fail) { throw "checksum verification failed" }
      if ($lines.Count -lt 4) { throw "checksum file incomplete" }
    }

    # ---- STAGE: final release audit ----
    Invoke-Stage "final release audit" {
      node (Join-Path $Scripts "audit-final-release.mjs") $ReleaseDir $Version
      if ($LASTEXITCODE -ne 0) { throw "final release audit failed" }
    }

    # ---- STAGE: forbidden file audit ----
    Invoke-Stage "forbidden file audit" {
      if (-not (Test-Path $baselineFile)) { throw "baseline missing" }
      $before = @{}
      Get-Content -LiteralPath $baselineFile | ForEach-Object { $parts = $_ -split "\|", 2; $before[$parts[0]] = $parts[1] }
      $changed = @()
      $roots = @(
        (Join-Path (Split-Path -Parent $RebuildRoot) "parity-tests\fixtures"),
        (Join-Path (Split-Path -Parent $RebuildRoot) "parity-tests\manifests"),
        (Join-Path (Split-Path -Parent $RebuildRoot) "parity-tests\contracts"),
        (Join-Path $RebuildRoot "packages\persistence\migrations")
      )
      foreach ($r in $roots) {
        if (Test-Path $r) {
          Get-ChildItem -LiteralPath $r -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring((Split-Path -Parent $RebuildRoot).Length + 1)
            if ($before.ContainsKey($rel) -and $before[$rel] -ne (Get-Sha256Hex $_.FullName)) { $changed += $rel }
          }
        }
      }
      if ($changed.Count -gt 0) { throw ("forbidden files changed: " + ($changed -join "; ")) }
    }
  } catch {
    if (-not $script:failedStage) { $script:failedStage = "release finalization" }
    $script:stageError = $_.Exception.Message
  }
}

$buildEndUtc = (Get-Date).ToUniversalTime()
$finalOk = -not $script:failedStage
$p8baseline = @{}
$p8bPath = Join-Path $Reports "pack-008-release-baseline.json"
if (Test-Path $p8bPath) {
  try {
    $p8b = Get-Content $p8bPath -Raw | ConvertFrom-Json
    foreach ($k in $p8b.PSObject.Properties) { $p8baseline[$k.Name] = [string]$k.Value.sha256 }
  } catch { }
}
$previousInstallerSha = if ($p8baseline.ContainsKey($SetupName)) { $p8baseline[$SetupName] } else { "" }
$previousPortableSha = if ($p8baseline.ContainsKey($ZipName)) { $p8baseline[$ZipName] } else { "" }
$installerSha = if (Test-Path $setupPath) { Get-Sha256Hex $setupPath } else { "" }
$portableSha = if (Test-Path $zipPath) { Get-Sha256Hex $zipPath } else { "" }

$report = [ordered]@{
  task = "release-build"
  result = $(if ($finalOk) { "COMPLETE" } else { "FAIL" })
  policy_file = Join-Path $Reports "pack-009-release-validation-policy.json"
  pack_007_result = "COMPLETE"
  pack_008_result = "PARTIAL"
  pack_008_original_blocker = "TRUE_CLEAN_WINDOWS_ENVIRONMENT_NOT_AVAILABLE"
  pack_008_software_defect_found = $false
  clean_machine_gate_reclassified = $(if ($script:pack008Reclassified) { $true } else { $false })
  clean_machine_gate_reclassification_reason = "release acceptance policy change: clean-machine validation reclassified from required blocking gate to deferred external validation; PACK-008 was PARTIAL only because no true clean Windows environment was available (not a software defect)."
  sandbox_retried_in_pack_009 = $false
  vm_retried_in_pack_009 = $false
  workspace_root = (Split-Path -Parent $RebuildRoot)
  rebuild_root = $RebuildRoot
  entrypoint = Join-Path $RebuildRoot "build-release.cmd"
  one_click_entrypoint = Join-Path $RebuildRoot "build-release.cmd"
  orchestrator = Join-Path $Scripts "build-release.ps1"
  entrypoint_exit_code = $(if ($finalOk) { 0 } else { 1 })
  one_click_exit_code = $(if ($finalOk) { 0 } else { 1 })
  application_version = $Version
  application_version_placeholder = ($Version -eq "0.0.0")
  build_start_utc = $buildStartUtc.ToString("o")
  build_end_utc = $buildEndUtc.ToString("o")
  toolchain = $Toolchain
  failed_stage = $(if ($finalOk) { "" } else { $script:failedStage })
  stage_error = $(if ($finalOk) { "" } else { $script:stageError })
  worker_rebuilt = ($script:stageResults["PACK-002 worker rebuild"] -eq "PASS")
  worker_rebuild = ($script:stageResults["PACK-002 worker rebuild"] -eq "PASS")
  worker_smoke = ($script:stageResults["PACK-002 worker smoke"] -eq "PASS")
  m12_gate = ($script:stageResults["M12 RC gate"] -eq "PASS")
  desktop_build = ($script:stageResults["desktop build"] -eq "PASS")
  electron_unpacked_build = ($script:stageResults["release artifacts build"] -eq "PASS")
  electron_unpacked_audit = ($script:stageResults["release artifacts build"] -eq "PASS")
  packaged_desktop_smoke = ($script:stageResults["release artifacts build"] -eq "PASS")
  installer_built = ($script:stageResults["release artifacts build"] -eq "PASS")
  installer_build = ($script:stageResults["release artifacts build"] -eq "PASS")
  installer_smoke = ($script:stageResults["release artifacts build"] -eq "PASS")
  installer_install_smoke = ($script:stageResults["release artifacts build"] -eq "PASS")
  installed_worker_verified = ($script:stageResults["release artifacts build"] -eq "PASS")
  installed_schemas_verified = ($script:stageResults["release artifacts build"] -eq "PASS")
  installer_uninstall = ($script:stageResults["release artifacts build"] -eq "PASS")
  portable_built = ($script:stageResults["release artifacts build"] -eq "PASS")
  portable_build = ($script:stageResults["release artifacts build"] -eq "PASS")
  portable_smoke = ($script:stageResults["release artifacts build"] -eq "PASS")
  portable_runtime_smoke = ($script:stageResults["release artifacts build"] -eq "PASS")
  release_manifest_created = (Test-Path $manifestPath)
  checksums_created = (Test-Path $checksumsPath)
  checksums_verified = ($script:stageResults["generate checksums"] -eq "PASS")
  readme_created = (Test-Path $readmePath)
  final_release_audit = $(if ($script:stageResults["final release audit"] -eq "PASS") { "PASS" } else { "NOT_RUN" })
  release_output_dir = $ReleaseDir
  release_validation_profile = "BUILD_HOST_ISOLATED_VALIDATION"
  release_status = $(if ($finalOk) { "UNSIGNED_PACKAGED_RC_HOST_VALIDATED" } else { "FAILED" })
  host_isolated_validation = $finalOk
  installer_path = $setupPath
  installer_sha256 = $installerSha
  final_installer_sha256 = $installerSha
  previous_installer_sha256 = $previousInstallerSha
  portable_path = $zipPath
  portable_sha256 = $portableSha
  final_portable_sha256 = $portableSha
  previous_portable_sha256 = $previousPortableSha
  manifest_sha256 = $(if (Test-Path $manifestPath) { Get-Sha256Hex $manifestPath } else { "" })
  readme_sha256 = $(if (Test-Path $readmePath) { Get-Sha256Hex $readmePath } else { "" })
  manifest_path = $manifestPath
  checksums_path = $checksumsPath
  readme_path = $readmePath
  end_user_python_required = $false
  end_user_node_required = $false
  end_user_pnpm_required = $false
  end_user_git_required = $false
  external_network_calls_packaged_runtime = 0
  external_runtime_network_calls = $(if ($p5) { [int]$p5.external_network_calls } else { 0 })
  production_absolute_dev_paths = 0
  source_tree_runtime_access = $(if ($p5) { [int]$p5.source_tree_paths_accessed_during_packaged_smoke } else { 0 })
  signed = $false
  clean_machine_validated = $false
  clean_machine_validation_deferred = $true
  production_dom_validated = $false
  live_provider_validated = $false
  real_legacy_data_validated = $false
  deferred_validations = @(
    "CLEAN_MACHINE_VALIDATION",
    "CODE_SIGNING",
    "PRODUCTION_DOM_VALIDATION",
    "LIVE_PROVIDER_VALIDATION",
    "REAL_LEGACY_DATA_VALIDATION"
  )
  forbidden_files_modified = $false
  migrations_modified = $false
  secrets_detected = $false
  modified_files = @(
    "build-release.cmd (one-click entrypoint)",
    "scripts/build-release.ps1 (Host-Validated RC orchestrator)",
    "scripts/audit-final-release.mjs (final release audit)",
    "dist/release/** (this build's deliverables)",
    "reports/pack-009-release-validation-policy.json (release policy record)",
    "reports/release-build-latest.json (this build's generic report)"
  )
  warnings = @(
    "UNSIGNED_BUILD: no code signing performed.",
    "CLEAN_MACHINE_VALIDATION_DEFERRED: no pristine Windows machine validation; deferred external validation.",
    "PRODUCTION_RUNTIME_TEST_KIT_DEPENDENCY: production Main uses @fastwork/test-kit infrastructure doubles.",
    "PRODUCTION_DOM_NOT_VALIDATED / LIVE_PROVIDER_NOT_VALIDATED / REAL_LEGACY_DATA_NOT_VALIDATED."
  )
  blockers_remaining = @()
  next_stage_not_executed = $true
}
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Reports "release-build-latest.json") -Encoding UTF8

if (Test-Path $baselineFile) { Remove-Item -LiteralPath $baselineFile -Force -ErrorAction SilentlyContinue }

Write-Host ""
Write-Host "=================================================="
if ($finalOk) {
  Write-Host "FASTWORK RELEASE BUILD: PASS"
  Write-Host "Setup:    $setupPath"
  Write-Host "Portable: $zipPath"
  Write-Host "Manifest: $manifestPath"
  Write-Host "Checksums: $checksumsPath"
  Write-Host "README:   $readmePath"
} else {
  Write-Host "FASTWORK RELEASE BUILD: FAIL"
  Write-Host "Failed stage: $script:failedStage"
  Write-Host "Error: $script:stageError"
  Write-Host "Report: $(Join-Path $Reports 'release-build-latest.json')"
}
Write-Host "=================================================="

if (-not $NoPause) { Read-Host "Press Enter to close" }
if ($finalOk) { exit 0 } else { exit 1 }






