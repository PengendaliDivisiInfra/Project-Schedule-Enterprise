# ============================================================================
# Project Schedule Enterprise — Local Pre-Flight Verification (PowerShell 5.1)
# Memeriksa UTF-8 BOM, TypeScript, Unit Tests (Jest), dan Production Build
# sebelum commit/push ke GitHub. Tidak melakukan auto-commit atau auto-push.
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "`n[1/4] Memeriksa kebersihan encoding UTF-8 (Tanpa BOM)..." -ForegroundColor Cyan
$sourceDirs = @("app", "components", "lib", "types", "context")
$bomFiles = @()

foreach ($dir in $sourceDirs) {
  if (Test-Path $dir) {
    Get-ChildItem -Path $dir -Recurse -Include *.ts,*.tsx,*.js,*.jsx | ForEach-Object {
      $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
      if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $bomFiles += $_.FullName
      }
    }
  }
}

if ($bomFiles.Count -gt 0) {
  Write-Host "PERINGATAN: Ditemukan file dengan UTF-8 BOM:" -ForegroundColor Red
  $bomFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  exit 1
}
Write-Host "OK: Tidak ada file sumber yang mengandung UTF-8 BOM." -ForegroundColor Green

Write-Host "`n[2/4] Menjalankan TypeScript Type Check (npx tsc --noEmit)..." -ForegroundColor Cyan
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "OK: TypeScript lulus tanpa error." -ForegroundColor Green

Write-Host "`n[3/4] Menjalankan Jest Unit Tests (npm test -- --ci)..." -ForegroundColor Cyan
npm test -- --ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "OK: Seluruh Jest Test Suites lulus." -ForegroundColor Green

Write-Host "`n[4/4] Menjalankan Next.js Production Build (npm run build)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "OK: Production Build sukses!" -ForegroundColor Green

Write-Host "`n=== Ringkasan Git Status ===" -ForegroundColor Yellow
git status -s
Write-Host "`nPre-Flight Check SELESAI. Siap untuk git add / commit / push." -ForegroundColor Green
