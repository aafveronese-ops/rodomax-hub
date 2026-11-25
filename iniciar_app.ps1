# Inicia a aplicação web do Rodomax HUB no Windows (PowerShell).
# Pré-requisito: Node.js 18+ (https://nodejs.org). Não mexe nos containers existentes.
Set-Location -Path (Join-Path $PSScriptRoot "app")
if (-not (Test-Path "..\.env")) { Copy-Item "..\.env.example" "..\.env"; Write-Host "Criado .env a partir do .env.example" }
if (-not (Test-Path "node_modules")) { npm install }
Write-Host "Abrindo http://localhost:3000 ..."
npm start
