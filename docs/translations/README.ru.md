[English](../../README.md) · [فارسی](README.fa.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português (Brasil)](README.pt-BR.md) · **Русский** · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md)

<div align="center">

<img src="../../extension/icon-128.png" alt="Логотип Bookmark Scope" width="88" height="88">

# Bookmark Scope

**Находите закладки для сайта, на котором вы сейчас. Наводите порядок в остальных.**

Бесплатное браузерное расширение с открытым кодом для тех, кто накопил слишком много ссылок.<br>
Работает только на вашем компьютере. Без аккаунта и без слежки.

[![Добавить в Chrome](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)
[![Руководство пользователя](https://img.shields.io/badge/User%20guide-Read%20online-0f766e?logo=readthedocs&logoColor=white&style=for-the-badge)](https://ehsanenaloo.github.io/Bookmark-Scope/)
[![Угостить кофе](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/enaloo)

[![Лицензия: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 языка](https://img.shields.io/badge/languages-52-orange)
![Без аналитики](https://img.shields.io/badge/analytics-none-lightgrey)
[![Звёзды на GitHub](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

[Возможности](#features) · [Установка](#install) · [Приватность](#privacy) · [Документация](#documentation) · [Вопросы и ответы](#faq) · [Как помочь проекту](#contributing)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/dashboard-desktop-dark.png">
  <img src="../assets/screenshots/dashboard-desktop-light.png" alt="Панель Bookmark Scope со списком закладок, фильтрами, тегами и панелью сведений">
</picture>

## Что такое Bookmark Scope?

Chrome показывает закладки в виде дерева папок. Для двадцати ссылок это удобно, для двух тысяч нет. Одну и ту же статью вы сохраняете три раза, половина старой папки состоит из мёртвых ссылок, а что вы уже сохранили для сайта, который читаете сейчас, понять нельзя.

Bookmark Scope решает это двумя инструментами. **Всплывающее окно** показывает закладки, которые у вас уже есть для страницы, сайта или домена, где вы сейчас. **Панель** показывает всю библиотеку, чтобы вы могли найти дубликаты и мёртвые ссылки и убрать их за несколько кликов. Перед любым изменением вы видите предпросмотр.

<a id="features"></a>

## Возможности

| | |
| --- | --- |
| **Всплывающее окно для текущего сайта** <br> Смотрите сохранённые закладки для этой страницы, хоста или домена. Число на значке в панели инструментов показывает, сколько закладок подходит. | **Панель для всей библиотеки** <br> Ищите, фильтруйте, группируйте, сортируйте, размечайте тегами и правьте тысячи закладок. Она не тормозит. |
| **Безопасная очистка** <br> Сначала смотрите предпросмотр объединения дубликатов и массовых изменений тегов. Удалённое можно вернуть вместе с тегами. | **Проверка мёртвых ссылок** <br> Находите сломанные и перенаправленные ссылки. Функция включается по желанию, а долгую проверку можно поставить на паузу и продолжить. |
| **Резервные копии и импорт** <br> Сохраняйте снимки библиотеки. Импортируйте из `bookmarks.html`, Pocket, Pinboard, Raindrop.io, CSV и JSON. Экспортируйте в JSON или CSV. | **Сохранённые виды и палитра команд** <br> Открывайте сохранённый поиск одним кликом. Нажмите `Ctrl+Shift+P` (`Cmd+Shift+P` на Mac), чтобы увидеть все действия. |
| **Приватность по умолчанию** <br> Нет сервера, аккаунта и аналитики. Ваши данные остаются в вашем браузере. | **Ваш язык и внешний вид** <br> 52 языка, светлая и тёмная темы, четыре цветовые палитры, раскладка справа налево. |

<p align="center">
  <img src="../assets/screenshots/popup-light.png" alt="Всплывающее окно с закладками для текущего сайта" width="230">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/duplicate-preview.png" alt="Окно предпросмотра дубликатов, где вы выбираете, какую закладку оставить" width="520">
</p>
<p align="center">
  <img src="../assets/screenshots/library-tools.png" alt="Инструменты библиотеки: сохранённые виды, массовые теги, дубликаты, проверки, резервные копии и импорт" width="390">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/command-palette.png" alt="Палитра команд со списком действий" width="390">
</p>

<a id="install"></a>

## Установка

| Браузер | Статус | Как |
| --- | --- | --- |
| **Chrome** | Проверено | [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) |
| **Edge, Brave** | Работает | Установите с той же страницы Chrome Web Store. В Edge Add-ons пока нет. |
| **Firefox 140+** (настольный) | Экспериментально | [Временная установка со страницы Releases](#firefox-experimental) |
| **Safari** | Не поддерживается | |

**Chrome, Edge и Brave:** откройте страницу в магазине, нажмите **Добавить в Chrome** (**Add to Chrome**), затем нажмите на значок пазла на панели инструментов и закрепите Bookmark Scope.

<a id="firefox-experimental"></a>

**Firefox (экспериментально):** его ещё нет в Firefox Add-ons.

1. Скачайте `bookmark-scope-<version>-firefox.zip` со [страницы Releases](https://github.com/ehsanenaloo/Bookmark-Scope/releases).
2. В Firefox откройте `about:debugging#/runtime/this-firefox`.
3. Нажмите **Load Temporary Add-on** и выберите zip-файл.

Firefox удаляет временные дополнения при закрытии. Подробнее в [руководстве по установке](https://ehsanenaloo.github.io/Bookmark-Scope/guides/installation.html#firefox-experimental).

**Из исходников:** сборки нет. Папка `extension/` и есть расширение. Откройте `chrome://extensions`, включите **Режим разработчика** (**Developer mode**), нажмите **Загрузить распакованное расширение** (**Load unpacked**) и выберите папку `extension`.

<a id="privacy"></a>

## Приватность

- Нет сервера, аккаунта, аналитики и рекламы.
- Ваши закладки, теги и настройки остаются в вашем браузере.
- Единственные сетевые запросы идут к сайтам из ваших закладок при проверке ссылок, и только после вашего разрешения. Всё остальное работает без этого разрешения.
- Расширение не читает страницы, которые вы открываете. Оно смотрит только адрес активной вкладки, чтобы показать подходящие закладки.

Подробности и список разрешений есть в [политике конфиденциальности](https://ehsanenaloo.github.io/Bookmark-Scope/privacy.html).

<a id="documentation"></a>

## Документация

| | |
| --- | --- |
| [Руководство пользователя](https://ehsanenaloo.github.io/Bookmark-Scope/) | Все функции со скриншотами |
| [Известные ограничения](https://ehsanenaloo.github.io/Bookmark-Scope/guides/limits.html) | Что не закончено или не проверено |
| [Политика конфиденциальности](https://ehsanenaloo.github.io/Bookmark-Scope/privacy.html) | Что расширение хранит и отправляет |
| [Список изменений](../../CHANGELOG.md) | Что изменилось в каждом выпуске |
| [Как участвовать](../../.github/CONTRIBUTING.md) | Как сообщить об ошибке и предложить изменения |
| [Безопасность](../../.github/SECURITY.md) | Как сообщить о проблеме безопасности в личном порядке |

<a id="faq"></a>

## Вопросы и ответы

<details>
<summary><b>Отправляет ли расширение мои закладки куда-нибудь?</b></summary>

Нет. Сервера нет. Ваши закладки остаются в браузере. Расширение обращается только к сайтам из ваших закладок, когда вы запускаете проверку ссылок и разрешили её.
</details>

<details>
<summary><b>Будет ли оно само менять или удалять закладки?</b></summary>

Нет. Оно меняет закладки только по вашей просьбе. Перед объединением и массовым изменением тегов показывается предпросмотр, а удаление нужно подтвердить.
</details>

<details>
<summary><b>Можно ли вернуть удалённую закладку?</b></summary>

Да, нажмите «Отменить» (Undo). Закладка вернётся в свою папку вместе с тегами. Браузеры не позволяют расширениям восстановить прежний ID и дату добавления, поэтому восстановленная закладка будет новой.
</details>

<details>
<summary><b>Работает ли оно с другими менеджерами закладок?</b></summary>

Можно импортировать из Chrome, Edge, Firefox, Safari и Brave (файл `bookmarks.html`), Pocket, Pinboard, Raindrop.io, а также из файлов CSV и JSON. Импорт плоский: папки показываются как путь, но не создаются.
</details>

<details>
<summary><b>Как сообщить о проблеме или предложить функцию?</b></summary>

[Откройте issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues). Пожалуйста, не прикладывайте свой настоящий список закладок. О проблемах безопасности читайте в [SECURITY.md](../../.github/SECURITY.md).
</details>

## Переводы

Переводы сделаны машиной, поэтому в них могут быть ошибки или остаться английские слова. Если один из этих языков для вас родной и вы можете написать правильный, естественный перевод, помогите нам: [откройте issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues) или отправьте pull request. См. [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#translations).

<a id="contributing"></a>

## Как помочь проекту

Мы рады отчётам об ошибках, исправлениям переводов и небольшим pull request. Сначала прочитайте [CONTRIBUTING.md](../../.github/CONTRIBUTING.md).

Если Bookmark Scope экономит вам время, можете [угостить меня кофе](https://buymeacoffee.com/enaloo). Оценка в [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) тоже помогает другим людям найти расширение.

### Участники

Спасибо всем, кто помогал проекту. Ваше имя появится здесь после первого принятого вклада.

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="Участники"></a>

## Лицензия

[MIT](../../LICENSE). Copyright 2026 Ehsan Enaloo.

Код расширения распространяется по лицензии MIT. Две части взяты из других проектов и сохраняют свои лицензии: Public Suffix List (список окончаний доменов, например `.co.uk`, MPL-2.0) и значки [Lucide](https://lucide.dev) (ISC). Полные тексты лицензий есть в [extension/THIRD_PARTY_NOTICES.md](../../extension/THIRD_PARTY_NOTICES.md).
