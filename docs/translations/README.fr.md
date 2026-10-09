[English](../../README.md) · [فارسی](README.fa.md) · [Español](README.es.md) · **Français** · [Deutsch](README.de.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md)

<div align="center">

<img src="../../extension/icons/icon-128.png" alt="Logo de Bookmark Scope" width="88" height="88">

# Bookmark Scope

**Retrouvez les marque-pages du site sur lequel vous êtes. Faites le ménage dans le reste de votre bibliothèque.**

Une extension de navigateur gratuite et open source pour les personnes qui ont enregistré trop de liens.<br>
Elle fonctionne uniquement sur votre ordinateur. Pas de compte, pas de suivi.

[![Ajouter à Chrome](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)
[![Guide d'utilisation](https://img.shields.io/badge/User%20guide-Read%20online-0f766e?logo=readthedocs&logoColor=white&style=for-the-badge)](https://enaloo.com/apps/bookmark-scope/)
[![Offrez-moi un café](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/enaloo)

[![Licence : MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 langues](https://img.shields.io/badge/languages-52-orange)
![Sans analytique](https://img.shields.io/badge/analytics-none-lightgrey)
[![Étoiles GitHub](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

[Fonctionnalités](#features) · [Installation](#install) · [Confidentialité](#privacy) · [Documentation](#documentation) · [FAQ](#faq) · [Contribuer](#contributing)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/dashboard-desktop-dark.png">
  <img src="../assets/screenshots/dashboard-desktop-light.png" alt="Le tableau de bord de Bookmark Scope avec une liste de marque-pages, des filtres, des étiquettes et un panneau de détails">
</picture>

## Qu'est-ce que Bookmark Scope ?

Chrome affiche vos marque-pages sous forme d'arborescence de dossiers. Ça marche pour vingt liens, pas pour deux mille. Vous enregistrez trois fois le même article, la moitié d'un vieux dossier ne contient que des liens morts, et vous ne savez pas ce que vous avez déjà enregistré pour le site que vous lisez.

Bookmark Scope règle ce problème avec deux outils. La **fenêtre contextuelle** montre les marque-pages que vous avez déjà pour la page, le site ou le domaine où vous êtes. Le **tableau de bord** montre toute votre bibliothèque. Vous y trouvez les doublons et les liens morts, et vous faites le ménage en quelques clics, avec un aperçu avant tout changement.

<a id="features"></a>

## Fonctionnalités

| | |
| --- | --- |
| **Fenêtre pour le site actuel** <br> Voyez vos marque-pages enregistrés pour cette page, cet hôte ou ce domaine. Le badge de la barre d'outils indique combien correspondent. | **Tableau de bord pour toute la bibliothèque** <br> Cherchez, filtrez, regroupez, triez, étiquetez et modifiez des milliers de marque-pages. Il reste rapide. |
| **Ménage sans risque** <br> Prévisualisez d'abord la fusion des doublons et les changements d'étiquettes en lot. Annulez ce que vous supprimez, étiquettes comprises. | **Vérification des liens morts** <br> Trouvez les liens cassés et redirigés. Elle est facultative, et les longues analyses peuvent être mises en pause puis reprises. |
| **Sauvegarde et import** <br> Enregistrez des instantanés de votre bibliothèque. Importez depuis `bookmarks.html`, Pocket, Pinboard, Raindrop.io, CSV et JSON. Exportez en JSON ou en CSV. | **Vues enregistrées et palette de commandes** <br> Rouvrez une recherche enregistrée en un clic. Appuyez sur `Ctrl+Shift+P` (`Cmd+Shift+P` sur Mac) pour accéder à toutes les actions. |
| **Privé par conception** <br> Pas de serveur, pas de compte, pas d'analytique. Vos données restent dans votre navigateur. | **Votre langue et votre style** <br> 52 langues, thèmes clair et sombre, quatre palettes de couleurs, mises en page de droite à gauche. |

<p align="center">
  <img src="../assets/screenshots/popup-light.png" alt="La fenêtre contextuelle avec les marque-pages du site actuel" width="230">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/duplicate-preview.png" alt="La boîte de dialogue d'aperçu des doublons, où vous choisissez quel marque-page garder" width="520">
</p>
<p align="center">
  <img src="../assets/screenshots/library-tools.png" alt="Outils de bibliothèque : vues enregistrées, étiquettes en lot, doublons, analyses, sauvegarde et import" width="390">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/command-palette.png" alt="La palette de commandes avec une liste d'actions" width="390">
</p>

<a id="install"></a>

## Installation

| Navigateur | État | Comment |
| --- | --- | --- |
| **Chrome** | Testé | [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) |
| **Edge** | Fonctionne | [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ioonncgajlliiajlebblkfkgagcgcnae) |
| **Brave** | Fonctionne | Installez depuis la même page du Chrome Web Store. |
| **Firefox 140+** (ordinateur) | Expérimental | [Installation temporaire depuis la page des Releases](#firefox-experimental) |
| **Safari** | Non pris en charge | |

**Chrome et Brave :** ouvrez la page de la boutique, cliquez sur **Add to Chrome**, puis cliquez sur l'icône en forme de pièce de puzzle dans la barre d'outils et épinglez Bookmark Scope.

**Edge :** ouvrez la [page sur Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ioonncgajlliiajlebblkfkgagcgcnae) et cliquez sur **Get**.

<a id="firefox-experimental"></a>

**Firefox (expérimental) :** l'extension n'est pas encore sur Firefox Add-ons.

1. Téléchargez `bookmark-scope-<version>-firefox.zip` depuis la [page des Releases](https://github.com/ehsanenaloo/Bookmark-Scope/releases).
2. Dans Firefox, ouvrez `about:debugging#/runtime/this-firefox`.
3. Cliquez sur **Load Temporary Add-on** et choisissez le fichier zip.

Firefox supprime les modules complémentaires temporaires quand il se ferme. Plus de détails dans le [guide d'installation](https://enaloo.com/apps/bookmark-scope/docs/installation/#firefox-experimental).

**Depuis les sources :** il n'y a pas d'étape de compilation. Le dossier `extension/` est l'extension. Ouvrez `chrome://extensions`, activez le **Mode développeur**, cliquez sur **Charger l'extension non empaquetée** et choisissez le dossier `extension`.

<a id="privacy"></a>

## Confidentialité

- Il n'y a ni serveur, ni compte, ni analytique, ni publicité.
- Vos marque-pages, vos étiquettes et vos réglages restent dans votre navigateur.
- Les seules requêtes réseau sont les vérifications de liens vers les sites que vous avez enregistrés, et seulement après votre autorisation. Tout le reste fonctionne sans cette autorisation.
- L'extension ne lit pas les pages que vous visitez. Elle lit seulement l'adresse de l'onglet actif, pour afficher les marque-pages correspondants.

Lisez la [politique de confidentialité](https://enaloo.com/apps/bookmark-scope/docs/privacy-policy/) pour les détails et la liste des autorisations.

<a id="documentation"></a>

## Documentation

| | |
| --- | --- |
| [Guide d'utilisation](https://enaloo.com/apps/bookmark-scope/) | Toutes les fonctionnalités, avec des captures d'écran |
| [Limites connues](https://enaloo.com/apps/bookmark-scope/docs/limits/) | Ce qui est inachevé ou non testé |
| [Politique de confidentialité](https://enaloo.com/apps/bookmark-scope/docs/privacy-policy/) | Ce que l'extension stocke et envoie |
| [Journal des modifications](../../CHANGELOG.md) | Ce qui a changé à chaque version |
| [Contribuer](../../.github/CONTRIBUTING.md) | Comment signaler des bugs et proposer des changements |
| [Sécurité](../../.github/SECURITY.md) | Comment signaler un problème de sécurité en privé |

<a id="faq"></a>

## FAQ

<details>
<summary><b>Envoie-t-elle mes marque-pages quelque part ?</b></summary>

Non. Il n'y a pas de serveur. Vos marque-pages restent dans votre navigateur. L'extension contacte seulement les sites que vous avez enregistrés, quand vous lancez une vérification de liens et que vous l'avez autorisée.
</details>

<details>
<summary><b>Modifie-t-elle ou supprime-t-elle des marque-pages toute seule ?</b></summary>

Non. Elle ne change vos marque-pages que lorsque vous le demandez. Les fusions et les changements d'étiquettes en lot montrent d'abord un aperçu, et les suppressions demandent une confirmation.
</details>

<details>
<summary><b>Puis-je récupérer un marque-page supprimé ?</b></summary>

Oui, utilisez Annuler. Le marque-page revient dans son dossier avec ses étiquettes. Les navigateurs ne permettent à aucune extension de rétablir l'identifiant d'origine ni la date d'ajout, donc le marque-page restauré est un nouveau marque-page.
</details>

<details>
<summary><b>Fonctionne-t-elle avec d'autres gestionnaires de marque-pages ?</b></summary>

Vous pouvez importer depuis Chrome, Edge, Firefox, Safari et Brave (le fichier `bookmarks.html`), Pocket, Pinboard, Raindrop.io, ainsi que des fichiers CSV et JSON. Les imports sont à plat : les dossiers apparaissent sous forme de chemin, mais ne sont pas créés.
</details>

<details>
<summary><b>Comment signaler un problème ou demander une fonctionnalité ?</b></summary>

[Ouvrez une issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues). Merci de ne pas joindre votre vraie liste de marque-pages. Pour les problèmes de sécurité, consultez [SECURITY.md](../../.github/SECURITY.md).
</details>

## Traductions

Les traductions sont automatiques : elles peuvent contenir des erreurs ou laisser quelques mots en anglais. Si l'une de ces langues est votre langue maternelle et que vous pouvez écrire une traduction correcte et naturelle, aidez-nous : [ouvrez une issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues) ou envoyez une pull request. Détails dans [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#translations).

<a id="contributing"></a>

## Contribuer

Les rapports de bugs, les corrections de traduction et les petites pull requests sont les bienvenus. Lisez d'abord [CONTRIBUTING.md](../../.github/CONTRIBUTING.md).

Si Bookmark Scope vous fait gagner du temps, vous pouvez [m'offrir un café](https://buymeacoffee.com/enaloo). Une note sur le [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) aide aussi d'autres personnes à le trouver.

### Contributeurs

Merci à toutes les personnes qui ont aidé. Votre nom apparaît ici après votre première contribution acceptée.

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="Contributeurs"></a>

## Licence

[MIT](../../LICENSE). Copyright 2026 Ehsan Enaloo.

Le code de l'extension est sous licence MIT. Deux éléments viennent d'autres projets et gardent leurs propres licences : la Public Suffix List (une liste de fins de domaine comme `.co.uk`, MPL-2.0) et les icônes [Lucide](https://lucide.dev) (ISC). Les textes complets se trouvent dans [extension/THIRD_PARTY_NOTICES.md](../../extension/THIRD_PARTY_NOTICES.md).
