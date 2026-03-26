# Script rápido para instalar dependências e rodar Vite
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
Set-Location "C:\Users\Matheus\Desktop\suportetrelado"

Write-Host "Instalando todas as dependências..." -ForegroundColor Cyan
& 'C:\Program Files\nodejs\npm.cmd' install --legacy-peer-deps

Write-Host "Dependências instaladas. Iniciando servidor..." -ForegroundColor Green
& 'C:\Program Files\nodejs\npm.cmd' run dev -- --host
