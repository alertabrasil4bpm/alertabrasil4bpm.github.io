/**
 * Alerta Brasil - 4º BPM + PRF
 * API que recebe o formulário do site e grava na planilha.
 *
 * Como funciona:
 *  - O site envia o "token" do login Google junto com os dados.
 *  - Este script confere o token com o Google, descobre o e-mail da pessoa e
 *    cria (ou atualiza) a linha dela na planilha. Cada e-mail tem uma única linha.
 *  - Quem preenche NUNCA tem acesso à planilha; só este script grava nela.
 *
 * Passo a passo de instalação: veja o arquivo LEIA-ME.md.
 */

const CONFIG = {
  SHEET_ID: '1lv9h6BivLPCTF8dPxIJ2n2rfCkJbWsYTGu6UFAn3-pw',
  SHEET_NAME: 'Respostas',
  // Mesmo Client ID que vai no index.html
  GOOGLE_CLIENT_ID: '650627934556-vcb0v6q690vug5f03p5u10fjb9vm0tgv.apps.googleusercontent.com',
  TIMEZONE: 'America/Recife'
};

const HEADERS = [
  'Primeiro envio', 'Última atualização', 'E-mail Google', 'Matrícula',
  'Nome de guerra', 'Nome completo', 'CPF', 'Equipe / guarnição',
  'Situação', 'Observações do administrador'
];
const COL = { CRIADO: 1, ATUALIZADO: 2, EMAIL: 3, MATRICULA: 4, GUERRA: 5, NOME: 6, CPF: 7, EQUIPE: 8, STATUS: 9, OBS: 10 };
const STATUS = ['Pendente', 'Aprovado', 'Rejeitado'];

const EQUIPES = [
  'Operação IMPACTO',
  'GT Alto do Moura',
  'GT KOBAN',
  'GT Maria da Penha',
  'GT Vassoural',
  'GTR 2º Distrito',
  'GTR 4º Distrito',
  'GT Salgado',
  'GE Tático – Sede do 4º BPM',
  'GT Operações – Sede do 4º BPM',
  'Central – PC 04'
];

class UserError extends Error {}

/* ===================== Preparação da planilha ===================== */

/** Rode UMA vez no editor (botão "Executar") para preparar a planilha. */
function configurarPlanilha() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) sh = ss.insertSheet(CONFIG.SHEET_NAME);

  sh.getRange(1, 1, 1, HEADERS.length)
    .setValues([HEADERS])
    .setFontWeight('bold')
    .setBackground('#0B2E6B')
    .setFontColor('#FFFFFF')
    .setWrap(true);
  sh.setFrozenRows(1);

  const rows = Math.max(sh.getMaxRows() - 1, 1);
  // Texto puro em todas as colunas de dados: preserva zeros à esquerda e impede fórmulas.
  sh.getRange(2, 1, rows, HEADERS.length).setNumberFormat('@');

  const regra = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS, true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, COL.STATUS, rows, 1).setDataValidation(regra);

  const larguras = [150, 150, 230, 110, 150, 280, 130, 230, 110, 280];
  larguras.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  return 'Planilha pronta: aba "' + CONFIG.SHEET_NAME + '".';
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || sh.getLastRow() < 1) {
    configurarPlanilha();
    sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  }
  return sh;
}

/* ============================ Entrada ============================ */

function doGet() {
  return out_({ ok: true, service: 'Alerta Brasil - 4º BPM' });
}

function doPost(e) {
  let lock = null;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    // Campo-isca contra robôs: se vier preenchido, ignora em silêncio.
    if (req.data && req.data.website) return out_({ ok: true });

    const user = verifyIdToken_(req.token);

    lock = LockService.getScriptLock();
    lock.waitLock(20000);
    const sh = getSheet_();

    if (req.action === 'get') return out_({ ok: true, record: getRecord_(sh, user.email) });
    if (req.action === 'save') return out_(saveRecord_(sh, user.email, req.data || {}));
    throw new UserError('Ação inválida.');
  } catch (err) {
    if (err instanceof UserError) return out_({ ok: false, error: err.message });
    console.error(err && err.stack ? err.stack : err);
    return out_({ ok: false, error: 'Erro interno. Tente novamente em instantes.' });
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (_) { /* ignora */ } }
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ======================= Login (token Google) ======================= */

function verifyIdToken_(token) {
  const MSG = 'Sessão inválida ou expirada. Entre novamente com o Google.';
  if (!token || typeof token !== 'string' || token.length > 4096) throw new UserError(MSG);
  const resp = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
    { muteHttpExceptions: true }
  );
  if (resp.getResponseCode() !== 200) throw new UserError(MSG);
  const p = JSON.parse(resp.getContentText());
  const issOk = p.iss === 'accounts.google.com' || p.iss === 'https://accounts.google.com';
  if (p.aud !== CONFIG.GOOGLE_CLIENT_ID || !issOk) throw new UserError(MSG);
  if (String(p.email_verified) !== 'true' || !p.email) throw new UserError(MSG);
  if (Number(p.exp) * 1000 < Date.now()) throw new UserError(MSG);
  return { email: String(p.email).toLowerCase(), name: p.name || '' };
}

/* ============================ Dados ============================ */

function readAll_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
}

function digits_(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
function str_(v) { return String(v == null ? '' : v); }

function toRecord_(row) {
  return {
    matricula: str_(row[COL.MATRICULA - 1]),
    guerra: str_(row[COL.GUERRA - 1]),
    nome: str_(row[COL.NOME - 1]),
    cpf: digits_(row[COL.CPF - 1]),
    equipe: str_(row[COL.EQUIPE - 1]),
    status: str_(row[COL.STATUS - 1]) || 'Pendente',
    obs: str_(row[COL.OBS - 1]),
    atualizado: str_(row[COL.ATUALIZADO - 1])
  };
}

function findRow_(rows, email) {
  for (let i = 0; i < rows.length; i++) {
    if (str_(rows[i][COL.EMAIL - 1]).toLowerCase() === email) return i;
  }
  return -1;
}

function getRecord_(sh, email) {
  const rows = readAll_(sh);
  const i = findRow_(rows, email);
  return i < 0 ? null : toRecord_(rows[i]);
}

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’.\- ]*$/;
const MAT_RE = /^[0-9A-Za-z][0-9A-Za-z.\-]{2,14}$/;

function cpfValido_(v) {
  const c = digits_(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(c.charAt(i)) * (t + 1 - i);
    const d = (s * 10) % 11 % 10;
    if (d !== Number(c.charAt(t))) return false;
  }
  return true;
}

function validate_(d) {
  const matricula = str_(d.matricula).trim();
  const guerra = str_(d.guerra).trim().replace(/\s+/g, ' ');
  const nome = str_(d.nome).trim().replace(/\s+/g, ' ');
  const cpf = digits_(d.cpf);
  const equipe = str_(d.equipe);

  if (!MAT_RE.test(matricula)) throw new UserError('Matrícula inválida.');
  if (guerra.length < 2 || guerra.length > 40 || !NAME_RE.test(guerra)) throw new UserError('Nome de guerra inválido.');
  if (nome.length < 5 || nome.length > 120 || !NAME_RE.test(nome) || nome.indexOf(' ') < 0) throw new UserError('Nome completo inválido.');
  if (!cpfValido_(cpf)) throw new UserError('CPF inválido.');
  if (EQUIPES.indexOf(equipe) < 0) throw new UserError('Selecione uma equipe da lista.');
  return { matricula: matricula, guerra: guerra, nome: nome, cpf: cpf, equipe: equipe };
}

function maskCpf_(c) {
  return c.slice(0, 3) + '.' + c.slice(3, 6) + '.' + c.slice(6, 9) + '-' + c.slice(9);
}

function now_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
}

function saveRecord_(sh, email, d) {
  const v = validate_(d);
  const rows = readAll_(sh);
  const idx = findRow_(rows, email);

  // Mesmo CPF não pode estar em duas contas Google diferentes.
  for (let i = 0; i < rows.length; i++) {
    if (i !== idx && digits_(rows[i][COL.CPF - 1]) === v.cpf) {
      throw new UserError('Este CPF já está cadastrado em outra conta Google. Procure a SSCOM do 4º BPM.');
    }
  }

  const agora = now_();
  let row;
  let created = false;
  if (idx < 0) {
    created = true;
    row = [agora, agora, email, v.matricula, v.guerra, v.nome, maskCpf_(v.cpf), v.equipe, 'Pendente', ''];
    const target = Math.max(sh.getLastRow(), 1) + 1;
    sh.getRange(target, 1, 1, HEADERS.length).setNumberFormat('@').setValues([row]);
  } else {
    const old = rows[idx];
    const mudou =
      str_(old[COL.MATRICULA - 1]) !== v.matricula ||
      str_(old[COL.GUERRA - 1]) !== v.guerra ||
      str_(old[COL.NOME - 1]) !== v.nome ||
      digits_(old[COL.CPF - 1]) !== v.cpf ||
      str_(old[COL.EQUIPE - 1]) !== v.equipe;
    let status = str_(old[COL.STATUS - 1]) || 'Pendente';
    // Alterou dados depois de avaliado: volta para análise.
    if (mudou && (status === 'Aprovado' || status === 'Rejeitado')) status = 'Pendente';
    row = [old[COL.CRIADO - 1], agora, email, v.matricula, v.guerra, v.nome, maskCpf_(v.cpf), v.equipe, status, old[COL.OBS - 1]];
    sh.getRange(idx + 2, 1, 1, HEADERS.length).setNumberFormat('@').setValues([row]);
  }
  return { ok: true, created: created, record: toRecord_(row) };
}
