# Build the app and take a headless Edge screenshot of the production preview.
# Usage: ./scripts/screenshot.ps1 [-Query "mod=qpsk&ebn0=8&theme=light&sweep=1"] [-Out shot.png] [-NoBuild]
# Requires `npx vite preview --port 4173` running (the script starts it if the port is closed).
param(
  [string]$Query = "",
  [string]$Out = "$env:TEMP\signalforge-shot.png",
  [int]$Width = 1600,
  [int]$Height = 1250,
  [int]$WaitMs = 5000,
  [switch]$NoBuild
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $NoBuild) { npm run build | Out-Null }

$open = Test-NetConnection -ComputerName localhost -Port 4173 -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $open) {
  Start-Process -FilePath "npx.cmd" -ArgumentList "vite","preview","--port","4173","--strictPort" -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Seconds 3
}

$edge = @("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", "C:\Program Files\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Microsoft Edge not found" }

$url = "http://localhost:4173/signalforge/"
if ($Query) { $url = "$url`?$Query" }
$profile = Join-Path $env:TEMP "signalforge-edge-profile"

Start-Process -FilePath $edge -Wait -ArgumentList @(
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--user-data-dir=`"$profile`"", "--window-size=$Width,$Height",
  "--virtual-time-budget=$WaitMs", "--screenshot=`"$Out`"", "`"$url`""
)
Write-Output $Out
