$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$relayFile = Join-Path $env:LOCALAPPDATA 'SmartRenew\group-relay-secret.txt'
$ruleName = 'Smart Renew LAN Proxy 4173'
$taskName = 'SmartRenewLanProxy'
$lanAddress = '172.16.71.17'
$lanSubnet = '172.16.71.0/24'

if (-not (Test-Path -LiteralPath $relayFile)) {
  throw "Group relay secret not found: $relayFile"
}

$acl = New-Object Security.AccessControl.FileSecurity
$userAccount = [Security.Principal.NTAccount]::new("$env:USERDOMAIN\$env:USERNAME")
$systemAccount = [Security.Principal.NTAccount]::new('NT AUTHORITY\SYSTEM')
$administrators = [Security.Principal.NTAccount]::new('BUILTIN\Administrators')
$acl.SetOwner($userAccount)
$acl.SetAccessRuleProtection($true, $false)
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($userAccount, 'FullControl', 'Allow'))
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($systemAccount, 'FullControl', 'Allow'))
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($administrators, 'FullControl', 'Allow'))
Set-Acl -LiteralPath $relayFile -AclObject $acl

Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule `
  -DisplayName $ruleName `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 4173 `
  -LocalAddress $lanAddress `
  -RemoteAddress $lanSubnet `
  -Profile Domain,Private | Out-Null

Push-Location $projectRoot
try {
  & (Join-Path $PSScriptRoot 'register-lan-proxy-task.ps1')
  Start-ScheduledTask -TaskName $taskName
} finally {
  Pop-Location
}

Write-Host 'Smart Renew LAN proxy system configuration completed.'
