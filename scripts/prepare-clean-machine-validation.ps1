# PACK-008 build-host validation bundle preparation (clean-room).
#
# Copies the frozen PACK-007 release deliverables + the PowerShell-only clean-host
# validator into dist\validation\pack-008, records expected SHA-256 hashes, writes
# a Windows Sandbox config (networking disabled) and instructions, and records a
# release-file immutability baseline. Does NOT modify dist\release.
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RebuildRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ReleaseDir = Join-Path $RebuildRoot "dist\release"
$ValidationDir = Join-Path $RebuildRoot "dist\validation\pack-008"
$ResultsDir = Join-Path $RebuildRoot "dist\validation\pack-008-results"
$Version = (Get-Content (Join-Path $RebuildRoot "apps\desktop\package.json") -Raw | ConvertFrom-Json).version
if (-not $Version) { Write-Error "no version"; exit 1 }
$SetupName = "FastWork-Rebuild-$Version-Setup.exe"
$ZipName = "FastWork-Rebuild-$Version-portable.zip"

function Get-Sha256Hex([string]$path) {
  $stream = [System.IO.File]::OpenRead($path)
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = $sha.ComputeHash($stream)
    return ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToLower()
  } finally { $stream.Close() }
}

# ---- PACK-007 consistency preflight ----
$p7 = Get-Content (Join-Path $RebuildRoot "reports\pack-007-one-click-release-build-report.json") -Raw | ConvertFrom-Json
if ($p7.result -ne "COMPLETE" -or $p7.entrypoint_exit_code -ne 0) { Write-Error "PACK-007 not COMPLETE/exit0"; exit 1 }
$required = @($SetupName, $ZipName, "release-manifest.json", "checksums.sha256", "README.txt")
foreach ($f in $required) { if (-not (Test-Path (Join-Path $ReleaseDir $f))) { Write-Error ("release file missing: " + $f); exit 1 } }
# checksums still match
$checksumsOk = $true
Get-Content (Join-Path $ReleaseDir "checksums.sha256") | ForEach-Object {
  $parts = $_.Trim() -split "\s+", 2
  if ($parts.Count -eq 2) {
    $p = Join-Path $ReleaseDir $parts[1]
    if (-not (Test-Path $p) -or (Get-Sha256Hex $p) -ne $parts[0].ToLower()) { $checksumsOk = $false; Write-Host ("  checksum mismatch: " + $parts[1]) }
  }
}
if (-not $checksumsOk) { Write-Error "dist/release checksums do not match"; exit 1 }
$man = Get-Content (Join-Path $ReleaseDir "release-manifest.json") -Raw | ConvertFrom-Json
if ($man.unsigned -ne $true -or $man.clean_machine_validated -ne $false) { Write-Error "manifest state unexpected"; exit 1 }
Write-Host "PACK-007 consistency preflight PASS"

# ---- clean bundle staging ----
if (Test-Path $ValidationDir) { $v = Resolve-Path $ValidationDir; if ($v.Path -like "$RebuildRoot\dist\validation\pack-008*") { Remove-Item -LiteralPath $v.Path -Recurse -Force } }
New-Item -ItemType Directory -Force -Path $ValidationDir | Out-Null
New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null

# ---- copy release deliverables (frozen bytes) ----
$hashes = @()
foreach ($f in @($SetupName, $ZipName, "release-manifest.json", "checksums.sha256", "README.txt")) {
  Copy-Item -LiteralPath (Join-Path $ReleaseDir $f) -Destination (Join-Path $ValidationDir $f) -Force
  $srcHash = Get-Sha256Hex (Join-Path $ReleaseDir $f)
  $dstHash = Get-Sha256Hex (Join-Path $ValidationDir $f)
  if ($srcHash -ne $dstHash) { Write-Error ("copy hash mismatch: " + $f); exit 1 }
  $hashes += ($dstHash + "  " + $f)
}
$hashes | Set-Content -LiteralPath (Join-Path $ValidationDir "expected-hashes.txt") -Encoding ASCII
Write-Host ("copied " + $required.Count + " release deliverables byte-identical")

# ---- copy the clean-host validator ----
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "validate-release-on-clean-machine.ps1") -Destination (Join-Path $ValidationDir "validate-release-on-clean-machine.ps1") -Force

# ---- instructions ----
$instructions = @"
FastWork PACK-008 clean-machine validation bundle
================================================
This bundle validates the frozen PACK-007 release artifacts on a TRUE clean
Windows x64 environment (Windows Sandbox / fresh VM / physical clean PC).

Contents:
  FastWork-Rebuild-$Version-Setup.exe
  FastWork-Rebuild-$Version-portable.zip
  release-manifest.json
  checksums.sha256
  README.txt
  expected-hashes.txt
  validate-release-on-clean-machine.ps1
  FastWork-PACK-008.wsb   (Windows Sandbox config, networking disabled)

Requirements on the clean host:
  - Windows 10/11 x64 (fresh). Do NOT install Python/Node/pnpm/Git/VS Build Tools.
  - Only Windows built-in PowerShell (5.1+) is used by the validator.

How to run:
  1. Copy this whole folder into the clean environment (e.g. map it into the
     Sandbox or copy to the VM).
  2. Open PowerShell as the normal user and run:
        powershell -NoProfile -ExecutionPolicy Bypass -File `
          validate-release-on-clean-machine.ps1
     (optionally: -Version $Version)
  3. The validator writes pack-008-clean-host-result.json and a plain-text log.
  4. Copy pack-008-clean-host-result.json + the log back to the build host.

Windows Sandbox (auto round-trip):
  - FastWork-PACK-008.wsb disables networking and maps:
        bundle (read-only)   -> C:\pack008
        results (writable)   -> C:\pack008-out
    Start it with:  WindowsSandbox.exe FastWork-PACK-008.wsb
    It auto-copies the bundle to the Sandbox temp dir, runs the validator with
    -OutputDir C:\pack008-out, and the result
    (pack-008-clean-host-result.json + log) appears on the host under:
        dist\validation\pack-008-results\
    Copy that JSON to build-host reports\pack-008-clean-host-result.json.

Notes:
  - The packaged application must run WITHOUT any dev toolchain and WITHOUT
    installing a VC++ Redistributable (the Worker bundles its own native runtime).
  - Do NOT disable Defender/SmartScreen or install test certificates; an unsigned
    warning is expected for the first version.
"@
Set-Content -LiteralPath (Join-Path $ValidationDir "INSTRUCTIONS.txt") -Value $instructions -Encoding UTF8

# ---- Windows Sandbox config (networking disabled, bundle read-only) ----
$wsbTemplate = @'
<Configuration>
  <Networking>Disable</Networking>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>__BUNDLE__</HostFolder>
      <SandboxFolder>C:\pack008</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
    <MappedFolder>
      <HostFolder>__RESULTS__</HostFolder>
      <SandboxFolder>C:\pack008-out</SandboxFolder>
      <ReadOnly>false</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>powershell -NoProfile -ExecutionPolicy Bypass -Command "Copy-Item -Recurse -Force C:\pack008\* $env:TEMP\pack008; powershell -NoProfile -ExecutionPolicy Bypass -File $env:TEMP\pack008\validate-release-on-clean-machine.ps1 -OutputDir C:\pack008-out; Write-Host 'DONE - result written to C:\pack008-out\pack-008-clean-host-result.json'"</Command>
  </LogonCommand>
</Configuration>
'@
$wsb = $wsbTemplate.Replace("__BUNDLE__", $ValidationDir).Replace("__RESULTS__", $ResultsDir)


Set-Content -LiteralPath (Join-Path $ValidationDir "FastWork-PACK-008.wsb") -Value $wsb -Encoding UTF8

# ---- release-file immutability baseline (build host) ----
$baseline = [ordered]@{}
foreach ($f in @($SetupName, $ZipName, "release-manifest.json", "checksums.sha256", "README.txt")) {
  $p = Join-Path $ReleaseDir $f
  $item = Get-Item -LiteralPath $p
  $baseline[$f] = [ordered]@{ sha256 = (Get-Sha256Hex $p); size = $item.Length; last_write_utc = $item.LastWriteTimeUtc.ToString("o") }
}
$baseline | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $RebuildRoot "reports\pack-008-release-baseline.json") -Encoding UTF8

Write-Host ""
Write-Host "PACK-008 validation bundle prepared: $ValidationDir"
Get-ChildItem -LiteralPath $ValidationDir -Force | ForEach-Object { Write-Host ("  " + $_.Name) }

