# Fail fast on any error
$ErrorActionPreference = 'Stop'
Set-StrictMode -Off

# Determine repo root (parent of the scripts folder)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Get-Item $scriptDir).Parent.FullName

$searchRoot = Join-Path $repo '.vscode-user-settings'
if (-not (Test-Path $searchRoot)) {
  Write-Output "No .vscode-user-settings folder found at $searchRoot"
  exit 0
}

$files = Get-ChildItem -Path $searchRoot -Recurse -Filter 'settings.json' -ErrorAction SilentlyContinue
if (-not $files) {
  Write-Output 'No settings.json files found to sanitize.'
  exit 0
}

function RedactLine($line) {
  $sensitiveKeyPattern = '(?i)"([^"]*(token|secret|password|accessKey|secretKey|credentials|pat|auth|aws|apikey)[^"]*)"\s*:\s*"([^"]*)"'
  if ($line -match $sensitiveKeyPattern) {
    return ($line -replace $sensitiveKeyPattern, '"$1": "<REDACTED>"')
  }
  if ($line -match 'ghp_[A-Za-z0-9_\-]{36,}') { return ($line -replace 'ghp_[A-Za-z0-9_\-]{36,}', '<REDACTED>') }
  if ($line -match '\bAKIA[0-9A-Z]{16}\b') { return ($line -replace '\bAKIA[0-9A-Z]{16}\b', '<REDACTED>') }
  if ($line -match '"[^"]+"\s*:\s*"([^"]{100,})"') { return ($line -replace '"([^"]+)"\s*:\s*"([^"]{100,})"', '"$1": "<REDACTED>"') }
  return $line
}

$sanitized = @()
foreach ($f in $files) {
  Write-Output "Sanitizing: $($f.FullName)"
  try {
    $content = Get-Content -Raw -LiteralPath $f.FullName -ErrorAction Stop -Encoding UTF8
  } catch {
    Write-Output "  Could not read file: $($f.FullName)"
    continue
  }
  $linesArray = $content -split "`n"
  $out = @()
  foreach ($line in $linesArray) {
    $trimmed = $line.TrimEnd("`r")
    $new = RedactLine $trimmed
    $out += $new
  }
  $sanitizedPath = Join-Path $f.DirectoryName 'settings.sanitized.json'
  $out -join "`n" | Out-File -FilePath $sanitizedPath -Encoding utf8
  Write-Output "  Wrote sanitized file: $sanitizedPath"
  $sanitized += $sanitizedPath
}

Write-Output 'Sanitization complete.'
Write-Output 'Sanitized files:'
$sanitized | ForEach-Object { Write-Output "  $_" }
