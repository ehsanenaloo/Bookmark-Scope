[English](../../README.md) · [فارسی](README.fa.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru.md) · **简体中文** · [日本語](README.ja.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md)

<div align="center">

<img src="../../extension/icon-128.png" alt="Bookmark Scope 标志" width="88" height="88">

# Bookmark Scope

**找到当前网站对应的书签，再把其余的书签整理干净。**

一款免费的 Chrome 扩展，给存了太多链接的人用。<br>
它只在你的电脑上运行。不用账号，没有追踪。

[![添加到 Chrome](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)

[![许可证：MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 种语言](https://img.shields.io/badge/languages-52-orange)
![无统计分析](https://img.shields.io/badge/analytics-none-lightgrey)

[![GitHub stars](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/dashboard-desktop-dark.png">
  <img src="../assets/screenshots/dashboard-desktop-light.png" alt="Bookmark Scope 仪表盘：书签列表、筛选器、标签和详情面板">
</picture>

## 为什么做这个扩展

Chrome 把书签显示成文件夹树。二十个链接还好，两千个就不行了。

同一篇文章你存了三次。2019 年的一个文件夹里，一半是失效链接。你对某个网站有十一个书签，却找不到想要的那个。Bookmark Scope 可以帮你解决这些问题。

- 在任意页面打开弹出窗口，就能看到你已经为这个页面、这个站点或这个域名保存的书签。
- 打开仪表盘，就能看到整个书签库，找出重复项和失效链接，几下点击就能处理。

## 你可以做什么

### 看看这个网站你已经存了什么

点击工具栏上的图标。弹出窗口会列出你为当前页面保存的书签。你可以在“这个确切页面”“这个主机”和“整个域名”之间切换。图标上的角标会显示匹配的书签数量。

<p align="center">
  <img src="../assets/screenshots/popup-light.png" alt="弹出窗口显示当前站点的书签" width="300">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/popup-dark.png" alt="深色主题下的弹出窗口" width="300">
</p>

### 查看整个书签库

仪表盘是一个专门管理书签的完整页面。你可以按标题、地址或文件夹搜索，按域名或文件夹分组，按标题、地址或日期排序。你还可以筛选重复书签、无标题书签、旧书签和标题冲突的书签。即使有几千个书签，它也很流畅。

点击一个书签可以查看详情。勾选多个书签可以一起处理。拖动书签可以调整顺序。

### 放心地清理

没有预览，就不会发生大的改动。

<p align="center">
  <img src="../assets/screenshots/duplicate-preview.png" alt="重复项预览对话框，在这里选择保留哪个书签" width="780">
</p>

- **重复项。** 选择保留哪一个。其他副本的标签会加到它上面。删除之前，你先看到结果。
- **标签。** 可以一次给很多书签添加、移除、重命名或合并标签。先对比修改前后的样子，再应用。你可以撤销。
- **删除和撤销。** 删除的书签可以连同标签一起恢复。Chrome 不允许任何扩展恢复原来的 ID 和添加日期，所以恢复出来的书签是新的。扩展会告诉你这一点。

<p align="center">
  <img src="../assets/screenshots/bulk-tags.png" alt="批量标签对话框，显示修改前后的标签" width="780">
</p>

### 找出失效链接

检查一组书签，看哪些链接正常，哪些被重定向，哪些已经失效。检查在你的浏览器里运行，只会访问你加了书签的网站。

- 它会先请求权限。如果你拒绝，其他功能照常使用。
- 长时间的扫描可以暂停，之后继续。
- 你可以开启定时扫描。默认是关闭的。
- “修复重定向”会把已经搬到新地址的书签更新为新地址。它不能撤销，所以请先看一下新地址。

### 备份和迁移

- **快照。** 把整个书签库连同文件夹和标签保存到一个文件里。以后可以把它恢复到一个新文件夹中。
- **导入。** 可以导入 Chrome、Edge、Firefox、Safari 或 Brave 的书签（`bookmarks.html` 文件），也可以导入 Pocket、Pinboard、Raindrop.io，以及 CSV、JSON 或纯文本的链接列表。导入前会显示预览，遇到重复项时你可以选择保留、跳过或合并。
- **导出。** 把你当前看到的书签保存为 JSON 或 CSV。

<p align="center">
  <img src="../assets/screenshots/library-tools.png" alt="书签库工具：已保存的视图、批量标签、重复项、扫描、备份和导入" width="780">
</p>

### 更快地操作

- **命令面板。** 按 `Ctrl+Shift+P`（Mac 上按 `Cmd+Shift+P`），输入你想做的事。
- **已保存的视图。** 把一次搜索连同筛选器、标签、排序和分组保存下来。一键就能再次打开。
- **右键菜单。** 在任意页面或链接上，可以显示该域名下的书签，或者查找这个链接的重复项。
- **整理提醒。** 如果你想每隔几周收到一次整理书签的提醒，可以在设置里打开。

<p align="center">
  <img src="../assets/screenshots/command-palette.png" alt="命令面板和操作列表" width="780">
</p>

### 按你的习惯来用

浅色、深色或跟随系统的主题。四种配色。支持从右到左的布局。扩展内置 52 种语言（见[注意事项](#good-to-know)）。

<p align="center">
  <img src="../assets/screenshots/options-light.png" alt="设置页面" width="300">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/dashboard-rtl-dark.png" alt="深色主题下的波斯语仪表盘，采用从右到左的布局" width="300">
</p>

## 安装

**从 Chrome Web Store 安装（最简单）**

1. 打开 [Bookmark Scope 页面](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)。
2. 点击 **添加至 Chrome**。
3. 点击工具栏上的拼图图标，把 Bookmark Scope 固定在工具栏。

Edge、Brave 等其他 Chromium 浏览器通常也可以从同一个页面安装。我只用 Chrome 测试。不支持 Firefox 和 Safari。

**从这个仓库安装**

不需要构建。`extension` 文件夹本身就是扩展。

1. 下载或克隆这个仓库。
2. 打开 `chrome://extensions`，打开 **开发者模式**。
3. 点击 **加载已解压的扩展程序**，选择仓库里的 `extension` 文件夹（里面有 `manifest.json`），不要选最上层的文件夹。

未打包的版本有自己的扩展 ID。你可以让它和商店版本同时存在，但两者不共享数据，而且未打包的版本不会自动更新。

## 你的数据留在你手里

没有服务器。没有账号，没有统计分析，也没有广告。你的书签、标签和设置都保存在你的浏览器里。详情见[隐私政策](../PRIVACY.md)。

扩展不会读取你访问的页面内容。它只读取当前标签页的地址，用来显示匹配的书签。

| 权限 | 用途 |
| --- | --- |
| `bookmarks` | 读取你的书签，并在你要求时修改它们 |
| `tabs` | 读取当前标签页的地址，用于弹出窗口和角标 |
| `storage` | 在浏览器中保存你的设置、标签和扫描结果 |
| `alarms` | 运行可选的提醒和可选的定时扫描 |
| `notifications` | 显示提醒和扫描结果 |
| `contextMenus` | 添加右键菜单项 |
| `clipboardWrite` | 点击复制按钮时复制地址 |
| `favicon` | 从浏览器自己的缓存中显示网站图标 |
| 网站（可选） | 只在你开始检查链接时才请求，这样扩展才能访问你加了书签的网站 |

<a id="good-to-know"></a>
## 注意事项

- **翻译。** 我借助 AI 和自动检查修正了翻译。只有英语和波斯语经过真人审读。其他语言可能有错误，或者留有一些英文单词。如果你发现了，请[提交 issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues) 或发 pull request。见 [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#translations)。
- **这份简体中文 README。** 这份译文是借助 AI 写的，还没有母语者审读过。如果有不通顺或不准确的地方，欢迎通过 issue 或 pull request 告诉我。
- **导入是扁平的。** 导入 `bookmarks.html` 文件时，文件夹名称会显示为路径，但不会创建文件夹，也不会保留原来的日期。如果你需要重建文件夹树，请使用快照。
- **链接检查只是提示。** 任何 4xx 响应都算失效。页面能打开，但显示错误或登录界面，仍然算正常。
- **CSV。** 我用导入功能和真实的 Chrome 下载测试过 CSV 导出。我还没有在 Excel、Numbers 或 Google Sheets 里打开过它。
- **测试。** 这个扩展在 Chromium 中测试过。见[完整的限制列表](../guides/limits.html)。

## 键盘快捷键

| 按键 | 作用 |
| --- | --- |
| `Ctrl+Shift+P` / `Cmd+Shift+P` | 打开命令面板 |
| `/` | 跳到搜索框 |
| `Ctrl+A` / `Cmd+A` | 选中当前列表中的所有书签 |
| `Esc` | 后退一步：取消编辑、清除搜索、取消选择、关闭对话框 |

## 使用指南

指南用截图介绍了扩展的每个部分。可以从 [docs/README.md](../README.md) 开始，也可以打开[指南文件夹](../guides/)。如果想像网页一样阅读，请在浏览器中打开 `docs/index.html`。

## 参与项目

欢迎提交 bug 报告、翻译修正和小的 pull request。请先阅读 [CONTRIBUTING.md](../../.github/CONTRIBUTING.md)。发送 pull request 之前，请运行下面的检查。它需要 Node.js 24 或更新版本，不需要安装依赖。

```bash
node scripts/validate.mjs
node scripts/test.mjs
```

安全问题请私下报告。见 [SECURITY.md](../../.github/SECURITY.md)。

如果 Bookmark Scope 帮你节省了时间，可以[请我喝杯咖啡](https://buymeacoffee.com/enaloo)。在 [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) 上给个评分，也能让更多人找到它。

## 贡献者

感谢所有帮助过这个项目的人。你的第一个贡献被合并后，你的头像会出现在这里。详情见 [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#recognition)。

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="Contributors" width="400"></a>


## 许可证

[MIT](../../LICENSE)。版权所有 2026 Ehsan Enaloo。

Bookmark Scope 的代码采用 MIT 许可证。有两部分来自其他项目，保留各自的许可证：Public Suffix List（域名后缀列表，例如 `.co.uk`，MPL-2.0）和 [Lucide](https://lucide.dev) 图标（ISC）。完整文本见 [extension/THIRD_PARTY_NOTICES.md](../../extension/THIRD_PARTY_NOTICES.md)。
