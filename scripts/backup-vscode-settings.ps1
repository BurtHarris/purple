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

# Export extensions if code CLI exists
if (Get-Command code -ErrorAction SilentlyContinue) {
  & code --list-extensions > (Join-Path $dest 'extensions.txt')
  Write-Output 'Exported extensions to extensions.txt'
} else {
  Write-Output 'VS Code CLI (code) not found on PATH; skipped extensions export'
}

# Git add & commit if repo is a git repo. Skip commit when -NoCommit is used.
if (Test-Path (Join-Path $repo '.git')) {
  git add $dest
  if (-not $NoCommit) {
    $msg = "chore: add user vscode settings backup $now"
    git commit -m $msg
    Write-Output 'Backup committed to git.'
  } else {
    Write-Output 'NoCommit flag set; skipped git commit.'
  }
} else {
  Write-Output '.git not found; skipped git commit.'
}

Write-Output 'Backup script finished.'
