Set-StrictMode -Off

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (Get-Item $scriptDir).Parent.FullName
$logDir = Join-Path $root '.vscode-debug-logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("backup-trace-" + (Get-Date).ToString('yyyyMMdd-HHmmss') + '.log')

Write-Output "Starting transcript -> $logFile"
Start-Transcript -Path $logFile -Force

# Retry helper for transient failures (exponential backoff with jitter)
function Invoke-WithRetry {
  param(
    [Parameter(Mandatory=$true)] [ScriptBlock] $ScriptBlock,
    [int] $MaxAttempts = 5,
    [int] $InitialDelaySec = 2,
    [double] $Factor = 2.0
  )
  $attempt = 1
  while ($true) {
    try {
      return & $ScriptBlock
    } catch {
      $err = $_
      if ($attempt -ge $MaxAttempts) {
        Write-Output "Attempt $attempt failed and reached max attempts. Throwing error."
        throw $err
      }
      $delay = $InitialDelaySec * [math]::Pow($Factor, $attempt - 1)
      $jitter = (Get-Random -Minimum 0 -Maximum ([math]::Max(0.5, $delay * 0.2)))
      $wait = [int]([math]::Round($delay + $jitter))
      Write-Output "Attempt $attempt failed: $($err.Exception.Message). Retrying in ${wait}s..."
      Start-Sleep -Seconds $wait
      $attempt++
    }
  }
}

Write-Output 'Running backup script (no commit)'
try {
  $backupScript = Join-Path $root 'scripts\backup-vscode-settings.ps1'
  Invoke-WithRetry -ScriptBlock { & pwsh -NoProfile -File $backupScript -NoCommit -ErrorAction Stop }
} catch {
  Write-Output "Backup script failed: $_"
}

Write-Output 'Running sanitize script'
try {
  $sanitizeScript = Join-Path $root 'scripts\sanitize-vscode-backups.ps1'
  Invoke-WithRetry -ScriptBlock { & pwsh -NoProfile -File $sanitizeScript -ErrorAction Stop }
} catch {
  Write-Output "Sanitize script failed: $_"
}

Stop-Transcript
Write-Output "Transcript saved to: $logFile"
