# Read-only Windows environment inventory for the desktop editor track.
# No installation, deletion, registry edits, or project file modifications.

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "AI Auto Editor - Windows Desktop Preflight" -ForegroundColor Cyan
Write-Host "Read-only check; no system or project changes will be made."
Write-Host ("Timestamp: {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
Write-Host ""

$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$ram = Get-CimInstance Win32_ComputerSystem
$gpuList = Get-CimInstance Win32_VideoController

Write-Host "[SYSTEM]" -ForegroundColor Yellow
[pscustomobject]@{
    OS = $os.Caption
    Version = $os.Version
    Build = $os.BuildNumber
    Architecture = $os.OSArchitecture
    CPU = $cpu.Name
    Cores = $cpu.NumberOfCores
    LogicalProcessors = $cpu.NumberOfLogicalProcessors
    RAM_GB = [math]::Round($ram.TotalPhysicalMemory / 1GB, 1)
} | Format-List

Write-Host "[GPU]" -ForegroundColor Yellow
if ($gpuList) {
    $gpuList | Select-Object Name, DriverVersion, AdapterRAM | Format-Table -AutoSize
} else {
    Write-Host "No display adapter information returned."
}

$commands = @(
    @{ Name = "git"; RequiredNow = $true },
    @{ Name = "cmake"; RequiredNow = $false },
    @{ Name = "ninja"; RequiredNow = $false },
    @{ Name = "ffmpeg"; RequiredNow = $true },
    @{ Name = "ffprobe"; RequiredNow = $true },
    @{ Name = "python"; RequiredNow = $true },
    @{ Name = "py"; RequiredNow = $false },
    @{ Name = "node"; RequiredNow = $true },
    @{ Name = "npm"; RequiredNow = $true },
    @{ Name = "qmake"; RequiredNow = $false },
    @{ Name = "qtpaths"; RequiredNow = $false },
    @{ Name = "melt"; RequiredNow = $false }
)

Write-Host ""
Write-Host "[COMMANDS]" -ForegroundColor Yellow
$results = foreach ($item in $commands) {
    $cmd = Get-Command $item.Name -ErrorAction SilentlyContinue | Select-Object -First 1
    [pscustomobject]@{
        Command = $item.Name
        Found = [bool]$cmd
        Path = if ($cmd) { $cmd.Source } else { "" }
        RequiredForCurrentMVP = $item.RequiredNow
    }
}
$results | Format-Table -AutoSize

Write-Host ""
Write-Host "[ENVIRONMENT VARIABLES]" -ForegroundColor Yellow
[pscustomobject]@{
    PATH_has_Git = (($env:PATH -split ";") | Where-Object { $_ -match "\\Git\\cmd$" }).Count -gt 0
    QT_ROOT = $env:QT_ROOT
    QTDIR = $env:QTDIR
    MLT_ROOT = $env:MLT_ROOT
} | Format-List

$missing = $results | Where-Object { $_.RequiredForCurrentMVP -and -not $_.Found }
Write-Host "[SUMMARY]" -ForegroundColor Yellow
if ($missing) {
    Write-Host "Missing commands used by the existing MVP:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host (" - {0}" -f $_.Command) }
} else {
    Write-Host "All commands marked as current-MVP requirements were found." -ForegroundColor Green
}
Write-Host ""
Write-Host "Note: this inventory does NOT validate Shotcut/MLT build prerequisites."
Write-Host "Those versions will be pinned only after selecting the upstream release."
