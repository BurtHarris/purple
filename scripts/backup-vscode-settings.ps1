param(
  [switch]$NoCommit
)

# Fail fast on any error
$ErrorActionPreference = 'Stop'
Set-StrictMode -Off

# Determine repo root (parent of the scripts folder) so backups live in the repo root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Get-Item $scriptDir).Parent.FullName

$now = (Get-Date).ToString('yyyyMMdd-HHmmss')
$dest = Join-Path $repo ('.vscode-user-settings\' + $now)
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Write-Output "Created backup dir: $dest"

$appData = $env:APPDATA

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
      # add small jitter up to 20% of delay
      $jitter = (Get-Random -Minimum 0 -Maximum ([math]::Max(0.5, $delay * 0.2)))
      $wait = [int]([math]::Round($delay + $jitter))
      Write-Output "Attempt $attempt failed: $($err.Exception.Message). Retrying in ${wait}s..."
      Start-Sleep -Seconds $wait
      $attempt++
    }
  }
}

# Determine repo root (parent of the scripts folder)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Get-Item $scriptDir).Parent.FullName

$now = (Get-Date).ToString('yyyyMMdd-HHmmss')
$dest = Join-Path $repo ('.vscode-user-settings\' + $now)
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Write-Output "Created backup dir: $dest"

$appData = $env:APPDATA
# Build relative paths and map to absolute paths safely
$relPaths = @(
  'Code\User\settings.json',
  'Code\User\keybindings.json',
  'Code - Insiders\User\settings.json',
  'Code - Insiders\User\keybindings.json'
)

$paths = $relPaths | ForEach-Object { Join-Path $appData $_ }

foreach ($p in $paths) {
  if (Test-Path $p) {
    $leaf = Split-Path $p -Leaf
    $target = Join-Path $dest $leaf
    Copy-Item -Path $p -Destination $target -Force
    Write-Output "Copied: $p -> $target"
  } else {
    Write-Output "Not found: $p"
  }
}

# Export extensions if code CLI exists (retry on transient failures)
if (Get-Command code -ErrorAction SilentlyContinue) {
  Invoke-WithRetry -ScriptBlock { & code --list-extensions > (Join-Path $dest 'extensions.txt') }
  Write-Output 'Exported extensions to extensions.txt'
} else {
  Write-Output 'VS Code CLI (code) not found on PATH; skipped extensions export'
}

# Git add & commit if repo is a git repo. Skip commit when -NoCommit is used.
if (Test-Path (Join-Path $repo '.git')) {
  Invoke-WithRetry -ScriptBlock { git add $dest }
  if (-not $NoCommit) {
    $msg = "chore: add user vscode settings backup $now"
    Invoke-WithRetry -ScriptBlock { git commit -m $msg }
    Write-Output 'Backup committed to git.'
  } else {
    Write-Output 'NoCommit flag set; skipped git commit.'
  }
} else {
  Write-Output '.git not found; skipped git commit.'
}

Write-Output 'Backup script finished.'
