param(
  [int]$Port = 4173,
  [string]$SecretScriptPath = 'D:\WeChat Files\xwechat_files\wxid_nx491mkybq3l22_6563\msg\file\2026-08\image_test.py',
  [switch]$UseCloudBaseApi,
  [switch]$Lan
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$target = [IO.File]::ReadAllText((Join-Path $projectRoot 'cloudbase.target.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
if ($target.envId -ne 'smart-renew-d2gamusvr1b96ce95') {
  throw 'The project is not locked to the Smart Renew CloudBase environment.'
}
if (-not (Test-Path -LiteralPath $SecretScriptPath)) {
  throw "Group vision test script not found: $SecretScriptPath"
}

$source = [IO.File]::ReadAllText($SecretScriptPath, [Text.Encoding]::UTF8)
$match = [regex]::Match($source, 'API_KEY\s*=\s*"([^"]+)"')
if (-not $match.Success) {
  throw 'Unable to read the group vision API key from the test script.'
}

$lanAddress = '127.0.0.1'
$env:HOST = '127.0.0.1'
if ($Lan) {
  $lanAddress = Get-NetIPConfiguration |
    Where-Object { $_.IPv4Address -and $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
    ForEach-Object { $_.IPv4Address.IPAddress } |
    Select-Object -First 1
  if (-not $lanAddress) {
    throw 'No usable LAN IPv4 address was found.'
  }
  $env:HOST = '0.0.0.0'
}
$env:PORT = [string]$Port
$env:GROUP_VISION_API_KEY = $match.Groups[1].Value
$env:GROUP_VISION_BASE_URL = 'https://jcpt.cscec.com/aijsxmywyapi/0510220001/v1.0/qwen3_vl_plus_public'
$env:GROUP_VISION_MODEL = 'qwen3-vl-plus'
if ($UseCloudBaseApi) {
  $env:SMART_RENEW_USE_CLOUDBASE_API = 'true'
  $env:CLOUDBASE_API_ORIGIN = 'https://smart-renew-d2gamusvr1b96ce95.service.tcloudbase.com'
} else {
  Remove-Item Env:\SMART_RENEW_USE_CLOUDBASE_API -ErrorAction SilentlyContinue
  Remove-Item Env:\CLOUDBASE_API_ORIGIN -ErrorAction SilentlyContinue
}
$env:NO_PROXY = (($env:NO_PROXY -split ',' | Where-Object { $_ }) + @('jcpt.cscec.com', '10.240.254.135', '127.0.0.1', 'localhost') | Select-Object -Unique) -join ','

Write-Host "Smart Renew proxy: http://$lanAddress`:$Port"
if ($UseCloudBaseApi) {
  Write-Host 'Group vision uses the local intranet; other APIs use Smart Renew CloudBase.'
} else {
  Write-Host 'Local test mode: group vision uses the local intranet; project and photo APIs use local storage.'
}
Push-Location $projectRoot
try {
  node server.mjs
} finally {
  Pop-Location
  Remove-Item Env:\GROUP_VISION_API_KEY,Env:\GROUP_VISION_BASE_URL,Env:\GROUP_VISION_MODEL -ErrorAction SilentlyContinue
}
