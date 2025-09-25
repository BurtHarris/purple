Set-StrictMode -Off

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (Get-Item $scriptDir).Parent.FullName
$logDir = Join-Path $root '.vscode-debug-logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("backup-trace-" + (Get-Date).ToString('yyyyMMdd-HHmmss') + '.log')

Write-Output "Starting transcript -> $logFile"
Start-Transcript -Path $logFile -Force

Write-Output 'Running backup script (no commit)'
try {
  $backupScript = Join-Path $root 'scripts\backup-vscode-settings.ps1'
  & pwsh -NoProfile -File $backupScript -NoCommit -ErrorAction Stop
} catch {
  Write-Output "Backup script failed: $_"
}

Write-Output 'Running sanitize script'
try {
  $sanitizeScript = Join-Path $root 'scripts\sanitize-vscode-backups.ps1'
  & pwsh -NoProfile -File $sanitizeScript -ErrorAction Stop
} catch {
  Write-Output "Sanitize script failed: $_"
}

Stop-Transcript
Write-Output "Transcript saved to: $logFile"
