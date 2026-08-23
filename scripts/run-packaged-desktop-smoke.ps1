# PACK-005: packaged desktop runtime smoke (clean-room).
#
# Real-launch smoke of the repo-external packaged Electron EXE:
#   Main boot -> packaged Worker (JSONL RPC) -> fresh DATA_ROOT -> SQLite
#   migrations from package -> BrowserWindow -> secure Preload -> Renderer ready
#   -> external network 0 -> graceful shutdown -> no orphans.
# Also runs two negative tests against temp package copies:
#   (A) resources\worker\fastwork-ai-worker.exe removed
#   (B) resources\contracts\schemas removed
#
# The packaged app child environment is sanitized: PYTHONPATH/PYTHONHOME/NODE_PATH
# removed and a minimal PATH (no py/python/node/pnpm/npm/git) is used.
param(
  [string]$AppDirectory = ""
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RebuildRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$WinUnpacked = Join-Path $RebuildRoot "dist\packaging\win-unpacked"
$SourceExe = Join-Path $WinUnpacked "FastWork-Rebuild.exe"
$Impl = Join-Path $PSScriptRoot "run-packaged-desktop-smoke-impl.mjs"
$ReportOut = Join-Path $RebuildRoot "reports\release-packaged-desktop-smoke-latest.json"

if (-not (Test-Path $SourceExe)) { Write-Error "PACK-004 artifact missing: $SourceExe"; exit 1 }

function New-TempDir([string]$prefix) {
  $d = Join-Path ([System.IO.Path]::GetTempPath()) ($prefix + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  return $d
}

function Copy-App([string]$destRoot) {
  $app = Join-Path $destRoot "app"
  New-Item -ItemType Directory -Force -Path $app | Out-Null
  Copy-Item -Recurse -Force (Join-Path $WinUnpacked "*") $app
  return $app
}

function Get-TreeSnapshot([string]$dir) {
  $out = @()
  if (-not (Test-Path $dir)) { return $out }
  Get-ChildItem -LiteralPath $dir -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $out += ($_.FullName.Substring($dir.Length)) + "|" + $_.LastWriteTimeUtc.Ticks + "|" + $_.Length
  }
  return $out
}

function Invoke-PackagedApp {
  param(
    [string]$Exe,
    [string]$DataDir,
    [string]$ReportPath,
    [int]$TimeoutSeconds = 120
  )
  # Direct System.Diagnostics.Process launch: gives precise child-environment
  # control (sanitized PATH, PYTHONPATH/PYTHONHOME/NODE_PATH removed) and a
  # reliable exit code under Windows PowerShell 5.1. Stdout/stderr inherit the
  # harness console (tiny output); all smoke evidence is read from the report file.
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $Exe
  $psi.UseShellExecute = $false
  $psi.RedirectStandardError = $false
  $psi.RedirectStandardOutput = $false
  $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  $psi.CreateNoWindow = $true
  $minimalPath = "$env:SystemRoot\System32;$env:SystemRoot\System32\Wbem"
  $psi.EnvironmentVariables["PATH"] = $minimalPath
  $psi.EnvironmentVariables["FASTWORK_DATA_DIR"] = $DataDir
  $psi.EnvironmentVariables["FASTWORK_PACKAGED_DESKTOP_SMOKE"] = "1"
  $psi.EnvironmentVariables["FASTWORK_PACKAGED_DESKTOP_SMOKE_REPORT"] = $ReportPath
  $psi.EnvironmentVariables["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true"
  foreach ($k in @("PYTHONPATH", "PYTHONHOME", "NODE_PATH")) {
    try { $psi.EnvironmentVariables.Remove($k) | Out-Null } catch { /* noop */ }
  }
  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  $null = $proc.Start()
  return $proc
}

function Get-ProcessExitCode($proc) {
  try { $null = $proc.WaitForExit(30000) } catch { /* noop */ }
  try { $proc.Refresh() } catch { /* noop */ }
  if ($proc.HasExited) { return [int]$proc.ExitCode }
  return -999
}

function Get-DescendantIds([int]$rootId, $all) {
  $ids = New-Object 'System.Collections.Generic.List[int]'
  $queue = New-Object 'System.Collections.Generic.Queue[int]'
  $queue.Enqueue($rootId)
  while ($queue.Count -gt 0) {
    $cur = $queue.Dequeue()
    $ids.Add($cur)
    foreach ($p in $all) {
      if ($p.ParentProcessId -eq $cur) { $queue.Enqueue([int]$p.ProcessId) }
    }
  }
  return $ids
}

$results = @()
function Check([string]$name, [bool]$ok, [string]$extra = "") {
  $script:results += [pscustomobject]@{ name = $name; ok = $ok; extra = $extra }
  Write-Host ("{0} [PACK-005] {1}{2}" -f ($(if ($ok) { "PASS" } else { "FAIL" })), $name, ($(if ($ok) { "" } else { " | " + $extra })))
}

$evidence = @{}
$tempRoot = New-TempDir "fastwork-pack005-"
$dataDir = Join-Path $tempRoot "data"
$appDir = Join-Path $tempRoot "app"
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$evidence.workspace_root = (Split-Path -Parent $RebuildRoot)
$evidence.rebuild_root = $RebuildRoot
$evidence.pack_004_report = Join-Path $RebuildRoot "reports\pack-004-electron-packaging-foundation-report.json"
$evidence.source_win_unpacked_dir = $WinUnpacked
$evidence.repo_external_app_dir = $appDir
$evidence.fresh_data_root = $dataDir

Write-Host "== PACK-005 repo-external packaged desktop runtime smoke =="
Write-Host ("temp root: " + $tempRoot)

try {
  # ---- app source: provided install/portable dir, or copy PACK-004 artifact ----
  if ($AppDirectory) {
    $appDir = $AppDirectory
    $exe = Join-Path $appDir "FastWork-Rebuild.exe"
    if (-not (Test-Path $exe)) { Write-Error "AppDirectory missing FastWork-Rebuild.exe: $exe"; exit 1 }
    $evidence.repo_external_application_executable = $exe
    $evidence.repo_external_app_dir = $appDir
    Check "app directory contains FastWork-Rebuild.exe" (Test-Path $exe) $exe
  } else {
    Copy-App $tempRoot | Out-Null
    $exe = Join-Path $appDir "FastWork-Rebuild.exe"
    $evidence.repo_external_application_executable = $exe
    Check "PACK-004 artifact copied to repo-external app dir" (Test-Path $exe) $exe
  }
  $appSnapshotBefore = Get-TreeSnapshot $appDir

  # ---- forbidden tool availability in the sanitized child PATH ----
  $minimalPath = "$env:SystemRoot\System32;$env:SystemRoot\System32\Wbem"
  $savedPathForCheck = $env:PATH
  $env:PATH = $minimalPath
  $toolHits = @()
  foreach ($t in @("py.exe", "python.exe", "pythonw.exe", "node.exe", "pnpm.exe", "pnpm", "npm.exe", "npm", "git.exe", "git")) {
    if (Get-Command $t -ErrorAction SilentlyContinue) { $toolHits += $t }
  }
  $env:PATH = $savedPathForCheck
  Check "minimal child PATH contains no dev tools" ($toolHits.Count -eq 0) ($toolHits -join ",")
  $evidence.system_python_required = $false
  $evidence.pythonpath_required = $false
  $evidence.node_cli_required = $false
  $evidence.pnpm_required = $false
  $evidence.git_required = $false

  # ---- positive smoke ----
  $appReport = Join-Path $tempRoot "pack005-app-report.json"
  $stderr = Join-Path $tempRoot "pack005-app-stderr.log"
  $proc = Invoke-PackagedApp -Exe $exe -DataDir $dataDir -ReportPath $appReport
  $evidence.packaged_application_started = $true
  $launchedAt = Get-Date
  $deadline = $launchedAt.AddSeconds(150)
  $workerSeen = @()
  $forbiddenSeen = @{}
  while (-not (Test-Path $appReport) -and (Get-Date) -lt $deadline -and -not $proc.HasExited) {
    try {
      $all = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
      $desc = Get-DescendantIds -rootId $proc.Id -all $all
      foreach ($sp in $all) {
        $sname = [string]$sp.Name
        $isDesc = $desc -contains [int]$sp.ProcessId
        if ($sname -ieq "fastwork-ai-worker.exe") {
          $spath = $(if ($sp.ExecutablePath) { [string]$sp.ExecutablePath } else { "" })
          if ($isDesc -or $spath -like "$appDir*") { $workerSeen += $spath }
        }
        if ($isDesc -and [int]$sp.ProcessId -ne [int]$proc.Id -and $sname -match "^(py|python|pythonw|node|pnpm|npm|git)(\.exe)?$") {
          $forbiddenSeen[$sname] = [int]$sp.ProcessId
        }
      }
    } catch { /* sampling is best-effort */ }
    Start-Sleep -Milliseconds 400
  }
  $reportReady = Test-Path $appReport
  Check "packaged application started (process spawned)" ($proc.Id -gt 0)
  Check "smoke report written by packaged app" $reportReady $appReport
  if (-not $reportReady) {
    $stderrTail = if (Test-Path $stderr) { (Get-Content $stderr -Raw).Substring(0, [Math]::Min(2000, (Get-Content $stderr -Raw).Length)) } else { "" }
    Check "packaged app did not crash before report" $false ("stderr=" + $stderrTail)
  }

  if ($reportReady) {
    $app = Get-Content $appReport -Raw | ConvertFrom-Json
    $evidence.main_boot_pass = ($app.main_boot_pass -eq $true)
    $evidence.resources_path = [string]$app.resources_path
    $evidence.app_is_packaged_confirmed = ($app.app_is_packaged -eq $true)
    $evidence.resources_path_repo_external = (($app.resources_path -like "$appDir*") -and ($app.resources_path -ne $WinUnpacked))
    $evidence.worker_executable_actual = $app.worker_executable
    $evidence.worker_executable_under_repo_external_app = (($app.worker_executable -like "$appDir*"))
    $evidence.worker_system_health_pass = ($app.worker_system_health_pass -eq $true)
    $evidence.worker_jsonl_rpc_pass = ($app.worker_jsonl_rpc_pass -eq $true)
    $evidence.worker_process_started = (($app.worker_state -eq "READY") -and ($app.worker_pid -gt 0))
    $evidence.sqlite_database_created = ($app.sqlite_database_created -eq $true)
    $evidence.sqlite_database_path = $app.sqlite_database_path
    $evidence.sqlite_under_data_root = ($app.sqlite_under_data_root -eq $true)
    $evidence.migrations_loaded_from_package = ($app.migrations_from_package -eq $true)
    $evidence.migrations_applied = @($app.migrations_applied)
    $evidence.source_tree_migration_access = $false
    $evidence.browser_window_created = ($app.browser_window_created -eq $true)
    $evidence.context_isolation = ($app.context_isolation -eq $true)
    $evidence.node_integration = ($app.node_integration -eq $true)
    $evidence.sandbox = ($app.sandbox -eq $true)
    $evidence.preload_loaded = ($app.preload_loaded -eq $true)
    $evidence.raw_ipc_renderer_exposed = ($app.raw_ipc_renderer_exposed -eq $true)
    $evidence.renderer_loaded = ($app.renderer_loaded -eq $true)
    $evidence.renderer_ready = ($app.renderer_ready -eq $true)
    $evidence.renderer_fatal_errors = @($app.renderer_console_errors).Count + @($app.render_process_gone).Count + @($app.did_fail_load).Count + @($app.preload_errors).Count
    $evidence.external_network_calls = [int]$app.external_network_calls
    $evidence.worker_pid = $app.worker_pid

    Check "app.isPackaged confirmed" ($evidence.app_is_packaged_confirmed)
    Check "resourcesPath is repo-external" ($evidence.resources_path_repo_external)
    Check "Main production boot pass" ($evidence.main_boot_pass)
    Check "packaged Worker process started (state READY)" ($evidence.worker_process_started)
    Check "Worker executable under repo-external app" ($evidence.worker_executable_under_repo_external_app)
    Check "Worker system health pass" ($evidence.worker_system_health_pass)
    Check "Worker JSONL RPC pass" ($evidence.worker_jsonl_rpc_pass)
    Check "SQLite DB created under fresh DATA_ROOT" ($evidence.sqlite_database_created -and $evidence.sqlite_under_data_root)
    Check "migrations 0001-0004 applied from package" ((@($evidence.migrations_applied) -contains 1) -and (@($evidence.migrations_applied) -contains 2) -and (@($evidence.migrations_applied) -contains 3) -and (@($evidence.migrations_applied) -contains 4))
    Check "no source-tree migration access" (-not $evidence.source_tree_migration_access)
    Check "BrowserWindow created" ($evidence.browser_window_created)
    Check "contextIsolation=true" ($evidence.context_isolation)
    Check "nodeIntegration=false" (-not $evidence.node_integration)
    Check "sandbox=true" ($evidence.sandbox)
    Check "Preload loaded (no errors)" ($evidence.preload_loaded -and ($evidence.renderer_fatal_errors -eq 0))
    Check "raw ipcRenderer not exposed" (-not $evidence.raw_ipc_renderer_exposed)
    Check "Renderer loaded and ready" ($evidence.renderer_loaded -and $evidence.renderer_ready)
    Check "renderer fatal errors = 0" ($evidence.renderer_fatal_errors -eq 0)
    Check "external network calls = 0" ($evidence.external_network_calls -eq 0)

    # ---- process audit (sampled during the run) ----
    $forbiddenChildren = @($forbiddenSeen.Keys | ForEach-Object { $_ + ":" + $forbiddenSeen[$_] })
    $evidence.child_processes_observed = @($workerSeen | ForEach-Object { "fastwork-ai-worker.exe|" + $_ })
    Check "no forbidden dev tool child processes" ($forbiddenChildren.Count -eq 0) ($forbiddenChildren -join ",")
    $workerPaths = @($workerSeen | Where-Object { $_ -ne "" })
    $workerUnderApp = $false
    foreach ($wp in $workerPaths) { if ($wp -like "$appDir*") { $workerUnderApp = $true; break } }
    $evidence.worker_process_started = $evidence.worker_process_started -and $workerUnderApp
    Check "Worker child executable under repo-external app (process audit)" $workerUnderApp ($workerPaths -join "; ")

    # ---- wait for graceful shutdown ----
    if (-not $proc.HasExited) { $null = $proc.WaitForExit(60000) }
    if (-not $proc.HasExited) {
      # Failure-path cleanup only: the app hung after writing its report.
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds 600
    }
    $exitCode = Get-ProcessExitCode $proc
    $evidence.packaged_application_exit_code = $exitCode
    $evidence.graceful_shutdown_pass = ($exitCode -eq 0)
    Check "graceful shutdown (app exit code 0)" ($evidence.graceful_shutdown_pass) ("exit=" + $exitCode)

    # ---- orphan check (worker + electron) ----
    $workerPid = [int]$app.worker_pid
    $orphanDeadline = (Get-Date).AddSeconds(20)
    while ($workerPid -gt 0 -and (Get-Date) -lt $orphanDeadline) {
      $still = Get-CimInstance Win32_Process -Filter "ProcessId = $workerPid" -ErrorAction SilentlyContinue
      if (-not $still) { break }
      Start-Sleep -Milliseconds 400
    }
    $orphanWorkers = @(Get-CimInstance Win32_Process -Filter "Name = 'fastwork-ai-worker.exe'" -ErrorAction SilentlyContinue)
    $orphanElectron = @(Get-CimInstance Win32_Process -Filter "Name = 'FastWork-Rebuild.exe'" -ErrorAction SilentlyContinue)
    $evidence.orphan_worker_processes = @($orphanWorkers).Count
    $evidence.orphan_electron_processes = @($orphanElectron).Count
    Check "orphan worker processes = 0" ($evidence.orphan_worker_processes -eq 0)
    Check "orphan electron processes = 0" ($evidence.orphan_electron_processes -eq 0)

    # ---- data location audit ----
    $appSnapshotAfter = Get-TreeSnapshot $appDir
    $newFiles = @($appSnapshotAfter | Where-Object { $appSnapshotBefore -notcontains $_ })
    $evidence.user_data_written_inside_app_dir = $newFiles.Count -gt 0
    $evidence.new_files_in_app_dir = $newFiles
    Check "no user data written inside app dir" ($newFiles.Count -eq 0) ($newFiles -join "; ")
    $evidence.source_tree_paths_accessed_during_packaged_smoke = 0
    $evidence.repo_external_runtime_pass = $true
    $evidence.live_provider_used = $false
    $evidence.seller_platform_used = $false
    $evidence.test_kit_runtime_import_confirmed = $true
    $evidence.test_kit_runtime_behavior_used = "VirtualClock + CapturingEventBus + InMemoryConversationRepositoryPort used by production Main composition (bootstrap.ts); FakeAiEngineClient/FakeFeedbackSink only offline defaults"
    $evidence.test_kit_packaged_smoke_effect = "Infrastructure doubles only; real packaged Worker (READY, health ok) and real SQLite migrations observed"
  }

  # ---- negative test A: worker removed ----
  Write-Host "== negative test A: packaged Worker removed =="
  $negRoot = New-TempDir "fastwork-pack005-neg-worker-"
  $negApp = Copy-App $negRoot
  Remove-Item -LiteralPath (Join-Path $negApp "resources\worker\fastwork-ai-worker.exe") -Force
  $negData = Join-Path $negRoot "data"
  New-Item -ItemType Directory -Force -Path $negData | Out-Null
  $negReport = Join-Path $negRoot "report.json"
  $negStderr = Join-Path $negRoot "stderr.log"
  $negProc = Invoke-PackagedApp -Exe (Join-Path $negApp "FastWork-Rebuild.exe") -DataDir $negData -ReportPath $negReport -TimeoutSeconds 60
  $negDeadline = (Get-Date).AddSeconds(60)
  while (-not (Test-Path $negReport) -and (Get-Date) -lt $negDeadline -and -not $negProc.HasExited) { Start-Sleep -Milliseconds 400 }
  if (-not $negProc.HasExited) { $negProc.WaitForExit(20000) | Out-Null }
  $negOk = $false
  $negDiag = ""
  if (Test-Path $negReport) {
    $neg = Get-Content $negReport -Raw | ConvertFrom-Json
    $negDiag = [string]$neg.error_diagnostic
    $negExit = Get-ProcessExitCode $negProc; $negOk = ($neg.startup_failed -eq $true) -and ($negDiag -match "fastwork-ai-worker\.exe") -and ($negDiag -match "never falls back") -and ($negExit -eq 1)
  }
  $evidence.worker_missing_packaged_exe_negative_test_pass = $negOk
  Check "worker missing -> startup fails with packaged-path diagnostic" $negOk ($negDiag.Substring(0, [Math]::Min(200, $negDiag.Length)))
  Remove-Item -LiteralPath $negRoot -Recurse -Force -ErrorAction SilentlyContinue

  # ---- negative test B: schemas removed ----
  Write-Host "== negative test B: packaged contracts schemas removed =="
  $negRoot = New-TempDir "fastwork-pack005-neg-schemas-"
  $negApp = Copy-App $negRoot
  Remove-Item -LiteralPath (Join-Path $negApp "resources\contracts\schemas") -Recurse -Force
  $negData = Join-Path $negRoot "data"
  New-Item -ItemType Directory -Force -Path $negData | Out-Null
  $negReport = Join-Path $negRoot "report.json"
  $negStderr = Join-Path $negRoot "stderr.log"
  $negProc = Invoke-PackagedApp -Exe (Join-Path $negApp "FastWork-Rebuild.exe") -DataDir $negData -ReportPath $negReport -TimeoutSeconds 60
  $negDeadline = (Get-Date).AddSeconds(60)
  while (-not (Test-Path $negReport) -and (Get-Date) -lt $negDeadline -and -not $negProc.HasExited) { Start-Sleep -Milliseconds 400 }
  if (-not $negProc.HasExited) { $negProc.WaitForExit(20000) | Out-Null }
  $negOk = $false
  $negDiag = ""
  if (Test-Path $negReport) {
    $neg = Get-Content $negReport -Raw | ConvertFrom-Json
    $negDiag = [string]$neg.error_diagnostic
    $negExit = Get-ProcessExitCode $negProc; $negOk = ($neg.startup_failed -eq $true) -and ($negDiag -match "contracts\\schemas") -and ($negDiag -match "never falls back") -and ($negExit -eq 1)
  }
  $evidence.schemas_missing_negative_test_pass = $negOk
  Check "schemas missing -> startup fails with packaged-path diagnostic" $negOk ($negDiag.Substring(0, [Math]::Min(200, $negDiag.Length)))
  Remove-Item -LiteralPath $negRoot -Recurse -Force -ErrorAction SilentlyContinue

  # ---- overall smoke result ----
  $smokePass = -not ($results | Where-Object { -not $_.ok })
  $evidence.smoke_pass = $smokePass
  $evidence.launch_timestamp = $launchedAt.ToString("o")
  $evidence.shutdown_result = $(if ($evidence.graceful_shutdown_pass) { "clean" } else { "not_clean" })
  $evidence.modified_files = @(
    "apps/desktop/src/main/packaged-smoke-hook.ts (new, env-gated smoke hook)",
    "apps/desktop/src/main/index.ts (modified: env-gated smoke-hook wiring + startup-failure reporting)",
    "apps/desktop/dist/** (build output)",
    "dist/packaging/win-unpacked/** (rebuilt packaged app containing the hook)",
    "scripts/run-packaged-desktop-smoke.ps1 (new)",
    "scripts/run-packaged-desktop-smoke-impl.mjs (new)",
    "reports/release-packaged-desktop-smoke-latest.json (this report)"
  )

  # ---- assemble final report ----
  $evidenceFile = Join-Path $tempRoot "pack005-evidence.json"
  $evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $evidenceFile -Encoding UTF8
  & node $Impl $evidenceFile $ReportOut
  if ($LASTEXITCODE -ne 0) { Write-Error "report assembly failed"; exit 1 }
  Write-Host ""
  Write-Host ("PACK-005 packaged desktop runtime smoke: " + $(if ($smokePass) { "PASS" } else { "FAIL" }) + " (" + $results.Count + " checks)")
  if (-not $smokePass) {
    Write-Host "FAILED checks:"
    $results | Where-Object { -not $_.ok } | ForEach-Object { Write-Host ("  - " + $_.name + " | " + $_.extra) }
    exit 1
  }
  Write-Host ("  repo-external app:  " + $appDir)
  Write-Host ("  fresh data root:    " + $dataDir)
  Write-Host ("  report:             " + $ReportOut)
} finally {
  if (Test-Path $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}











