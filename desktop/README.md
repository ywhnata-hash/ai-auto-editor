# Desktop Windows preflight

This folder is the Windows-side preparation area for the desktop editor track.
The existing web MVP remains untouched.

## Current target machine
- Windows 11 Home 64-bit
- AMD Ryzen 5 5500 (6 cores / 12 threads)
- 16 GB RAM
- NVIDIA GeForce RTX 3050 6 GB

## Run the read-only environment check

Open PowerShell in the repository root and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop\scripts\Test-DesktopEnvironment.ps1
```

The script only reads system information and command availability. It does not install, delete, or modify anything.

## Important
This is a generic environment inventory, not proof that the Shotcut/MLT source build is ready. The exact supported compiler, Qt, SDK and dependency versions must be pinned from the selected upstream Shotcut release before building.
