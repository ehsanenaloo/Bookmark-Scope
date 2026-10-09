[English](../../README.md) · [فارسی](README.fa.md) · **Español** · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md)

<div align="center">

<img src="../../extension/icons/icon-128.png" alt="Logotipo de Bookmark Scope" width="88" height="88">

# Bookmark Scope

**Encuentra los marcadores del sitio en el que estás. Ordena el resto de tu biblioteca.**

Una extensión de navegador gratuita y de código abierto para quienes han guardado demasiados enlaces.<br>
Funciona solo en tu computadora. Sin cuenta, sin rastreo.

[![Añadir a Chrome](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)
[![Guía de usuario](https://img.shields.io/badge/User%20guide-Read%20online-0f766e?logo=readthedocs&logoColor=white&style=for-the-badge)](https://enaloo.com/apps/bookmark-scope/)
[![Invítame un café](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/enaloo)

[![Licencia: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 idiomas](https://img.shields.io/badge/languages-52-orange)
![Sin analítica](https://img.shields.io/badge/analytics-none-lightgrey)
[![Estrellas en GitHub](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

[Funciones](#features) · [Instalación](#install) · [Privacidad](#privacy) · [Documentación](#documentation) · [Preguntas frecuentes](#faq) · [Cómo contribuir](#contributing)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/dashboard-desktop-dark.png">
  <img src="../assets/screenshots/dashboard-desktop-light.png" alt="El panel de Bookmark Scope con una lista de marcadores, filtros, etiquetas y un panel de detalles">
</picture>

## ¿Qué es Bookmark Scope?

Chrome muestra tus marcadores como un árbol de carpetas. Eso sirve para veinte enlaces, no para dos mil. Guardas el mismo artículo tres veces, la mitad de una carpeta antigua son enlaces muertos y no sabes qué tienes ya guardado del sitio que estás leyendo.

Bookmark Scope lo resuelve con dos herramientas. El **popup** muestra los marcadores que ya tienes para la página, el sitio o el dominio en el que estás. El **panel** muestra toda tu biblioteca, para que encuentres duplicados y enlaces muertos y los ordenes con unos pocos clics, con una vista previa antes de que cambie nada.

<a id="features"></a>

## Funciones

| | |
| --- | --- |
| **Popup para el sitio actual** <br> Mira los marcadores guardados para esta página, host o dominio. La insignia de la barra de herramientas muestra cuántos coinciden. | **Panel para toda tu biblioteca** <br> Busca, filtra, agrupa, ordena, etiqueta y edita miles de marcadores. Sigue siendo rápido. |
| **Limpieza segura** <br> Mira antes una vista previa de la combinación de duplicados y de los cambios de etiquetas en lote. Deshaz lo que eliminas, con sus etiquetas. | **Revisión de enlaces muertos** <br> Encuentra enlaces rotos y redirigidos. Es opcional, y los escaneos largos se pueden pausar y continuar. |
| **Copia de seguridad e importación** <br> Guarda instantáneas de tu biblioteca. Importa desde `bookmarks.html`, Pocket, Pinboard, Raindrop.io, CSV y JSON. Exporta a JSON o CSV. | **Vistas guardadas y paleta de comandos** <br> Abre una búsqueda guardada con un clic. Pulsa `Ctrl+Shift+P` (`Cmd+Shift+P` en Mac) para ver todas las acciones. |
| **Privada por diseño** <br> Sin servidor, sin cuenta, sin analítica. Tus datos se quedan en tu navegador. | **Tu idioma y tu estilo** <br> 52 idiomas, temas claro y oscuro, cuatro paletas de color y diseños de derecha a izquierda. |

<p align="center">
  <img src="../assets/screenshots/popup-light.png" alt="El popup con los marcadores del sitio actual" width="230">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/duplicate-preview.png" alt="El diálogo de vista previa de duplicados, donde eliges qué marcador conservar" width="520">
</p>
<p align="center">
  <img src="../assets/screenshots/library-tools.png" alt="Herramientas de la biblioteca: vistas guardadas, etiquetas en lote, duplicados, escaneos, copia de seguridad e importación" width="390">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/command-palette.png" alt="La paleta de comandos con una lista de acciones" width="390">
</p>

<a id="install"></a>

## Instalación

| Navegador | Estado | Cómo |
| --- | --- | --- |
| **Chrome** | Probado | [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) |
| **Edge** | Funciona | [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ioonncgajlliiajlebblkfkgagcgcnae) |
| **Brave** | Funciona | Instala desde la misma página de Chrome Web Store. |
| **Firefox 140+** (escritorio) | Experimental | [Instalación temporal desde la página de Releases](#firefox-experimental) |
| **Safari** | No compatible | |

**Chrome y Brave:** abre la página de la tienda, haz clic en **Add to Chrome**, luego haz clic en el icono del rompecabezas de la barra de herramientas y ancla Bookmark Scope.

**Edge:** abre la [página en Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ioonncgajlliiajlebblkfkgagcgcnae) y haz clic en **Get**.

<a id="firefox-experimental"></a>

**Firefox (experimental):** todavía no está en Firefox Add-ons.

1. Descarga `bookmark-scope-<version>-firefox.zip` desde la [página de Releases](https://github.com/ehsanenaloo/Bookmark-Scope/releases).
2. En Firefox, abre `about:debugging#/runtime/this-firefox`.
3. Haz clic en **Load Temporary Add-on** y elige el archivo zip.

Firefox quita los complementos temporales al cerrarse. Hay más detalles en la [guía de instalación](https://enaloo.com/apps/bookmark-scope/docs/installation/#firefox-experimental).

**Desde el código fuente:** no hay paso de compilación. La carpeta `extension/` es la extensión. Abre `chrome://extensions`, activa el **Modo de desarrollador**, haz clic en **Cargar descomprimida** y elige la carpeta `extension`.

<a id="privacy"></a>

## Privacidad

- No hay servidor, ni cuenta, ni analítica, ni anuncios.
- Tus marcadores, etiquetas y ajustes se quedan en tu navegador.
- Las únicas solicitudes de red son las revisiones de enlaces a los sitios que guardaste, y solo después de que las permitas. Todo lo demás funciona sin ese permiso.
- La extensión no lee las páginas que visitas. Solo lee la dirección de la pestaña activa, para mostrar los marcadores que coinciden.

Lee la [política de privacidad](https://enaloo.com/apps/bookmark-scope/docs/privacy-policy/) para ver los detalles y la lista de permisos.

<a id="documentation"></a>

## Documentación

| | |
| --- | --- |
| [Guía de usuario](https://enaloo.com/apps/bookmark-scope/) | Todas las funciones, con capturas de pantalla |
| [Límites conocidos](https://enaloo.com/apps/bookmark-scope/docs/limits/) | Lo que está sin terminar o sin probar |
| [Política de privacidad](https://enaloo.com/apps/bookmark-scope/docs/privacy-policy/) | Qué guarda y qué envía la extensión |
| [Registro de cambios](../../CHANGELOG.md) | Qué cambió en cada versión |
| [Cómo contribuir](../../.github/CONTRIBUTING.md) | Cómo reportar errores y enviar cambios |
| [Seguridad](../../.github/SECURITY.md) | Cómo reportar un problema de seguridad en privado |

<a id="faq"></a>

## Preguntas frecuentes

<details>
<summary><b>¿Envía mis marcadores a algún sitio?</b></summary>

No. No hay servidor. Tus marcadores se quedan en tu navegador. La extensión solo se conecta con los sitios que guardaste, cuando inicias una revisión de enlaces y la has permitido.
</details>

<details>
<summary><b>¿Cambiará o borrará marcadores por su cuenta?</b></summary>

No. Solo cambia marcadores cuando tú lo pides. Las combinaciones y los cambios de etiquetas en lote muestran antes una vista previa, y al eliminar te pide confirmación.
</details>

<details>
<summary><b>¿Puedo recuperar un marcador eliminado?</b></summary>

Sí, usa Deshacer. El marcador vuelve a su carpeta con sus etiquetas. Los navegadores no permiten que una extensión restaure el ID original ni la fecha en que se añadió, así que el marcador restaurado es nuevo.
</details>

<details>
<summary><b>¿Funciona con otros gestores de marcadores?</b></summary>

Puedes importar desde Chrome, Edge, Firefox, Safari y Brave (el archivo `bookmarks.html`), Pocket, Pinboard, Raindrop.io, y archivos CSV y JSON. Las importaciones son planas: las carpetas se muestran como una ruta, pero no se crean.
</details>

<details>
<summary><b>¿Cómo reporto un problema o pido una función?</b></summary>

[Abre un issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues). Por favor, no incluyas tu lista real de marcadores. Para problemas de seguridad, mira [SECURITY.md](../../.github/SECURITY.md).
</details>

## Traducciones

Las traducciones son automáticas, así que pueden tener errores o dejar algunas palabras en inglés. Si tu lengua materna es una de estas y puedes escribir una traducción correcta y natural, ayúdanos: [abre un issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues) o envía un pull request. Más información en [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#translations).

<a id="contributing"></a>

## Cómo contribuir

Los reportes de errores, las correcciones de traducciones y los pull requests pequeños son bienvenidos. Lee primero [CONTRIBUTING.md](../../.github/CONTRIBUTING.md).

Si Bookmark Scope te ahorra tiempo, puedes [invitarme un café](https://buymeacoffee.com/enaloo). Una valoración en [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) también ayuda a que otras personas la encuentren.

### Colaboradores

Gracias a todas las personas que han ayudado. Tu nombre aparece aquí después de tu primera contribución aceptada.

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="Colaboradores"></a>

## Licencia

[MIT](../../LICENSE). Copyright 2026 Ehsan Enaloo.

El código de la extensión usa la licencia MIT. Dos piezas vienen de otros proyectos y conservan sus propias licencias: la Public Suffix List (una lista de terminaciones de dominio como `.co.uk`, MPL-2.0) y los iconos de [Lucide](https://lucide.dev) (ISC). Los textos completos están en [extension/THIRD_PARTY_NOTICES.md](../../extension/THIRD_PARTY_NOTICES.md).
