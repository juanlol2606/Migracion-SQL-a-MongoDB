<#
  Instalación y configuración del entorno del Taller 3 (TecnoHogar) en Windows 10/11.

  Instala y deja listo:
    1. SQL Server 2022 Express (instancia SQLEXPRESS)
       - autenticación mixta (Windows + SQL) con el usuario sa habilitado
       - TCP/IP activo en el puerto fijo 1433 (necesario para el driver mssql de Node.js)
    2. SQL Server Management Studio (SSMS), para ver la base relacional
    3. MongoDB Community Server como servicio de Windows (puerto 27017)
    4. mongosh y MongoDB Compass
    5. Verifica las conexiones y escribe el archivo .env del proyecto

  Uso: doble clic en instalar.bat (pide permisos de administrador)
       o en PowerShell como administrador:
       powershell -ExecutionPolicy Bypass -File .\instalar-entorno.ps1

  Se puede ejecutar varias veces: lo que ya está instalado se omite y la configuración se vuelve a aplicar.
#>
param(
  [string]$SaPassword = "TecnoHogar_2025!",
  [int]$PuertoSql = 1433,
  [string]$Instancia = "SQLEXPRESS",
  [switch]$SinHerramientasGraficas
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # acelera mucho Invoke-WebRequest en Windows PowerShell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Raiz = Split-Path -Parent $PSScriptRoot           # carpeta del proyecto (padre de instalacion/)
$Temp = Join-Path $env:TEMP "taller3-instalacion"
New-Item -ItemType Directory -Force -Path $Temp | Out-Null
$Log = Join-Path $PSScriptRoot "instalacion.log"
Start-Transcript -Path $Log -Force | Out-Null

function Titulo($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "  [OK] $t" -ForegroundColor Green }
function Aviso($t)  { Write-Host "  [!]  $t" -ForegroundColor Yellow }
function Falla($t)  { Write-Host "  [X]  $t" -ForegroundColor Red }

function Refrescar-Path {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

function Tiene-Winget { [bool](Get-Command winget -ErrorAction SilentlyContinue) }

function Instalar-Winget($id, $nombre) {
  if (-not (Tiene-Winget)) { Aviso "winget no está disponible: instale '$nombre' manualmente."; return $false }
  Write-Host "  Instalando $nombre con winget..."
  & winget install --id $id -e --silent --accept-source-agreements --accept-package-agreements --disable-interactivity | Out-Host
  $codigo = $LASTEXITCODE
  # 0 = instalado; -1978335189 / -1978335135 = ya estaba instalado / sin actualización
  if ($codigo -eq 0 -or $codigo -eq -1978335189 -or $codigo -eq -1978335135) { Ok "$nombre listo"; return $true }
  Aviso "winget terminó con código $codigo para $nombre"
  return $false
}

function Esperar-Puerto($puerto, $segundos) {
  for ($i = 0; $i -lt $segundos; $i++) {
    try {
      $c = New-Object System.Net.Sockets.TcpClient
      $c.Connect("127.0.0.1", $puerto); $c.Close(); return $true
    } catch { Start-Sleep -Seconds 1 }
  }
  return $false
}

function Buscar-Mongod {
  Get-ChildItem -Path "$env:ProgramFiles\MongoDB\Server\*\bin\mongod.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
}

function Registrar-ServicioMongo {
  $mongod = Buscar-Mongod
  if (-not $mongod) { throw "No se encontró mongod.exe en $env:ProgramFiles\MongoDB\Server" }
  $datos = "C:\MongoDB\data"; $logs = "C:\MongoDB\log"
  New-Item -ItemType Directory -Force -Path $datos, $logs | Out-Null
  $cfg = Join-Path $mongod.DirectoryName "mongod.cfg"
  if (-not (Test-Path $cfg)) {
    $cfg = "C:\MongoDB\mongod.cfg"
    Set-Content -Path $cfg -Encoding ASCII -Value @"
storage:
  dbPath: $datos
systemLog:
  destination: file
  logAppend: true
  path: $logs\mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1
"@
  }
  Write-Host "  Registrando MongoDB como servicio de Windows ($($mongod.FullName))..."
  & $mongod.FullName --config $cfg --install --serviceName MongoDB --serviceDisplayName "MongoDB Server" | Out-Host
  if (-not (Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue)) { throw "No se pudo registrar el servicio MongoDB" }
  Ok "Servicio MongoDB registrado"
}

# ---------------------------------------------------------------------------- 0. Comprobaciones
Titulo "0. Comprobaciones previas"
$identidad = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($identidad)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Falla "Ejecute este script como administrador (use instalar.bat)."
  Stop-Transcript | Out-Null; exit 1
}
Ok "Ejecutando como administrador ($($identidad.Name))"
if ([Environment]::Is64BitOperatingSystem) { Ok "Windows de 64 bits" } else { Falla "Se requiere Windows de 64 bits"; exit 1 }
if (Tiene-Winget) { Ok "winget disponible" } else { Aviso "winget no está disponible: MongoDB se instalará desde el MSI y se omitirán SSMS, Compass y mongosh" }
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  $v = (& node --version).Trim()
  if ([int]($v.TrimStart("v").Split(".")[0]) -ge 18) { Ok "Node.js $v" } else { Aviso "Node.js $v es antiguo: se recomienda 20 o superior" }
} else {
  Aviso "Node.js no está instalado: se instala la versión LTS"
  Instalar-Winget "OpenJS.NodeJS.LTS" "Node.js LTS" | Out-Null
}

# ---------------------------------------------------------------------------- 1. SQL Server Express
Titulo "1. SQL Server 2022 Express (instancia $Instancia)"
$sqlListo = $false
try {
$claveInstancias = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL"
$idInstancia = (Get-ItemProperty -Path $claveInstancias -Name $Instancia -ErrorAction SilentlyContinue).$Instancia

if ($idInstancia) {
  Ok "La instancia $Instancia ya existe ($idInstancia): se omite la instalación"
} else {
  $ssei = Join-Path $Temp "SQL2022-SSEI-Expr.exe"
  $medios = Join-Path $Temp "medios"
  $extraido = Join-Path $Temp "sqlexpress"
  Write-Host "  Descargando el instalador de SQL Server 2022 Express..."
  $urlsSql = @(
    "https://download.microsoft.com/download/29654887-7cde-4397-bba3-d7f087970845/SQL2022-SSEI-Expr.exe",
    "https://go.microsoft.com/fwlink/p/?linkid=2216019"
  )
  foreach ($u in $urlsSql) {
    try { Invoke-WebRequest -Uri $u -OutFile $ssei -UseBasicParsing; break } catch { Aviso "No se pudo descargar desde $u" }
  }
  if (-not (Test-Path $ssei)) {
    throw "No se pudo descargar SQL Server Express. Descárguelo de https://www.microsoft.com/es-es/sql-server/sql-server-downloads (Express), guárdelo como $ssei y vuelva a ejecutar."
  }
  # --- Método 1: instalación "Básica" del instalador oficial (instancia SQLEXPRESS, su usuario de Windows como administrador).
  #     La autenticación mixta, el usuario sa y el puerto 1433 se configuran justo después.
  Write-Host "  Instalando SQL Server Express en modo Básico (descarga ~250 MB + 5-10 minutos)..."
  $p = Start-Process -FilePath $ssei -ArgumentList "/ACTION=Install", "/IACCEPTSQLSERVERLICENSETERMS", "/ENU", "/QUIET" -Wait -PassThru
  $idInstancia = (Get-ItemProperty -Path $claveInstancias -Name $Instancia -ErrorAction SilentlyContinue).$Instancia

  # --- Método 2 (respaldo): descargar los medios y ejecutar setup.exe con parámetros explícitos
  if (-not $idInstancia) {
    Aviso "El modo Básico terminó con código $($p.ExitCode) sin crear la instancia: se intenta la instalación detallada"
    Write-Host "  Descargando los medios de instalación..."
    $p = Start-Process -FilePath $ssei -ArgumentList "/ACTION=Download", "/MEDIAPATH=`"$medios`"", "/MEDIATYPE=Core", "/QUIET" -Wait -PassThru
    $paquete = Get-ChildItem -Path $medios -Filter "SQLEXPR*.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $paquete) { throw "No se pudieron descargar los medios de SQL Server Express (código $($p.ExitCode)). Revise su conexión y vuelva a intentar." }
    Write-Host "  Extrayendo $($paquete.Name)..."
    Start-Process -FilePath $paquete.FullName -ArgumentList "/q", "/x:`"$extraido`"" -Wait | Out-Null
    $setup = Join-Path $extraido "setup.exe"
    if (-not (Test-Path $setup)) { throw "No se encontró $setup después de extraer los medios" }
    Write-Host "  Instalando el motor (5-10 minutos)..."
    $argumentos = @(
      "/Q", "/ACTION=Install", "/IACCEPTSQLSERVERLICENSETERMS", "/UPDATEENABLED=False",
      "/FEATURES=SQLENGINE", "/INSTANCENAME=$Instancia", "/ADDCURRENTUSERASSQLADMIN=True",
      "/SECURITYMODE=SQL", "/SAPWD=`"$SaPassword`"", "/TCPENABLED=1"
    )
    $p = Start-Process -FilePath $setup -ArgumentList $argumentos -Wait -PassThru
    $idInstancia = (Get-ItemProperty -Path $claveInstancias -Name $Instancia -ErrorAction SilentlyContinue).$Instancia
  }

  if (-not $idInstancia) {
    $logTemp = Join-Path $env:TEMP "SqlSetup.log"
    if (Test-Path $logTemp) { Write-Host "  --- $logTemp ---"; Get-Content $logTemp -Tail 25 | ForEach-Object { Write-Host "  | $_" } }
    throw "SQL Server no se pudo instalar (último código: $($p.ExitCode)). Instálelo a mano con el instalador oficial, opción Básica, y luego ejecute diagnosticar.bat."
  }
  if ($p.ExitCode -eq 3010) { Aviso "SQL Server pide reiniciar el equipo al terminar" }
  Ok "SQL Server instalado ($idInstancia)"
}

# ---- configuración: autenticación mixta + TCP/IP en puerto fijo
Write-Host "  Configurando autenticación mixta y TCP/IP en el puerto $PuertoSql..."
$base = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$idInstancia\MSSQLServer"
Set-ItemProperty -Path $base -Name "LoginMode" -Value 2 -Type DWord                       # 2 = Windows + SQL Server
Set-ItemProperty -Path "$base\SuperSocketNetLib\Tcp" -Name "Enabled" -Value 1 -Type DWord
Set-ItemProperty -Path "$base\SuperSocketNetLib\Tcp\IPAll" -Name "TcpDynamicPorts" -Value ""
Set-ItemProperty -Path "$base\SuperSocketNetLib\Tcp\IPAll" -Name "TcpPort" -Value "$PuertoSql"

$servicioSql = "MSSQL`$$Instancia"
$ocupado = Get-NetTCPConnection -LocalPort $PuertoSql -State Listen -ErrorAction SilentlyContinue |
  Where-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName -ne "sqlservr" }
if ($ocupado) { Aviso "El puerto $PuertoSql lo usa otro programa. Vuelva a ejecutar con -PuertoSql 14330" }
Restart-Service -Name $servicioSql -Force
Set-Service -Name $servicioSql -StartupType Automatic
if (Esperar-Puerto $PuertoSql 60) { Ok "SQL Server escuchando en localhost:$PuertoSql" } else { Falla "SQL Server no responde en el puerto $PuertoSql" }

# ---- habilitar sa y fijar su contraseña (con la cuenta de Windows, que es sysadmin)
try {
  $cn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost,$PuertoSql;Database=master;Integrated Security=True;TrustServerCertificate=True")
  $cn.Open()
  $cmd = $cn.CreateCommand()
  $cmd.CommandText = "ALTER LOGIN sa WITH PASSWORD = N'$($SaPassword.Replace("'", "''"))', CHECK_POLICY = ON; ALTER LOGIN sa ENABLE;"
  $cmd.ExecuteNonQuery() | Out-Null
  $cn.Close()
  Ok "Usuario sa habilitado"
} catch {
  Aviso "No se pudo configurar sa con la cuenta de Windows: $($_.Exception.Message)"
}
$sqlListo = $true
} catch {
  Falla "SQL Server: $($_.Exception.Message)"
  Aviso "Se continúa con MongoDB. Después ejecute diagnosticar.bat o vuelva a ejecutar instalar.bat."
}

# ---------------------------------------------------------------------------- 2. SSMS
if (-not $SinHerramientasGraficas) {
  Titulo "2. SQL Server Management Studio"
  $ssmsOk = $false
  foreach ($id in @("Microsoft.SQLServerManagementStudio", "Microsoft.SQLServerManagementStudio.21")) {
    if (Instalar-Winget $id "SSMS") { $ssmsOk = $true; break }
  }
  if (-not $ssmsOk) {
    Aviso "Puede descargar SSMS desde https://aka.ms/ssms (no es obligatorio: el proyecto funciona sin él)"
  }
}

# ---------------------------------------------------------------------------- 3. MongoDB
Titulo "3. MongoDB Community Server"
try {
  if (Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue) {
    Ok "El servicio MongoDB ya existe: se omite la instalación"
  } else {
    if (-not (Buscar-Mongod)) { Instalar-Winget "MongoDB.Server" "MongoDB Server" | Out-Null }
    if (-not (Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue) -and -not (Buscar-Mongod)) {
      $msi = Join-Path $Temp "mongodb.msi"
      Write-Host "  Descargando MongoDB 8.0 (MSI)..."
      Invoke-WebRequest -Uri "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-8.0.4-signed.msi" -OutFile $msi -UseBasicParsing
      Write-Host "  Instalando MongoDB como servicio..."
      $p = Start-Process msiexec.exe -ArgumentList "/i", "`"$msi`"", "/qn", "/norestart", "ADDLOCAL=`"ServerService`"", "SHOULD_INSTALL_COMPASS=`"0`"", "/l*v", "`"$Temp\mongodb-msi.log`"" -Wait -PassThru
      if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { throw "La instalación de MongoDB terminó con código $($p.ExitCode) (registro: $Temp\mongodb-msi.log)" }
    }
    # MongoDB instalado pero sin servicio de Windows: se registra
    if (-not (Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue)) { Registrar-ServicioMongo }
  }
  Set-Service -Name "MongoDB" -StartupType Automatic
  if ((Get-Service -Name "MongoDB").Status -ne "Running") { Start-Service -Name "MongoDB" }
  if (Esperar-Puerto 27017 60) { Ok "MongoDB escuchando en localhost:27017" } else { Falla "MongoDB no responde en el puerto 27017" }
} catch {
  Falla "MongoDB: $($_.Exception.Message)"
}

# ---------------------------------------------------------------------------- 4. mongosh y Compass
if (-not $SinHerramientasGraficas) {
  Titulo "4. mongosh y MongoDB Compass"
  Instalar-Winget "MongoDB.Shell" "mongosh" | Out-Null
  Instalar-Winget "MongoDB.Compass.Full" "MongoDB Compass" | Out-Null
}
Refrescar-Path

# ---------------------------------------------------------------------------- 5. Verificación final
Titulo "5. Verificación"
$sqlOk = $false
try {
  $cn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost,$PuertoSql;Database=master;User Id=sa;Password=$SaPassword;TrustServerCertificate=True;Connect Timeout=15")
  $cn.Open()
  $cmd = $cn.CreateCommand(); $cmd.CommandText = "SELECT SERVERPROPERTY('ProductVersion'), SERVERPROPERTY('Edition')"
  $r = $cmd.ExecuteReader(); $r.Read() | Out-Null
  Ok "SQL Server: conexión con sa correcta (versión $($r.GetValue(0)), $($r.GetValue(1)))"
  $cn.Close(); $sqlOk = $true
} catch { Falla "SQL Server: no se pudo iniciar sesión con sa: $($_.Exception.Message)" }

$mongoOk = Esperar-Puerto 27017 5
if ($mongoOk) {
  if (Get-Command mongosh -ErrorAction SilentlyContinue) {
    $ping = & mongosh --quiet --eval "db.runCommand({ ping: 1 }).ok + ' / MongoDB ' + db.version()" 2>$null
    Ok "MongoDB: ping = $ping"
  } else { Ok "MongoDB responde en el puerto 27017" }
} else { Falla "MongoDB no responde" }

# ---------------------------------------------------------------------------- 6. Archivo .env
Titulo "6. Archivo .env del proyecto"
if (Test-Path (Join-Path $Raiz "package.json")) {
  $env_ = @"
# Generado por instalacion/instalar-entorno.ps1
SQL_SERVER=localhost
SQL_PORT=$PuertoSql
SQL_DATABASE=TecnoHogarDB
SQL_USER=sa
SQL_PASSWORD="$SaPassword"
SQL_INSTANCE=
SQL_ENCRYPT=false
MONGO_URI=mongodb://localhost:27017
MONGO_DB=tecnohogar
PORT=3000
"@
  Set-Content -Path (Join-Path $Raiz ".env") -Value $env_ -Encoding ASCII
  Ok "Escrito $(Join-Path $Raiz '.env')"
} else {
  Aviso "No se encontró el proyecto junto a este script; configure .env a mano (SQL_USER=sa, SQL_PASSWORD=$SaPassword, SQL_PORT=$PuertoSql)"
}

Titulo "Resumen"
Write-Host "  SQL Server : localhost,$PuertoSql  (usuario sa / contraseña $SaPassword)"
Write-Host "               En SSMS: Server name = localhost,$PuertoSql  o  .\$Instancia"
Write-Host "  MongoDB    : mongodb://localhost:27017   (Compass: botón Connect con esa URI)"
Write-Host ""
if ($sqlOk -and $mongoOk) {
  Write-Host "  Todo listo. Siguientes pasos en la carpeta del proyecto:" -ForegroundColor Green
  Write-Host "    npm install"
  Write-Host "    npm run dev      ->  http://localhost:3000"
} else {
  Write-Host "  Hubo problemas. Revise los mensajes en rojo y el registro: $Log" -ForegroundColor Yellow
}
Stop-Transcript | Out-Null