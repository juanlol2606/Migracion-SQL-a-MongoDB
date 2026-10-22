@echo off
REM Diagnostica y repara SQL Server y MongoDB para el Taller 3.
REM Pide permisos de administrador.
echo Iniciando diagnostico (acepte el aviso de permisos de Windows)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -NoExit -File \"%~dp0diagnosticar.ps1\"'"
