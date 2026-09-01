$ErrorActionPreference = 'Stop'
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$startScript = Join-Path $PSScriptRoot 'start-lan-proxy.ps1'
$userId = "$env:USERDOMAIN\$env:USERNAME"

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument ("-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`" -Lan -UseCloudBaseApi")
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$principal = New-ScheduledTaskPrincipal `
  -UserId $userId `
  -LogonType Interactive `
  -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -MultipleInstances IgnoreNew `
  -RestartCount 10 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

Register-ScheduledTask `
  -TaskName 'SmartRenewLanProxy' `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Smart Renew group vision LAN proxy' `
  -Force | Out-Null

$task = Get-ScheduledTask -TaskName 'SmartRenewLanProxy'
Write-Host "Task registered: $($task.TaskName)"
Write-Host "State: $($task.State)"
$Host.UI.RawUI.WindowTitle = 'SmartRenewTaskReady'
