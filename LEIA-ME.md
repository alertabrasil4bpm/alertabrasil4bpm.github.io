# Site Alerta Brasil - 4º BPM + PRF

Conteúdo da pasta:

- `index.html` - o site (já com os logos em `assets/`)
- `assets/` - brasão do 4º BPM e logo da PRF
- `apps-script/Code.gs` - o script que grava as respostas na planilha

Para o site funcionar são **3 ajustes, nesta ordem**. Leva cerca de 20 minutos.

---

## 1. Criar o "Client ID" do login Google

1. Acesse https://console.cloud.google.com e crie um projeto (ex.: "Alerta Brasil 4BPM").
2. Menu **APIs e serviços > Tela de permissão OAuth**.
   - Tipo de usuário: **Externo**. Preencha nome do app e e-mails de contato.
   - Escopos: deixe só os básicos (e-mail, perfil, openid).
   - **Publique o app ("Em produção")**. Se ficar em "Teste", só quem você cadastrar como testador consegue entrar.
3. Menu **APIs e serviços > Credenciais > Criar credenciais > ID do cliente OAuth**.
   - Tipo: **Aplicativo da Web**.
   - Em **Origens JavaScript autorizadas**, coloque o endereço onde o site vai ficar, por exemplo `https://alertabrasil4bpm.netlify.app` (sem barra no final). Para testar no seu computador, adicione também `http://localhost:8000`.
4. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`).

## 2. Instalar o script da planilha

1. Abra a planilha de respostas. Menu **Extensões > Apps Script**.
2. Apague o conteúdo e cole o arquivo `apps-script/Code.gs`.
3. No topo, troque o Client ID (já preenchido nesta versão) pelo ID do cliente do passo 1.
4. Selecione a função `configurarPlanilha` e clique em **Executar** (autorize quando pedir). Isso cria a aba **Respostas** com os títulos das colunas. Se a planilha já estiver preparada, pode pular.
5. Clique em **Implantar > Nova implantação > Tipo: App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Copie a **URL do app da Web** (termina em `/exec`).

> "Qualquer pessoa" só quer dizer que o site consegue chamar o script. Para gravar, a pessoa precisa estar logada no Google e o login é conferido pelo script. Ninguém precisa de acesso à planilha.

## 3. Ajustar e publicar o site

1. Abra `index.html` em um editor de texto e procure `CONFIG` (perto do final). Preencha:
   - `GOOGLE_CLIENT_ID`: o ID do cliente do passo 1
   - `API_URL`: a URL `/exec` do passo 2
2. Publique a pasta inteira (o `index.html` junto com a pasta `assets`) em um local com **HTTPS**. Opções simples e gratuitas:
   - **Netlify Drop** (app.netlify.com/drop): arraste a pasta e ele devolve um link.
   - **GitHub Pages** ou **Cloudflare Pages**.
   - Servidor próprio do batalhão, desde que seja HTTPS.
3. Se o endereço final for diferente do que você colocou no passo 1, volte em **Credenciais** e adicione o endereço correto em "Origens JavaScript autorizadas".

## Testando

1. Abra o site, entre com uma conta Google e envie o formulário.
2. Confira que apareceu uma linha na aba **Respostas**.
3. Saia, entre de novo com a mesma conta: os dados devem voltar preenchidos. Altere algo e envie: a mesma linha é atualizada, sem criar outra.

## Como aprovar

Na aba **Respostas**, a coluna **Situação** começa como `Pendente`. Troque para `Aprovado` ou `Rejeitado` (lista suspensa). Em `Observações do administrador` você pode escrever o que a pessoa precisa corrigir: ela vê esse texto ao reabrir o formulário. Se a pessoa alterar dados depois de avaliada, a situação volta para `Pendente`.

## Regras já embutidas

- Cada conta Google tem uma única linha (reenvio = edição).
- O mesmo CPF não pode ser usado por duas contas.
- CPF validado pelos dígitos verificadores; equipe só aceita as opções da lista.
- Nomes só aceitam letras (bloqueia fórmulas e caracteres estranhos na planilha).

## Cuidados

- A planilha contém CPF e matrícula: **não compartilhe por link**, deixe só com quem administra o cadastro.
- Se mudar o `Code.gs`, faça **Implantar > Gerenciar implantações > Editar > Nova versão**, senão o site continua usando a versão antiga.
- Para incluir ou trocar equipes, altere a lista `EQUIPES` no `Code.gs` e as opções do campo "Equipe / guarnição" no `index.html` (os textos precisam ser idênticos).
