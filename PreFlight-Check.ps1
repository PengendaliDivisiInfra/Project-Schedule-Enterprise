function Start-InfraControlDev {
    Set-Location "D:\Project Schedule\promanage-construction"
    Write-Host "Navigasi ke InfraControl PRO berhasil. Menjalankan server..." -ForegroundColor Green
    npm run dev
}