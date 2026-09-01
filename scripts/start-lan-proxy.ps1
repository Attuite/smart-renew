param(
  [int]$Port = 4173,
  [string]$SecretScriptPath = 'D:\WeChat Files\xwechat_files\wxid_nx491mkybq3l22_6563\msg\file\2026-08\image_test.py',
  [string]$RelaySecretPath = '',
  [switch]$UseCloudBaseApi,
  [switch]$Lan
)

$ErrorActionPreference = 'Stop'
$runtimeDir = Join-Path $env:LOCALAPPDATA 'SmartRenew'
$runtimeLog = Join-Path $runtimeDir 'lan-proxy-task.log'
$runtimeOutLog = Join-Path $runtimeDir 'lan-proxy-stdout.log'
$runtimeErrorLog = Join-Path $runtimeDir 'lan-proxy-stderr.log'
if (-not (Test-Path -LiteralPath $runtimeDir)) {
  New-Item -ItemType Directory -Path $runtimeDir | Out-Null
}
trap {
  ("{0:o} {1}" -f [DateTime]::Now, $_.Exception.Message) | Out-File -LiteralPath $runtimeLog -Encoding utf8 -Append
  exit 1
}
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $RelaySecretPath) {
  $RelaySecretPath = Join-Path $projectRoot '.smart-renew-data\group-relay-secret.txt'
}
$target = [IO.File]::ReadAllText((Join-Path $projectRoot 'cloudbase.target.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
if ($target.envId -ne 'smart-renew-d2gamusvr1b96ce95') {
  throw 'The project is not locked to the Smart Renew CloudBase environment.'
}
if (-not (Test-Path -LiteralPath $SecretScriptPath)) {
  throw "Group vision test script not found: $SecretScriptPath"
}
if (-not (Test-Path -LiteralPath $RelaySecretPath)) {
  throw "Group relay secret not found: $RelaySecretPath"
}

$source = [IO.File]::ReadAllText($SecretScriptPath, [Text.Encoding]::UTF8)
$match = [regex]::Match($source, 'API_KEY\s*=\s*"([^"]+)"')
if (-not $match.Success) {
  throw 'Unable to read the group vision API key from the test script.'
}

$lanAddress = '127.0.0.1'
$env:HOST = '127.0.0.1'
Remove-Item Env:\SMART_RENEW_TRUSTED_LAN_PREFIX -ErrorAction SilentlyContinue
if ($Lan) {
  $candidateAddresses = [Net.Dns]::GetHostAddresses([Net.Dns]::GetHostName()) |
    Where-Object { $_.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork } |
    ForEach-Object { $_.IPAddressToString } |
    Where-Object { $_ -notmatch '^127\.' }
  $lanAddress = $candidateAddresses | Where-Object { $_ -like '172.16.71.*' } | Select-Object -First 1
  if (-not $lanAddress) {
    $lanAddress = $candidateAddresses | Where-Object { $_ -match '^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)' } | Select-Object -First 1
  }
  if (-not $lanAddress) {
    throw 'No usable LAN IPv4 address was found.'
  }
  $env:HOST = $lanAddress
  $lanOctets = $lanAddress -split '\.'
  if ($lanOctets.Count -ne 4) {
    throw 'The detected LAN address is not a valid IPv4 address.'
  }
  $env:SMART_RENEW_TRUSTED_LAN_PREFIX = "$($lanOctets[0]).$($lanOctets[1]).$($lanOctets[2])."
}
$env:PORT = [string]$Port
$env:GROUP_VISION_API_KEY = $match.Groups[1].Value
$env:GROUP_VISION_BASE_URL = 'https://jcpt.cscec.com/aijsxmywyapi/0510220001/v1.0/qwen3_vl_plus_public'
$env:GROUP_VISION_MODEL = 'qwen3-vl-plus'
$env:GROUP_RELAY_SECRET = ([IO.File]::ReadAllText($RelaySecretPath, [Text.Encoding]::UTF8)).Trim()
if (-not $env:GROUP_RELAY_SECRET) {
  throw 'The group relay secret is empty.'
}
if ($UseCloudBaseApi) {
  $env:SMART_RENEW_USE_CLOUDBASE_API = 'true'
  $env:CLOUDBASE_API_ORIGIN = 'https://smart-renew-d2gamusvr1b96ce95.service.tcloudbase.com'
} else {
  Remove-Item Env:\SMART_RENEW_USE_CLOUDBASE_API -ErrorAction SilentlyContinue
  Remove-Item Env:\CLOUDBASE_API_ORIGIN -ErrorAction SilentlyContinue
}
$env:NO_PROXY = (($env:NO_PROXY -split ',' | Where-Object { $_ }) + @('jcpt.cscec.com', '10.240.254.135', '127.0.0.1', 'localhost') | Select-Object -Unique) -join ','

Write-Host "Smart Renew proxy: http://$lanAddress`:$Port"
("{0:o} starting http://{1}:{2}" -f [DateTime]::Now, $lanAddress, $Port) | Out-File -LiteralPath $runtimeLog -Encoding utf8 -Append
if ($UseCloudBaseApi) {
  Write-Host 'Group vision uses the local intranet; other APIs use Smart Renew CloudBase.'
} else {
  Write-Host 'Local test mode: group vision uses the local intranet; project and photo APIs use local storage.'
}
Push-Location $projectRoot
try {
  $nodeProcess = Start-Process `
    -FilePath 'node.exe' `
    -ArgumentList 'server.mjs' `
    -WorkingDirectory $projectRoot `
    -NoNewWindow `
    -RedirectStandardOutput $runtimeOutLog `
    -RedirectStandardError $runtimeErrorLog `
    -PassThru `
    -Wait
  if ($nodeProcess.ExitCode -ne 0) {
    throw "Smart Renew Node proxy exited with code $($nodeProcess.ExitCode). See $runtimeErrorLog"
  }
} finally {
  Pop-Location
  Remove-Item Env:\GROUP_VISION_API_KEY,Env:\GROUP_VISION_BASE_URL,Env:\GROUP_VISION_MODEL,Env:\GROUP_RELAY_SECRET,Env:\SMART_RENEW_TRUSTED_LAN_PREFIX -ErrorAction SilentlyContinue
}
