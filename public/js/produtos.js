// produtos.js - view por categorias + produtos por categoria + realtime
import { ref, get, onValue, off } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let db = null;
let getLojaId = () => null;
let produtos = [];
let produtosGridEl = null;
let produtoClickCallback = null;

// listeners unsub
let produtosListenerUnsub = null;
let promocoesListenerUnsub = null;

/* ------------------ INIT ------------------ */
export function init({ db: _db, getLojaId: _getLojaId }) {
  db = _db;
  getLojaId = _getLojaId;
}

export function setProdutosGrid(el) { produtosGridEl = el; }
export function setProdutoClickCallback(cb) { produtoClickCallback = cb; }

/* ------------------ CATEGORIAS ------------------ */
export async function carregarCategoriasDoDB() {
  try {
    const lojaId = getLojaId();
    if (!lojaId) return [];
    const snap = await get(ref(db, `lojas/${lojaId}/categorias`));
    if (!snap.exists()) return [];
    const catsObj = snap.val();
    const arr = Object.values(catsObj).map(c => c.name).filter(Boolean);
    arr.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
    return arr;
  } catch (err) {
    console.warn('Erro ao carregar categorias do DB', err);
    return [];
  }
}

export function derivarCategoriasDeProdutos() {
  const setCats = new Set((produtos || []).map(p => p.categoria || 'Sem categoria'));
  return Array.from(setCats).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

/* ------------------ RENDER: CATEGORIAS ------------------ */
function criarCartaoCategoria(nome) {
  const card = document.createElement('div');
  card.className = 'categoria-card';
  card.tabIndex = 0;
  card.role = 'button';
  card.innerHTML = `
    <div class="categoria-nome">${nome}</div>
    <div class="categoria-badge">${contarProdutosNaCategoria(nome)}</div>
  `;
  card.addEventListener('click', () => mostrarProdutosDaCategoria(nome));
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter') mostrarProdutosDaCategoria(nome); });
  return card;
}

function contarProdutosNaCategoria(nome) {
  return (produtos || []).filter(p => (p.categoria || 'Sem categoria') === nome).length;
}

export async function mostrarCategorias() {
  if (!produtosGridEl) produtosGridEl = document.getElementById('produtosGrid');
  if (!produtosGridEl) return;

  produtosGridEl.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'categorias-header';
  header.innerHTML = `<h2>Categorias</h2><small>Selecione uma categoria</small>`;
  produtosGridEl.appendChild(header);

  let categorias = await carregarCategoriasDoDB();
  if (!categorias || categorias.length === 0) categorias = derivarCategoriasDeProdutos();

  if (!categorias || categorias.length === 0) {
    const vazio = document.createElement('div');
    vazio.className = 'produto-card sem-categoria';
    vazio.innerHTML = `<div style="grid-column:1/-1;text-align:center;"><i class="fas fa-box-open" style="font-size:2rem;color:#666;margin-bottom:10px;"></i><p>Nenhuma categoria encontrada</p><small>Adicione categorias no estoque</small></div>`;
    produtosGridEl.appendChild(vazio);
    return;
  }

  const container = document.createElement('div');
  container.className = 'categorias-grid';
  categorias.forEach(cat => container.appendChild(criarCartaoCategoria(cat)));
  produtosGridEl.appendChild(container);
}

/* ------------------ RENDER: PRODUTOS ------------------ */
export function mostrarProdutosDaCategoria(categoriaNome) {
  if (!produtosGridEl) produtosGridEl = document.getElementById('produtosGrid');
  if (!produtosGridEl) return;

  produtosGridEl.innerHTML = '';

  const topo = document.createElement('div');
  topo.className = 'produtos-topo';
  topo.innerHTML = `
    <button class="btn-voltar-categorias" aria-label="Voltar para categorias">← Voltar</button>
    <div class="titulo-categoria"><strong>${categoriaNome}</strong></div>
  `;
  topo.querySelector('.btn-voltar-categorias').addEventListener('click', mostrarCategorias);
  produtosGridEl.appendChild(topo);

  const filtrados = (produtos || []).filter(p => (p.categoria || 'Sem categoria') === categoriaNome);

  if (!filtrados || filtrados.length === 0) {
    const aviso = document.createElement('div');
    aviso.className = 'produto-card';
    aviso.style.gridColumn = '1/-1';
    aviso.innerHTML = `<div style="text-align:center;"><i class="fas fa-search" style="font-size:2rem;color:#666;margin-bottom:10px;"></i><p>Nenhum produto nesta categoria</p></div>`;
    produtosGridEl.appendChild(aviso);
    return;
  }

  filtrados.forEach(produto => renderProdutoCard(produto));
}

function renderProdutoCard(produto) {
  const temEstoque = produto.quantidade > 0;
  const temPromocao = produto.temPromocao;
  const precoFinal = temPromocao ? produto.precoPromocional : produto.valor;
  const produtoCard = document.createElement('div');
  produtoCard.className = `produto-card ${!temEstoque ? 'sem-estoque' : ''} ${temPromocao ? 'com-promocao' : ''}`;
  produtoCard.onclick = () => { if (temEstoque) produtoClickCallback?.(produto); };
  produtoCard.innerHTML = `
    <div class="produto-nome">${produto.nome}</div>
    ${produto.codigoBarras ? `<div class="produto-codigo">${produto.codigoBarras}</div>` : ''}
    ${temPromocao ?
      `<div class="produto-promocao-tag"><i class="fas fa-tag"></i> PROMOÇÃO</div>
       <div class="produto-preco-promocional">
         <span class="preco-original">R$ ${produto.valor.toFixed(2)}</span>
         <span class="preco-promocional">R$ ${precoFinal.toFixed(2)}</span>
       </div>` :
      `<div class="produto-preco">R$ ${precoFinal.toFixed(2)}</div>`
    }
    <div class="produto-estoque ${!temEstoque ? 'produto-sem-estoque' : ''}">
      ${temEstoque ? `Estoque: ${produto.quantidade}` : 'SEM ESTOQUE'}
    </div>
  `;
  produtosGridEl.appendChild(produtoCard);
}

/* ------------------ PRODUTOS: CARREGAR / ATUALIZAR ------------------ */
export async function verificarPromocoesAtivas() {
  try {
    const promSnap = await get(ref(db, 'promocoes'));
    if (!promSnap.exists()) return [];
    const prom = promSnap.val();
    const res = [];
    const agora = new Date();
    const lojaId = getLojaId();
    Object.entries(prom).forEach(([id, p]) => {
      if (p.lojaId === lojaId && new Date(p.dataExpiracao) > agora) {
        res.push({ id, produtoId: p.produtoId, precoPromocional: p.precoPromocional, dataExpiracao: p.dataExpiracao });
      }
    });
    return res;
  } catch (err) {
    console.error('Erro ao verificar promoções', err);
    return [];
  }
}

export async function carregarProdutos() {
  try {
    const loja = getLojaId();
    if (!loja) return;
    const produtosSnap = await get(ref(db, `lojas/${loja}/produtos`));
    const prom = await verificarPromocoesAtivas();
    if (!produtosSnap.exists()) {
      produtos = [];
      if (produtosGridEl) produtosGridEl.innerHTML = `<div class="produto-card" style="grid-column:1/-1;text-align:center;"><i class="fas fa-box-open" style="font-size:3rem;color:#666;margin-bottom:15px;"></i><p>Nenhum produto cadastrado</p><small>Adicione produtos no estoque primeiro</small></div>`;
      return;
    }
    atualizarProdutosLocais(produtosSnap.val(), prom);
  } catch (err) {
    console.error('Erro ao carregar produtos', err);
  }
}

export function atualizarProdutosLocais(produtosObj, promocoesAtivas = []) {
  produtos = produtosObj ? Object.entries(produtosObj).map(([id, prod]) => {
    const promocaoAtiva = promocoesAtivas.find(p => p.produtoId === id);
    return {
      id,
      ...prod,
      quantidade: prod.quantidade || 0,
      valor: prod.valor || 0,
      precoPromocional: promocaoAtiva ? promocaoAtiva.precoPromocional : null,
      temPromocao: !!promocaoAtiva
    };
  }) : [];
}

/* ------------------ FILTRAGEM / BUSCA ------------------ */
export function exibirProdutos(produtosLista) {
  if (!produtosGridEl) produtosGridEl = document.getElementById('produtosGrid');
  if (!produtosGridEl) return;
  produtosGridEl.innerHTML = '';
  if (!produtosLista || produtosLista.length === 0) {
    produtosGridEl.innerHTML = `<div class="produto-card" style="grid-column:1/-1;text-align:center;"><i class="fas fa-search" style="font-size:3rem;color:#666;margin-bottom:15px;"></i><p>Nenhum produto encontrado</p></div>`;
    return;
  }
  produtosLista.forEach(renderProdutoCard);
}

export function filtrarProdutos() {
  const campoBuscaElement = document.getElementById('campoBusca');
  const termo = (campoBuscaElement?.value || '').toLowerCase().trim();
  if (!termo) { exibirProdutos(produtos); return; }
  const produtosFiltrados = produtos.filter(p => (p.nome?.toLowerCase().includes(termo)) || (p.codigoBarras && String(p.codigoBarras).toLowerCase().includes(termo)));
  exibirProdutos(produtosFiltrados);
}

export function encontrarProdutoPorTermo(termo) {
  if (!termo) return null;
  const termoLower = termo.toString().toLowerCase();
  return produtos.find(p => p.codigoBarras && String(p.codigoBarras).toLowerCase() === termoLower) ||
         produtos.find(p => p.nome && p.nome.toLowerCase().includes(termoLower)) || null;
}

/* ------------------ REALTIME ------------------ */
export function configurarRealtimeUpdates() {
  removerRealtimeListeners();
  const loja = getLojaId();
  if (!loja) return;
  const produtosRef = ref(db, `lojas/${loja}/produtos`);
  const promRef = ref(db, `promocoes`);

  produtosListenerUnsub = onValue(produtosRef, async snapshot => {
    atualizarProdutosLocais(snapshot.exists() ? snapshot.val() : null, await verificarPromocoesAtivas());
  });

  promocoesListenerUnsub = onValue(promRef, async snapshot => {
    const promAct = await verificarPromocoesAtivas();
    const produtosObj = produtos.reduce((acc, p) => { acc[p.id] = { ...p }; return acc; }, {});
    atualizarProdutosLocais(produtosObj, promAct);
  });
}

export function removerRealtimeListeners() {
  try {
    if (typeof produtosListenerUnsub === 'function') { produtosListenerUnsub(); produtosListenerUnsub = null; }
    if (typeof promocoesListenerUnsub === 'function') { promocoesListenerUnsub(); promocoesListenerUnsub = null; }
  } catch {
    try {
      const loja = getLojaId();
      if (loja) off(ref(db, `lojas/${loja}/produtos`));
      off(ref(db, 'promocoes'));
    } catch {}
  }
}

/* ------------------ UTILITÁRIOS ------------------ */
export function getProdutos() { return produtos; }
export function getProdutoById(id) { return produtos.find(p => p.id === id) || null; }
