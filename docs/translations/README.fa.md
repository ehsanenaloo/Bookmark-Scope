[English](../../README.md) · **فارسی** · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md)

<div dir="rtl" align="right">

<div align="center">

<img src="../../extension/icons/icon-128.png" alt="لوگوی Bookmark Scope" width="88" height="88">

# Bookmark Scope

**بوکمارک‌های سایتی که در آن هستید را پیدا کنید. بقیه‌ی کتابخانه‌تان را مرتب کنید.**

یک افزونه‌ی رایگان و متن‌باز برای کسانی که بیش از حد لینک ذخیره کرده‌اند.<br>
فقط روی کامپیوتر خودتان کار می‌کند. بدون حساب کاربری، بدون ردیابی.

[![افزودن به Chrome](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)
[![راهنمای کاربر](https://img.shields.io/badge/User%20guide-Read%20online-0f766e?logo=readthedocs&logoColor=white&style=for-the-badge)](https://ehsanenaloo.github.io/Bookmark-Scope/)
[![برای من یک قهوه بخرید](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/enaloo)

[![مجوز: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 زبان](https://img.shields.io/badge/languages-52-orange)
![بدون آنالیتیکس](https://img.shields.io/badge/analytics-none-lightgrey)
[![ستاره‌های GitHub](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

[امکانات](#features) · [نصب](#install) · [حریم خصوصی](#privacy) · [مستندات](#documentation) · [پرسش‌های متداول](#faq) · [مشارکت](#contributing)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/dashboard-desktop-dark.png">
  <img src="../assets/screenshots/dashboard-desktop-light.png" alt="داشبورد Bookmark Scope با فهرست بوکمارک‌ها، فیلترها، برچسب‌ها و پنل جزئیات">
</picture>

## Bookmark Scope چیست؟

Chrome بوکمارک‌های شما را به شکل درخت پوشه نشان می‌دهد. این برای بیست لینک خوب است، نه برای دو هزار لینک. یک مقاله را سه بار ذخیره می‌کنید، نیمی از یک پوشه‌ی قدیمی پر از لینک مرده است و نمی‌توانید بفهمید برای سایتی که الان می‌خوانید چه چیزی ذخیره کرده‌اید.

Bookmark Scope این مشکل را با دو ابزار حل می‌کند. **پنجره‌ی کوچک** بوکمارک‌هایی را که از قبل برای صفحه، سایت یا دامنه‌ی فعلی دارید نشان می‌دهد. **داشبورد** کل کتابخانه‌تان را نشان می‌دهد. با آن تکراری‌ها و لینک‌های مرده را پیدا می‌کنید و با چند کلیک پاکشان می‌کنید. پیش از هر تغییر، یک پیش‌نمایش می‌بینید.

<a id="features"></a>

## امکانات

| | |
| --- | --- |
| **پنجره‌ی کوچک برای سایت فعلی** <br> بوکمارک‌های ذخیره‌شده‌ی این صفحه، میزبان یا دامنه را ببینید. نشان روی نوار ابزار نشان می‌دهد چند مورد مطابقت دارد. | **داشبورد برای کل کتابخانه** <br> هزاران بوکمارک را جست‌وجو، فیلتر، گروه‌بندی، مرتب، برچسب‌گذاری و ویرایش کنید. سرعتش خوب می‌ماند. |
| **پاک‌سازی ایمن** <br> ادغام تکراری‌ها و تغییر گروهی برچسب‌ها را اول پیش‌نمایش کنید. چیزی را که حذف کرده‌اید با برچسب‌هایش برگردانید. | **بررسی لینک‌های مرده** <br> لینک‌های خراب و ریدایرکت‌شده را پیدا کنید. این بررسی اختیاری است و بررسی‌های طولانی را می‌شود متوقف کرد و ادامه داد. |
| **پشتیبان و درون‌ریزی** <br> از کتابخانه‌تان اسنپ‌شات بگیرید. از `bookmarks.html`، Pocket، Pinboard، Raindrop.io، CSV و JSON وارد کنید. به JSON یا CSV خروجی بگیرید. | **نماهای ذخیره‌شده و پالت فرمان** <br> یک جست‌وجوی ذخیره‌شده را با یک کلیک باز کنید. برای دیدن همه‌ی کارها `Ctrl+Shift+P` را بزنید (در مک `Cmd+Shift+P`). |
| **خصوصی از پایه** <br> بدون سرور، بدون حساب کاربری، بدون آنالیتیکس. داده‌هایتان در مرورگر خودتان می‌ماند. | **زبان و ظاهر دلخواه شما** <br> 52 زبان، تم روشن و تیره، چهار پالت رنگی، چیدمان راست‌به‌چپ. |

<p align="center">
  <img src="../assets/screenshots/popup-light.png" alt="پنجره‌ی کوچک افزونه با بوکمارک‌های سایت فعلی" width="230">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/duplicate-preview.png" alt="پنجره‌ی پیش‌نمایش تکراری‌ها که در آن انتخاب می‌کنید کدام بوکمارک بماند" width="520">
</p>
<p align="center">
  <img src="../assets/screenshots/library-tools.png" alt="ابزارهای کتابخانه: نماهای ذخیره‌شده، برچسب‌های گروهی، تکراری‌ها، بررسی‌ها، پشتیبان و درون‌ریزی" width="390">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/command-palette.png" alt="پالت فرمان با فهرستی از کارها" width="390">
</p>

<a id="install"></a>

## نصب

| مرورگر | وضعیت | روش |
| --- | --- | --- |
| **Chrome** | تست‌شده | [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) |
| **Edge، Brave** | کار می‌کند | از همان صفحه‌ی Chrome Web Store نصب کنید. هنوز در Edge Add-ons نیست. |
| **Firefox 140 به بالا** (دسکتاپ) | آزمایشی | [نصب موقت از صفحه‌ی Releases](#firefox-experimental) |
| **Safari** | پشتیبانی نمی‌شود | |

**Chrome، Edge و Brave:** صفحه‌ی افزونه را باز کنید، روی **Add to Chrome** کلیک کنید، بعد روی آیکون puzzle در نوار ابزار کلیک کنید و Bookmark Scope را پین کنید.

<a id="firefox-experimental"></a>

**Firefox (آزمایشی):** هنوز در Firefox Add-ons نیست.

1. فایل `bookmark-scope-<version>-firefox.zip` را از [صفحه‌ی Releases](https://github.com/ehsanenaloo/Bookmark-Scope/releases) دانلود کنید.
2. در Firefox آدرس `about:debugging#/runtime/this-firefox` را باز کنید.
3. روی **Load Temporary Add-on** کلیک کنید و فایل zip را انتخاب کنید.

Firefox افزونه‌های موقت را با بسته شدن حذف می‌کند. جزئیات بیشتر در [راهنمای نصب](https://ehsanenaloo.github.io/Bookmark-Scope/guides/installation.html#firefox-experimental) آمده است.

**از سورس:** مرحله‌ی build ندارد. پوشه‌ی `extension/` خودِ افزونه است. `chrome://extensions` را باز کنید، **Developer mode** را روشن کنید، روی **Load unpacked** کلیک کنید و پوشه‌ی `extension` را انتخاب کنید.

<a id="privacy"></a>

## حریم خصوصی

- سرور، حساب کاربری، آنالیتیکس و تبلیغات وجود ندارد.
- بوکمارک‌ها، برچسب‌ها و تنظیمات شما در مرورگرتان می‌ماند.
- تنها درخواست‌های شبکه، بررسی لینک‌ها به سایت‌هایی است که بوکمارک کرده‌اید، و فقط بعد از اینکه اجازه بدهید. بقیه‌ی امکانات بدون این اجازه کار می‌کنند.
- افزونه صفحه‌هایی را که می‌بینید نمی‌خواند. فقط آدرس تب فعال را می‌خواند تا بوکمارک‌های مطابق را نشان بدهد.

برای جزئیات و فهرست مجوزها [سیاست حریم خصوصی](https://ehsanenaloo.github.io/Bookmark-Scope/privacy.html) را بخوانید.

<a id="documentation"></a>

## مستندات

| | |
| --- | --- |
| [راهنمای کاربر](https://ehsanenaloo.github.io/Bookmark-Scope/) | همه‌ی امکانات، با تصویر |
| [محدودیت‌های شناخته‌شده](https://ehsanenaloo.github.io/Bookmark-Scope/guides/limits.html) | چه چیزهایی ناتمام یا تست‌نشده است |
| [سیاست حریم خصوصی](https://ehsanenaloo.github.io/Bookmark-Scope/privacy.html) | افزونه چه چیزی ذخیره می‌کند و چه چیزی می‌فرستد |
| [تاریخچه‌ی تغییرات](../../CHANGELOG.md) | در هر نسخه چه چیزی تغییر کرده |
| [مشارکت](../../.github/CONTRIBUTING.md) | چطور خطا گزارش کنید و تغییر بفرستید |
| [امنیت](../../.github/SECURITY.md) | چطور یک مشکل امنیتی را خصوصی گزارش کنید |

<a id="faq"></a>

## پرسش‌های متداول

<details>
<summary><b>آیا بوکمارک‌های من را جایی می‌فرستد؟</b></summary>

نه. سرور وجود ندارد. بوکمارک‌های شما در مرورگرتان می‌ماند. افزونه فقط وقتی بررسی لینک را شروع کنید و اجازه داده باشید، با سایت‌هایی که بوکمارک کرده‌اید ارتباط می‌گیرد.
</details>

<details>
<summary><b>آیا خودش بوکمارک‌ها را تغییر می‌دهد یا حذف می‌کند؟</b></summary>

نه. بوکمارک‌ها را فقط وقتی شما بخواهید تغییر می‌دهد. ادغام‌ها و تغییرهای گروهی برچسب اول پیش‌نمایش نشان می‌دهند و برای حذف از شما تأیید می‌خواهد.
</details>

<details>
<summary><b>می‌توانم بوکمارک حذف‌شده را برگردانم؟</b></summary>

بله، از «واگرد» (Undo) استفاده کنید. بوکمارک با برچسب‌هایش در پوشه‌ی خودش برمی‌گردد. مرورگرها به هیچ افزونه‌ای اجازه نمی‌دهند شناسه‌ی اصلی یا تاریخ افزودن را برگرداند، پس بوکمارک برگردانده‌شده یک بوکمارک تازه است.
</details>

<details>
<summary><b>با مدیرهای بوکمارک دیگر کار می‌کند؟</b></summary>

می‌توانید از Chrome، Edge، Firefox، Safari و Brave (فایل `bookmarks.html`)، Pocket، Pinboard، Raindrop.io و فایل‌های CSV و JSON وارد کنید. درون‌ریزی تخت است: پوشه‌ها به شکل مسیر نشان داده می‌شوند ولی ساخته نمی‌شوند.
</details>

<details>
<summary><b>چطور مشکلی را گزارش کنم یا امکانی را پیشنهاد بدهم؟</b></summary>

[یک issue باز کنید](https://github.com/ehsanenaloo/Bookmark-Scope/issues). لطفاً فهرست واقعی بوکمارک‌هایتان را نگذارید. برای مشکلات امنیتی [SECURITY.md](../../.github/SECURITY.md) را ببینید.
</details>

## ترجمه‌ها

ترجمه‌ها ماشینی هستند و ممکن است اشتباه داشته باشند یا بعضی کلمه‌ها انگلیسی مانده باشند. اگر زبان مادری‌تان یکی از این زبان‌هاست و می‌توانید ترجمه‌ی درست و طبیعی بنویسید، لطفاً به ما کمک کنید: [یک issue باز کنید](https://github.com/ehsanenaloo/Bookmark-Scope/issues) یا pull request بفرستید. [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#translations) را ببینید.

<a id="contributing"></a>

## مشارکت

گزارش خطا، اصلاح ترجمه و pull requestهای کوچک خوش‌آمدند. اول [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) را بخوانید.

اگر Bookmark Scope وقتتان را کم کرده، می‌توانید [برای من یک قهوه بخرید](https://buymeacoffee.com/enaloo). امتیاز دادن در [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) هم به پیدا شدن افزونه توسط دیگران کمک می‌کند.

### مشارکت‌کنندگان

از همه‌ی کسانی که کمک کرده‌اند ممنونم. بعد از پذیرفته‌شدن اولین مشارکتتان، نام شما هم اینجا نشان داده می‌شود.

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="مشارکت‌کنندگان"></a>

## مجوز

[MIT](../../LICENSE). Copyright 2026 Ehsan Enaloo.

کد افزونه تحت مجوز MIT است. دو بخش از پروژه‌های دیگر آمده و مجوز خودشان را حفظ کرده‌اند: Public Suffix List (فهرستی از پسوندهای دامنه مانند `.co.uk`، با مجوز MPL-2.0) و آیکون‌های [Lucide](https://lucide.dev) (مجوز ISC). متن کامل مجوزها در [extension/THIRD_PARTY_NOTICES.md](../../extension/THIRD_PARTY_NOTICES.md) آمده است.

</div>
