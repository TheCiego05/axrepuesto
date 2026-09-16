# ============================================================
# deploy_to_github.ps1 — Sube/actualiza llave10 en GitHub
# Repo: https://github.com/TheCiego05/axrepuesto
#
# Qué hace:
#   1. Conecta esta carpeta al repo remoto (si aún no está conectada)
#   2. Trae el historial existente del repo (main)
#   3. Aplica tus archivos locales actuales sobre ese historial
#   4. Elimina 2 archivos viejos que ya no se usan (styles.css raíz, css/extra.css)
#   5. Muestra los cambios antes de confirmar
#   6. Commit + push a main (push normal, sin --force)
#
# Uso: abre PowerShell en esta carpeta y ejecuta:
#   .\deploy_to_github.ps1
# ============================================================

$ErrorActionPreference = "Stop"
# PowerShell 7.3+ convierte cualquier salida por stderr de git en error terminante;
# lo desactivamos porque git usa stderr para mensajes normales (progreso, avisos).
$PSNativeCommandUseErrorActionPreference = $false
$repoUrl = "https://github.com/TheCiego05/axrepuesto.git"

Write-Host "== Llave10 -> GitHub ==" -ForegroundColor Cyan

# 1. Inicializar repo si hace falta
if (-not (Test-Path ".git")) {
    Write-Host "Inicializando repositorio git..." -ForegroundColor Yellow
    git init
}

# 2. Conectar remoto si hace falta
$remotes = git remote 2>$null
if ($remotes -notcontains "origin") {
    git remote add origin $repoUrl
    Write-Host "Remoto 'origin' agregado: $repoUrl" -ForegroundColor Yellow
} else {
    Write-Host "Remoto 'origin' ya existe." -ForegroundColor Gray
}

# 3. Traer historial remoto
Write-Host "Descargando historial de GitHub..." -ForegroundColor Yellow
git fetch origin

# 4. Enlazar la rama local 'main' con el historial remoto SIN tocar tus archivos
#    (usamos symbolic-ref + reset en vez de checkout, porque checkout falla si ya
#    tienes archivos locales con el mismo nombre que los del remoto)
if (-not (Test-Path ".git\refs\heads\main")) {
    Write-Host "Enlazando rama 'main' con el historial remoto..." -ForegroundColor Yellow
    git symbolic-ref HEAD refs/heads/main
    git reset origin/main
} else {
    git checkout main
}

# 5. Limpiar archivos obsoletos / restos sueltos que ya no usa index.html
$obsoletos = @("styles.css", "css/extra.css", "config.js", "ordenes.js")
foreach ($f in $obsoletos) {
    if (Test-Path $f) {
        git rm --cached --ignore-unmatch $f | Out-Null
        Remove-Item $f -Force
        Write-Host "Eliminado archivo obsoleto: $f" -ForegroundColor DarkYellow
    }
}

# 6. Agregar todos los cambios actuales
git add -A

# 7. Mostrar qué se va a subir
Write-Host "`n== Cambios a subir ==" -ForegroundColor Cyan
git status --short

$hayCambios = git status --short
if (-not $hayCambios) {
    Write-Host "No hay cambios nuevos que subir." -ForegroundColor Green
    exit 0
}

# 8. Confirmar antes de commitear/subir
$confirm = Read-Host "`n¿Confirmas el commit y push a GitHub? (s/n)"
if ($confirm -ne "s") {
    Write-Host "Cancelado. No se subió nada." -ForegroundColor Red
    exit 0
}

# 9. Commit
$fecha = Get-Date -Format "yyyy-MM-dd HH:mm"
git commit -m "Actualizacion llave10: cotizacion por WhatsApp, mejoras UX/UI ($fecha)"

# 10. Push normal (sin forzar)
Write-Host "`nSubiendo a GitHub..." -ForegroundColor Yellow
git push origin main

Write-Host "`n✅ Listo. Revisa: https://github.com/TheCiego05/axrepuesto" -ForegroundColor Green
