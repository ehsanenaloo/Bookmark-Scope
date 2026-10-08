[English](../../README.md) · [فارسی](README.fa.md) · [Español](README.es.md) · **Français** · [Deutsch](README.de.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md)

<div align="center">

<img src="../../extension/icon-128.png" alt="Logo de Bookmark Scope" width="88" height="88">

# Bookmark Scope

**Retrouvez les marque-pages du site sur lequel vous êtes. Faites le ménage dans le reste de votre bibliothèque.**

Une extension Chrome gratuite pour les personnes qui ont enregistré trop de liens.<br>
Elle fonctionne uniquement sur votre ordinateur. Pas de compte, pas de suivi.

[![Add to Chrome](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)
[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/enaloo)

[![Licence : MIT](https://img.shields.io/badge/licence-MIT-green)](../../LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 langues](https://img.shields.io/badge/langues-52-orange)
![Sans analytique](https://img.shields.io/badge/analytique-aucune-lightgrey)

[![GitHub stars](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/dashboard-desktop-dark.png">
  <img src="../assets/screenshots/dashboard-desktop-light.png" alt="Le tableau de bord de Bookmark Scope avec une liste de marque-pages, des filtres, des étiquettes et un panneau de détails">
</picture>

## Pourquoi ce projet

Chrome affiche vos marque-pages sous forme d'arborescence de dossiers. C'est très bien pour vingt liens. Ça ne l'est plus pour deux mille.

Vous enregistrez le même article trois fois. Un dossier de 2019 est à moitié rempli de liens morts. Vous avez onze marque-pages sur un site et vous ne trouvez pas celui que vous cherchez. Bookmark Scope vous aide à régler ces problèmes.

- Ouvrez la fenêtre contextuelle sur n'importe quelle page. Vous voyez les marque-pages que vous avez déjà pour cette page, ce site ou ce domaine.
- Ouvrez le tableau de bord. Vous voyez toute votre bibliothèque, vous repérez les doublons et les liens morts, et vous les corrigez en quelques clics.

## Ce que vous pouvez faire

### Voir ce que vous avez déjà enregistré pour ce site

Cliquez sur l'icône dans la barre d'outils. La fenêtre contextuelle liste vos marque-pages pour la page où vous êtes. Passez de cette page exacte à cet hôte, ou à tout le domaine. Le badge sur l'icône indique combien de marque-pages correspondent.

<p align="center">
  <img src="../assets/screenshots/popup-light.png" alt="La fenêtre contextuelle avec les marque-pages du site actuel" width="300">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/popup-dark.png" alt="La fenêtre contextuelle avec le thème sombre" width="300">
</p>

### Voir toute votre bibliothèque

Le tableau de bord est une page complète pour vos marque-pages. Cherchez par titre, adresse ou dossier. Regroupez par domaine ou par dossier. Triez par titre, adresse ou date. Filtrez pour afficher les doublons, les marque-pages sans titre, les marque-pages anciens et les titres en double. Il reste rapide avec des milliers de marque-pages.

Cliquez sur un marque-page pour voir ses détails. Cochez-en plusieurs pour les traiter ensemble. Faites glisser les marque-pages pour changer leur ordre.

### Faire le ménage sans crainte

Rien d'important ne se passe sans aperçu.

<p align="center">
  <img src="../assets/screenshots/duplicate-preview.png" alt="La boîte de dialogue d'aperçu des doublons, où vous choisissez quel marque-page garder" width="780">
</p>

- **Doublons.** Choisissez quelle copie garder. Les étiquettes des autres copies lui sont ajoutées. Vous voyez le résultat avant que quoi que ce soit soit supprimé.
- **Étiquettes.** Ajoutez, retirez, renommez ou fusionnez des étiquettes pour plusieurs marque-pages à la fois. Vérifiez l'avant et l'après, puis appliquez. Vous pouvez annuler.
- **Suppression et annulation.** Les marque-pages supprimés peuvent être restaurés avec leurs étiquettes. Chrome ne permet à aucune extension de rétablir l'identifiant d'origine ni la date d'ajout, donc le marque-page restauré est un nouveau marque-page. L'extension vous le dit.

<p align="center">
  <img src="../assets/screenshots/bulk-tags.png" alt="La boîte de dialogue des étiquettes en lot, avec les étiquettes avant et après la modification" width="780">
</p>

### Trouver les liens morts

Vérifiez un groupe de marque-pages pour voir quels liens fonctionnent, lesquels redirigent et lesquels sont cassés. La vérification s'exécute dans votre navigateur et ne contacte que les sites que vous avez mis en marque-page.

- Elle demande d'abord votre permission. Si vous refusez, tout le reste fonctionne quand même.
- Vous pouvez mettre en pause une longue analyse et la reprendre plus tard.
- Vous pouvez activer une analyse programmée. Elle est désactivée par défaut.
- « Réparer les redirections » met à jour les marque-pages dont l'adresse a changé. Il n'y a pas d'annulation, donc regardez d'abord la nouvelle adresse.

### Sauvegarder et déplacer

- **Instantané.** Enregistrez toute votre bibliothèque, avec les dossiers et les étiquettes, dans un seul fichier. Restaurez-la plus tard dans un nouveau dossier.
- **Import.** Importez des marque-pages depuis Chrome, Edge, Firefox, Safari ou Brave (le fichier `bookmarks.html`), Pocket, Pinboard, Raindrop.io, ou depuis une liste de liens en CSV, JSON ou texte brut. Vous voyez un aperçu et vous choisissez quoi faire des doublons : garder, ignorer ou fusionner.
- **Export.** Enregistrez les marque-pages que vous avez sous les yeux en JSON ou en CSV.

<p align="center">
  <img src="../assets/screenshots/library-tools.png" alt="Outils de bibliothèque : vues enregistrées, étiquettes en lot, doublons, analyses, sauvegarde et import" width="780">
</p>

### Aller plus vite

- **Palette de commandes.** Appuyez sur `Ctrl+Shift+P` (`Cmd+Shift+P` sur Mac) et tapez ce que vous voulez faire.
- **Vues enregistrées.** Enregistrez une recherche avec ses filtres, ses étiquettes, son tri et son regroupement. Rouvrez-la en un clic.
- **Menu du clic droit.** Sur n'importe quelle page ou n'importe quel lien, affichez vos marque-pages pour ce domaine, ou cherchez les doublons de ce lien.
- **Rappels de révision.** Activez-les dans les Paramètres si vous voulez un petit rappel toutes les quelques semaines pour faire du rangement.

<p align="center">
  <img src="../assets/screenshots/command-palette.png" alt="La palette de commandes avec une liste d'actions" width="780">
</p>

### Personnaliser l'extension

Thème clair, sombre ou celui du système. Quatre palettes de couleurs. Mises en page de droite à gauche. L'extension inclut 52 langues (voir [Bon à savoir](#good-to-know)).

<p align="center">
  <img src="../assets/screenshots/options-light.png" alt="La page des paramètres" width="300">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/dashboard-rtl-dark.png" alt="Le tableau de bord en persan, avec une mise en page de droite à gauche et le thème sombre" width="300">
</p>

## Installation

**Depuis le Chrome Web Store (le plus simple)**

1. Ouvrez la [page de Bookmark Scope](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo).
2. Cliquez sur **Add to Chrome**.
3. Cliquez sur l'icône en forme de pièce de puzzle dans la barre d'outils et épinglez Bookmark Scope.

Les autres navigateurs Chromium, comme Edge et Brave, peuvent en général l'installer depuis la même page. Je teste uniquement avec Chrome. Firefox et Safari ne sont pas pris en charge.

**Depuis ce dépôt**

Il n'y a pas d'étape de compilation. Le dossier `extension` est l'extension.

1. Téléchargez ou clonez ce dépôt.
2. Ouvrez `chrome://extensions` et activez le **Mode développeur**.
3. Cliquez sur **Charger l'extension non empaquetée** et choisissez le dossier `extension` du dépôt (celui qui contient `manifest.json`), pas le dossier principal.

Une copie non empaquetée a son propre identifiant d'extension. Vous pouvez la garder à côté de la version du Store, mais elles ne partagent pas leurs données, et la copie non empaquetée ne se met pas à jour toute seule.

## Vos données restent chez vous

Il n'y a pas de serveur. Il n'y a ni compte, ni analytique, ni publicité. Vos marque-pages, vos étiquettes et vos paramètres restent dans votre navigateur. La [politique de confidentialité](../PRIVACY.md) donne les détails.

L'extension ne lit pas les pages que vous visitez. Elle lit seulement l'adresse de l'onglet actif, pour pouvoir afficher les marque-pages correspondants.

| Permission | À quoi elle sert |
| --- | --- |
| `bookmarks` | Lire vos marque-pages, et les modifier quand vous le demandez |
| `tabs` | Lire l'adresse de l'onglet actif pour la fenêtre contextuelle et le badge |
| `storage` | Garder vos paramètres, vos étiquettes et les résultats d'analyse dans le navigateur |
| `alarms` | Lancer les rappels facultatifs et les analyses programmées facultatives |
| `notifications` | Afficher les rappels et les résultats d'analyse |
| `contextMenus` | Ajouter les entrées du menu du clic droit |
| `clipboardWrite` | Copier des adresses quand vous cliquez sur un bouton de copie |
| `favicon` | Afficher les icônes des sites depuis le cache du navigateur |
| Sites web (facultatif) | Demandée seulement quand vous lancez une vérification de liens, pour que l'extension puisse contacter les sites que vous avez mis en marque-page |

<a id="good-to-know"></a>
## Bon à savoir

- **Traductions.** Les traductions sont automatiques : elles peuvent contenir des erreurs ou laisser quelques mots en anglais. Si l'une de ces langues est votre langue maternelle et que vous pouvez écrire une traduction correcte et naturelle, aidez-nous : [ouvrez une issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues) ou envoyez une pull request. Détails dans [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#translations).
- **L'import est à plat.** Quand vous importez un fichier `bookmarks.html`, le nom du dossier s'affiche sous forme de chemin, mais les dossiers ne sont pas créés et les dates d'origine ne sont pas conservées. Utilisez un instantané si vous devez reconstruire une arborescence de dossiers.
- **Les vérifications de liens sont des indications.** Toute réponse 4xx compte comme un lien cassé. Une page qui se charge mais affiche une erreur ou un écran de connexion compte comme saine.
- **CSV.** J'ai testé l'export CSV avec l'importeur et avec un vrai téléchargement dans Chrome. Je ne l'ai pas encore ouvert dans Excel, Numbers ou Google Sheets.
- **Tests.** L'extension est testée dans Chromium. Voir la [liste complète des limites](../guides/limits.html).

## Raccourcis clavier

| Touches | Ce que ça fait |
| --- | --- |
| `Ctrl+Shift+P` / `Cmd+Shift+P` | Ouvrir la palette de commandes |
| `/` | Aller dans la zone de recherche |
| `Ctrl+A` / `Cmd+A` | Sélectionner tous les marque-pages de la liste actuelle |
| `Esc` | Revenir en arrière d'une étape : annuler une modification, effacer la recherche, effacer la sélection, fermer une boîte de dialogue |

## Guide d'utilisation

Le guide explique chaque partie de l'extension, avec des captures d'écran. Commencez par [docs/README.md](../README.md) ou ouvrez le [dossier des guides](../guides/). Pour le lire comme une page web, ouvrez `docs/index.html` dans votre navigateur.

## Aider le projet

Les rapports de bugs, les corrections de traduction et les petites pull requests sont les bienvenus. Lisez d'abord [CONTRIBUTING.md](../../.github/CONTRIBUTING.md). Avant d'envoyer une pull request, lancez cette vérification. Elle demande Node.js 24 ou plus récent et aucune installation.

```bash
node scripts/validate.mjs
node scripts/test.mjs
```

Merci de signaler les problèmes de sécurité en privé. Voir [SECURITY.md](../../.github/SECURITY.md).

Si Bookmark Scope vous fait gagner du temps, vous pouvez [m'offrir un café](https://buymeacoffee.com/enaloo). Une note sur le [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) aide aussi d'autres personnes à le trouver.

## Contributeurs

Merci à toutes les personnes qui ont aidé. Votre nom apparaît ici après votre première contribution acceptée. Voir [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#recognition).

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="Contributors" width="400"></a>


## Licence

[MIT](../../LICENSE). Copyright 2026 Ehsan Enaloo.

Le code de Bookmark Scope est sous licence MIT. Deux éléments viennent d'autres projets et gardent leurs propres licences : la Public Suffix List (une liste de fins de domaine comme `.co.uk`, MPL-2.0) et les icônes [Lucide](https://lucide.dev) (ISC). Les textes complets se trouvent dans [extension/THIRD_PARTY_NOTICES.md](../../extension/THIRD_PARTY_NOTICES.md).
