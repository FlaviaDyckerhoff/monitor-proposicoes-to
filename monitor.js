const fs = require('fs');
const nodemailer = require('nodemailer');

const EMAIL_DESTINO = process.env.EMAIL_DESTINO;
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE;
const EMAIL_SENHA = process.env.EMAIL_SENHA;
const ARQUIVO_ESTADO = 'estado.json';
const API_BASE = 'https://sapl.al.to.leg.br/api';

function carregarEstado() {
  if (fs.existsSync(ARQUIVO_ESTADO)) {
    return JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, 'utf8'));
  }
  return { proposicoes_vistas: [], ultima_execucao: '' };
}

function salvarEstado(estado) {
  fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify(estado, null, 2));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function construirLinkProposicao(p) {
  return p.id ? `https://sapl.al.to.leg.br/materia/${encodeURIComponent(p.id)}` : 'https://sapl.al.to.leg.br/materia/pesquisar-materia';
}

async function enviarEmail(novas) {
  if (process.env.DRY_RUN_EMAIL === '1') {
    console.log(`[DRY_RUN_EMAIL] Email não enviado. Seriam ${novas.length} proposições.`);
    novas.slice(0, 5).forEach(p => console.log(`[DRY_RUN_EMAIL] ${p.tipo} ${p.numero}/${p.ano}: ${p.link}`));
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_REMETENTE, pass: EMAIL_SENHA },
  });

  // Agrupa por tipo
  const porTipo = {};
  novas.forEach(p => {
    const tipo = p.tipo || 'OUTROS';
    if (!porTipo[tipo]) porTipo[tipo] = [];
    porTipo[tipo].push(p);
  });

  const linhas = Object.keys(porTipo).sort().map(tipo => {
    const header = `<tr><td colspan="6" style="padding:10px 8px 4px;background:#f0f4f8;font-weight:bold;color:#1a5c2a;font-size:13px;border-top:2px solid #1a5c2a">${tipo} — ${porTipo[tipo].length} proposição(ões)</td></tr>`;
    const rows = porTipo[tipo].map(p => {
      const numeroAno = `${escapeHtml(p.numero || '-')}/${escapeHtml(p.ano || '-')}`;
      const link = escapeHtml(p.link || construirLinkProposicao(p));
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#555;font-size:12px">${escapeHtml(p.tipo || '-')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee"><strong><a href="${link}" style="color:#1a5c2a;text-decoration:underline">${numeroAno}</a></strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px">${escapeHtml(p.autor || '-')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;white-space:nowrap">${escapeHtml(p.data || '-')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px">${escapeHtml(p.ementa || '-')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;white-space:nowrap"><a href="${link}" style="color:#1a5c2a;text-decoration:underline">Abrir</a></td>
      </tr>`;
    }).join('');
    return header + rows;
  }).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto">
      <h2 style="color:#1a5c2a;border-bottom:2px solid #1a5c2a;padding-bottom:8px">
        🏛️ Assembleia Legislativa do Tocantins — ${novas.length} nova(s) proposição(ões)
      </h2>
      <p style="color:#666">Monitoramento automático — ${new Date().toLocaleString('pt-BR')}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#1a5c2a;color:white">
            <th style="padding:10px;text-align:left">Tipo</th>
            <th style="padding:10px;text-align:left">Número/Ano</th>
            <th style="padding:10px;text-align:left">Autor</th>
            <th style="padding:10px;text-align:left">Data</th>
            <th style="padding:10px;text-align:left">Ementa</th>
            <th style="padding:10px;text-align:left">Link</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      <p style="margin-top:20px;font-size:12px;color:#999">
        Acesse: <a href="https://sapl.al.to.leg.br/materia/pesquisar-materia">sapl.al.to.leg.br</a>
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Monitor Tocantins" <${EMAIL_REMETENTE}>`,
    to: EMAIL_DESTINO,
    subject: `🏛️ Tocantins: ${novas.length} nova(s) proposição(ões) — ${new Date().toLocaleDateString('pt-BR')}`,
    html,
  });

  console.log(`✅ Email enviado com ${novas.length} proposições novas.`);
}

async function buscarProposicoes() {
  const ano = new Date().getFullYear();
  console.log(`Buscando proposicoes de ${ano}...`);

  // ALETO/SAPL customizado: o endpoint ignora page_size=200 e devolve 100 por pagina,
  // mas informa total_pages em pagination. Não parar por lista.length < PAGE_SIZE.
  const PAGE_SIZE = 200;
  const MAX_PAGES = 50;
  const todas = [];
  const idsSeen = new Set();
  let totalPages = null;

  for (let page = 1; page <= (totalPages || MAX_PAGES); page++) {
    const url = `${API_BASE}/materia/materialegislativa/?ano=${ano}&page=${page}&page_size=${PAGE_SIZE}`;
    let response;
    try {
      response = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/120' } });
    } catch (err) {
      console.error(`Erro na pagina ${page}: ${err.message}`);
      break;
    }
    if (!response.ok) {
      console.error(`Erro na API p.${page}: ${response.status}`);
      break;
    }
    const json = await response.json();
    const lista = json.results || [];
    const pagination = json.pagination || {};
    if (pagination.total_pages) totalPages = Math.min(Number(pagination.total_pages), MAX_PAGES);
    if (lista.length === 0) break;

    let novas = 0;
    for (const item of lista) {
      const id = String(item.id);
      if (!idsSeen.has(id)) {
        idsSeen.add(id);
        todas.push(item);
        novas++;
      }
    }
    console.log(`Pagina ${page}/${totalPages || '?'}: ${lista.length} itens (${novas} novos, total: ${todas.length})`);

    // Para apenas quando a propria API diz que nao ha proxima pagina.
    if (pagination.next_page === null || pagination.next_page === undefined && totalPages && page >= totalPages) break;
    if (novas === 0) break;
  }

  console.log(`Total de proposicoes unicas: ${todas.length}`);
  return todas;
}

function extrairTipo(p) {
  // SAPL retorna tipo como ID numérico; o nome real fica no campo __str__
  // Ex: "Requerimento nº 45 de 2026" → "Requerimento"
  if (p.__str__) {
    const match = p.__str__.match(/^(.+?)\s+(nº|n°|Nº|N°|\d)/);
    if (match) return match[1].trim();
    // fallback: tudo antes do primeiro número
    const semNum = p.__str__.replace(/\s*\d.*$/, '').trim();
    if (semNum) return semNum;
  }
  return String(p.tipo || 'OUTROS');
}

function normalizarProposicao(p) {
  const id = String(p.id);
  return {
    id,
    tipo: extrairTipo(p),
    numero: p.numero || '-',
    ano: p.ano || '-',
    autor: '-', // SAPL não retorna autor inline; exigiria chamada extra em /autoria/
    data: p.data_apresentacao || '-',
    ementa: (p.ementa || '-').substring(0, 200),
    link: construirLinkProposicao({ id }),
  };
}

(async () => {
  console.log('🚀 Iniciando monitor ALETO (Tocantins)...');
  console.log(`⏰ ${new Date().toLocaleString('pt-BR')}`);

  const estado = carregarEstado();
  const idsVistos = new Set(estado.proposicoes_vistas.map(String));

  const proposicoesRaw = await buscarProposicoes();

  if (proposicoesRaw.length === 0) {
    console.log('⚠️ Nenhuma proposição encontrada.');
    process.exit(0);
  }

  const proposicoes = proposicoesRaw.map(normalizarProposicao).filter(p => p.id);
  console.log(`📊 Total normalizado: ${proposicoes.length}`);

  const novas = proposicoes.filter(p => !idsVistos.has(p.id));
  console.log(`🆕 Proposições novas: ${novas.length}`);

  if (novas.length > 0) {
    novas.sort((a, b) => {
      if (a.tipo < b.tipo) return -1;
      if (a.tipo > b.tipo) return 1;
      return (parseInt(b.numero) || 0) - (parseInt(a.numero) || 0);
    });
    await enviarEmail(novas);
    novas.forEach(p => idsVistos.add(p.id));
    estado.proposicoes_vistas = Array.from(idsVistos);
  } else {
    console.log('✅ Sem novidades. Nada a enviar.');
  }

  estado.ultima_execucao = new Date().toISOString();
  salvarEstado(estado);
})();
