import en_MESSAGES from './en.js';

const DEFAULT_LOCALE = 'en';
const LOCALE_META = [{"code":"am","intl":"am","nativeName":"አማርኛ","englishName":"Amharic","rtl":false,"aliases":["am","am-et"]},{"code":"ar","intl":"ar","nativeName":"العربية","englishName":"Arabic","rtl":true,"aliases":["ar","ar-sa","ar-eg","ar-ae","ar-iq","ar-ma"]},{"code":"bg","intl":"bg","nativeName":"Български","englishName":"Bulgarian","rtl":false,"aliases":["bg","bg-bg"]},{"code":"bn","intl":"bn","nativeName":"বাংলা","englishName":"Bengali","rtl":false,"aliases":["bn","bn-bd","bn-in"]},{"code":"ca","intl":"ca","nativeName":"Català","englishName":"Catalan","rtl":false,"aliases":["ca","ca-es"]},{"code":"cs","intl":"cs","nativeName":"Čeština","englishName":"Czech","rtl":false,"aliases":["cs","cs-cz"]},{"code":"da","intl":"da","nativeName":"Dansk","englishName":"Danish","rtl":false,"aliases":["da","da-dk"]},{"code":"de","intl":"de","nativeName":"Deutsch","englishName":"German","rtl":false,"aliases":["de","de-de","de-at","de-ch"]},{"code":"el","intl":"el","nativeName":"Ελληνικά","englishName":"Greek","rtl":false,"aliases":["el","el-gr"]},{"code":"en","intl":"en","nativeName":"English","englishName":"English","rtl":false,"aliases":["en","en-us","en-gb","en-ca","en-au"]},{"code":"es","intl":"es","nativeName":"Español","englishName":"Spanish","rtl":false,"aliases":["es","es-es","es-mx","es-419","es-ar","es-cl","es-co"]},{"code":"et","intl":"et","nativeName":"Eesti","englishName":"Estonian","rtl":false,"aliases":["et","et-ee"]},{"code":"fa","intl":"fa","nativeName":"فارسی","englishName":"Persian","rtl":true,"aliases":["fa","fa-ir","prs"]},{"code":"fi","intl":"fi","nativeName":"Suomi","englishName":"Finnish","rtl":false,"aliases":["fi","fi-fi"]},{"code":"fil","intl":"fil","nativeName":"Filipino","englishName":"Filipino","rtl":false,"aliases":["fil","fil-ph","tl","tl-ph"]},{"code":"fr","intl":"fr","nativeName":"Français","englishName":"French","rtl":false,"aliases":["fr","fr-fr","fr-ca","fr-be","fr-ch"]},{"code":"gu","intl":"gu","nativeName":"ગુજરાતી","englishName":"Gujarati","rtl":false,"aliases":["gu","gu-in"]},{"code":"he","intl":"he","nativeName":"עברית","englishName":"Hebrew","rtl":true,"aliases":["he","he-il","iw"]},{"code":"hi","intl":"hi","nativeName":"हिन्दी","englishName":"Hindi","rtl":false,"aliases":["hi","hi-in"]},{"code":"hr","intl":"hr","nativeName":"Hrvatski","englishName":"Croatian","rtl":false,"aliases":["hr","hr-hr"]},{"code":"hu","intl":"hu","nativeName":"Magyar","englishName":"Hungarian","rtl":false,"aliases":["hu","hu-hu"]},{"code":"id","intl":"id","nativeName":"Bahasa Indonesia","englishName":"Indonesian","rtl":false,"aliases":["id","id-id"]},{"code":"it","intl":"it","nativeName":"Italiano","englishName":"Italian","rtl":false,"aliases":["it","it-it","it-ch"]},{"code":"ja","intl":"ja","nativeName":"日本語","englishName":"Japanese","rtl":false,"aliases":["ja","ja-jp"]},{"code":"kn","intl":"kn","nativeName":"ಕನ್ನಡ","englishName":"Kannada","rtl":false,"aliases":["kn","kn-in"]},{"code":"ko","intl":"ko","nativeName":"한국어","englishName":"Korean","rtl":false,"aliases":["ko","ko-kr"]},{"code":"lt","intl":"lt","nativeName":"Lietuvių","englishName":"Lithuanian","rtl":false,"aliases":["lt","lt-lt"]},{"code":"lv","intl":"lv","nativeName":"Latviešu","englishName":"Latvian","rtl":false,"aliases":["lv","lv-lv"]},{"code":"ml","intl":"ml","nativeName":"മലയാളം","englishName":"Malayalam","rtl":false,"aliases":["ml","ml-in"]},{"code":"mr","intl":"mr","nativeName":"मराठी","englishName":"Marathi","rtl":false,"aliases":["mr","mr-in"]},{"code":"ms","intl":"ms","nativeName":"Bahasa Melayu","englishName":"Malay","rtl":false,"aliases":["ms","ms-my"]},{"code":"nl","intl":"nl","nativeName":"Nederlands","englishName":"Dutch","rtl":false,"aliases":["nl","nl-nl","nl-be"]},{"code":"no","intl":"nb","nativeName":"Norsk","englishName":"Norwegian","rtl":false,"aliases":["no","nb","nb-no","nn","nn-no"]},{"code":"pl","intl":"pl","nativeName":"Polski","englishName":"Polish","rtl":false,"aliases":["pl","pl-pl"]},{"code":"pt_BR","intl":"pt-BR","nativeName":"Português (Brasil)","englishName":"Portuguese (Brazil)","rtl":false,"aliases":["pt-br","pt_br"]},{"code":"pt_PT","intl":"pt-PT","nativeName":"Português (Portugal)","englishName":"Portuguese (Portugal)","rtl":false,"aliases":["pt-pt","pt_pt","pt"]},{"code":"ro","intl":"ro","nativeName":"Română","englishName":"Romanian","rtl":false,"aliases":["ro","ro-ro"]},{"code":"ru","intl":"ru","nativeName":"Русский","englishName":"Russian","rtl":false,"aliases":["ru","ru-ru"]},{"code":"sk","intl":"sk","nativeName":"Slovenčina","englishName":"Slovak","rtl":false,"aliases":["sk","sk-sk"]},{"code":"sl","intl":"sl","nativeName":"Slovenščina","englishName":"Slovenian","rtl":false,"aliases":["sl","sl-si"]},{"code":"sr","intl":"sr","nativeName":"Српски","englishName":"Serbian","rtl":false,"aliases":["sr","sr-rs"]},{"code":"sv","intl":"sv","nativeName":"Svenska","englishName":"Swedish","rtl":false,"aliases":["sv","sv-se"]},{"code":"sw","intl":"sw","nativeName":"Kiswahili","englishName":"Swahili","rtl":false,"aliases":["sw","sw-ke","sw-tz"]},{"code":"ta","intl":"ta","nativeName":"தமிழ்","englishName":"Tamil","rtl":false,"aliases":["ta","ta-in","ta-lk"]},{"code":"te","intl":"te","nativeName":"తెలుగు","englishName":"Telugu","rtl":false,"aliases":["te","te-in"]},{"code":"th","intl":"th","nativeName":"ไทย","englishName":"Thai","rtl":false,"aliases":["th","th-th"]},{"code":"tr","intl":"tr","nativeName":"Türkçe","englishName":"Turkish","rtl":false,"aliases":["tr","tr-tr"]},{"code":"uk","intl":"uk","nativeName":"Українська","englishName":"Ukrainian","rtl":false,"aliases":["uk","uk-ua"]},{"code":"ur","intl":"ur","nativeName":"اردو","englishName":"Urdu","rtl":true,"aliases":["ur","ur-pk","ur-in"]},{"code":"vi","intl":"vi","nativeName":"Tiếng Việt","englishName":"Vietnamese","rtl":false,"aliases":["vi","vi-vn"]},{"code":"zh_CN","intl":"zh-CN","nativeName":"简体中文","englishName":"Chinese (Simplified)","rtl":false,"aliases":["zh-cn","zh_cn","zh-hans","zh-sg"]},{"code":"zh_TW","intl":"zh-TW","nativeName":"繁體中文","englishName":"Chinese (Traditional)","rtl":false,"aliases":["zh-tw","zh_tw","zh-hant","zh-hk","zh-mo"]}];
const localeMessageCache = new Map([[DEFAULT_LOCALE, validateLocaleMessages(DEFAULT_LOCALE, en_MESSAGES)]]);


function validateLocaleMessages(code, messages) {
  if (!messages || typeof messages !== 'object' || Array.isArray(messages)) {
    throw new Error(`Invalid locale messages for ${code}`);
  }
  return Object.freeze(messages);
}

async function loadJsonLocale(code) {
  if (code === DEFAULT_LOCALE) return localeMessageCache.get(DEFAULT_LOCALE);
  if (localeMessageCache.has(code)) return localeMessageCache.get(code);

  const localeUrl = (typeof chrome !== 'undefined' && chrome?.runtime?.getURL)
    ? chrome.runtime.getURL(`src/locales/${code}.json`)
    : new URL(`./${code}.json`, import.meta.url).href;

  const response = await fetch(localeUrl, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Failed to load locale messages for ${code}`);
  const messages = await response.json();

  const frozen = validateLocaleMessages(code, messages);
  localeMessageCache.set(code, frozen);
  return frozen;
}

export const LOCALE_REGISTRY = LOCALE_META.map((locale) => ({
  ...locale,
  ...(locale.code === DEFAULT_LOCALE ? { messages: localeMessageCache.get(DEFAULT_LOCALE) } : {}),
  loadMessages: () => loadJsonLocale(locale.code)
}));

export async function loadLocaleMessages(localeCode) {
  const entry = LOCALE_REGISTRY.find((locale) => locale.code === localeCode) || LOCALE_REGISTRY.find((locale) => locale.code === DEFAULT_LOCALE);
  if (!entry) return localeMessageCache.get(DEFAULT_LOCALE);
  return entry.loadMessages();
}
