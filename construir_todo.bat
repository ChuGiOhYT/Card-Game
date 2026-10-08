@echo off
rem ============================================================================
rem  AETERNUM - construir todo
rem
rem  Doble clic para compilar el juego entero. Hace, en este orden:
rem    1. Mata los Electron colgados, que bloquean el perfil y provocan
rem       errores de cache que parecen fallos del codigo.
rem    2. Regenera characters.js y actions.js desde los -source.json.
rem    3. Regenera MAPA.md.
rem    4. Compila el instalador y el portable en dist\.
rem
rem  Uso:
rem    construir_todo.bat            todo lo anterior
rem    construir_todo.bat rapido     salta los pasos 2 y 3, solo compila
rem
rem  Si algo falla, se para ahi y te dice en que paso: no sigue compilando
rem  sobre datos a medio generar.
rem ============================================================================
setlocal
chcp 65001 >nul
title AETERNUM - construir todo

rem Se coloca en la carpeta del propio script, para que funcione con doble
rem clic desde cualquier sitio.
cd /d "%~dp0"

set SOLO_EXE=
if /i "%~1"=="rapido" set SOLO_EXE=1

echo.
echo ========================================================
echo   AETERNUM - construir todo
echo   %CD%
if defined SOLO_EXE echo   modo rapido: solo el .exe
echo ========================================================

echo.
echo --- Cerrando Electron colgados ---
taskkill /f /im electron.exe >nul 2>&1
if errorlevel 1 (
  echo     no habia ninguno abierto
) else (
  echo     cerrados
)

if defined SOLO_EXE goto :compilar

echo.
echo --- Regenerando datos desde los -source.json ---
call npm run datos
if errorlevel 1 goto :error_datos

echo.
echo --- Regenerando MAPA.md ---
call npm run mapa
if errorlevel 1 goto :error_mapa

:compilar
echo.
echo --- Compilando los ejecutables. Esto tarda un par de minutos ---
call npm run dist
if errorlevel 1 goto :error_dist

echo.
echo ========================================================
echo   LISTO
echo ========================================================
powershell -NoProfile -Command "Get-ChildItem 'dist\*.exe' | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,1)}}, LastWriteTime | Format-Table -AutoSize"
echo   Estan en: %CD%\dist
echo.
goto :fin

:error_datos
echo.
echo *** FALLO al regenerar los datos. Revisa los -source.json: ***
echo *** seguramente hay una coma de mas o un JSON mal cerrado.  ***
goto :fallo

:error_mapa
echo.
echo *** FALLO al regenerar MAPA.md. ***
goto :fallo

:error_dist
echo.
echo *** FALLO al compilar. Lo mas comun:                        ***
echo ***  - una ventana del juego abierta: cierrala y reintenta   ***
echo ***  - el antivirus tocando dist\: reintenta                 ***
echo ***  - falta node_modules: ejecuta  npm install              ***
goto :fallo

:fallo
echo.
rem AETERNUM_SIN_PAUSA la usan los scripts de prueba para no quedarse colgados.
if not defined AETERNUM_SIN_PAUSA pause
endlocal
exit /b 1

:fin
if not defined AETERNUM_SIN_PAUSA pause
endlocal
exit /b 0
