param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$AdminRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $AdminRoot ".env"
$RuntimeDir = Join-Path $AdminRoot ".runtime"
$StdOutLog = Join-Path $RuntimeDir "launch-admin.stdout.log"
$StdErrLog = Join-Path $RuntimeDir "launch-admin.stderr.log"

function Get-EnvValue {
  param(
    [string]$FilePath,
    [string]$Key
  )

  if (-not (Test-Path -LiteralPath $FilePath)) {
    return ""
  }

  foreach ($line in Get-Content -LiteralPath $FilePath) {
    $trimmed = [string]$line
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.TrimStart().StartsWith("#")) {
      continue
    }

    $separatorIndex = $trimmed.IndexOf("=")
    if ($separatorIndex -lt 0) {
      continue
    }

    $name = $trimmed.Substring(0, $separatorIndex).Trim()
    if ($name -ne $Key) {
      continue
    }

    return $trimmed.Substring($separatorIndex + 1).Trim().Trim("'`"")
  }

  return ""
}

function Test-AdminServer {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Get-LogTail {
  param(
    [string]$FilePath,
    [int]$LineCount = 60
  )

  if (-not (Test-Path -LiteralPath $FilePath)) {
    return @()
  }

  try {
    return Get-Content -LiteralPath $FilePath -Tail $LineCount
  } catch {
    return @()
  }
}

function Get-ProcessFailureDetails {
  param(
    [string]$StdOutPath,
    [string]$StdErrPath
  )

  $stderrLines = @(Get-LogTail -FilePath $StdErrPath)
  if ($stderrLines.Count -gt 0) {
    return ($stderrLines -join [Environment]::NewLine)
  }

  $stdoutLines = @(Get-LogTail -FilePath $StdOutPath)
  if ($stdoutLines.Count -gt 0) {
    return ($stdoutLines -join [Environment]::NewLine)
  }

  return ""
}

$rawPort = Get-EnvValue -FilePath $EnvFile -Key "ADMIN_PORT"
$port = 3000
if ($rawPort -match "^\d+$") {
  $port = [int]$rawPort
}

$rawHost = Get-EnvValue -FilePath $EnvFile -Key "ADMIN_HOST"
$displayHost = if ([string]::IsNullOrWhiteSpace($rawHost) -or $rawHost -eq "0.0.0.0") {
  "localhost"
} else {
  $rawHost
}

$browserUrl = "http://${displayHost}:$port/"
$healthUrl = "http://127.0.0.1:$port/api/meta/plans"

if (Test-AdminServer -Url $healthUrl) {
  Write-Host "EduData admin is already running at $browserUrl"
  if (-not $NoBrowser) {
    Start-Process $browserUrl | Out-Null
  }
  exit 0
}

New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
foreach ($logPath in @($StdOutLog, $StdErrLog)) {
  if (Test-Path -LiteralPath $logPath) {
    Remove-Item -LiteralPath $logPath -Force
  }
}

$process = Start-Process `
  -FilePath "node" `
  -ArgumentList "server.js" `
  -WorkingDirectory $AdminRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $StdOutLog `
  -RedirectStandardError $StdErrLog `
  -PassThru

$isReady = $false
for ($attempt = 0; $attempt -lt 80; $attempt += 1) {
  Start-Sleep -Milliseconds 250

  if ($process.HasExited) {
    $failureDetails = Get-ProcessFailureDetails -StdOutPath $StdOutLog -StdErrPath $StdErrLog
    if ($failureDetails) {
      throw "EduData admin exited early with code $($process.ExitCode).`n$failureDetails"
    }
    throw "EduData admin exited early with code $($process.ExitCode)."
  }

  if (Test-AdminServer -Url $healthUrl) {
    $isReady = $true
    break
  }
}

if (-not $isReady) {
  try {
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force
    }
  } catch {}
  $failureDetails = Get-ProcessFailureDetails -StdOutPath $StdOutLog -StdErrPath $StdErrLog
  if ($failureDetails) {
    throw "EduData admin did not become ready at $browserUrl.`n$failureDetails"
  }
  throw "EduData admin did not become ready at $browserUrl"
}

Write-Host "EduData admin running at $browserUrl"
Write-Host "Server PID: $($process.Id)"
Write-Host "Use the Exit Admin button in the app to stop the server."

if (-not $NoBrowser) {
  Start-Process $browserUrl | Out-Null
}
