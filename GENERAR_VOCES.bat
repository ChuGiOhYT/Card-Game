@echo off
chcp 65001 >nul
rem Voces de personajes (Gemini, una voz por personaje): la frase de cada estirpe.
rem   1) Si aun no elegiste voces: genera muestras de las voces candidatas
rem      (se reparte en varios dias por el cupo gratis; repite hasta que no falte nada)
rem      y abre la pagina para escucharlas.
rem   2) Cuando esten elegidas en tools\narrador\voces-personajes.json: genera las finales.
cd /d "%~dp0"
findstr /r /c:"\"[A-Z][a-z]*\"" tools\narrador\voces-personajes.json >nul 2>nul
if errorlevel 1 (
  node tools\narrador\generar-voces.mjs --muestras %*
  if exist tools\narrador\muestras-voces\escuchar.html start "" tools\narrador\muestras-voces\escuchar.html
) else (
  node tools\narrador\generar-voces.mjs %*
)
echo.
pause
