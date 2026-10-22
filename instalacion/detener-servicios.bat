@echo off
REM Detiene SQL Server (SQLEXPRESS) y MongoDB. Pide permisos de administrador.
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -Command Stop-Service ''MSSQL$SQLEXPRESS'',MongoDB; Get-Service ''MSSQL$SQLEXPRESS'',MongoDB; pause'"
