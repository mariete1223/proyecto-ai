# ============================================================
#  start.ps1 - Arranca backend + tunel Cloudflare automaticamente
#  Uso: .\start.ps1
#  Despues: abre otra terminal -> cd frontend && npx expo start --lan
# ============================================================

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host ""
Write-Host "=== Proyecto AI - Arranque ===" -ForegroundColor Cyan
Write-Host ""

# 1. Matar procesos anteriores en puerto 8000
Write-Host "Limpiando procesos anteriores en :8000..." -ForegroundColor Yellow
$portPids = netstat -ano 2>$null | Select-String ":8000 " | ForEach-Object {
    ($_ -split "\s+")[-1]
} | Sort-Object -Unique
foreach ($p in $portPids) {
    if ($p -match "^\d+$" -and $p -ne "0") {
        try { Stop-Process -Id ([int]$p) -Force -ErrorAction SilentlyContinue } catch {}
    }
}
Start-Sleep -Seconds 1

# 2. Arrancar el backend FastAPI en ventana nueva
Write-Host "Arrancando backend FastAPI (puerto 8000)..." -ForegroundColor Yellow
$backendCmd = "cd '$root\backend'; uv run python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
$backendProcess = Start-Process -FilePath "powershell" `
    -ArgumentList "-NoProfile", "-Command", $backendCmd `
    -PassThru `
    -WindowStyle Normal

# Esperar a que el backend responda en localhost:8000/health
Write-Host "   Esperando que el backend responda en :8000..." -ForegroundColor DarkGray
$backendReady = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) {
            $backendReady = $true
            break
        }
    } catch {}
}
if ($backendReady) {
    Write-Host "   Backend listo y respondiendo." -ForegroundColor Green
} else {
    Write-Host "   Aviso: backend no respondio en 15s, continuando de todos modos..." -ForegroundColor Yellow
}

# 3. Arrancar el tunel Ngrok con dominio permanente
Write-Host "Arrancando tunel Ngrok con dominio permanente..." -ForegroundColor Yellow
$permanentDomain = "raging-degraded-reptile.ngrok-free.dev"
$tunnelUrl = "https://$permanentDomain"

$tunnelProcess = Start-Process -FilePath "npx.cmd" `
    -ArgumentList "--yes", "ngrok", "http", "8000", "--url", $permanentDomain `
    -WorkingDirectory $root `
    -PassThru `
    -WindowStyle Hidden

Write-Host "Tunel Ngrok permanente activo: $tunnelUrl" -ForegroundColor Green
Write-Host ""

# 4. Escribir .env.local para Expo (leido por Metro en arranque)
$envFile = Join-Path $root "frontend\.env.local"
"# Generado automaticamente por start.ps1 - no editar a mano`nEXPO_PUBLIC_BACKEND_URL=$tunnelUrl" | Set-Content -Path $envFile -Encoding UTF8
Write-Host "  .env.local actualizado con URL del tunel" -ForegroundColor DarkGray

# 5. Actualizar app.json extra.backendUrl
$appJsonPath = Join-Path $root "frontend\app.json"
$appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
$appJson.expo.extra.backendUrl = $tunnelUrl
$appJson | ConvertTo-Json -Depth 10 | Set-Content -Path $appJsonPath -Encoding UTF8
Write-Host "  app.json actualizado con URL del tunel" -ForegroundColor DarkGray

# 6. Resumen final
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Backend: http://localhost:8000" -ForegroundColor Green
Write-Host "  Tunel:   $tunnelUrl" -ForegroundColor Green
Write-Host ""
Write-Host "  Ahora en OTRA terminal ejecuta:" -ForegroundColor White
Write-Host "    cd frontend" -ForegroundColor Cyan
Write-Host "    npx expo start --lan" -ForegroundColor Cyan
Write-Host ""
Write-Host "  El iPhone usara el tunel automaticamente." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona Ctrl+C para parar todo." -ForegroundColor DarkGray

# Mantener vivo el script (Ctrl+C lo para todo)
try {
    while ($true) { Start-Sleep -Seconds 60 }
} finally {
    Write-Host ""
    Write-Host "Parando procesos..." -ForegroundColor Yellow
    if ($tunnelProcess -and -not $tunnelProcess.HasExited) {
        Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Listo." -ForegroundColor Green
}
