# Marcusnator Pro Athlete 2.0 By Dr. Hans

WebApp progressivo (PWA) de rastreamento de emagrecimento, nutrição assistida por IA (Gemini), farmacocinética de GLP-1/GIP (Semaglutida e Tirzepatida), bioimpedância, avaliação de tipo corporal, Escala EFCA e geração de relatório clínico em PDF.

## 1. Como publicar no GitHub Pages

1. Crie um repositório público ou privado (com Pages habilitado) no GitHub, por exemplo: `marcusnator-pro-athlete`.
2. Extraia todo o conteúdo deste `.ZIP` e suba os arquivos (`index.html`, `manifest.json`, `sw.js`, `css/`, `js/`, `icons/`) para a raiz do branch `main`.
3. No GitHub, acesse **Settings → Pages**.
4. Em **Source**, selecione **Deploy from a branch**, escolha `main` e a pasta `/ (root)`, e clique em **Save**.
5. Em 1–2 minutos, seu aplicativo estará no ar em `https://SEU_USUARIO.github.io/marcusnator-pro-athlete/`.

## 2. Como configurar o Google Apps Script (Planilha)

1. Abra sua planilha no Google Sheets:
   `https://docs.google.com/spreadsheets/d/1lM9dHsrdv59n_HkY5Oa75UBzbabNDUfdCvgOMgCWxxc/edit`
2. No menu superior, clique em **Extensões → Apps Script**.
3. Apague o conteúdo padrão de `Code.gs` e cole o conteúdo do arquivo `apps-script/Code.gs` incluído neste ZIP.
4. Salve o projeto (`Ctrl+S` / `Cmd+S`).
5. Clique em **Implantar → Gerenciar implantações** (ou **Nova implantação**):
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. A URL padrão já está configurada em `js/api.js`. Caso crie uma nova implantação com URL diferente, basta atualizar `DEFAULT_APPS_SCRIPT_URL` em `js/api.js` (ou alterar diretamente em Configurações dentro do app).
7. Na primeira requisição, o script criará automaticamente as abas `Perfis`, `DadosUsuario`, `DiarioRefeicoes`, `PesagensMedidas`, `Treinos`, `Aplicacoes` e `EFCA`.

## 3. Como instalar na tela principal (PWA)

- **Android (Chrome/Edge):** Abra a URL do GitHub Pages e toque em **Instalar aplicativo** no banner superior ou no menu (`⋮`) → **Adicionar à tela inicial**.
- **iPhone / iPad (Safari):** Abra a URL no Safari, toque no botão **Compartilhar** (`↑`) e selecione **Adicionar à Tela de Início**.
- **Mac / Windows (Chrome/Edge):** Clique no ícone de instalação na barra de endereços (ou no botão **Instalar App** no menu `=` do aplicativo).

## 4. Aviso Clínico

> Este aplicativo é apenas uma ferramenta e não substitui profissionais como Nutricionista, Médico, Profissional de Educação Física, Fisioterapeuta e Psicólogos. Faça questão de sempre estar acompanhando de ajuda profissional!
