param(
    [string]$Godot = $env:GODOT4,
    [ValidateSet('Play','Verify','Smoke','Export')][string]$Mode = 'Play',
    [string]$OutputDirectory = (Join-Path $PSScriptRoot 'Builds/Windows')
)
$ErrorActionPreference = 'Stop'
if (-not $Godot) {
    $command = Get-Command godot -ErrorAction SilentlyContinue
    if ($command) { $Godot = $command.Source }
}
if (-not $Godot -or -not (Test-Path -LiteralPath $Godot)) {
    throw 'Set GODOT4 or pass -Godot with the path to the Godot 4.7.2 .NET console executable. See README.md.'
}
& dotnet build (Join-Path $PSScriptRoot 'AsciiSurvivors.csproj') --nologo
if ($LASTEXITCODE -ne 0) { throw 'C# build failed' }
& $Godot --headless --editor --path $PSScriptRoot --import
if ($LASTEXITCODE -ne 0) { throw 'Godot import failed' }
switch ($Mode) {
    'Verify' { & $Godot --headless --path $PSScriptRoot -- --verify }
    'Smoke' {
        $shots = Join-Path $PSScriptRoot 'Builds/Smoke'
        New-Item -ItemType Directory -Force -Path $shots | Out-Null
        & $Godot --path $PSScriptRoot -- "--smoke-test=$shots"
    }
    'Export' {
        $destination = [IO.Path]::GetFullPath($OutputDirectory)
        New-Item -ItemType Directory -Force -Path $destination | Out-Null
        & $Godot --headless --path $PSScriptRoot --export-release 'Windows Desktop' (Join-Path $destination 'ASCII-Survivors.exe')
        if ($LASTEXITCODE -ne 0) { throw 'Export failed. Check Godot output and matching .NET templates. If the EXE is open, use -OutputDirectory with a different folder.' }
        & (Join-Path $destination 'ASCII-Survivors.console.exe') --headless -- --verify
        if ($LASTEXITCODE -ne 0) { throw 'Exported game verification failed' }
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'README.md') -Destination $destination
        Compress-Archive -Path (Join-Path $destination '*') -DestinationPath (Join-Path $PSScriptRoot 'Builds/ASCII-Survivors-Windows.zip') -Force
    }
    default { & $Godot --path $PSScriptRoot }
}
if ($LASTEXITCODE -ne 0) { throw "Godot $Mode failed" }
