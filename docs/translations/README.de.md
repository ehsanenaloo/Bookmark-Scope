[English](../../README.md) · [فارسی](README.fa.md) · [Español](README.es.md) · [Français](README.fr.md) · **Deutsch** · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md)

<div align="center">

<img src="../../extension/icons/icon-128.png" alt="Bookmark-Scope-Logo" width="88" height="88">

# Bookmark Scope

**Finde die Lesezeichen für die Seite, auf der du gerade bist. Räum den Rest deiner Sammlung auf.**

Eine kostenlose Open-Source-Browser-Erweiterung für alle, die zu viele Links gespeichert haben.<br>
Sie läuft nur auf deinem Computer. Kein Konto, kein Tracking.

[![Zu Chrome hinzufügen](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)
[![Benutzerhandbuch](https://img.shields.io/badge/User%20guide-Read%20online-0f766e?logo=readthedocs&logoColor=white&style=for-the-badge)](https://ehsanenaloo.github.io/Bookmark-Scope/)
[![Spendier mir einen Kaffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/enaloo)

[![Lizenz: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 Sprachen](https://img.shields.io/badge/languages-52-orange)
![Keine Analyse-Tools](https://img.shields.io/badge/analytics-none-lightgrey)
[![GitHub-Sterne](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

[Funktionen](#features) · [Installation](#install) · [Datenschutz](#privacy) · [Dokumentation](#documentation) · [FAQ](#faq) · [Mitmachen](#contributing)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/dashboard-desktop-dark.png">
  <img src="../assets/screenshots/dashboard-desktop-light.png" alt="Das Bookmark-Scope-Dashboard mit einer Liste von Lesezeichen, Filtern, Tags und einem Detailbereich">
</picture>

## Was ist Bookmark Scope?

Chrome zeigt deine Lesezeichen als Ordnerbaum. Bei zwanzig Links reicht das, bei zweitausend nicht mehr. Du speicherst denselben Artikel dreimal, die Hälfte eines alten Ordners besteht aus toten Links, und du weißt nicht, was du für die Seite, die du gerade liest, schon gespeichert hast.

Bookmark Scope löst das mit zwei Werkzeugen. Das **Popup** zeigt die Lesezeichen, die du schon für die aktuelle Seite, Website oder Domain hast. Das **Dashboard** zeigt deine ganze Sammlung. Dort findest du Duplikate und tote Links und räumst mit wenigen Klicks auf, mit einer Vorschau, bevor sich etwas ändert.

<a id="features"></a>

## Funktionen

| | |
| --- | --- |
| **Popup für die aktuelle Seite** <br> Sieh deine gespeicherten Lesezeichen für diese Seite, diesen Host oder diese Domain. Das Badge in der Symbolleiste zeigt, wie viele passen. | **Dashboard für deine ganze Sammlung** <br> Durchsuche, filtere, gruppiere, sortiere, tagge und bearbeite Tausende Lesezeichen. Es bleibt schnell. |
| **Sicheres Aufräumen** <br> Sieh dir das Zusammenführen von Duplikaten und Tag-Änderungen für mehrere Lesezeichen vorher in einer Vorschau an. Gelöschtes kannst du rückgängig machen, samt Tags. | **Prüfung auf tote Links** <br> Finde kaputte und weitergeleitete Links. Sie ist optional, und lange Scans lassen sich pausieren und später fortsetzen. |
| **Backup und Import** <br> Speichere Snapshots deiner Sammlung. Importiere aus `bookmarks.html`, Pocket, Pinboard, Raindrop.io, CSV und JSON. Exportiere als JSON oder CSV. | **Gespeicherte Ansichten und Befehlspalette** <br> Öffne eine gespeicherte Suche mit einem Klick. Drück `Ctrl+Shift+P` (auf dem Mac `Cmd+Shift+P`) für alle Aktionen. |
| **Privat von Grund auf** <br> Kein Server, kein Konto, keine Analyse-Tools. Deine Daten bleiben in deinem Browser. | **Deine Sprache und dein Look** <br> 52 Sprachen, helles und dunkles Design, vier Farbpaletten, Layouts von rechts nach links. |

<p align="center">
  <img src="../assets/screenshots/popup-light.png" alt="Das Popup mit den Lesezeichen für die aktuelle Website" width="230">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/duplicate-preview.png" alt="Der Vorschau-Dialog für Duplikate, in dem du wählst, welches Lesezeichen du behältst" width="520">
</p>
<p align="center">
  <img src="../assets/screenshots/library-tools.png" alt="Sammlungswerkzeuge: gespeicherte Ansichten, Tags für mehrere Lesezeichen, Duplikate, Scans, Backup und Import" width="390">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/command-palette.png" alt="Die Befehlspalette mit einer Liste von Aktionen" width="390">
</p>

<a id="install"></a>

## Installation

| Browser | Status | Wie |
| --- | --- | --- |
| **Chrome** | Getestet | [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) |
| **Edge, Brave** | Funktioniert | Installiere von derselben Seite im Chrome Web Store. Noch nicht bei Edge Add-ons gelistet. |
| **Firefox 140+** (Desktop) | Experimentell | [Temporäre Installation von der Releases-Seite](#firefox-experimental) |
| **Safari** | Nicht unterstützt | |

**Chrome, Edge und Brave:** Öffne die Store-Seite, klick auf **Add to Chrome**, klick dann auf das Puzzle-Symbol in der Symbolleiste und pinne Bookmark Scope an.

<a id="firefox-experimental"></a>

**Firefox (experimentell):** Die Erweiterung ist noch nicht bei Firefox Add-ons verfügbar.

1. Lade `bookmark-scope-<version>-firefox.zip` von der [Releases-Seite](https://github.com/ehsanenaloo/Bookmark-Scope/releases) herunter.
2. Öffne in Firefox `about:debugging#/runtime/this-firefox`.
3. Klick auf **Load Temporary Add-on** und wähle die ZIP-Datei.

Firefox entfernt temporäre Add-ons beim Beenden. Mehr dazu steht in der [Installationsanleitung](https://ehsanenaloo.github.io/Bookmark-Scope/guides/installation.html#firefox-experimental).

**Aus dem Quellcode:** Es gibt keinen Build-Schritt. Der Ordner `extension/` ist die Erweiterung. Öffne `chrome://extensions`, schalte den **Entwicklermodus** ein, klick auf **Entpackte Erweiterung laden** und wähle den Ordner `extension`.

<a id="privacy"></a>

## Datenschutz

- Es gibt keinen Server, kein Konto, keine Analyse-Tools und keine Werbung.
- Deine Lesezeichen, Tags und Einstellungen bleiben in deinem Browser.
- Die einzigen Netzwerkanfragen sind Linkprüfungen an die Seiten, die du gespeichert hast, und nur, nachdem du sie erlaubt hast. Alles andere funktioniert ohne diese Berechtigung.
- Die Erweiterung liest die Seiten, die du besuchst, nicht. Sie liest nur die Adresse des aktiven Tabs, um passende Lesezeichen zu zeigen.

Lies die [Datenschutzerklärung](https://ehsanenaloo.github.io/Bookmark-Scope/privacy.html) für Details und die Liste der Berechtigungen.

<a id="documentation"></a>

## Dokumentation

| | |
| --- | --- |
| [Benutzerhandbuch](https://ehsanenaloo.github.io/Bookmark-Scope/) | Jede Funktion, mit Screenshots |
| [Bekannte Grenzen](https://ehsanenaloo.github.io/Bookmark-Scope/guides/limits.html) | Was unfertig oder ungetestet ist |
| [Datenschutzerklärung](https://ehsanenaloo.github.io/Bookmark-Scope/privacy.html) | Was die Erweiterung speichert und sendet |
| [Änderungsprotokoll](../../CHANGELOG.md) | Was sich in jeder Version geändert hat |
| [Mitmachen](../../.github/CONTRIBUTING.md) | Wie du Fehler meldest und Änderungen einschickst |
| [Sicherheit](../../.github/SECURITY.md) | Wie du ein Sicherheitsproblem privat meldest |

<a id="faq"></a>

## FAQ

<details>
<summary><b>Sendet sie meine Lesezeichen irgendwohin?</b></summary>

Nein. Es gibt keinen Server. Deine Lesezeichen bleiben in deinem Browser. Die Erweiterung kontaktiert nur die Seiten, die du gespeichert hast, wenn du eine Linkprüfung startest und sie erlaubt hast.
</details>

<details>
<summary><b>Ändert oder löscht sie Lesezeichen von selbst?</b></summary>

Nein. Sie ändert Lesezeichen nur, wenn du es willst. Zusammenführungen und Tag-Änderungen für mehrere Lesezeichen zeigen zuerst eine Vorschau, und beim Löschen wirst du um eine Bestätigung gebeten.
</details>

<details>
<summary><b>Kann ich ein gelöschtes Lesezeichen zurückholen?</b></summary>

Ja, nutze Rückgängig. Das Lesezeichen kommt mit seinen Tags in seinen Ordner zurück. Browser erlauben keiner Erweiterung, die ursprüngliche ID oder das Hinzufügedatum wiederherzustellen. Das wiederhergestellte Lesezeichen ist also ein neues.
</details>

<details>
<summary><b>Funktioniert sie mit anderen Lesezeichen-Managern?</b></summary>

Du kannst aus Chrome, Edge, Firefox, Safari und Brave (die Datei `bookmarks.html`), Pocket, Pinboard, Raindrop.io sowie aus CSV- und JSON-Dateien importieren. Importe sind flach: Ordner werden als Pfad angezeigt, aber nicht angelegt.
</details>

<details>
<summary><b>Wie melde ich ein Problem oder wünsche mir eine Funktion?</b></summary>

[Eröffne ein Issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues). Bitte füge nicht deine echte Lesezeichenliste bei. Bei Sicherheitsproblemen lies [SECURITY.md](../../.github/SECURITY.md).
</details>

## Übersetzungen

Die Übersetzungen sind maschinell erstellt und können Fehler enthalten oder einzelne englische Wörter lassen. Wenn eine dieser Sprachen deine Muttersprache ist und du eine richtige, natürliche Übersetzung schreiben kannst, hilf uns: [Eröffne ein Issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues) oder schick einen Pull Request. Mehr dazu in [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#translations).

<a id="contributing"></a>

## Mitmachen

Fehlerberichte, Übersetzungskorrekturen und kleine Pull Requests sind willkommen. Lies zuerst [CONTRIBUTING.md](../../.github/CONTRIBUTING.md).

Wenn dir Bookmark Scope Zeit spart, kannst du mir [einen Kaffee spendieren](https://buymeacoffee.com/enaloo). Eine Bewertung im [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) hilft außerdem anderen, die Erweiterung zu finden.

### Mitwirkende

Danke an alle, die geholfen haben. Dein Name erscheint hier, sobald dein erster Beitrag übernommen wurde.

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="Mitwirkende"></a>

## Lizenz

[MIT](../../LICENSE). Copyright 2026 Ehsan Enaloo.

Der Code der Erweiterung steht unter der MIT-Lizenz. Zwei Teile stammen aus anderen Projekten und behalten ihre eigenen Lizenzen: die Public Suffix List (eine Liste von Domain-Endungen wie `.co.uk`, MPL-2.0) und die Symbole von [Lucide](https://lucide.dev) (ISC). Die vollständigen Texte stehen in [extension/THIRD_PARTY_NOTICES.md](../../extension/THIRD_PARTY_NOTICES.md).
