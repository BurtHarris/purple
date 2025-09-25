# Remove workbench/editor color customizations from local VS Code user settings
# Creates timestamped .bak copies before editing.

Set-StrictMode -Off
$ErrorActionPreference = 'Stop'

$now = (Get-Date).ToString('yyyyMMdd-HHmmss')
$app = $env:APPDATA
$targets = @(
  (Join-Path $app 'Code\User\settings.json'),
  (Join-Path $app 'Code - Insiders\User\settings.json')
)

foreach ($f in $targets) {
  if (-not (Test-Path $f)) {
    Write-Output ("Not found: {0}" -f $f)
    continue
  }

  $bak = "$f.$now.bak"
  try {
    Copy-Item -Path $f -Destination $bak -Force
    Write-Output ("Backed up {0} -> {1}" -f $f, $bak)
  } catch {
    Write-Output ("Could not back up {0}: {1}" -f $f, $_.Exception.Message)
    continue
  }

  try {
    $raw = Get-Content -Raw -LiteralPath $f -ErrorAction Stop
  } catch {
    Write-Output ("  Could not read {0}: {1}" -f $f, $_.Exception.Message)
    continue
  }

  try {
    if ($raw.Trim().Length -eq 0) {
      $json = [PSCustomObject]@{}
    } else {
      $json = $raw | ConvertFrom-Json -ErrorAction Stop
    }
  } catch {
    Write-Output ("  Could not parse JSON in {0}: {1}" -f $f, $_.Exception.Message)
    continue
  }

  $removed = @()
  if ($json.PSObject.Properties.Name -contains 'workbench.colorCustomizations') {
    $json.PSObject.Properties.Remove('workbench.colorCustomizations')
    $removed += 'workbench.colorCustomizations'
  }
  if ($json.PSObject.Properties.Name -contains 'editor.tokenColorCustomizations') {
    $json.PSObject.Properties.Remove('editor.tokenColorCustomizations')
    $removed += 'editor.tokenColorCustomizations'
  }

  if ($removed.Count -gt 0) {
    try {
      $json | ConvertTo-Json -Depth 99 | Out-File -FilePath $f -Encoding utf8
      Write-Output ("Removed keys from {0}: {1}" -f $f, ($removed -join ', '))
    } catch {
      Write-Output ("  Could not write modified JSON to {0}: {1}" -f $f, $_.Exception.Message)
      # Attempt to restore from backup
      try { Copy-Item -Path $bak -Destination $f -Force } catch {}
    }
  } else {
    Write-Output "No color keys found in $f"
  }
}
