# Marcusnator Pro Athlete 2.0 By Dr. Hans

WebApp Progressivo (PWA) de rastreamento de emagrecimento, nutrição, treino, evolução clínica e comportamento alimentar (EFCA), pronto para hospedagem gratuita no **GitHub Pages** e instalação na tela inicial do **Android** e **iPhone (iOS)**.

## Como publicar no GitHub Pages
1. Crie um repositório no GitHub (ex.: `marcusnator-pro-athlete`).
2. Envie todos os arquivos desta pasta (`index.html`, `manifest.webmanifest`, `sw.js` e a pasta `icons/`).
3. Acesse **Settings > Pages** no repositório, selecione a branch `main` e pasta `/ (root)` e salve.
4. Abra o link gerado no celular:
   - **Android (Chrome):** Toque no banner *"Instalar Aplicativo"* ou no menu `⋮` > **Adicionar à tela inicial**.
   - **iPhone (Safari):** Toque no botão **Compartilhar** (`↑`) > **Adicionar à Tela de Início**.

## Como ativar a sincronização com o Google Sheets
1. Abra a planilha **Marcusnator 2.0 Pro Athlete By Dr. Hans**.
2. Vá em **Extensões > Apps Script**, cole o conteúdo de `apps-script/Code.gs` e salve.
3. Clique em **Implantar > Nova implantação > App da Web** (Executar como: *Eu* | Acesso: *Qualquer pessoa*).
4. Copie a URL gerada (`/exec`) e cole na opção **Sincronizar Google Sheets** dentro do menu (`=`) do aplicativo.
