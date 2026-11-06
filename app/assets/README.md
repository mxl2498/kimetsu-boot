# 可选资源目录

这里放**可选**的字体文件，项目本身不依赖它就能运行。

- 想要和项目截图完全一致的粗宋体字形：把本机已安装的
  `Source Han Serif SC Heavy`（思源宋体 Heavy）复制过来，命名为 `GMincho-Heavy.ttf`。
  也可以直接运行根目录的 `scripts/prepare-assets.ps1` 自动完成。
- 没有这个文件时，CSS 会依次回退到系统已安装的思源宋体 / Noto Serif SC / 系统衬线字体，
  动画照常播放，只是字形略有差别。

该字体遵循 **SIL Open Font License 1.1**，本项目不附带、不再分发字体文件，
需要的请自行从官方渠道获取。字体文件已被 `.gitignore` 排除。

默认结尾徽标是 `app/index.html` 里内联的自绘 SVG，不依赖任何图片文件。
