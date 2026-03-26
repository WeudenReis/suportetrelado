# Script PowerShell para instalar Node.js e rodar o projeto Suporte Trelado

# 1. Instalar Node.js via winget
Write-Host "Instalando Node.js..."
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --silent

# 2. Adicionar Node ao PATH do usuário
$nodePath = 'C:\Program Files\nodejs'
if ($env:Path -notlike "*${nodePath}*") {
    [Environment]::SetEnvironmentVariable('Path', $env:Path + ';' + $nodePath, 'User')
    $env:Path = $env:Path + ';' + $nodePath
}
Write-Host "Node.js adicionado ao PATH."

# 3. Ajustar ExecutionPolicy
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
Write-Host "ExecutionPolicy ajustado."

# 4. Navegar para o diretório do projeto
Set-Location -Path "C:\Users\Matheus\Desktop\suportetrelado"

# 5. Instalar dependências npm
Write-Host "Instalando dependências..."
& 'C:\Program Files\nodejs\npm.cmd' install

# 6. Renomear configs para .cjs (ESM compatibility)
if (Test-Path "postcss.config.js") {
    Move-Item -Path "postcss.config.js" -Destination "postcss.config.cjs" -Force
    Write-Host "PostCSS config renomeado para .cjs."
}
if (Test-Path "tailwind.config.js") {
    Move-Item -Path "tailwind.config.js" -Destination "tailwind.config.cjs" -Force
    Write-Host "Tailwind config renomeado para .cjs."
}

# 7. Rodar o servidor de desenvolvimento
Write-Host "Iniciando servidor Vite..."
& 'C:\Program Files\nodejs\node.exe' node_modules/vite/bin/vite.js --host