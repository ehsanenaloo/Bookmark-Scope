[English](../../README.md) · [فارسی](README.fa.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · **हिन्दी**

<div align="center">

<img src="../../extension/icons/icon-128.png" alt="Bookmark Scope का लोगो" width="88" height="88">

# Bookmark Scope

**जिस साइट पर हैं, उसके बुकमार्क तुरंत पाएं। बाकी लाइब्रेरी को साफ़ करें।**

उन लोगों के लिए एक मुफ़्त, ओपन-सोर्स ब्राउज़र extension, जिन्होंने बहुत ज़्यादा लिंक सेव कर लिए हैं।<br>
यह सिर्फ़ आपके कंप्यूटर पर चलता है। न अकाउंट, न ट्रैकिंग।

[![Chrome में जोड़ें](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)
[![यूज़र गाइड](https://img.shields.io/badge/User%20guide-Read%20online-0f766e?logo=readthedocs&logoColor=white&style=for-the-badge)](https://ehsanenaloo.github.io/Bookmark-Scope/)
[![एक कॉफ़ी पिलाएं](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/enaloo)

[![लाइसेंस: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 भाषाएं](https://img.shields.io/badge/languages-52-orange)
![कोई analytics नहीं](https://img.shields.io/badge/analytics-none-lightgrey)
[![GitHub स्टार](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

[खूबियां](#features) · [इंस्टॉल करें](#install) · [प्राइवेसी](#privacy) · [दस्तावेज़](#documentation) · [अक्सर पूछे जाने वाले सवाल](#faq) · [योगदान दें](#contributing)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/dashboard-desktop-dark.png">
  <img src="../assets/screenshots/dashboard-desktop-light.png" alt="Bookmark Scope का dashboard, जिसमें बुकमार्क की सूची, फ़िल्टर, टैग और डिटेल पैनल दिख रहे हैं">
</picture>

## Bookmark Scope क्या है?

Chrome आपके बुकमार्क फ़ोल्डर के पेड़ की तरह दिखाता है। बीस लिंक के लिए यह ठीक है, दो हज़ार के लिए नहीं। आप एक ही लेख तीन बार सेव कर देते हैं, किसी पुराने फ़ोल्डर के आधे लिंक बंद हो चुके होते हैं, और आप जिस साइट को पढ़ रहे हैं, उसके लिए आपने पहले से क्या सेव किया है, यह समझ नहीं आता।

Bookmark Scope इसे दो टूल से ठीक करता है। **Popup** उस पेज, साइट या domain के बुकमार्क दिखाता है जिस पर आप अभी हैं। **Dashboard** आपकी पूरी लाइब्रेरी दिखाता है, ताकि आप duplicate और बंद लिंक ढूंढकर कुछ क्लिक में साफ़ कर सकें। कुछ भी बदलने से पहले आपको preview दिखता है।

<a id="features"></a>

## खूबियां

| | |
| --- | --- |
| **आप जिस साइट पर हैं, उसके लिए popup** <br> इस पेज, host या domain के लिए सेव किए गए बुकमार्क देखें। Toolbar का badge बताता है कि कितने बुकमार्क मेल खाते हैं। | **पूरी लाइब्रेरी के लिए dashboard** <br> हज़ारों बुकमार्क खोजें, फ़िल्टर करें, ग्रुप करें, क्रम में लगाएं, टैग लगाएं और बदलें। यह तेज़ बना रहता है। |
| **सुरक्षित सफ़ाई** <br> Duplicate मर्ज और टैग के बड़े बदलावों का पहले preview देखें। जो हटाया है, उसे टैग के साथ undo करें। | **बंद लिंक की जांच** <br> टूटे और redirect होने वाले लिंक ढूंढें। यह अपनी मर्ज़ी से चालू किया जाता है, और लंबे scan को रोककर फिर शुरू किया जा सकता है। |
| **Backup और import** <br> अपनी लाइब्रेरी के snapshot सेव करें। `bookmarks.html`, Pocket, Pinboard, Raindrop.io, CSV और JSON से import करें। JSON या CSV में export करें। | **सेव किए गए व्यू और command palette** <br> सेव की हुई खोज को एक क्लिक में खोलें। हर काम देखने के लिए `Ctrl+Shift+P` दबाएं (Mac पर `Cmd+Shift+P`)। |
| **शुरू से निजी** <br> न server, न अकाउंट, न analytics। आपका डेटा आपके ब्राउज़र में ही रहता है। | **आपकी भाषा और आपका रूप** <br> 52 भाषाएं, लाइट और डार्क थीम, चार रंग पैलेट, दाएं से बाएं लिखी जाने वाली भाषाओं का लेआउट। |

<p align="center">
  <img src="../assets/screenshots/popup-light.png" alt="Popup, जिसमें मौजूदा साइट के बुकमार्क दिख रहे हैं" width="230">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/duplicate-preview.png" alt="Duplicate preview डायलॉग, जहां आप चुनते हैं कि कौन सा बुकमार्क रखना है" width="520">
</p>
<p align="center">
  <img src="../assets/screenshots/library-tools.png" alt="लाइब्रेरी टूल: सेव किए गए व्यू, बल्क टैग, duplicate, scan, backup और import" width="390">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/command-palette.png" alt="Command palette, जिसमें कामों की सूची दिख रही है" width="390">
</p>

<a id="install"></a>

## इंस्टॉल करें

| ब्राउज़र | स्थिति | कैसे |
| --- | --- | --- |
| **Chrome** | टेस्ट किया हुआ | [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) |
| **Edge, Brave** | काम करता है | उसी Chrome Web Store पेज से इंस्टॉल करें। यह अभी Edge Add-ons पर नहीं है। |
| **Firefox 140+** (डेस्कटॉप) | प्रयोगात्मक | [Releases पेज से अस्थायी इंस्टॉल](#firefox-experimental) |
| **Safari** | सपोर्ट नहीं है | |

**Chrome, Edge और Brave:** स्टोर पेज खोलें, **Add to Chrome** पर क्लिक करें, फिर toolbar में पज़ल आइकन पर क्लिक करें और Bookmark Scope को pin करें।

<a id="firefox-experimental"></a>

**Firefox (प्रयोगात्मक):** यह अभी Firefox Add-ons पर नहीं है।

1. [Releases पेज](https://github.com/ehsanenaloo/Bookmark-Scope/releases) से `bookmark-scope-<version>-firefox.zip` डाउनलोड करें।
2. Firefox में `about:debugging#/runtime/this-firefox` खोलें।
3. **Load Temporary Add-on** पर क्लिक करें और zip फ़ाइल चुनें।

Firefox बंद होने पर temporary add-on हटा देता है। ज़्यादा जानकारी [इंस्टॉल गाइड](https://ehsanenaloo.github.io/Bookmark-Scope/guides/installation.html#firefox-experimental) में है।

**Source से:** कोई build step नहीं है। `extension/` फ़ोल्डर ही extension है। `chrome://extensions` खोलें, **Developer mode** चालू करें, **Load unpacked** पर क्लिक करें और `extension` फ़ोल्डर चुनें।

<a id="privacy"></a>

## प्राइवेसी

- न server है, न अकाउंट, न analytics और न विज्ञापन।
- आपके बुकमार्क, टैग और सेटिंग आपके ब्राउज़र में ही रहते हैं।
- एकमात्र नेटवर्क अनुरोध लिंक जांच के समय आपके बुकमार्क की साइटों पर जाते हैं, और वह भी आपकी अनुमति के बाद ही। बाकी सब कुछ इस अनुमति के बिना चलता है।
- Extension आपके खोले गए पेज नहीं पढ़ता। यह मेल खाते बुकमार्क दिखाने के लिए सिर्फ़ सक्रिय टैब का पता देखता है।

विवरण और अनुमतियों की सूची के लिए [प्राइवेसी पॉलिसी](https://ehsanenaloo.github.io/Bookmark-Scope/privacy.html) पढ़ें।

<a id="documentation"></a>

## दस्तावेज़

| | |
| --- | --- |
| [यूज़र गाइड](https://ehsanenaloo.github.io/Bookmark-Scope/) | हर फ़ीचर, screenshot के साथ |
| [ज्ञात सीमाएं](https://ehsanenaloo.github.io/Bookmark-Scope/guides/limits.html) | क्या अधूरा है या टेस्ट नहीं हुआ |
| [प्राइवेसी पॉलिसी](https://ehsanenaloo.github.io/Bookmark-Scope/privacy.html) | Extension क्या सेव करता है और क्या भेजता है |
| [Changelog](../../CHANGELOG.md) | हर रिलीज़ में क्या बदला |
| [योगदान](../../.github/CONTRIBUTING.md) | Bug कैसे बताएं और बदलाव कैसे भेजें |
| [सुरक्षा](../../.github/SECURITY.md) | सुरक्षा की समस्या निजी तौर पर कैसे बताएं |

<a id="faq"></a>

## अक्सर पूछे जाने वाले सवाल

<details>
<summary><b>क्या यह मेरे बुकमार्क कहीं भेजता है?</b></summary>

नहीं। कोई server नहीं है। आपके बुकमार्क आपके ब्राउज़र में ही रहते हैं। Extension सिर्फ़ तब आपके बुकमार्क की साइटों से संपर्क करता है, जब आप लिंक जांच शुरू करते हैं और आपने उसकी अनुमति दी हो।
</details>

<details>
<summary><b>क्या यह अपने आप बुकमार्क बदलेगा या हटाएगा?</b></summary>

नहीं। यह बुकमार्क तभी बदलता है जब आप कहते हैं। मर्ज और टैग के बड़े बदलावों से पहले preview दिखता है, और हटाने से पहले आपसे पुष्टि मांगी जाती है।
</details>

<details>
<summary><b>क्या हटाया हुआ बुकमार्क वापस मिल सकता है?</b></summary>

हां, Undo का इस्तेमाल करें। बुकमार्क अपने फ़ोल्डर में टैग के साथ वापस आ जाता है। ब्राउज़र किसी भी extension को पुराना ID या जोड़ने की तारीख़ वापस लगाने नहीं देते, इसलिए वापस आया बुकमार्क नया होता है।
</details>

<details>
<summary><b>क्या यह दूसरे बुकमार्क मैनेजर के साथ काम करता है?</b></summary>

आप Chrome, Edge, Firefox, Safari और Brave (`bookmarks.html` फ़ाइल), Pocket, Pinboard, Raindrop.io, और CSV तथा JSON फ़ाइलों से import कर सकते हैं। Import सपाट होता है: फ़ोल्डर रास्ते की तरह दिखते हैं, पर बनाए नहीं जाते।
</details>

<details>
<summary><b>कोई समस्या कैसे बताऊं या नया फ़ीचर कैसे मांगूं?</b></summary>

[Issue खोलें](https://github.com/ehsanenaloo/Bookmark-Scope/issues)। कृपया अपनी असली बुकमार्क सूची साथ न लगाएं। सुरक्षा की समस्याओं के लिए [SECURITY.md](../../.github/SECURITY.md) देखें।
</details>

## अनुवाद

अनुवाद मशीन से किए गए हैं, इसलिए उनमें गलतियां हो सकती हैं या कुछ शब्द अंग्रेज़ी में रह सकते हैं। अगर इनमें से कोई भाषा आपकी मातृभाषा है और आप सही और स्वाभाविक अनुवाद लिख सकते हैं, तो हमारी मदद करें: [issue खोलें](https://github.com/ehsanenaloo/Bookmark-Scope/issues) या pull request भेजें। देखें [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#translations)।

<a id="contributing"></a>

## योगदान दें

Bug रिपोर्ट, अनुवाद के सुधार और छोटे pull request का स्वागत है। पहले [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) पढ़ें।

अगर Bookmark Scope से आपका समय बचता है, तो आप [मुझे एक कॉफ़ी पिला सकते हैं](https://buymeacoffee.com/enaloo)। [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) पर रेटिंग देने से भी दूसरे लोगों को यह मिलने में मदद होती है।

### योगदानकर्ता

प्रोजेक्ट में मदद करने वाले सभी लोगों का धन्यवाद। आपका पहला योगदान स्वीकार होने के बाद आपका नाम यहाँ दिखेगा।

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="योगदानकर्ता"></a>

## लाइसेंस

[MIT](../../LICENSE)। Copyright 2026 Ehsan Enaloo।

Extension का कोड MIT लाइसेंस के तहत है। दो हिस्से दूसरे प्रोजेक्ट से लिए गए हैं और उनके अपने लाइसेंस हैं: Public Suffix List (`.co.uk` जैसे डोमेन के अंत की सूची, MPL-2.0) और [Lucide](https://lucide.dev) आइकन (ISC)। पूरे लाइसेंस पाठ [extension/THIRD_PARTY_NOTICES.md](../../extension/THIRD_PARTY_NOTICES.md) में हैं।
