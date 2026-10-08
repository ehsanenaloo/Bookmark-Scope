[English](../../README.md) · [فارسی](README.fa.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Português (Brasil)** · [Русский](README.ru.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md)

<div align="center">

<img src="../../extension/icon-128.png" alt="Logo do Bookmark Scope" width="88" height="88">

# Bookmark Scope

**Encontre os favoritos do site em que você está. Organize o resto da sua biblioteca.**

Uma extensão gratuita do Chrome para quem salvou links demais.<br>
Ela funciona só no seu computador. Sem conta, sem rastreamento.

[![Add to Chrome](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)
[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/enaloo)

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 idiomas](https://img.shields.io/badge/idiomas-52-orange)
![Sem analytics](https://img.shields.io/badge/analytics-nenhum-lightgrey)

[![GitHub stars](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/dashboard-desktop-dark.png">
  <img src="../assets/screenshots/dashboard-desktop-light.png" alt="O painel do Bookmark Scope com uma lista de favoritos, filtros, tags e um painel de detalhes">
</picture>

## Por que isto existe

O Chrome mostra seus favoritos como uma árvore de pastas. Isso funciona bem para vinte links. Não funciona para dois mil.

Você salva o mesmo artigo três vezes. Uma pasta de 2019 está cheia de links mortos. Você tem onze favoritos sobre um site e não acha o que quer. O Bookmark Scope ajuda com esses problemas.

- Abra o popup em qualquer página. Veja os favoritos que você já tem para aquela página, aquele site ou aquele domínio.
- Abra o painel. Veja toda a sua biblioteca, encontre duplicados e links quebrados e resolva tudo com poucos cliques.

## O que você pode fazer

### Veja o que você já salvou para este site

Clique no ícone da barra de ferramentas. O popup lista seus favoritos para a página em que você está. Alterne entre esta página exata, este host ou o domínio inteiro. O selo no ícone mostra quantos favoritos correspondem.

<p align="center">
  <img src="../assets/screenshots/popup-light.png" alt="O popup mostrando os favoritos do site atual" width="300">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/popup-dark.png" alt="O popup no tema escuro" width="300">
</p>

### Veja toda a sua biblioteca

O painel é uma página inteira para os seus favoritos. Busque por título, endereço ou pasta. Agrupe por domínio ou por pasta. Ordene por título, endereço ou data. Filtre por duplicados, favoritos sem título, favoritos antigos e títulos repetidos. Ele continua rápido com milhares de favoritos.

Clique em um favorito para ver os detalhes. Marque vários para trabalhar neles juntos. Arraste os favoritos para mudar a ordem.

### Organize sem medo

Nada grande acontece sem uma prévia.

<p align="center">
  <img src="../assets/screenshots/duplicate-preview.png" alt="A janela de prévia de duplicados, onde você escolhe qual favorito manter" width="780">
</p>

- **Duplicados.** Escolha qual cópia manter. As tags das outras cópias são adicionadas a ela. Você vê o resultado antes de apagar qualquer coisa.
- **Tags.** Adicione, remova, renomeie ou una tags de vários favoritos de uma vez. Confira o antes e o depois e aplique. Você pode desfazer.
- **Apagar e desfazer.** Os favoritos apagados podem ser restaurados com as tags. O Chrome não deixa nenhuma extensão recuperar o ID original nem a data de adição, então o favorito restaurado é novo. A extensão avisa você sobre isso.

<p align="center">
  <img src="../assets/screenshots/bulk-tags.png" alt="A janela de tags em lote mostrando as tags antes e depois da mudança" width="780">
</p>

### Encontre links quebrados

Verifique um grupo de favoritos para ver quais links funcionam, quais redirecionam e quais estão quebrados. A verificação roda no seu navegador e fala só com os sites que você salvou.

- Ela pede permissão antes. Se você disser não, todo o resto continua funcionando.
- Você pode pausar uma verificação longa e continuar depois.
- Você pode ativar uma verificação agendada. Ela vem desativada por padrão.
- "Reparar redirecionados" atualiza os favoritos que mudaram para um novo endereço. Não dá para desfazer, então confira o novo endereço antes.

### Backup e migração

- **Snapshot.** Salve toda a sua biblioteca, com pastas e tags, em um único arquivo. Restaure depois em uma pasta nova.
- **Importar.** Traga favoritos do Chrome, Edge, Firefox, Safari ou Brave (o arquivo `bookmarks.html`), do Pocket, Pinboard, Raindrop.io, ou de uma lista de links em CSV, JSON ou texto simples. Você vê uma prévia e escolhe o que fazer com os duplicados: manter, ignorar ou mesclar.
- **Exportar.** Salve em JSON ou CSV os favoritos que você está vendo.

<p align="center">
  <img src="../assets/screenshots/library-tools.png" alt="Ferramentas da biblioteca: visualizações salvas, tags em lote, duplicados, verificações, backup e importação" width="780">
</p>

### Trabalhe mais rápido

- **Paleta de comandos.** Pressione `Ctrl+Shift+P` (`Cmd+Shift+P` no Mac) e digite o que você quer fazer.
- **Visualizações salvas.** Salve uma busca com seus filtros, tags, ordenação e agrupamento. Abra de novo com um clique.
- **Menu de clique direito.** Em qualquer página ou link, mostre seus favoritos daquele domínio ou encontre duplicados daquele link.
- **Lembretes de revisão.** Ative nas Configurações se quiser um aviso a cada poucas semanas para arrumar a biblioteca.

<p align="center">
  <img src="../assets/screenshots/command-palette.png" alt="A paleta de comandos com uma lista de ações" width="780">
</p>

### Deixe do seu jeito

Tema claro, escuro ou do sistema. Quatro paletas de cores. Layouts da direita para a esquerda. A extensão inclui 52 idiomas (veja [Bom saber](#good-to-know)).

<p align="center">
  <img src="../assets/screenshots/options-light.png" alt="A página de configurações" width="300">
  &nbsp;&nbsp;
  <img src="../assets/screenshots/dashboard-rtl-dark.png" alt="O painel em persa com layout da direita para a esquerda no tema escuro" width="300">
</p>

## Instalação

**Pela Chrome Web Store (mais fácil)**

1. Abra a [página do Bookmark Scope](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo).
2. Clique em **Add to Chrome**.
3. Clique no ícone de quebra-cabeça na barra de ferramentas e fixe o Bookmark Scope.

Outros navegadores Chromium, como Edge e Brave, normalmente conseguem instalar pela mesma página. Eu só testo com o Chrome. Firefox e Safari não são compatíveis.

**Por este repositório**

Não há etapa de build. A pasta `extension` é a extensão.

1. Baixe ou clone este repositório.
2. Abra `chrome://extensions` e ative o **Developer mode**.
3. Clique em **Load unpacked** e escolha a pasta `extension` dentro do repositório (a que contém o `manifest.json`), não a pasta principal.

Uma cópia sem empacotar tem o próprio ID de extensão. Você pode mantê-la ao lado da versão da Store, mas elas não compartilham dados, e a cópia sem empacotar não se atualiza sozinha.

## Seus dados ficam com você

Não há servidor. Não há conta, analytics nem anúncios. Seus favoritos, tags e configurações ficam no seu navegador. A [política de privacidade](../PRIVACY.md) tem os detalhes.

A extensão não lê as páginas que você visita. Ela só lê o endereço da aba ativa, para poder mostrar os favoritos correspondentes.

| Permissão | Para que serve |
| --- | --- |
| `bookmarks` | Ler seus favoritos e alterá-los quando você pedir |
| `tabs` | Ler o endereço da aba ativa para o popup e o selo |
| `storage` | Guardar no navegador suas configurações, tags e resultados de verificações |
| `alarms` | Executar lembretes opcionais e verificações agendadas opcionais |
| `notifications` | Mostrar lembretes e resultados de verificações |
| `contextMenus` | Adicionar os itens do menu de clique direito |
| `clipboardWrite` | Copiar endereços quando você clica em um botão de copiar |
| `favicon` | Mostrar os ícones dos sites a partir do cache do próprio navegador |
| Sites (opcional) | Pedida só quando você inicia uma verificação de links, para a extensão poder acessar os sites que você salvou |

<a id="good-to-know"></a>
## Bom saber

- **Traduções.** As traduções são automáticas, então podem ter erros ou deixar algumas palavras em inglês. Se o seu idioma nativo é um deles e você sabe escrever uma tradução correta e natural, ajude a gente: [abra uma issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues) ou envie um pull request. Veja o [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#translations).
- **A importação é plana.** Ao importar um arquivo `bookmarks.html`, o nome da pasta aparece como um caminho, mas as pastas não são criadas e as datas originais não são mantidas. Use um snapshot se precisar recriar uma árvore de pastas.
- **As verificações de links são apenas indicações.** Qualquer resposta 4xx conta como quebrada. Uma página que carrega, mas mostra um erro ou uma tela de login, conta como saudável.
- **CSV.** Testei a exportação em CSV com o importador e com um download real no Chrome. Ainda não abri o arquivo no Excel, no Numbers nem no Google Sheets.
- **Testes.** A extensão é testada no Chromium. Veja a [lista completa de limites](../guides/limits.html).

## Atalhos de teclado

| Teclas | O que fazem |
| --- | --- |
| `Ctrl+Shift+P` / `Cmd+Shift+P` | Abrir a paleta de comandos |
| `/` | Ir para a caixa de busca |
| `Ctrl+A` / `Cmd+A` | Selecionar todos os favoritos da lista atual |
| `Esc` | Voltar um passo: cancelar uma edição, limpar a busca, limpar a seleção, fechar uma janela |

## Guia do usuário

O guia explica cada parte da extensão, com capturas de tela. Comece por [docs/README.md](../README.md) ou abra a [pasta de guias](../guides/). Para ler como página web, abra `docs/index.html` no seu navegador.

## Ajude o projeto

Relatos de bugs, correções de tradução e pequenos pull requests são bem-vindos. Leia o [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) primeiro. Antes de enviar um pull request, rode esta verificação. Ela precisa do Node.js 24 ou mais novo e não exige instalação.

```bash
node scripts/validate.mjs
node scripts/test.mjs
```

Por favor, relate problemas de segurança em particular. Veja [SECURITY.md](../../.github/SECURITY.md).

Se o Bookmark Scope economiza seu tempo, você pode [me pagar um café](https://buymeacoffee.com/enaloo). Uma avaliação na [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) também ajuda outras pessoas a encontrá-lo.

## Contribuidores

Obrigado a todo mundo que ajudou. Seu nome aparece aqui depois da sua primeira contribuição aceita. Veja o [CONTRIBUTING.md](../../.github/CONTRIBUTING.md#recognition).

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="Contributors"></a>


## Licença

[MIT](../../LICENSE). Copyright 2026 Ehsan Enaloo.

O código do Bookmark Scope usa a licença MIT. Duas partes vêm de outros projetos e mantêm suas próprias licenças: a Public Suffix List (uma lista de terminações de domínio, como `.co.uk`, MPL-2.0) e os ícones do [Lucide](https://lucide.dev) (ISC). Os textos completos estão em [extension/THIRD_PARTY_NOTICES.md](../../extension/THIRD_PARTY_NOTICES.md).
