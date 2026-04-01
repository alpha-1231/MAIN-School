param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$AdminRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $AdminRoot ".env"

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

$process = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $AdminRoot -WindowStyle Hidden -PassThru

$isReady = $false
for ($attempt = 0; $attempt -lt 80; $attempt += 1) {
  Start-Sleep -Milliseconds 250

  if ($process.HasExited) {
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
  throw "EduData admin did not become ready at $browserUrl"
}

Write-Host "EduData admin running at $browserUrl"
Write-Host "Server PID: $($process.Id)"
Write-Host "Use the Exit Admin button in the app to stop the server."

if (-not $NoBrowser) {
  Start-Process $browserUrl | Out-Null
}
