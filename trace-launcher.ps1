# Trace Windows launcher
# - Auto-detects Node.js (>= 20.19); installs via winget or a portable runtime zip if missing
# - Installs dependencies on first run (retries via npmmirror for CN networks)
# - Starts the Vite server in THIS console window: closing the window (or Ctrl+C)
#   stops only Trace's own server. It never kills other node.exe processes.
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Trace Server'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Join-Path $root 'app'
$minVersion = [version]'20.19'

function Write-Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }

function Get-NodeVersion($nodeExe) {
    try {
        $v = (& $nodeExe --version) -replace '^v', ''
        return [version]$v
    } catch { return $null }
}

function Get-NodeDir {
    # 1) System Node.js
    $sys = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($sys) {
        $v = Get-NodeVersion $sys.Source
        if ($v -ge $minVersion) { return Split-Path -Parent $sys.Source }
    }

    # 2) winget (Node.js LTS)
    Write-Step "Node.js >= $minVersion not found - installing via winget (a few minutes)..."
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($winget) {
        & $winget.Source install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements | Out-Null
        $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
        $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        $env:Path = "$machinePath;$userPath"
        $sys = Get-Command node.exe -ErrorAction SilentlyContinue
        if ($sys) {
            $v = Get-NodeVersion $sys.Source
            if ($v -ge $minVersion) { return Split-Path -Parent $sys.Source }
        }
    }

    # 3) Portable runtime zip (nodejs.org, npmmirror fallback)
    Write-Step "Downloading portable Node.js runtime..."
    $base = Join-Path $env:LOCALAPPDATA 'Trace\runtime'
    New-Item -ItemType Directory -Force -Path $base | Out-Null
    $file = $null
    foreach ($u in 'https://nodejs.org/dist/latest-v22.x/', 'https://npmmirror.com/mirrors/node/latest-v22.x/') {
        try {
            $list = (Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 30).Content
            if ($list -match 'node-v[\d\.]+-win-x64\.zip') { $file = $Matches[0]; break }
        } catch {}
    }
    if (-not $file) { return $null }
    $name = [IO.Path]::GetFileNameWithoutExtension($file)
    $outer = Join-Path $base $name
    $inner = Join-Path $outer $name
    if (Test-Path (Join-Path $inner 'node.exe')) { return $inner }
    if (Test-Path (Join-Path $outer 'node.exe')) { return $outer }

    $zip = Join-Path $env:TEMP $file
    $ok = $false
    foreach ($u in "https://nodejs.org/dist/latest-v22.x/$file", "https://npmmirror.com/mirrors/node/latest-v22.x/$file") {
        try {
            Write-Step "Downloading $u"
            Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile $zip -TimeoutSec 600
            $ok = $true; break
        } catch {}
    }
    if (-not $ok) { return $null }
    Write-Step "Extracting Node.js..."
    Expand-Archive -Path $zip -DestinationPath $outer -Force
    if (Test-Path (Join-Path $inner 'node.exe')) { return $inner }
    if (Test-Path (Join-Path $outer 'node.exe')) { return $outer }
    return $null
}

function Test-TracePort {
    foreach ($h in '127.0.0.1', '::1') {
        $c = New-Object Net.Sockets.TcpClient
        try {
            $t = $c.BeginConnect($h, 5173, $null, $null)
            if ($t.AsyncWaitHandle.WaitOne(800) -and $c.Connected) { return $true }
        } catch {} finally { $c.Close() }
    }
    return $false
}

if (-not (Test-Path (Join-Path $appDir 'package.json'))) {
    Write-Host "The 'app' folder was not found next to Trace.bat. Keep it in the repository root." -ForegroundColor Red
    exit 1
}

$nodeDir = Get-NodeDir
if (-not $nodeDir) {
    Write-Host "Could not install Node.js automatically." -ForegroundColor Red
    Write-Host "Please install the Node.js LTS from https://nodejs.org and start Trace again."
    exit 1
}
Write-Step "Using Node.js runtime: $nodeDir"
$env:Path = "$nodeDir;$env:Path"

if (-not (Test-Path (Join-Path $appDir 'node_modules')) -or
    -not (Test-Path (Join-Path $appDir 'node_modules\express'))) {
    Write-Step "Installing dependencies (first run, a few minutes)..."
    Push-Location $appDir
    & cmd /c npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Step "npm install failed - retrying via npmmirror (CN mirror)..."
        & cmd /c "npm install --registry=https://registry.npmmirror.com"
    }
    Pop-Location
    if (-not (Test-Path (Join-Path $appDir 'node_modules\express'))) {
        Write-Host "npm install failed. Check your network and try again." -ForegroundColor Red
        exit 1
    }
}

if (Test-TracePort) {
    Write-Step "Trace server already running on port 5173 - opening browser..."
    Start-Process 'http://localhost:5173'
    exit 0
}

# Open the browser only after the server answers (background helper job).
Start-Job -ScriptBlock {
    for ($i = 0; $i -lt 180; $i++) {
        try {
            Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5173' -TimeoutSec 1 | Out-Null
            Start-Process 'http://localhost:5173'
            break
        } catch { Start-Sleep -Milliseconds 500 }
    }
} | Out-Null

Write-Step "Starting Trace server in this window (close it or press Ctrl+C to stop)..."
Set-Location $appDir
& cmd /c npm run dev
