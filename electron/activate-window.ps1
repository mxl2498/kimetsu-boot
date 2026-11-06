/* ============================================================
   Kimetsu Boot — 把目标程序的主窗口拉到最前
   通用版：进程名 / 窗口标题 / exe 路径均可由配置传入
   ============================================================ */
param(
  [string]$ExePath = "",
  [string]$ProcessName = "",
  [string]$WindowTitle = ""
)

$ErrorActionPreference = "SilentlyContinue"
$script:out = @()

try {
  $src = @"
using System;
using System.Runtime.InteropServices;
public static class KBWin32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hAfter, int x, int y, int cx, int cy, uint flags);
}
"@
  Add-Type -TypeDefinition $src -ErrorAction Stop
  $script:out += "addtype=ok"
} catch {
  $script:out += "addtype=fail:$($_.Exception.Message)"
}

$names = @()
if ($ProcessName) { $names += ($ProcessName -split '[,，\s]+' | Where-Object { $_ }) }
if ($names.Count -eq 0) { $names = @("WorkBuddy", "WorkBuddyAI") }

function Activate-Target {
  $procs = @()
  foreach ($n in $names) {
    $procs += Get-Process -Name $n -ErrorAction SilentlyContinue
  }
  $procs = $procs | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowHandle -ne [IntPtr]::Zero } | Sort-Object -Unique Id
  if ($WindowTitle) {
    $matched = $procs | Where-Object { $_.MainWindowTitle -like "*$WindowTitle*" }
    if ($matched) { $procs = $matched }
  }
  foreach ($p in $procs) {
    $h = $p.MainWindowHandle
    try {
      [KBWin32]::ShowWindow($h, 9) | Out-Null
      [KBWin32]::SetWindowPos($h, [IntPtr](-1), 0, 0, 0, 0, 0x0043) | Out-Null
      [KBWin32]::SetWindowPos($h, [IntPtr](-2), 0, 0, 0, 0, 0x0043) | Out-Null
      [KBWin32]::BringWindowToTop($h) | Out-Null
      [KBWin32]::SetForegroundWindow($h) | Out-Null
      $script:out += "activated pid=$($p.Id) title=$($p.MainWindowTitle)"
    } catch { $script:out += "activate-fail:$($_.Exception.Message)" }
  }
  return $procs.Count
}

# 最多等 6 秒，等目标窗口出现
$hit = 0
for ($i = 0; $i -lt 12; $i++) {
  $hit = Activate-Target
  if ($hit -gt 0) { break }
  if ($ExePath -and (Test-Path $ExePath) -and $i -eq 3) {
    Start-Process -FilePath $ExePath | Out-Null
    $script:out += "relaunch"
  }
  Start-Sleep -Milliseconds 500
}

if ($hit -eq 0) { $script:out += "no-window-found names=$($names -join ',')" }

$script:out -join " | "
