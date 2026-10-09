[English](../../README.md) · [فارسی](README.fa.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-CN.md) · **日本語** · [العربية](README.ar.md) · [हिन्दी](README.hi.md)

<div align="center">

<img src="../../extension/icons/icon-128.png" alt="Bookmark Scope のロゴ" width="88" height="88">

# Bookmark Scope

**いま見ているサイトのブックマークをすぐ探せます。残りのブックマークも整理できます。**

リンクを保存しすぎた人のための、無料のオープンソースのブラウザー拡張機能です。<br>
動作はあなたのパソコンの中だけです。アカウントも、トラッキングもありません。

[![Chrome に追加](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)
[![ユーザーガイド](https://img.shields.io/badge/User%20guide-Read%20online-0f766e?logo=readthedocs&logoColor=white&style=for-the-badge)](https://ehsanenaloo.github.io/Bookmark-Scope/)
[![コーヒーをおごる](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/enaloo)

[![ライセンス: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 の言語](https://img.shields.io/badge/languages-52-orange)
![アナリティクスなし](https://img.shields.io/badge/analytics-none-lightgrey)
[![GitHub のスター](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

[機能](#features) · [インストール](#install) · [プライバシー](#privacy) · [ドキュメント](#documentation) · [FAQ](#faq) · [コントリビュート](#contributing)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/dashboard-desktop-dark.png">
  <img src="../assets/screenshots/dashboard-desktop-light.png" alt="ブックマークの一覧、フィルター、タグ、詳細パネルが表示された Bookmark Scope のダッシュボード">
</picture>

## Bookmark Scope とは?

Chrome はブックマークをフォルダーのツリーで表示します。リンクが 20 件なら問題ありませんが、2,000 件になると使いにくくなります。同じ記事を 3 回保存していたり、古いフォルダーの半分がリンク切れだったりします。いま読んでいるサイトについて何を保存したのかも、わかりにくくなります。

Bookmark Scope は、2 つのツールでこの問題を解決します。**ポップアップ**は、いま開いているページ、サイト、ドメインについて、すでに持っているブックマークを表示します。**ダッシュボード**はライブラリ全体を表示します。重複やリンク切れを見つけて、数回のクリックで整理できます。何かが変わる前に、必ずプレビューで確認できます。

<a id="features"></a>

## 機能

| | |
| --- | --- |
| **いまのサイト用のポップアップ** <br> このページ、ホスト、ドメインについて保存したブックマークを表示します。ツールバーのバッジには、一致した数が出ます。 | **ライブラリ全体のダッシュボード** <br> 数千件のブックマークを、検索、絞り込み、グループ化、並べ替え、タグ付け、編集できます。動作は軽いままです。 |
| **安全な整理** <br> 重複の統合とタグの一括変更は、先にプレビューで確認できます。削除したものは、タグも含めて元に戻せます。 | **リンク切れのチェック** <br> 壊れたリンクとリダイレクトされるリンクを見つけます。自分で有効にする機能で、長いスキャンは一時停止して再開できます。 |
| **バックアップとインポート** <br> ライブラリのスナップショットを保存します。`bookmarks.html`、Pocket、Pinboard、Raindrop.io、CSV、JSON から取り込めます。JSON または CSV でエクスポートできます。 | **保存したビューとコマンドパレット** <br> 保存した検索をワンクリックで開きます。`Ctrl+Shift+P`(Mac では `Cmd+Shift+P`)を押すと、すべての操作が使えます。 |
| **プライバシーを重視した設計** <br> サーバーも、アカウントも、アナリティクスもありません。データはブラウザーの中に残ります。 | **好みの言語と見た目** <br> 52 の言語、ライトとダークのテーマ、4 つのカラーパレット、右から左へ書く言語のレイアウトに対応しています。 |

<p align="center">
  <img src="../assets/screenshots/popup-light.png" alt="現在のサイトのブックマークを表示したポップアップ" width="230">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/duplicate-preview.png" alt="どのブックマークを残すか選ぶ、重複プレビューのダイアログ" width="520">
</p>
<p align="center">
  <img src="../assets/screenshots/library-tools.png" alt="ライブラリのツール:保存したビュー、タグの一括変更、重複、スキャン、バックアップ、インポート" width="390">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/command-palette.png" alt="操作の一覧が表示されたコマンドパレット" width="390">
</p>

<a id="install"></a>

## インストール

| ブラウザー | 状態 | 方法 |
| --- | --- | --- |
| **Chrome** | テスト済み | [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) |
| **Edge** | 動作します | [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ioonncgajlliiajlebblkfkgagcgcnae) |
| **Brave** | 動作します | 同じ Chrome Web Store のページからインストールします。 |
| **Firefox 140 以降**(デスクトップ版) | 試験版 | [Releases ページから一時的にインストール](#firefox-experimental) |
| **Safari** | 非対応 | |

**Chrome、Brave:** ストアのページを開いて **Add to Chrome** をクリックします。次にツールバーのパズルのアイコンをクリックして、Bookmark Scope をピン留めします。

**Edge:** [Microsoft Edge Add-ons のページ](https://microsoftedge.microsoft.com/addons/detail/ioonncgajlliiajlebblkfkgagcgcnae)を開いて **Get** をクリックします。

<a id="firefox-experimental"></a>

**Firefox(試験版):** Firefox Add-ons にはまだ公開していません。

1. [Releases ページ](https://github.com/ehsanenaloo/Bookmark-Scope/releases)から `bookmark-scope-<version>-firefox.zip` をダウンロードします。
2. Firefox で `about:debugging#/runtime/this-firefox` を開きます。
3. **Load Temporary Add-on** をクリックして、zip ファイルを選びます。

一時的なアドオンは Firefox を閉じると削除されます。くわしくは[インストールガイド](https://ehsanenaloo.github.io/Bookmark-Scope/guides/installation.html#firefox-experimental)を見てください。

**ソースから:** ビルドの手順はありません。`extension/` フォルダーがそのまま拡張機能です。`chrome://extensions` を開いて、**デベロッパー モード**をオンにします。**パッケージ化されていない拡張機能を読み込む**をクリックして、`extension` フォルダーを選びます。

<a id="privacy"></a>

## プライバシー

- サーバーも、アカウントも、アナリティクスも、広告もありません。
- ブックマーク、タグ、設定は、ブラウザーの中に残ります。
- ネットワークへのリクエストは、ブックマークしたサイトに対するリンクチェックだけです。それも、あなたが許可した後にだけ行います。ほかの機能は、この許可がなくても使えます。
- 拡張機能は、あなたが見たページの内容を読みません。読むのは、一致するブックマークを表示するための、開いているタブのアドレスだけです。

くわしい内容と権限の一覧は、[プライバシーポリシー](https://ehsanenaloo.github.io/Bookmark-Scope/privacy.html)をご覧ください。

<a id="documentation"></a>

## ドキュメント

| | |
| --- | --- |
| [ユーザーガイド](https://ehsanenaloo.github.io/Bookmark-Scope/) | すべての機能を、スクリーンショット付きで説明 |
| [既知の制限](https://ehsanenaloo.github.io/Bookmark-Scope/guides/limits.html) | 未完成の部分と、未テストの部分 |
| [プライバシーポリシー](https://ehsanenaloo.github.io/Bookmark-Scope/privacy.html) | 拡張機能が保存するものと、送信するもの |
| [変更履歴](../../CHANGELOG.md) | 各リリースでの変更点 |
| [コントリビュート](../../.github/CONTRIBUTING.md) | バグの報告と変更の送り方 |
| [セキュリティ](../../.github/SECURITY.md) | セキュリティの問題を非公開で報告する方法 |

<a id="faq"></a>

## FAQ

<details>
<summary><b>ブックマークをどこかに送信しますか?</b></summary>

いいえ。サーバーはありません。ブックマークはブラウザーの中に残ります。拡張機能がアクセスするのは、リンクチェックを開始して、それを許可したときの、ブックマーク済みのサイトだけです。
</details>

<details>
<summary><b>ブックマークを勝手に変更したり削除したりしますか?</b></summary>

いいえ。あなたが操作したときだけ変更します。統合とタグの一括変更は先にプレビューを表示し、削除では確認を求めます。
</details>

<details>
<summary><b>削除したブックマークは戻せますか?</b></summary>

はい、「元に戻す」を使ってください。ブックマークは、タグも含めて元のフォルダーに戻ります。ブラウザーの仕様で、拡張機能は元の ID や追加日を復元できません。そのため、復元したブックマークは新しいものになります。
</details>

<details>
<summary><b>ほかのブックマーク管理ツールとも使えますか?</b></summary>

Chrome、Edge、Firefox、Safari、Brave(`bookmarks.html` ファイル)、Pocket、Pinboard、Raindrop.io、CSV と JSON のファイルから取り込めます。取り込みはフラットです。フォルダーはパスとして表示されますが、作成はされません。
</details>

<details>
<summary><b>問題の報告や機能のリクエストはどうすればいいですか?</b></summary>

[issue を作成](https://github.com/ehsanenaloo/Bookmark-Scope/issues)してください。実際のブックマークの一覧は含めないでください。セキュリティの問題については、[SECURITY.md](../../.github/SECURITY.md) をご覧ください。
</details>

## 翻訳

翻訳は機械翻訳なので、間違いがあったり、英語の単語が残っていたりすることがあります。これらの言語が母語で、正確で自然な翻訳を書ける方は、ぜひ協力してください。[issue を作成](https://github.com/ehsanenaloo/Bookmark-Scope/issues)するか、pull request を送ってください。詳しくは [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#translations) をご覧ください。

<a id="contributing"></a>

## コントリビュート

バグの報告、翻訳の修正、小さな pull request を歓迎します。最初に [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) を読んでください。

Bookmark Scope が時間の節約になったなら、[コーヒーをおごる](https://buymeacoffee.com/enaloo)こともできます。[Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) での評価も、ほかの人が見つける助けになります。

### コントリビューター

助けてくれたすべての方に感謝します。最初の貢献が取り込まれると、ここにお名前が表示されます。

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="コントリビューター"></a>

## ライセンス

[MIT](../../LICENSE)。Copyright 2026 Ehsan Enaloo.

拡張機能のコードは MIT ライセンスです。2 つの部分は、ほかのプロジェクトのもので、それぞれのライセンスのまま使っています。Public Suffix List(`.co.uk` のようなドメインの末尾を集めたリスト、MPL-2.0)と、[Lucide](https://lucide.dev) のアイコン(ISC)です。ライセンスの全文は [extension/THIRD_PARTY_NOTICES.md](../../extension/THIRD_PARTY_NOTICES.md) にあります。
