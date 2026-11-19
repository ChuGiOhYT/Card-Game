@echo off
chcp 65001 >nul
rem Genera la voz del narrador (voz «mayor») para las cinemáticas de la campaña.
rem Solo hace lo que falta: si cambias un texto, rehace ese y nada más.
cd /d "%~dp0"
node tools\narrador\generar-narracion.mjs %*
echo.
pause
