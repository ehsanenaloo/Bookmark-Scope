[English](../../README.md) · [فارسی](README.fa.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru.md) · **简体中文** · [日本語](README.ja.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md)

<div align="center">

<img src="../../extension/icons/icon-128.png" alt="Bookmark Scope 标志" width="88" height="88">

# Bookmark Scope

**找到当前网站对应的书签，再把其余的书签整理干净。**

一款免费、开源的浏览器扩展，给存了太多链接的人用。<br>
它只在你的电脑上运行。不用账号，没有追踪。

[![添加到 Chrome](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)
[![使用指南](https://img.shields.io/badge/User%20guide-Read%20online-0f766e?logo=readthedocs&logoColor=white&style=for-the-badge)](https://enaloo.com/apps/bookmark-scope/)
[![请我喝杯咖啡](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/enaloo)

[![许可证：MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 种语言](https://img.shields.io/badge/languages-52-orange)
![无统计分析](https://img.shields.io/badge/analytics-none-lightgrey)
[![GitHub 星标](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

[功能](#features) · [安装](#install) · [隐私](#privacy) · [文档](#documentation) · [常见问题](#faq) · [参与贡献](#contributing)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/dashboard-desktop-dark.png">
  <img src="../assets/screenshots/dashboard-desktop-light.png" alt="Bookmark Scope 仪表盘：书签列表、筛选器、标签和详情面板">
</picture>

## Bookmark Scope 是什么？

Chrome 把书签显示成文件夹树。存二十个链接时还好用，存两千个就不行了。同一篇文章你存了三次，旧文件夹里有一半是失效链接，而且你分不清自己为正在看的网站已经存过什么。

Bookmark Scope 用两个工具来解决这个问题。**弹出窗口**会显示你为当前页面、网站或域名已经保存的书签。**仪表盘**会显示你的整个书签库，你可以找出重复项和失效链接，几下点击就能清理，而且在任何改动发生之前都有预览。

<a id="features"></a>

## 功能

| | |
| --- | --- |
| **当前网站的弹出窗口** <br> 查看为这个页面、主机或域名保存的书签。工具栏上的角标会显示匹配的数量。 | **整个书签库的仪表盘** <br> 可以搜索、筛选、分组、排序、加标签和编辑几千个书签。速度依然很快。 |
| **安全的清理** <br> 合并重复项和批量修改标签之前，先预览结果。删除的书签可以撤销，标签也会一起恢复。 | **失效链接检查** <br> 找出失效和被重定向的链接。这个功能需要你主动开启，长时间的扫描可以暂停和继续。 |
| **备份和导入** <br> 保存书签库的快照。可以从 `bookmarks.html`、Pocket、Pinboard、Raindrop.io、CSV 和 JSON 导入。可以导出为 JSON 或 CSV。 | **已保存的视图和命令面板** <br> 一键打开保存好的搜索。按 `Ctrl+Shift+P`（Mac 上按 `Cmd+Shift+P`）可以使用所有操作。 |
| **默认保护隐私** <br> 没有服务器，没有账号，没有统计分析。你的数据留在你的浏览器里。 | **你的语言和外观** <br> 52 种语言，浅色和深色主题，四种配色，支持从右到左的布局。 |

<p align="center">
  <img src="../assets/screenshots/popup-light.png" alt="弹出窗口显示当前站点的书签" width="230">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/duplicate-preview.png" alt="重复项预览对话框，在这里选择保留哪个书签" width="520">
</p>
<p align="center">
  <img src="../assets/screenshots/library-tools.png" alt="书签库工具：已保存的视图、批量标签、重复项、扫描、备份和导入" width="390">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/command-palette.png" alt="带有操作列表的命令面板" width="390">
</p>

<a id="install"></a>

## 安装

| 浏览器 | 状态 | 方法 |
| --- | --- | --- |
| **Chrome** | 已测试 | [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) |
| **Edge** | 可用 | [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ioonncgajlliiajlebblkfkgagcgcnae) |
| **Brave** | 可用 | 从同一个 Chrome Web Store 页面安装。 |
| **Firefox 140 及以上**（桌面版） | 实验版 | [从 Releases 页面临时安装](#firefox-experimental) |
| **Safari** | 不支持 | |

**Chrome 和 Brave：** 打开商店页面，点击 **添加至 Chrome**，再点击工具栏上的拼图图标，把 Bookmark Scope 固定在工具栏。

**Edge：** 打开 [Microsoft Edge Add-ons 页面](https://microsoftedge.microsoft.com/addons/detail/ioonncgajlliiajlebblkfkgagcgcnae)，点击 **Get**。

<a id="firefox-experimental"></a>

**Firefox（实验版）：** 它还没有上架 Firefox Add-ons。

1. 从 [Releases 页面](https://github.com/ehsanenaloo/Bookmark-Scope/releases)下载 `bookmark-scope-<version>-firefox.zip`。
2. 在 Firefox 中打开 `about:debugging#/runtime/this-firefox`。
3. 点击 **Load Temporary Add-on**，选择 zip 文件。

Firefox 关闭时会移除临时附加组件。更多说明见[安装指南](https://enaloo.com/apps/bookmark-scope/docs/installation/#firefox-experimental)。

**从源码安装：** 不需要构建。`extension/` 文件夹本身就是扩展。打开 `chrome://extensions`，打开 **开发者模式**，点击 **加载已解压的扩展程序**，然后选择 `extension` 文件夹。

<a id="privacy"></a>

## 隐私

- 没有服务器，没有账号，没有统计分析，也没有广告。
- 你的书签、标签和设置都留在你的浏览器里。
- 唯一的网络请求是对你收藏的网站做链接检查，而且只有在你允许之后才会发出。其他功能不需要这项权限。
- 扩展不会读取你访问的页面内容。它只读取当前标签页的地址，用来显示匹配的书签。

详细说明和权限列表见[隐私政策](https://enaloo.com/apps/bookmark-scope/docs/privacy-policy/)。

<a id="documentation"></a>

## 文档

| | |
| --- | --- |
| [使用指南](https://enaloo.com/apps/bookmark-scope/) | 每个功能的说明，附截图 |
| [已知限制](https://enaloo.com/apps/bookmark-scope/docs/limits/) | 哪些还没做完或没测试过 |
| [隐私政策](https://enaloo.com/apps/bookmark-scope/docs/privacy-policy/) | 扩展会保存和发送什么 |
| [更新日志](../../CHANGELOG.md) | 每个版本的变化 |
| [参与贡献](../../.github/CONTRIBUTING.md) | 如何报告 bug 和提交修改 |
| [安全](../../.github/SECURITY.md) | 如何私下报告安全问题 |

<a id="faq"></a>

## 常见问题

<details>
<summary><b>它会把我的书签发送到别处吗？</b></summary>

不会。没有服务器。你的书签留在你的浏览器里。只有当你开始链接检查并且已经允许时，扩展才会访问你收藏的那些网站。
</details>

<details>
<summary><b>它会自己修改或删除书签吗？</b></summary>

不会。只有你要求时，它才会修改书签。合并和批量修改标签会先显示预览，删除时会请你确认。
</details>

<details>
<summary><b>删除的书签能找回来吗？</b></summary>

可以，使用撤销。书签会带着它的标签回到原来的文件夹。浏览器不允许任何扩展恢复原来的 ID 或添加日期，所以恢复后的书签是一个新书签。
</details>

<details>
<summary><b>它能和其他书签管理工具一起用吗？</b></summary>

你可以从 Chrome、Edge、Firefox、Safari 和 Brave（`bookmarks.html` 文件）、Pocket、Pinboard、Raindrop.io、CSV 和 JSON 文件导入。导入是平铺的：文件夹会显示为路径，但不会被创建。
</details>

<details>
<summary><b>如何报告问题或提出功能建议？</b></summary>

[提交 issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues)。请不要附上你真实的书签列表。安全问题请见 [SECURITY.md](../../.github/SECURITY.md)。
</details>

## 翻译

翻译是机器翻译的，可能有错误，也可能留有一些英文单词。如果其中某种语言是你的母语，并且你能写出准确、自然的译文，欢迎一起完善：[提交 issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues) 或发送 pull request。详情见 [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#translations)。

<a id="contributing"></a>

## 参与贡献

欢迎提交 bug 报告、翻译修正和小的 pull request。请先阅读 [CONTRIBUTING.md](../../.github/CONTRIBUTING.md)。

如果 Bookmark Scope 帮你节省了时间，可以[请我喝杯咖啡](https://buymeacoffee.com/enaloo)。在 [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) 上给个评分，也能让更多人找到它。

### 贡献者

感谢所有帮助过这个项目的人。你的第一个贡献被合并后，你的名字会出现在这里。

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="贡献者"></a>

## 许可证

[MIT](../../LICENSE)。版权所有 2026 Ehsan Enaloo。

扩展的代码采用 MIT 许可证。有两部分来自其他项目，保留各自的许可证：Public Suffix List（域名后缀列表，例如 `.co.uk`，MPL-2.0）和 [Lucide](https://lucide.dev) 图标（ISC）。完整文本见 [extension/THIRD_PARTY_NOTICES.md](../../extension/THIRD_PARTY_NOTICES.md)。
