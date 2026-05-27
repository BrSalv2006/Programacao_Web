# Documento de Arquitetura - Armazenamento no Browser

Para este projeto, adotámos uma estratégia híbrida de armazenamento no lado do cliente (browser) visando segurança, performance e capacidades offline-first. As decisões baseiam-se nos seguintes pilares:

### 1. Cookies (HttpOnly) para o JWT
* **Justificação:** A autenticação é gerida via JWT (JSON Web Tokens). Optámos por **não** armazenar o token no `localStorage` devido à vulnerabilidade a ataques de XSS (Cross-Site Scripting). O token é injetado via Cookie marcado como `HttpOnly`, `Secure` (em produção) e `SameSite=Strict`. Isto garante que apenas o servidor consegue ler o token, protegendo a sessão do utilizador.

### 2. IndexedDB para Operações Pendentes e Sincronização
* **Justificação:** Dada a natureza de uma exploração agrícola (onde a internet pode ser instável), implementámos persistência local robusta através de IndexedDB. Ele é utilizado para armazenar ações do utilizador (ex: concluir tarefas, registar medições offline). Quando a ligação é restabelecida, um Service Worker processa a fila de ações pendentes. O IndexedDB foi preferido face ao localStorage pela sua capacidade de suportar volumes maiores de dados e estruturas mais complexas (asíncronas).

### 3. Cache API (Service Workers)
* **Justificação:** Utilizado para armazenar recursos estáticos vitais (`.css`, `.js`, `.html`, ícones) da aplicação. O Service Worker interceta os pedidos de rede e devolve a versão da Cache API se a rede falhar. Isto melhora significativamente o tempo de carregamento (Performance) e providencia o comportamento "App-Like" (PWA), exibindo as interfaces do utilizador mesmo sem acesso à internet.
