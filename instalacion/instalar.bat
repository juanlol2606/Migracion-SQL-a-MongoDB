@echo off
REM Instala y configura SQL Server Express y MongoDB para el Taller 3.
REM Pide permisos de administrador.
echo Iniciando instalacion (acepte el aviso de permisos de Windows)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -NoExit -File \"%~dp0instalar-entorno.ps1\"'"
