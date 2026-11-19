@echo off
rem AETERNUM para Android: copia el juego (src\) al proyecto movil\android y arma la APK.
rem Resultado: dist\AETERNUM.apk  (instalable, de depuracion: no va a la Play Store).
setlocal
cd /d "%~dp0"
set "JAVA_HOME=%USERPROFILE%\.jdks\jdk-21.0.12.1+1"
rem El SDK vive en %USERPROFILE%\Android\Sdk (NO en AppData: lo que Claude
rem instala en AppData queda virtualizado y este cmd no lo ve).
set "ANDROID_HOME=%USERPROFILE%\Android\Sdk"
if not exist "%ANDROID_HOME%\platforms" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"

if not exist "%JAVA_HOME%\bin\java.exe" (
  echo No encuentro el JDK en %JAVA_HOME%
  goto :error
)
if not exist "%ANDROID_HOME%\platforms" (
  echo No encuentro el SDK de Android en %USERPROFILE%\Android\Sdk ni en %LOCALAPPDATA%\Android\Sdk
  goto :error
)
echo SDK de Android: %ANDROID_HOME%

rem local.properties se escribe cada vez con la ruta de ESTE PC, con barras
rem normales (con "\" Java las lee como escapes).
set "SDK_BARRAS=%ANDROID_HOME:\=/%"
> movil\android\local.properties echo sdk.dir=%SDK_BARRAS%

pushd movil
if not exist node_modules (
  echo === Instalando Capacitor (solo la primera vez) ===
  call npm install --no-audit --no-fund || (popd & goto :error)
)

echo === Copiando el juego al proyecto Android ===
call npx cap sync android || (popd & goto :error)
node preparar-web.js || (popd & goto :error)

echo === Compilando la APK ===
pushd android
call gradlew.bat assembleDebug || (popd & popd & goto :error)
popd
popd

if not exist dist mkdir dist
copy /y movil\android\app\build\outputs\apk\debug\app-debug.apk dist\AETERNUM.apk >nul
echo.
echo Listo: dist\AETERNUM.apk
pause
exit /b 0

:error
echo.
echo *** Fallo la compilacion de la APK ***
pause
exit /b 1
