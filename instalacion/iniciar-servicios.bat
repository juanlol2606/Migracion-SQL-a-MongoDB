@echo off
REM Inicia SQL Server (SQLEXPRESS) y MongoDB. Pide permisos de administrador.
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -Command Start-Service ''MSSQL$SQLEXPRESS'',MongoDB; Get-Service ''MSSQL$SQLEXPRESS'',MongoDB; pause'"
