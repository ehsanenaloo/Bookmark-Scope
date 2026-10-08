[English](README.md) · [فارسی](README.fa.md) · **Español** · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md)

<div align="center">

<img src="icon-128.png" alt="Logotipo de Bookmark Scope" width="88" height="88">

# Bookmark Scope

**Encuentra los marcadores del sitio en el que estás. Ordena el resto de tu biblioteca.**

Una extensión gratuita de Chrome para quienes han guardado demasiados enlaces.<br>
Funciona solo en tu computadora. Sin cuenta, sin rastreo.

[![Add to Chrome](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 languages](https://img.shields.io/badge/languages-52-orange)
![No analytics](https://img.shields.io/badge/analytics-none-lightgrey)

[![GitHub stars](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/screenshots/dashboard-desktop-dark.png">
  <img src="docs/assets/screenshots/dashboard-desktop-light.png" alt="El panel de Bookmark Scope con una lista de marcadores, filtros, etiquetas y un panel de detalles">
</picture>

## Por qué existe

Chrome muestra tus marcadores como un árbol de carpetas. Eso sirve para veinte enlaces. No sirve para dos mil.

Guardas el mismo artículo tres veces. Una carpeta de 2019 está medio llena de enlaces muertos. Tienes once marcadores de un sitio y no encuentras el que buscas. Bookmark Scope te ayuda con estos problemas.

- Abre el popup en cualquier página. Verás los marcadores que ya tienes de esa página, de ese sitio o de ese dominio.
- Abre el panel. Verás toda tu biblioteca, podrás encontrar duplicados y enlaces muertos, y arreglarlos con pocos clics.

## Qué puedes hacer

### Ver lo que ya guardaste de este sitio

Haz clic en el icono de la barra de herramientas. El popup muestra tus marcadores de la página en la que estás. Cambia entre esta página exacta, este host o todo el dominio. La insignia del icono muestra cuántos marcadores coinciden.

<p align="center">
  <img src="docs/assets/screenshots/popup-light.png" alt="El popup con los marcadores del sitio actual" width="300">
  &nbsp;&nbsp;
  <img src="docs/assets/screenshots/popup-dark.png" alt="El popup en el tema oscuro" width="300">
</p>

### Ver toda tu biblioteca

El panel es una página completa para tus marcadores. Busca por título, dirección o carpeta. Agrupa por dominio o por carpeta. Ordena por título, dirección o fecha. Filtra duplicados, marcadores sin título, marcadores antiguos y títulos repetidos. Sigue siendo rápido con miles de marcadores.

Haz clic en un marcador para ver sus detalles. Marca varios para trabajar con ellos a la vez. Arrastra los marcadores para cambiar su orden.

### Ordena sin miedo

Nada importante ocurre sin una vista previa.

<p align="center">
  <img src="docs/assets/screenshots/duplicate-preview.png" alt="El diálogo de vista previa de duplicados, donde eliges qué marcador conservar" width="780">
</p>

- **Duplicados.** Elige qué copia conservar. Las etiquetas de las otras copias se añaden a ella. Ves el resultado antes de que se borre nada.
- **Etiquetas.** Añade, quita, renombra o combina etiquetas de muchos marcadores a la vez. Revisa el antes y el después, y luego aplica. Puedes deshacerlo.
- **Eliminar y deshacer.** Los marcadores eliminados se pueden restaurar con sus etiquetas. Chrome no permite que ninguna extensión recupere el ID original ni la fecha en que se añadió, así que el marcador restaurado es nuevo. La extensión te lo avisa.

<p align="center">
  <img src="docs/assets/screenshots/bulk-tags.png" alt="El diálogo de etiquetas en lote, con las etiquetas antes y después del cambio" width="780">
</p>

### Encuentra enlaces muertos

Revisa un grupo de marcadores para ver qué enlaces funcionan, cuáles redirigen y cuáles están rotos. La revisión se ejecuta en tu navegador y solo se conecta con los sitios que guardaste.

- Primero pide permiso. Si dices que no, todo lo demás sigue funcionando.
- Puedes pausar un escaneo largo y continuarlo más tarde.
- Puedes activar un escaneo programado. Viene desactivado por defecto.
- "Reparar redirigidos" actualiza los marcadores que cambiaron de dirección. No se puede deshacer, así que mira antes la nueva dirección.

### Copia de seguridad y traslado

- **Instantánea.** Guarda toda tu biblioteca, con carpetas y etiquetas, en un solo archivo. Restáurala más tarde en una carpeta nueva.
- **Importar.** Trae marcadores de Chrome, Edge, Firefox, Safari o Brave (el archivo `bookmarks.html`), de Pocket, Pinboard, Raindrop.io, o desde un CSV, un JSON o una lista simple de enlaces. Ves una vista previa y eliges qué hacer con los duplicados: conservar, omitir o combinar.
- **Exportar.** Guarda como JSON o CSV los marcadores que estás viendo.

<p align="center">
  <img src="docs/assets/screenshots/library-tools.png" alt="Herramientas de la biblioteca: vistas guardadas, etiquetas en lote, duplicados, escaneos, copia de seguridad e importación" width="780">
</p>

### Trabaja más rápido

- **Paleta de comandos.** Pulsa `Ctrl+Shift+P` (`Cmd+Shift+P` en Mac) y escribe lo que quieres hacer.
- **Vistas guardadas.** Guarda una búsqueda con sus filtros, etiquetas, orden y agrupación. Ábrela de nuevo con un clic.
- **Menú contextual.** En cualquier página o enlace, muestra tus marcadores de ese dominio o busca duplicados de ese enlace.
- **Recordatorios de revisión.** Actívalos en Ajustes si quieres un aviso cada pocas semanas para ordenar.

<p align="center">
  <img src="docs/assets/screenshots/command-palette.png" alt="La paleta de comandos con una lista de acciones" width="780">
</p>

### Hazlo tuyo

Tema claro, oscuro o del sistema. Cuatro paletas de colores. Diseños de derecha a izquierda. La extensión incluye 52 idiomas (consulta [Conviene saber](#good-to-know)).

<p align="center">
  <img src="docs/assets/screenshots/options-light.png" alt="La página de ajustes" width="300">
  &nbsp;&nbsp;
  <img src="docs/assets/screenshots/dashboard-rtl-dark.png" alt="El panel en persa con diseño de derecha a izquierda en el tema oscuro" width="300">
</p>

## Instalación

**Desde Chrome Web Store (lo más fácil)**

1. Abre la [página de Bookmark Scope](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo).
2. Haz clic en **Add to Chrome**.
3. Haz clic en el icono del rompecabezas de la barra de herramientas y ancla Bookmark Scope.

Otros navegadores Chromium, como Edge y Brave, normalmente pueden instalarla desde la misma página. Solo la pruebo con Chrome. Firefox y Safari no son compatibles.

**Desde este repositorio**

No hay paso de compilación. Esta carpeta es la extensión.

1. Descarga o clona este repositorio.
2. Abre `chrome://extensions` y activa el **Modo de desarrollador**.
3. Haz clic en **Cargar descomprimida** y elige la carpeta que contiene `manifest.json`.

Una copia descomprimida tiene su propio ID de extensión. Puedes tenerla junto a la versión de la tienda, pero no comparten datos, y la copia descomprimida no se actualiza sola.

## Tus datos se quedan contigo

No hay servidor. No hay cuenta, ni analítica, ni anuncios. Tus marcadores, etiquetas y ajustes se quedan en tu navegador. La [política de privacidad](PRIVACY.md) tiene los detalles.

La extensión no lee las páginas que visitas. Solo lee la dirección de la pestaña activa, para poder mostrar los marcadores que coinciden.

| Permiso | Para qué sirve |
| --- | --- |
| `bookmarks` | Leer tus marcadores y cambiarlos cuando lo pides |
| `tabs` | Leer la dirección de la pestaña activa para el popup y la insignia |
| `storage` | Guardar tus ajustes, etiquetas y resultados de escaneo en el navegador |
| `alarms` | Ejecutar recordatorios y escaneos programados opcionales |
| `notifications` | Mostrar recordatorios y resultados de escaneo |
| `contextMenus` | Añadir las opciones del menú contextual |
| `clipboardWrite` | Copiar direcciones cuando haces clic en un botón de copiar |
| `favicon` | Mostrar los iconos de los sitios desde la caché del propio navegador |
| Sitios web (opcional) | Solo se pide cuando inicias una revisión de enlaces, para que la extensión pueda conectarse con los sitios que guardaste |

<a id="good-to-know"></a>
## Conviene saber

- **Traducciones.** Corregí las traducciones con ayuda de IA y revisiones automáticas. Solo el inglés y el persa los ha leído una persona. Otros idiomas pueden tener errores o algunas palabras en inglés. Si ves alguno, por favor [abre un issue](../../issues) o envía un pull request. Consulta [CONTRIBUTING.md](CONTRIBUTING.md#translations).
- **Esta traducción al español.** Se escribió con ayuda de IA y todavía no la ha leído una persona de habla hispana. Si encuentras un error o una frase rara, abre un issue o envía un pull request con la corrección.
- **La importación es plana.** Al importar un archivo `bookmarks.html`, el nombre de la carpeta se muestra como una ruta, pero no se crean carpetas y no se conservan las fechas originales. Usa una instantánea si necesitas reconstruir un árbol de carpetas.
- **Las revisiones de enlaces son orientativas.** Cualquier respuesta 4xx cuenta como rota. Una página que carga pero muestra un error o una pantalla de inicio de sesión cuenta como sana.
- **CSV.** Probé la exportación a CSV con el importador y con una descarga real de Chrome. Todavía no la he abierto en Excel, Numbers ni Google Sheets.
- **Pruebas.** La extensión se prueba en Chromium. Consulta la [lista completa de límites](docs/guides/limits.html).

## Atajos de teclado

| Teclas | Qué hace |
| --- | --- |
| `Ctrl+Shift+P` / `Cmd+Shift+P` | Abrir la paleta de comandos |
| `/` | Ir al cuadro de búsqueda |
| `Ctrl+A` / `Cmd+A` | Seleccionar todos los marcadores de la lista actual |
| `Esc` | Retroceder un paso: cancelar una edición, borrar la búsqueda, quitar la selección, cerrar un diálogo |

## Guía de usuario

La guía explica cada parte de la extensión, con capturas de pantalla. Empieza por [docs/README.md](docs/README.md) o abre la [carpeta de guías](docs/guides/). Para leerla como página web, abre `docs/index.html` en tu navegador.

## Ayuda al proyecto

Se agradecen los reportes de errores, las correcciones de traducciones y los pull requests pequeños. Lee primero [CONTRIBUTING.md](CONTRIBUTING.md). Antes de enviar un pull request, ejecuta esta comprobación. Necesita Node.js 24 o más reciente y no requiere instalación.

```bash
node scripts/validate.mjs
node scripts/test.mjs
```

Por favor, reporta los problemas de seguridad en privado. Consulta [SECURITY.md](SECURITY.md).

Si Bookmark Scope te ahorra tiempo, puedes [invitarme un café](https://buymeacoffee.com/enaloo). Una valoración en [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) también ayuda a que otras personas la encuentren.

## Colaboradores

Gracias a todas las personas que han ayudado. Tu nombre aparece aquí después de tu primera contribución aceptada. Lee [CONTRIBUTING.md](CONTRIBUTING.md#recognition).

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="Contributors" width="400"></a>


## Licencia

[MIT](LICENSE). Copyright 2026 Ehsan Enaloo.

Dos partes vienen de otros proyectos y conservan sus propias licencias, indicadas en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md): la Public Suffix List (MPL-2.0) y los iconos de [Lucide](https://lucide.dev) (ISC).
