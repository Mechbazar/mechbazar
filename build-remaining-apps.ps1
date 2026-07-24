Write-Host "========================================="
Write-Host " Building Remaining MechBazar Apps"
Write-Host "========================================="
 
$apps = @(
    "seller-mobile",
    "mechanic",
    "rider",
    "delivery",
    "admin-mobile"
)
 
foreach ($app in $apps) {
    Write-Host "Starting build for $app..."
    Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$PSScriptRoot\apps\$app'; eas build -p android --profile production"
}
 
Write-Host "All builds submitted."