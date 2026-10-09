[English](../../README.md) · [فارسی](README.fa.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Português (Brasil)** · [Русский](README.ru.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md)

<div align="center">

<img src="../../extension/icons/icon-128.png" alt="Logo do Bookmark Scope" width="88" height="88">

# Bookmark Scope

**Encontre os favoritos do site em que você está. Organize o resto da sua biblioteca.**

Uma extensão de navegador gratuita e de código aberto para quem salvou links demais.<br>
Ela funciona só no seu computador. Sem conta, sem rastreamento.

[![Adicionar ao Chrome](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)
[![Guia do usuário](https://img.shields.io/badge/User%20guide-Read%20online-0f766e?logo=readthedocs&logoColor=white&style=for-the-badge)](https://enaloo.com/apps/bookmark-scope/)
[![Me pague um café](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/enaloo)

[![Licença: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 idiomas](https://img.shields.io/badge/languages-52-orange)
![Sem analytics](https://img.shields.io/badge/analytics-none-lightgrey)
[![Estrelas no GitHub](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

[Recursos](#features) · [Instalação](#install) · [Privacidade](#privacy) · [Documentação](#documentation) · [Perguntas frequentes](#faq) · [Como contribuir](#contributing)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/dashboard-desktop-dark.png">
  <img src="../assets/screenshots/dashboard-desktop-light.png" alt="O painel do Bookmark Scope com uma lista de favoritos, filtros, tags e um painel de detalhes">
</picture>

## O que é o Bookmark Scope?

O Chrome mostra seus favoritos como uma árvore de pastas. Isso funciona para vinte links, não para dois mil. Você salva o mesmo artigo três vezes, metade de uma pasta antiga são links mortos e você não sabe o que já salvou do site que está lendo.

O Bookmark Scope resolve isso com duas ferramentas. O **popup** mostra os favoritos que você já tem para a página, o site ou o domínio em que está. O **painel** mostra toda a sua biblioteca, para você achar duplicados e links mortos e organizar tudo em poucos cliques, com uma prévia antes de qualquer mudança.

<a id="features"></a>

## Recursos

| | |
| --- | --- |
| **Popup para o site atual** <br> Veja os favoritos salvos para esta página, host ou domínio. O selo na barra de ferramentas mostra quantos correspondem. | **Painel para toda a sua biblioteca** <br> Busque, filtre, agrupe, ordene, adicione tags e edite milhares de favoritos. Continua rápido. |
| **Limpeza segura** <br> Veja antes uma prévia da mesclagem de duplicados e das mudanças de tags em lote. Desfaça o que você apagar, com as tags. | **Verificação de links mortos** <br> Encontre links quebrados e redirecionados. É opcional, e verificações longas podem ser pausadas e retomadas. |
| **Backup e importação** <br> Salve snapshots da sua biblioteca. Importe de `bookmarks.html`, Pocket, Pinboard, Raindrop.io, CSV e JSON. Exporte para JSON ou CSV. | **Visualizações salvas e paleta de comandos** <br> Abra uma busca salva com um clique. Pressione `Ctrl+Shift+P` (`Cmd+Shift+P` no Mac) para ver todas as ações. |
| **Privado por princípio** <br> Sem servidor, sem conta, sem analytics. Seus dados ficam no seu navegador. | **Seu idioma e seu visual** <br> 52 idiomas, temas claro e escuro, quatro paletas de cores e layouts da direita para a esquerda. |

<p align="center">
  <img src="../assets/screenshots/popup-light.png" alt="O popup mostrando os favoritos do site atual" width="230">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/duplicate-preview.png" alt="A janela de prévia de duplicados, onde você escolhe qual favorito manter" width="520">
</p>
<p align="center">
  <img src="../assets/screenshots/library-tools.png" alt="Ferramentas da biblioteca: visualizações salvas, tags em lote, duplicados, verificações, backup e importação" width="390">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/command-palette.png" alt="A paleta de comandos com uma lista de ações" width="390">
</p>

<a id="install"></a>

## Instalação

| Navegador | Status | Como |
| --- | --- | --- |
| **Chrome** | Testado | [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) |
| **Edge** | Funciona | [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ioonncgajlliiajlebblkfkgagcgcnae) |
| **Brave** | Funciona | Instale pela mesma página da Chrome Web Store. |
| **Firefox 140+** (computador) | Experimental | [Instalação temporária pela página de Releases](#firefox-experimental) |
| **Safari** | Não compatível | |

**Chrome e Brave:** abra a página da loja, clique em **Add to Chrome**, depois clique no ícone de quebra-cabeça na barra de ferramentas e fixe o Bookmark Scope.

**Edge:** abra a [página no Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ioonncgajlliiajlebblkfkgagcgcnae) e clique em **Get**.

<a id="firefox-experimental"></a>

**Firefox (experimental):** ele ainda não está no Firefox Add-ons.

1. Baixe `bookmark-scope-<version>-firefox.zip` na [página de Releases](https://github.com/ehsanenaloo/Bookmark-Scope/releases).
2. No Firefox, abra `about:debugging#/runtime/this-firefox`.
3. Clique em **Load Temporary Add-on** e escolha o arquivo zip.

O Firefox remove os complementos temporários quando fecha. Há mais detalhes no [guia de instalação](https://enaloo.com/apps/bookmark-scope/docs/installation/#firefox-experimental).

**A partir do código-fonte:** não há etapa de build. A pasta `extension/` é a extensão. Abra `chrome://extensions`, ative o **Modo do desenvolvedor**, clique em **Carregar sem compactação** e escolha a pasta `extension`.

<a id="privacy"></a>

## Privacidade

- Não há servidor, nem conta, nem analytics, nem anúncios.
- Seus favoritos, tags e configurações ficam no seu navegador.
- As únicas requisições de rede são as verificações de links dos sites que você salvou, e só depois que você permitir. Todo o resto funciona sem essa permissão.
- A extensão não lê as páginas que você visita. Ela só lê o endereço da aba ativa, para mostrar os favoritos correspondentes.

Leia a [política de privacidade](https://enaloo.com/apps/bookmark-scope/docs/privacy-policy/) para ver os detalhes e a lista de permissões.

<a id="documentation"></a>

## Documentação

| | |
| --- | --- |
| [Guia do usuário](https://enaloo.com/apps/bookmark-scope/) | Todos os recursos, com capturas de tela |
| [Limites conhecidos](https://enaloo.com/apps/bookmark-scope/docs/limits/) | O que está incompleto ou sem teste |
| [Política de privacidade](https://enaloo.com/apps/bookmark-scope/docs/privacy-policy/) | O que a extensão guarda e envia |
| [Changelog](../../CHANGELOG.md) | O que mudou em cada versão |
| [Como contribuir](../../.github/CONTRIBUTING.md) | Como relatar bugs e enviar mudanças |
| [Segurança](../../.github/SECURITY.md) | Como relatar um problema de segurança em particular |

<a id="faq"></a>

## Perguntas frequentes

<details>
<summary><b>Ele envia meus favoritos para algum lugar?</b></summary>

Não. Não há servidor. Seus favoritos ficam no seu navegador. A extensão só entra em contato com os sites que você salvou, quando você inicia uma verificação de links e já a permitiu.
</details>

<details>
<summary><b>Ele vai alterar ou apagar favoritos por conta própria?</b></summary>

Não. Ele só altera favoritos quando você pede. Mesclagens e mudanças de tags em lote mostram uma prévia antes, e apagar pede a sua confirmação.
</details>

<details>
<summary><b>Posso recuperar um favorito apagado?</b></summary>

Sim, use Desfazer. O favorito volta para a pasta dele com as tags. Os navegadores não deixam nenhuma extensão restaurar o ID original nem a data em que foi adicionado, então o favorito restaurado é novo.
</details>

<details>
<summary><b>Funciona com outros gerenciadores de favoritos?</b></summary>

Você pode importar do Chrome, Edge, Firefox, Safari e Brave (o arquivo `bookmarks.html`), do Pocket, Pinboard, Raindrop.io, e de arquivos CSV e JSON. As importações são planas: as pastas aparecem como um caminho, mas não são criadas.
</details>

<details>
<summary><b>Como relato um problema ou peço um recurso?</b></summary>

[Abra uma issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues). Por favor, não inclua a sua lista real de favoritos. Para problemas de segurança, veja o [SECURITY.md](../../.github/SECURITY.md).
</details>

## Traduções

As traduções são automáticas, então podem ter erros ou deixar algumas palavras em inglês. Se o seu idioma nativo é um deles e você sabe escrever uma tradução correta e natural, ajude a gente: [abra uma issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues) ou envie um pull request. Veja o [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#translations).

<a id="contributing"></a>

## Como contribuir

Relatos de bugs, correções de tradução e pull requests pequenos são bem-vindos. Leia primeiro o [CONTRIBUTING.md](../../.github/CONTRIBUTING.md).

Se o Bookmark Scope economiza o seu tempo, você pode [me pagar um café](https://buymeacoffee.com/enaloo). Uma avaliação na [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) também ajuda outras pessoas a encontrá-lo.

### Contribuidores

Obrigado a todo mundo que ajudou. Seu nome aparece aqui depois da sua primeira contribuição aceita.

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="Contribuidores"></a>

## Licença

[MIT](../../LICENSE). Copyright 2026 Ehsan Enaloo.

O código da extensão usa a licença MIT. Duas partes vêm de outros projetos e mantêm suas próprias licenças: a Public Suffix List (uma lista de terminações de domínio, como `.co.uk`, MPL-2.0) e os ícones do [Lucide](https://lucide.dev) (ISC). Os textos completos estão em [extension/THIRD_PARTY_NOTICES.md](../../extension/THIRD_PARTY_NOTICES.md).
