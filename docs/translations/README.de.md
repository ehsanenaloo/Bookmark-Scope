[English](../../README.md) · [فارسی](README.fa.md) · [Español](README.es.md) · [Français](README.fr.md) · **Deutsch** · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md)

<div align="center">

<img src="../../extension/icon-128.png" alt="Bookmark-Scope-Logo" width="88" height="88">

# Bookmark Scope

**Finde die Lesezeichen für die Seite, auf der du gerade bist. Räum den Rest deiner Sammlung auf.**

Eine kostenlose Chrome-Erweiterung für alle, die zu viele Links gespeichert haben.<br>
Sie läuft nur auf deinem Computer. Kein Konto, kein Tracking.

[![Zu Chrome hinzufügen](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)
[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/enaloo)

[![Lizenz: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 Sprachen](https://img.shields.io/badge/languages-52-orange)
![Keine Analyse-Tools](https://img.shields.io/badge/analytics-none-lightgrey)

[![GitHub stars](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/dashboard-desktop-dark.png">
  <img src="../assets/screenshots/dashboard-desktop-light.png" alt="Das Bookmark-Scope-Dashboard mit einer Liste von Lesezeichen, Filtern, Tags und einem Detailbereich">
</picture>

## Warum es das gibt

Chrome zeigt deine Lesezeichen als Ordnerbaum. Das reicht für zwanzig Links. Für zweitausend reicht es nicht.

Du speicherst denselben Artikel dreimal. Ein Ordner aus dem Jahr 2019 besteht zur Hälfte aus toten Links. Du hast elf Lesezeichen zu einer Website und findest das eine nicht, das du suchst. Bookmark Scope hilft dir bei diesen Problemen.

- Öffne das Popup auf einer beliebigen Seite. Du siehst die Lesezeichen, die du schon für diese Seite, diese Website oder diese Domain hast.
- Öffne das Dashboard. Du siehst deine ganze Sammlung, findest Duplikate und tote Links und behebst sie mit wenigen Klicks.

## Was du damit machen kannst

### Sieh, was du für diese Website schon gespeichert hast

Klick auf das Symbol in der Symbolleiste. Das Popup listet deine Lesezeichen für die aktuelle Seite auf. Du kannst zwischen dieser genauen Seite, diesem Host oder der ganzen Domain wechseln. Das Badge am Symbol zeigt, wie viele Lesezeichen passen.

<p align="center">
  <img src="../assets/screenshots/popup-light.png" alt="Das Popup mit den Lesezeichen für die aktuelle Website" width="300">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/popup-dark.png" alt="Das Popup im dunklen Design" width="300">
</p>

### Sieh deine ganze Sammlung

Das Dashboard ist eine eigene Seite für deine Lesezeichen. Du kannst nach Titel, Adresse oder Ordner suchen. Du kannst nach Domain oder Ordner gruppieren. Du kannst nach Titel, Adresse oder Datum sortieren. Du kannst nach Duplikaten, Lesezeichen ohne Titel, alten Lesezeichen und Titelkollisionen filtern. Auch mit Tausenden Lesezeichen bleibt es schnell.

Klick auf ein Lesezeichen, um die Details zu sehen. Hak mehrere an, um sie zusammen zu bearbeiten. Zieh Lesezeichen, um ihre Reihenfolge zu ändern.

### Aufräumen ohne Angst

Nichts Großes passiert ohne Vorschau.

<p align="center">
  <img src="../assets/screenshots/duplicate-preview.png" alt="Der Vorschau-Dialog für Duplikate, in dem du wählst, welches Lesezeichen du behältst" width="780">
</p>

- **Duplikate.** Du wählst, welche Kopie bleibt. Die Tags der anderen Kopien werden zu ihr hinzugefügt. Du siehst das Ergebnis, bevor etwas gelöscht wird.
- **Tags.** Füge Tags für viele Lesezeichen gleichzeitig hinzu, entferne, benenne um oder führe sie zusammen. Prüf das Vorher und Nachher, dann wende es an. Du kannst es rückgängig machen.
- **Löschen und Rückgängig.** Gelöschte Lesezeichen lassen sich mit ihren Tags wiederherstellen. Chrome erlaubt es keiner Erweiterung, die ursprüngliche ID oder das Hinzufügedatum zurückzubringen. Das wiederhergestellte Lesezeichen ist also neu. Die Erweiterung sagt dir das.

<p align="center">
  <img src="../assets/screenshots/bulk-tags.png" alt="Der Dialog für Tags bei mehreren Lesezeichen, der die Tags vor und nach der Änderung zeigt" width="780">
</p>

### Tote Links finden

Prüf eine Gruppe von Lesezeichen und sieh, welche Links funktionieren, welche weiterleiten und welche kaputt sind. Die Prüfung läuft in deinem Browser und kontaktiert nur die Websites, die du als Lesezeichen gespeichert hast.

- Sie fragt zuerst nach deiner Erlaubnis. Wenn du Nein sagst, funktioniert alles andere weiter.
- Du kannst einen langen Scan pausieren und später fortsetzen.
- Du kannst einen geplanten Scan einschalten. Er ist standardmäßig aus.
- "Repair redirected" aktualisiert Lesezeichen, die an eine neue Adresse umgezogen sind. Es gibt dafür kein Rückgängig, schau dir die neue Adresse also vorher an.

### Sichern und umziehen

- **Snapshot.** Speichere deine ganze Sammlung mit Ordnern und Tags in einer Datei. Stell sie später in einem neuen Ordner wieder her.
- **Import.** Hol Lesezeichen aus Chrome, Edge, Firefox, Safari oder Brave (die Datei `bookmarks.html`), aus Pocket, Pinboard, Raindrop.io oder aus einer CSV-Datei, JSON-Datei oder einfachen Linkliste. Du siehst eine Vorschau und wählst, was mit Duplikaten passiert: behalten, überspringen oder zusammenführen.
- **Export.** Speichere die Lesezeichen, die du gerade siehst, als JSON oder CSV.

<p align="center">
  <img src="../assets/screenshots/library-tools.png" alt="Werkzeuge für die Sammlung: gespeicherte Ansichten, Tags für mehrere Lesezeichen, Duplikate, Scans, Backup und Import" width="780">
</p>

### Schneller arbeiten

- **Befehlspalette.** Drück `Ctrl+Shift+P` (auf dem Mac `Cmd+Shift+P`) und tipp, was du tun willst.
- **Gespeicherte Ansichten.** Speichere eine Suche mit ihren Filtern, Tags, Sortierung und Gruppierung. Öffne sie mit einem Klick wieder.
- **Rechtsklick-Menü.** Zeig auf jeder Seite oder bei jedem Link deine Lesezeichen für diese Domain an oder such Duplikate dieses Links.
- **Erinnerungen zum Aufräumen.** Schalte sie in den Einstellungen ein, wenn du alle paar Wochen einen Anstoß zum Aufräumen möchtest.

<p align="center">
  <img src="../assets/screenshots/command-palette.png" alt="Die Befehlspalette mit einer Liste von Aktionen" width="780">
</p>

### Mach es zu deinem

Helles, dunkles oder System-Design. Vier Farbpaletten. Layouts von rechts nach links. Die Erweiterung enthält 52 Sprachen (siehe [Gut zu wissen](#good-to-know)).

<p align="center">
  <img src="../assets/screenshots/options-light.png" alt="Die Einstellungsseite" width="300">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/dashboard-rtl-dark.png" alt="Das Dashboard auf Persisch mit Layout von rechts nach links im dunklen Design" width="300">
</p>

## Installation

**Aus dem Chrome Web Store (am einfachsten)**

1. Öffne die [Seite von Bookmark Scope](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo).
2. Klick auf **Add to Chrome**.
3. Klick auf das Puzzle-Symbol in der Symbolleiste und pinne Bookmark Scope an.

Andere Chromium-Browser wie Edge und Brave können die Erweiterung meist von derselben Seite installieren. Ich teste nur mit Chrome. Firefox und Safari werden nicht unterstützt.

**Aus diesem Repository**

Es gibt keinen Build-Schritt. Der Ordner `extension` ist die Erweiterung.

1. Lade dieses Repository herunter oder klone es.
2. Öffne `chrome://extensions` und schalte den **Entwicklermodus** ein.
3. Klick auf **Entpackte Erweiterung laden** und wähle den Ordner `extension` im Repository (er enthält `manifest.json`), nicht den obersten Ordner.

Eine entpackte Kopie hat ihre eigene Erweiterungs-ID. Du kannst sie neben der Store-Version behalten, aber die beiden teilen keine Daten, und die entpackte Kopie aktualisiert sich nicht von selbst.

## Deine Daten bleiben bei dir

Es gibt keinen Server. Es gibt kein Konto, keine Analyse-Tools und keine Werbung. Deine Lesezeichen, Tags und Einstellungen bleiben in deinem Browser. Die [Datenschutzerklärung](../PRIVACY.md) nennt die Details.

Die Erweiterung liest nicht die Seiten, die du besuchst. Sie liest nur die Adresse des aktiven Tabs, damit sie passende Lesezeichen zeigen kann.

| Berechtigung | Wofür sie gebraucht wird |
| --- | --- |
| `bookmarks` | Deine Lesezeichen lesen und sie ändern, wenn du es willst |
| `tabs` | Die Adresse des aktiven Tabs lesen, für das Popup und das Badge |
| `storage` | Deine Einstellungen, Tags und Scan-Ergebnisse im Browser speichern |
| `alarms` | Optionale Erinnerungen und optionale geplante Scans ausführen |
| `notifications` | Erinnerungen und Scan-Ergebnisse anzeigen |
| `contextMenus` | Die Einträge im Rechtsklick-Menü hinzufügen |
| `clipboardWrite` | Adressen kopieren, wenn du auf einen Kopieren-Button klickst |
| `favicon` | Website-Symbole aus dem eigenen Cache des Browsers anzeigen |
| Websites (optional) | Wird nur gefragt, wenn du eine Linkprüfung startest, damit die Erweiterung die Websites kontaktieren kann, die du als Lesezeichen gespeichert hast |

<a id="good-to-know"></a>

## Gut zu wissen

- **Übersetzungen.** Die Übersetzungen sind maschinell erstellt und können Fehler enthalten oder einzelne englische Wörter lassen. Wenn eine dieser Sprachen deine Muttersprache ist und du eine richtige, natürliche Übersetzung schreiben kannst, hilf uns: [Eröffne ein Issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues) oder schick einen Pull Request. Mehr dazu in [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#translations).
- **Der Import ist flach.** Wenn du eine Datei `bookmarks.html` importierst, wird der Ordnername als Pfad angezeigt. Ordner werden aber nicht angelegt, und die ursprünglichen Datumsangaben bleiben nicht erhalten. Nimm einen Snapshot, wenn du einen Ordnerbaum wiederherstellen musst.
- **Linkprüfungen sind Hinweise.** Jede 4xx-Antwort gilt als kaputt. Eine Seite, die lädt, aber einen Fehler oder einen Login-Bildschirm zeigt, gilt als in Ordnung.
- **CSV.** Ich habe den CSV-Export mit dem Importer und mit einem echten Chrome-Download getestet. In Excel, Numbers oder Google Sheets habe ich ihn noch nicht geöffnet.
- **Tests.** Die Erweiterung ist in Chromium getestet. Siehe die [vollständige Liste der Grenzen](../guides/limits.html).

## Tastenkürzel

| Tasten | Was sie tun |
| --- | --- |
| `Ctrl+Shift+P` / `Cmd+Shift+P` | Die Befehlspalette öffnen |
| `/` | Zum Suchfeld springen |
| `Ctrl+A` / `Cmd+A` | Alle Lesezeichen in der aktuellen Liste auswählen |
| `Esc` | Einen Schritt zurück: eine Bearbeitung abbrechen, die Suche leeren, die Auswahl aufheben, einen Dialog schließen |

## Benutzerhandbuch

Das Handbuch erklärt jeden Teil der Erweiterung mit Screenshots. Fang mit [docs/README.md](../README.md) an oder öffne den [Ordner mit den Anleitungen](../guides/). Um es als Webseite zu lesen, öffne `docs/index.html` in deinem Browser.

## Hilf dem Projekt

Fehlerberichte, Übersetzungskorrekturen und kleine Pull Requests sind willkommen. Lies zuerst [CONTRIBUTING.md](../../.github/CONTRIBUTING.md). Bevor du einen Pull Request schickst, führ diese Prüfung aus. Sie braucht Node.js 24 oder neuer und keine Installation.

```bash
node scripts/validate.mjs
node scripts/test.mjs
```

Bitte melde Sicherheitsprobleme privat. Siehe [SECURITY.md](../../.github/SECURITY.md).

Wenn dir Bookmark Scope Zeit spart, kannst du mir [einen Kaffee spendieren](https://buymeacoffee.com/enaloo). Eine Bewertung im [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) hilft außerdem anderen, die Erweiterung zu finden.

## Mitwirkende

Danke an alle, die geholfen haben. Dein Name erscheint hier, sobald dein erster Beitrag übernommen wurde. Mehr dazu in [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#recognition).

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="Contributors"></a>


## Lizenz

[MIT](../../LICENSE). Copyright 2026 Ehsan Enaloo.

Der Code von Bookmark Scope steht unter der MIT-Lizenz. Zwei Teile stammen aus anderen Projekten und behalten ihre eigenen Lizenzen: die Public Suffix List (eine Liste von Domain-Endungen wie `.co.uk`, MPL-2.0) und die Symbole von [Lucide](https://lucide.dev) (ISC). Die vollständigen Texte stehen in [extension/THIRD_PARTY_NOTICES.md](../../extension/THIRD_PARTY_NOTICES.md).
