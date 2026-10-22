<#
  Diagnóstico y reparación del entorno del Taller 3.
  - Revisa si SQL Server y MongoDB están instalados, si sus servicios corren y si responden en sus puertos.
  - Intenta repararlos: inicia los servicios, reaplica la configuración TCP/IP de SQL Server y registra
    el servicio de MongoDB si falta.
  - Guarda todo en instalacion\diagnostico.txt (envíe ese archivo si necesita ayuda).
  Uso: doble clic en diagnosticar.bat
#>
param([int]$PuertoSql = 1433, [string]$Instancia = "SQLEXPRESS", [switch]$CorregirSector)

$ErrorActionPreference = "Continue"
$Salida = Join-Path $PSScriptRoot "diagnostico.txt"
Start-Transcript -Path $Salida -Force | Out-Null

function Titulo($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "  [OK] $t" -ForegroundColor Green }
function Aviso($t)  { Write-Host "  [!]  $t" -ForegroundColor Yellow }
function Falla($t)  { Write-Host "  [X]  $t" -ForegroundColor Red }
function Puerto-Abierto($p) {
  try { $c = New-Object System.Net.Sockets.TcpClient; $c.Connect("127.0.0.1", $p); $c.Close(); $true } catch { $false }
}
function Esperar-Puerto($p, $s) { for ($i = 0; $i -lt $s; $i++) { if (Puerto-Abierto $p) { return $true }; Start-Sleep 1 }; $false }
function Ultimas-Lineas($ruta, $n = 25) {
  if (Test-Path $ruta) { Write-Host "  --- últimas líneas de $ruta ---"; Get-Content $ruta -Tail $n | ForEach-Object { Write-Host "  | $_" } }
}

function Mostrar-ResumenInstalacionSql {
  $resumen = Get-ChildItem "$env:ProgramFiles\Microsoft SQL Server\*\Setup Bootstrap\Log" -Recurse -Filter "Summary*.txt" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $resumen) {
    Aviso "No hay registros de instalación de SQL Server (el instalador se detuvo antes de empezar)"
    Ultimas-Lineas (Join-Path $env:TEMP "SqlSetup.log") 25
    return
  }
  Write-Host "  --- Resumen del último intento: $($resumen.FullName) ---"
  Get-Content $resumen.FullName -TotalCount 45 | ForEach-Object { Write-Host "  | $_" }
  $detalle = Get-ChildItem $resumen.DirectoryName -Recurse -Filter "Detail.txt" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($detalle) {
    $err = Select-String -Path $detalle.FullName -Pattern "Exception|Error:|failed|fall" -SimpleMatch:$false | Select-Object -Last 12
    if ($err) { Write-Host "  --- Errores en Detail.txt ---"; $err | ForEach-Object { Write-Host "  | $($_.Line.Trim())" } }
  }
}

function Revisar-SectorDisco {
  # Windows 11 + discos NVMe con sector físico > 4 KB impide que SQL Server arranque (problema documentado por Microsoft)
  $info = & fsutil fsinfo sectorinfo C: 2>$null
  $linea = $info | Where-Object { $_ -match "Physical.*Atomicity|f.sic.*atomicidad" } | Select-Object -First 1
  if ($linea -and ($linea -match "(\d+)\s*$")) {
    $bytes = [int]$Matches[1]
    if ($bytes -gt 4096) {
      Falla "El disco reporta sectores de $bytes bytes: SQL Server no puede iniciar con más de 4096."
      $clave = "HKLM:\SYSTEM\CurrentControlSet\Services\stornvme\Parameters\Device"
      $actual = (Get-ItemProperty -Path $clave -Name "ForcedPhysicalSectorSizeInBytes" -ErrorAction SilentlyContinue).ForcedPhysicalSectorSizeInBytes
      if ($actual) { Aviso "La corrección ya está aplicada ($actual): REINICIE el computador si no lo ha hecho" }
      elseif ($CorregirSector) {
        New-Item -Path $clave -Force | Out-Null
        New-ItemProperty -Path $clave -Name "ForcedPhysicalSectorSizeInBytes" -PropertyType MultiString -Value "* 4095" -Force | Out-Null
        Ok "Corrección aplicada (ForcedPhysicalSectorSizeInBytes = * 4095). REINICIE el computador y vuelva a instalar SQL Server."
      } else {
        Aviso "Solución de Microsoft: ejecute  .\diagnosticar.ps1 -CorregirSector  (como administrador) y reinicie"
      }
    } else { Ok "Tamaño de sector del disco: $bytes bytes (compatible con SQL Server)" }
  }
}

function Leer-PasswordEnv($envFile) {
  if (-not (Test-Path $envFile)) { return $null }
  $l = Get-Content $envFile | Where-Object { $_ -match "^SQL_PASSWORD=" } | Select-Object -First 1
  if ($l) { return ($l -replace "^SQL_PASSWORD=", "").Trim().Trim('"') }
  return $null
}

$admin = (New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Titulo "Equipo"
Write-Host "  Windows: $((Get-CimInstance Win32_OperatingSystem).Caption)  |  Administrador: $admin"
if (-not $admin) { Aviso "Sin permisos de administrador solo se diagnostica; no se puede reparar (use diagnosticar.bat)" }

# ============================================================================ SQL Server
Titulo "SQL Server"
Revisar-SectorDisco
$idInstancia = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL" -ErrorAction SilentlyContinue).$Instancia
$todas = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL" -ErrorAction SilentlyContinue)
if ($todas) {
  $nombres = $todas.PSObject.Properties | Where-Object { $_.Name -notlike "PS*" } | ForEach-Object { "$($_.Name) ($($_.Value))" }
  Write-Host "  Instancias instaladas: $($nombres -join ', ')"
}
$servicioSql = "MSSQL`$$Instancia"
if (-not $idInstancia) {
  Falla "La instancia $Instancia NO está instalada."
  if (Get-Service -Name "MSSQLSERVER" -ErrorAction SilentlyContinue) { Aviso "Existe una instancia predeterminada (MSSQLSERVER). Ejecute: .\diagnosticar.ps1 -Instancia MSSQLSERVER" }
  Mostrar-ResumenInstalacionSql
  Write-Host "  -> Instale SQL Server con el instalador oficial (opción Básica) y vuelva a ejecutar este diagnóstico: él termina la configuración."
} else {
  Ok "Instancia $Instancia instalada ($idInstancia)"
  if ($Instancia -eq "MSSQLSERVER") { $servicioSql = "MSSQLSERVER" }
  $base = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$idInstancia\MSSQLServer"
  $tcp = (Get-ItemProperty "$base\SuperSocketNetLib\Tcp" -ErrorAction SilentlyContinue).Enabled
  $ipall = Get-ItemProperty "$base\SuperSocketNetLib\Tcp\IPAll" -ErrorAction SilentlyContinue
  $modo = (Get-ItemProperty $base -ErrorAction SilentlyContinue).LoginMode
  Write-Host "  TCP/IP habilitado: $tcp | Puerto fijo: '$($ipall.TcpPort)' | Puerto dinámico: '$($ipall.TcpDynamicPorts)' | Autenticación: $(if ($modo -eq 2) {'mixta'} else {'solo Windows'})"
  $necesitaReinicio = $false
  if ($admin -and ($tcp -ne 1 -or $ipall.TcpPort -ne "$PuertoSql" -or $ipall.TcpDynamicPorts -ne "" -or $modo -ne 2)) {
    Aviso "Configuración incorrecta: se corrige"
    Set-ItemProperty -Path $base -Name "LoginMode" -Value 2 -Type DWord
    Set-ItemProperty -Path "$base\SuperSocketNetLib\Tcp" -Name "Enabled" -Value 1 -Type DWord
    Set-ItemProperty -Path "$base\SuperSocketNetLib\Tcp\IPAll" -Name "TcpDynamicPorts" -Value ""
    Set-ItemProperty -Path "$base\SuperSocketNetLib\Tcp\IPAll" -Name "TcpPort" -Value "$PuertoSql"
    $necesitaReinicio = $true
  }
  $svc = Get-Service -Name $servicioSql -ErrorAction SilentlyContinue
  if (-not $svc) { Falla "No existe el servicio $servicioSql" }
  else {
    Write-Host "  Servicio ${servicioSql}: $($svc.Status) (inicio $($svc.StartType))"
    if ($admin) {
      Set-Service -Name $servicioSql -StartupType Automatic
      try {
        if ($necesitaReinicio -or $svc.Status -ne "Running") { Write-Host "  (Re)iniciando el servicio..."; Restart-Service -Name $servicioSql -Force -ErrorAction Stop }
      } catch { Falla "No se pudo iniciar el servicio: $($_.Exception.Message)" }
    }
    if (Esperar-Puerto $PuertoSql 30) {
      Ok "SQL Server responde en localhost:$PuertoSql"
      $claveSa = Leer-PasswordEnv (Join-Path (Split-Path -Parent $PSScriptRoot) ".env")
      if (-not $claveSa) { $claveSa = "TecnoHogar_2025!" }
      try {
        $cn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost,$PuertoSql;Database=master;User Id=sa;Password=$claveSa;TrustServerCertificate=True;Connect Timeout=10")
        $cn.Open(); $cn.Close(); Ok "Inicio de sesión con sa correcto (contraseña del .env)"
      } catch {
        Aviso "sa no puede iniciar sesión: se configura con su cuenta de Windows"
        try {
          $cn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost,$PuertoSql;Database=master;Integrated Security=True;TrustServerCertificate=True")
          $cn.Open(); $cmd = $cn.CreateCommand()
          $cmd.CommandText = "ALTER LOGIN sa WITH PASSWORD = N'$($claveSa.Replace("'", "''"))', CHECK_POLICY = OFF; ALTER LOGIN sa ENABLE;"
          $cmd.ExecuteNonQuery() | Out-Null; $cn.Close()
          if ($modo -ne 2) { Restart-Service -Name $servicioSql -Force; Esperar-Puerto $PuertoSql 30 | Out-Null }
          $cn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost,$PuertoSql;Database=master;User Id=sa;Password=$claveSa;TrustServerCertificate=True;Connect Timeout=10")
          $cn.Open(); $cn.Close(); Ok "Usuario sa configurado y verificado"
        } catch { Falla "No se pudo configurar sa: $($_.Exception.Message)" }
      }
    }
    else {
      Falla "SQL Server NO responde en el puerto $PuertoSql"
      $quien = Get-NetTCPConnection -LocalPort $PuertoSql -State Listen -ErrorAction SilentlyContinue
      if ($quien) { Aviso "El puerto lo usa: $((Get-Process -Id $quien[0].OwningProcess).ProcessName)" }
      $errorlog = Get-ChildItem "$env:ProgramFiles\Microsoft SQL Server\$idInstancia\MSSQL\Log\ERRORLOG" -ErrorAction SilentlyContinue
      if ($errorlog) { Ultimas-Lineas $errorlog.FullName 30 }
    }
  }
}

# ============================================================================ MongoDB
Titulo "MongoDB"
$mongod = Get-ChildItem "$env:ProgramFiles\MongoDB\Server\*\bin\mongod.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
if ($mongod) { Ok "mongod.exe encontrado: $($mongod.FullName)" } else { Falla "MongoDB Server NO está instalado (no existe $env:ProgramFiles\MongoDB\Server)" }
$svcM = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if (-not $svcM -and $mongod -and $admin) {
  Aviso "MongoDB está instalado pero sin servicio de Windows: se registra"
  New-Item -ItemType Directory -Force -Path "C:\MongoDB\data", "C:\MongoDB\log" | Out-Null
  $cfg = Join-Path $mongod.DirectoryName "mongod.cfg"
  if (-not (Test-Path $cfg)) {
    $cfg = "C:\MongoDB\mongod.cfg"
    Set-Content -Path $cfg -Encoding ASCII -Value "storage:`r`n  dbPath: C:\MongoDB\data`r`nsystemLog:`r`n  destination: file`r`n  logAppend: true`r`n  path: C:\MongoDB\log\mongod.log`r`nnet:`r`n  port: 27017`r`n  bindIp: 127.0.0.1"
  }
  & $mongod.FullName --config $cfg --install --serviceName MongoDB --serviceDisplayName "MongoDB Server" | Out-Host
  $svcM = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
}
if ($svcM) {
  Write-Host "  Servicio MongoDB: $($svcM.Status) (inicio $($svcM.StartType))"
  if ($admin) {
    Set-Service -Name "MongoDB" -StartupType Automatic
    try { if ($svcM.Status -ne "Running") { Write-Host "  Iniciando el servicio..."; Start-Service -Name "MongoDB" -ErrorAction Stop } }
    catch { Falla "No se pudo iniciar MongoDB: $($_.Exception.Message)" }
  }
  if (Esperar-Puerto 27017 30) { Ok "MongoDB responde en localhost:27017" }
  else {
    Falla "MongoDB NO responde en el puerto 27017"
    $cfgUsado = (Get-CimInstance Win32_Service -Filter "Name='MongoDB'").PathName
    Write-Host "  Comando del servicio: $cfgUsado"
    Ultimas-Lineas "$($mongod.DirectoryName)\..\log\mongod.log" 30
    Ultimas-Lineas "C:\MongoDB\log\mongod.log" 30
  }
} elseif (-not $mongod) {
  Write-Host "  -> Vuelva a ejecutar instalar.bat (ahora instala MongoDB aunque falle SQL Server)."
}

# ============================================================================ Proyecto
Titulo "Proyecto"
$raiz = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $raiz ".env"
if (Test-Path $envFile) {
  Ok ".env encontrado: $envFile"
  Write-Host "  IMPORTANTE: ejecute 'npm run dev' desde esta carpeta: $raiz" -ForegroundColor Yellow
  Get-Content $envFile | Where-Object { $_ -match "^(SQL_SERVER|SQL_PORT|SQL_USER|SQL_INSTANCE|MONGO_URI)=" } | ForEach-Object { Write-Host "  $_" }
} else { Falla "No existe .env en $raiz (copie .env.example como .env)" }
$log = Join-Path $PSScriptRoot "instalacion.log"
if (Test-Path $log) {
  $errores = Select-String -Path $log -Pattern "\[X\]|Exception|terminó con código" | Select-Object -Last 10
  if ($errores) { Write-Host "  Errores registrados en instalacion.log:"; $errores | ForEach-Object { Write-Host "  | $($_.Line.Trim())" } }
}

Titulo "Resultado"
$sqlOk = Puerto-Abierto $PuertoSql; $mongoOk = Puerto-Abierto 27017
Write-Host "  SQL Server (localhost:$PuertoSql): $(if ($sqlOk) {'OK'} else {'NO RESPONDE'})" -ForegroundColor $(if ($sqlOk) {'Green'} else {'Red'})
Write-Host "  MongoDB    (localhost:27017): $(if ($mongoOk) {'OK'} else {'NO RESPONDE'})" -ForegroundColor $(if ($mongoOk) {'Green'} else {'Red'})
if ($sqlOk -and $mongoOk) { Write-Host "  Todo listo: recargue la interfaz (botón de actualizar)." -ForegroundColor Green }
else { Write-Host "  Envíe el archivo $Salida para revisar el problema." -ForegroundColor Yellow }
Stop-Transcript | Out-Null