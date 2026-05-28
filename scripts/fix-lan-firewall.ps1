<#
.SYNOPSIS
    Opens the Windows Firewall for Beauy Smash Flash LAN play.

.DESCRIPTION
    Hosting needs inbound UDP on the discovery port (5554) and game port (5555).
    Windows blocks inbound UDP on Public networks (school/managed Wi-Fi) by
    default, so the host never receives Join packets and clients see
    "Did not receive ID from host".

    This adds an all-profile inbound allow rule for those ports. Only the HOST
    needs to run this; pure joiners don't (their outbound traffic opens a return
    path automatically).

    The script self-elevates via UAC. Run it once per host machine.

.PARAMETER Remove
    Remove the firewall rule instead of adding it.
#>
[CmdletBinding()]
param(
    [switch]$Remove
)

$ruleName = 'Beauy Smash Flash LAN'

# Self-elevate if we're not already running as Administrator.
$identity = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $identity.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'Requesting administrator rights...' -ForegroundColor Yellow
    $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    if ($Remove) { $args += '-Remove' }
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $args
    return
}

# Always clear any existing rule first so the script is idempotent.
Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule -ErrorAction SilentlyContinue

if ($Remove) {
    Write-Host "Removed firewall rule '$ruleName'." -ForegroundColor Green
} else {
    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Inbound `
        -Action Allow `
        -Protocol UDP `
        -LocalPort 5554-5555 `
        -Profile Any | Out-Null
    Write-Host "Added firewall rule '$ruleName' (UDP 5554-5555, all profiles)." -ForegroundColor Green
    Write-Host 'You can now host Beauy Smash Flash on this network (including school Wi-Fi).'
}

Write-Host ''
Read-Host 'Press Enter to close'
