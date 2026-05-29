$ErrorActionPreference = 'Stop'
$keyPath = Join-Path $env:USERPROFILE '.tauri\beauy-smash-flash.key'
if (-not (Test-Path $keyPath)) {
    Write-Error "Missing signing key at $keyPath"
}
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $keyPath -Raw
Set-Location (Join-Path $PSScriptRoot '..')
bun run tauri:build
