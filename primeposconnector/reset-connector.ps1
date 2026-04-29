# PrimePOS Connector Reset Script
# Run this on any PC before re-pairing the connector

Write-Host "Resetting PrimePOS Connector identity..." -ForegroundColor Cyan

$keyFile = "$env:USERPROFILE\.primepos\connector_key.dat"
$deviceFile = "$env:USERPROFILE\.primepos\connector_device_id.dat"

if (Test-Path $keyFile) {
    Remove-Item $keyFile -Force
    Write-Host "Deleted: $keyFile" -ForegroundColor Green
} else {
    Write-Host "Not found (skipped): $keyFile" -ForegroundColor Yellow
}

if (Test-Path $deviceFile) {
    Remove-Item $deviceFile -Force
    Write-Host "Deleted: $deviceFile" -ForegroundColor Green
} else {
    Write-Host "Not found (skipped): $deviceFile" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Now restart primeposconnector.exe and re-pair from POS Settings." -ForegroundColor Cyan
