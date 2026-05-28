$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot
$exe = Join-Path $root "src-tauri\target\release\beauy-smash-flash.exe"

Write-Host "Building Beauy Smash Flash..." -ForegroundColor Cyan
Set-Location $root

if (-not (Test-Path "node_modules")) {
    bun install
}

bun run tauri build

Write-Host "Launching Beauy Smash Flash x2..." -ForegroundColor Green
Start-Process $exe
Start-Sleep -Milliseconds 800
Start-Process $exe
