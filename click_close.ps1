Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Mouse {
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);
    
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);
    
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hwnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

Start-Sleep -Seconds 2

$proc = Get-Process | Where-Object { $_.MainWindowTitle -eq "Praxis" -and $_.ProcessName -eq "praxis" }
if (-not $proc) {
    Write-Host "Process not found!"
    exit
}

$hwnd = $proc.MainWindowHandle
Write-Host "Found window. Bringing to front."
[Mouse]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 500

$rect = New-Object Mouse+RECT
[Mouse]::GetWindowRect($hwnd, [ref]$rect)

# Click Close (Right - 23)
$minX = $rect.Right - 23
$minY = $rect.Top + 19

Write-Host "Clicking Close at $minX, $minY"
[Mouse]::SetCursorPos($minX, $minY)
Start-Sleep -Milliseconds 200

# Click
[Mouse]::mouse_event([Mouse]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
Start-Sleep -Milliseconds 100
[Mouse]::mouse_event([Mouse]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)

Start-Sleep -Seconds 2
$proc = Get-Process | Where-Object { $_.MainWindowTitle -eq "Praxis" -and $_.ProcessName -eq "praxis" }
if (-not $proc) {
    Write-Host "SUCCESS: Window closed!"
} else {
    Write-Host "FAILED: Window still open!"
}
