/*
 * 可选：把本机已安装的「思源宋体 Heavy」复制成 app/assets/GMincho-Heavy.ttf，
 * 让动画字形与项目截图完全一致。
 *
 * 该字体遵循 SIL Open Font License 1.1，本项目不附带字体文件，
 * 请自行从官方渠道安装后再运行本脚本。
 * 不运行也完全不影响使用：CSS 会回退到系统衬线字体。
 */
$src = Join-Path $env:WINDIR 'Fonts\Source Han Serif SC Heavy (TrueType).ttf'
$dst = Join-Path $PSScriptRoot '..\app\assets\GMincho-Heavy.ttf'

if (Test-Path -LiteralPath $src) {
    $dir = Split-Path -Parent $dst
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    Copy-Item -LiteralPath $src -Destination $dst -Force
    Write-Host "字体已就位：$dst"
} else {
    Write-Host "本机没有找到「Source Han Serif SC Heavy」，已跳过。"
    Write-Host "不影响运行：动画会自动回退到系统衬线字体。"
}
