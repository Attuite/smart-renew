param([int]$Port = 4173)

$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $connections) {
  Write-Host "No Smart Renew LAN proxy is listening on port $Port."
  exit 0
}
$connections | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
  $process = Get-Process -Id $_ -ErrorAction SilentlyContinue
  if ($process -and $process.ProcessName -eq 'node') {
    Stop-Process -Id $_
    Write-Host "Stopped Smart Renew LAN proxy process $_."
  } else {
    throw "Port $Port is owned by a non-Node process and was not stopped."
  }
}
