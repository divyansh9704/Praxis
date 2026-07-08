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

    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

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

$hwnd = [Mouse]::FindWindow($null, "Praxis")
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Host "Window not found!"
    exit
}

Write-Host "Found window. Bringing to front."
[Mouse]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 500

$rect = New-Object Mouse+RECT
[Mouse]::GetWindowRect($hwnd, [ref]$rect)

# Calculate top-right offset for minimize button
# According to CSS: 3 buttons, each 46px wide.
# Close is at Right-23
# Maximize is at Right-69
# Minimize is at Right-115
# Y offset is Top + 19 (height is 38)
$minX = $rect.Right - 115
$minY = $rect.Top + 19

Write-Host "Clicking at $minX, $minY"
[Mouse]::SetCursorPos($minX, $minY)
Start-Sleep -Milliseconds 200

# Click
[Mouse]::mouse_event([Mouse]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
Start-Sleep -Milliseconds 100
[Mouse]::mouse_event([Mouse]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)

Write-Host "Clicked minimize button. Checking window state..."
Start-Sleep -Seconds 1
[Mouse]::GetWindowRect($hwnd, [ref]$rect)
Write-Host "New Rect: $($rect.Left), $($rect.Top), $($rect.Right), $($rect.Bottom)"
