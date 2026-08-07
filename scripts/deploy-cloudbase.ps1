param(
  [switch]$Deploy
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot 'cloudbase.target.json'
$target = [IO.File]::ReadAllText($targetPath, [Text.Encoding]::UTF8) | ConvertFrom-Json

if ((git -C $projectRoot branch --show-current) -ne 'main') {
  throw 'Deployments are only allowed from main.'
}

git -C $projectRoot fetch origin | Out-Null
if ((git -C $projectRoot rev-parse HEAD) -ne (git -C $projectRoot rev-parse origin/main)) {
  throw 'Local main does not match origin/main.'
}

if (git -C $projectRoot status --porcelain --untracked-files=no) {
  throw 'Tracked files have uncommitted changes.'
}

$indexPath = Join-Path $projectRoot 'index.html'
$html = [IO.File]::ReadAllText($indexPath, [Text.Encoding]::UTF8)
$title = [regex]::Match($html, '<title>(.*?)</title>', 'IgnoreCase').Groups[1].Value
if ($title -ne $target.expectedTitle) {
  throw "Unexpected page title: $title"
}

$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$envDetail = tcb env detail --env-id $target.envId --json 2>&1 | Out-String
$envDetailExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorAction
if ($envDetailExitCode -ne 0 -or $envDetail -notmatch [regex]::Escape($target.envId)) {
  throw 'CloudBase environment check failed.'
}
if ($envDetail -notmatch [regex]::Escape($target.expectedDomain)) {
  throw 'CloudBase domain does not match the project configuration.'
}

Write-Host "Preflight passed: $title -> $($target.expectedDomain)"
if (-not $Deploy) {
  Write-Host 'Preflight only. Add -Deploy to publish.'
  exit 0
}

$stageRoot = Join-Path ([IO.Path]::GetTempPath()) ("smart-renew-deploy-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stageRoot | Out-Null
try {
  Copy-Item -LiteralPath $indexPath -Destination (Join-Path $stageRoot 'index.html')
  Copy-Item -LiteralPath (Join-Path $projectRoot 'assets') -Destination (Join-Path $stageRoot 'assets') -Recurse
  Get-ChildItem -LiteralPath $stageRoot -File -Recurse | ForEach-Object { $_.IsReadOnly = $false }
  tcb hosting deploy $stageRoot --env-id $target.envId --json
  if ($LASTEXITCODE -ne 0) { throw 'Index upload failed.' }
} finally {
  if (Test-Path -LiteralPath $stageRoot) {
    Remove-Item -LiteralPath $stageRoot -Recurse -Force
  }
}

$verifyUrl = "https://$($target.expectedDomain)/?verify=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$response = Invoke-WebRequest -Uri $verifyUrl -UseBasicParsing -TimeoutSec 30
$onlineTitle = [regex]::Match($response.Content, '<title>(.*?)</title>', 'IgnoreCase').Groups[1].Value
if ($onlineTitle -ne $target.expectedTitle) {
  throw "Unexpected online title: $onlineTitle"
}
Write-Host "Deployment completed: $verifyUrl"
