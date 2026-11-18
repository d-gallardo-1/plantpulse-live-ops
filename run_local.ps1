# Starts PlantPulse without Docker (Windows PowerShell 5.1 or later).
# Requires Python 3.11+ and Node.js 20.19+ on PATH.
# Backend: http://127.0.0.1:8000   UI: http://127.0.0.1:5173

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

foreach ($tool in 'python', 'npm') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "$tool was not found on PATH. Install it and run this script again."
    }
}

$venvPython = Join-Path $backend '.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    Write-Host 'Creating Python virtual environment...'
    python -m venv (Join-Path $backend '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the virtual environment.' }
}

Write-Host 'Installing backend dependencies...'
& $venvPython -m pip install --quiet --disable-pip-version-check -r (Join-Path $backend 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }

Write-Host 'Starting backend on http://127.0.0.1:8000 ...'
$apiArgs = @(
    '-m', 'uvicorn', 'app.main:app',
    '--host', '127.0.0.1', '--port', '8000',
    '--workers', '1', '--timeout-graceful-shutdown', '3'
)
$api = Start-Process -FilePath $venvPython -ArgumentList $apiArgs `
    -WorkingDirectory $backend -PassThru -NoNewWindow

try {
    Push-Location $frontend
    if (-not (Test-Path 'node_modules')) {
        Write-Host 'Installing frontend dependencies...'
        npm ci --no-fund --no-audit
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    }
    Write-Host ''
    Write-Host 'Open http://127.0.0.1:5173 in your browser. Press Ctrl+C to stop.'
    Write-Host ''
    npm run dev
}
finally {
    Pop-Location
    if ($api -and -not $api.HasExited) {
        # /T also stops the interpreter started by the virtual environment launcher.
        taskkill /PID $api.Id /T /F | Out-Null
    }
}
