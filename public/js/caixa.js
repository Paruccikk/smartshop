// caixa.js (atualizado — substitui alert/confirm por toasts e confirm modal custom)
// usa módulos ESM (type="module" no HTML)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get, push, set, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCF2xMRCG8GhGYdMFncB_hPaUHApM7fpRc",
  authDomain: "iatech-aca5f.firebaseapp.com",
  databaseURL: "https://iatech-aca5f-default-rtdb.firebaseio.com",
  projectId: "iatech-aca5f",
  storageBucket: "iatech-aca5f.appspot.com",
  messagingSenderId: "70231377744",
  appId: "1:70231377744:web:61b45200fe2cad738c8e55"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// estado
let produtos = [];
let carrinho = [];
let lojaId = null;
let usuarioLogado = null;
let formaPagamentoSelecionada = 'pix';

// elementos DOM (inicializados depois)
let modalLogin, caixaContent, loginForm, loginError, errorText;
let lojaNome, userName, btnLogout;
let produtosGrid, carrinhoItems, totalItens, subtotalElement, totalVendaElement;
let modalFinalizar, resumoItens, totalModal, valorPagamentoFinal;
let btnConfirmarVenda, btnVoltar, btnFinalizarVenda, btnCancelarVenda;
let campoBuscaElement, scannerInputElement;

// Carrinho mobile
let modalCarrinho, btnAbrirCarrinho, btnFecharCarrinho, carrinhoModalItems;
let carrinhoBadge, carrinhoTotalMobile, carrinhoModalCount;
let subtotalModal, totalVendaModal;
let btnFinalizarVendaMobile, btnCancelarVendaMobile;

/* ------------------------
   TOAST (notificações)
   ------------------------ */
function ensureToastContainer() {
  let c = document.querySelector('.toast-container');
  if (!c) {
    c = document.createElement('div');
    c.className = 'toast-container';
    c.style.position = 'fixed';
    c.style.right = '20px';
    c.style.bottom = '24px';
    c.style.display = 'flex';
    c.style.flexDirection = 'column';
    c.style.gap = '8px';
    c.style.zIndex = '9999';
    c.style.pointerEvents = 'none'; // container shouldn't block clicks
    document.body.appendChild(c);
  }
  return c;
}

function showToast(message, options = {}) {
  const { type = 'success', duration = 1800 } = options;
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  // basic content
  const iconMap = { success: '✔', warning: '⚠', error: '✖', info: 'ℹ' };
  toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${iconMap[type] || ''}</span><div class="toast-text">${message}</div>`;

  // minimal inline styles so it works out-of-the-box
  toast.style.pointerEvents = 'auto';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '10px';
  toast.style.padding = '10px 14px';
  toast.style.borderRadius = '10px';
  toast.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
  toast.style.background = '#ffffff';
  toast.style.fontWeight = '600';
  toast.style.maxWidth = '420px';
  toast.style.cursor = 'pointer';
  toast.style.transition = 'transform 220ms ease, opacity 220ms ease';
  toast.style.transform = 'translateY(12px)';
  toast.style.opacity = '0';

  // icon style
  const iconEl = toast.querySelector('.toast-icon');
  if (iconEl) {
    iconEl.style.width = '34px';
    iconEl.style.height = '34px';
    iconEl.style.display = 'flex';
    iconEl.style.alignItems = 'center';
    iconEl.style.justifyContent = 'center';
    iconEl.style.borderRadius = '8px';
    iconEl.style.color = '#fff';
    iconEl.style.fontWeight = '700';
    iconEl.style.fontSize = '14px';
    iconEl.style.background = type === 'success' ? '#2a9d8f' : type === 'warning' ? '#f4a261' : type === 'error' ? '#e63946' : '#4361ee';
  }

  container.appendChild(toast);
  // entrance
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });

  // auto remove
  const id = setTimeout(() => {
    toast.style.transform = 'translateY(12px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      try { container.removeChild(toast); } catch (e) {}
    }, 240);
  }, duration);

  // click removes early
  toast.addEventListener('click', () => {
    clearTimeout(id);
    toast.style.transform = 'translateY(12px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      try { container.removeChild(toast); } catch (e) {}
    }, 200);
  });

  return toast;
}

/* ------------------------
   CONFIRM MODAL (custom)
   retorna Promise<boolean>
   ------------------------ */
function showConfirm(message, options = {}) {
  const { title = 'Confirmação', confirmText = 'OK', cancelText = 'Cancelar' } = options;

  return new Promise((resolve) => {
    // criar backdrop/modal
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.style.position = 'fixed';
    backdrop.style.left = 0;
    backdrop.style.top = 0;
    backdrop.style.right = 0;
    backdrop.style.bottom = 0;
    backdrop.style.zIndex = 10000;
    backdrop.style.display = 'flex';
    backdrop.style.alignItems = 'center';
    backdrop.style.justifyContent = 'center';
    backdrop.style.background = 'rgba(0,0,0,0.55)';

    const box = document.createElement('div');
    box.className = 'confirm-box';
    box.style.background = '#fff';
    box.style.padding = '18px';
    box.style.borderRadius = '12px';
    box.style.maxWidth = '420px';
    box.style.width = '92%';
    box.style.boxShadow = '0 20px 60px rgba(0,0,0,0.25)';
    box.style.textAlign = 'center';
    box.style.pointerEvents = 'auto';

    const h = document.createElement('div');
    h.style.fontWeight = '700';
    h.style.marginBottom = '8px';
    h.style.color = '#212529';
    h.textContent = title;

    const p = document.createElement('div');
    p.style.marginBottom = '18px';
    p.style.color = '#495057';
    p.textContent = message;

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'center';
    actions.style.gap = '12px';

    const btnCancel = document.createElement('button');
    btnCancel.textContent = cancelText;
    btnCancel.style.padding = '10px 14px';
    btnCancel.style.borderRadius = '8px';
    btnCancel.style.background = '#f1f3f5';
    btnCancel.style.border = 'none';
    btnCancel.style.cursor = 'pointer';

    const btnOk = document.createElement('button');
    btnOk.textContent = confirmText;
    btnOk.style.padding = '10px 14px';
    btnOk.style.borderRadius = '8px';
    btnOk.style.background = '#2a9d8f';
    btnOk.style.border = 'none';
    btnOk.style.color = 'white';
    btnOk.style.cursor = 'pointer';

    actions.appendChild(btnCancel);
    actions.appendChild(btnOk);
    box.appendChild(h);
    box.appendChild(p);
    box.appendChild(actions);
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    function cleanup(result) {
      try { document.body.removeChild(backdrop); } catch (e) {}
      resolve(result);
    }

    btnCancel.addEventListener('click', () => cleanup(false));
    btnOk.addEventListener('click', () => cleanup(true));

    // teclado: ESC cancela
    function onKey(e) {
      if (e.key === 'Escape') {
        cleanup(false);
        document.removeEventListener('keydown', onKey);
      }
    }
    document.addEventListener('keydown', onKey);
  });
}

/* =========================
   Inicializar elementos DOM
   ========================= */
function inicializarElementosDOM() {
  // modais e áreas principais
  modalLogin = document.getElementById('modalLogin');
  caixaContent = document.getElementById('caixaContent');
  loginForm = document.getElementById('loginForm');
  loginError = document.getElementById('loginError');
  errorText = document.getElementById('errorText');
  lojaNome = document.getElementById('lojaNome');
  userName = document.getElementById('userName');
  btnLogout = document.getElementById('btnLogout');

  // produtos & carrinho (desktop)
  produtosGrid = document.getElementById('produtosGrid');
  carrinhoItems = document.getElementById('carrinhoItems');
  totalItens = document.getElementById('totalItens');
  subtotalElement = document.getElementById('subtotal');
  totalVendaElement = document.getElementById('totalVenda');

  // finalizar venda modal
  modalFinalizar = document.getElementById('modalFinalizar');
  resumoItens = document.getElementById('resumoItens');
  totalModal = document.getElementById('totalModal');
  valorPagamentoFinal = document.getElementById('valorPagamentoFinal');

  btnConfirmarVenda = document.getElementById('btnConfirmarVenda');
  btnVoltar = document.getElementById('btnVoltar');
  btnFinalizarVenda = document.getElementById('btnFinalizarVenda');
  btnCancelarVenda = document.getElementById('btnCancelarVenda');

  // campo busca e scanner escondido
  campoBuscaElement = document.getElementById('campoBusca'); // seu HTML usa campoBusca
  scannerInputElement = document.getElementById('scannerInput');

  // carrinho mobile
  modalCarrinho = document.getElementById('modalCarrinho');
  btnAbrirCarrinho = document.getElementById('btnAbrirCarrinho');
  btnFecharCarrinho = document.getElementById('btnFecharCarrinho');
  carrinhoModalItems = document.getElementById('carrinhoModalItems');
  carrinhoBadge = document.getElementById('carrinhoBadge');
  carrinhoTotalMobile = document.getElementById('carrinhoTotalMobile');
  carrinhoModalCount = document.getElementById('carrinhoModalCount');
  subtotalModal = document.getElementById('subtotalModal');
  totalVendaModal = document.getElementById('totalVendaModal');
  btnFinalizarVendaMobile = document.getElementById('btnFinalizarVendaMobile');
  btnCancelarVendaMobile = document.getElementById('btnCancelarVendaMobile');

  // PROTEÇÕES PARA NÃO ABRIR TECLADO: torna o campo visível readonly + redireciona foco para scanner hidden
  if (campoBuscaElement) {
    try {
      campoBuscaElement.readOnly = true; // evita digitação direta
      campoBuscaElement.tabIndex = -1;   // remove do fluxo de tab
      // prevenir foco direto e redirecionar ao scanner oculto
      campoBuscaElement.addEventListener('focus', (e) => {
        e.preventDefault();
        if (scannerInputElement) {
          try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
        }
      }, { passive: true });

      campoBuscaElement.addEventListener('click', (e) => {
        e.preventDefault();
        if (scannerInputElement) {
          try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
        }
      }, { passive: true });

      campoBuscaElement.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (scannerInputElement) {
          try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
        }
      }, { passive: true });
    } catch (err) {
      console.warn('Não foi possível aplicar readOnly ao campo visível', err);
    }
  }

  configurarEventListeners();
  inicializarCarrinhoMobile(); // se presente
}

/* =========================
   configurar Event Listeners
   ========================= */
function configurarEventListeners() {
  // login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const senha = document.getElementById('loginPassword').value;
      if (!email || !senha) { showToast('Preencha todos os campos', { type: 'warning' }); return; }
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, senha);
        console.log('Login ok', userCredential.user.email);
      } catch (err) {
        console.error('erro login', err);
        showToast(getFriendlyError(err.code), { type: 'error', duration: 3000 });
      }
    });
  }

  // logout -> usa showConfirm
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (carrinho.length > 0) {
        const ok = await showConfirm('Há uma venda em andamento. Tem certeza que deseja sair?', { title: 'Sair' });
        if (!ok) return;
      }
      try { await signOut(auth); showToast('Você saiu do sistema', { type: 'info' }); }
      catch (err) { console.error(err); showToast('Erro ao sair. Tente novamente', { type: 'error' }); }
    });
  }

  // finalizar (desktop)
  if (btnFinalizarVenda) {
    btnFinalizarVenda.addEventListener('click', () => {
      if (carrinho.length === 0) { showToast('Adicione produtos ao carrinho antes de finalizar a venda!', { type: 'warning' }); return; }
      abrirModalFinalizacao();
    });
  }

  // confirmar venda no modal
  if (btnConfirmarVenda) btnConfirmarVenda.addEventListener('click', confirmarVenda);

  // voltar do modal
  if (btnVoltar) btnVoltar.addEventListener('click', () => { if (modalFinalizar) modalFinalizar.style.display = 'none'; });

  // cancelar venda (desktop) -> usa showConfirm
  if (btnCancelarVenda) {
    btnCancelarVenda.addEventListener('click', async () => {
      if (carrinho.length === 0) { showToast('Não há itens no carrinho para cancelar!', { type: 'warning' }); return; }
      const ok = await showConfirm('Deseja cancelar a venda e limpar o carrinho?', { title: 'Cancelar venda', confirmText: 'Sim, cancelar', cancelText: 'Não' });
      if (!ok) return;
      carrinho = [];
      atualizarCarrinho();
      if (scannerInputElement) {
        try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
      }
      fecharCarrinhoMobile();
      showToast('Venda cancelada', { type: 'info' });
    });
  }

  // opções de pagamento (visual)
  document.querySelectorAll('.opcao-pagamento').forEach(opcao => {
    opcao.addEventListener('click', function() {
      formaPagamentoSelecionada = this.getAttribute('data-pagamento');
      atualizarSelecaoPagamento();
      const total = carrinho.reduce((s, it) => s + (it.preco * it.quantidade), 0);
      atualizarInstrucaoPagamento(total);
    });
  });

  // fechar modal clicando fora
  window.addEventListener('click', (e) => {
    if (e.target === modalFinalizar) {
      modalFinalizar.style.display = 'none';
    }
    if (modalCarrinho && e.target === modalCarrinho) {
      fecharCarrinhoMobile();
    }
  });

  // ESC fecha modalFinalizar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalFinalizar && modalFinalizar.style.display === 'flex') {
      modalFinalizar.style.display = 'none';
    }
  });

  // beforeunload: mantém aviso nativo ao tentar fechar/atualizar página
  window.addEventListener('beforeunload', (e) => {
    if (carrinho.length > 0) {
      e.preventDefault();
      e.returnValue = 'Há uma venda em andamento. Tem certeza que deseja sair?';
      return 'Há uma venda em andamento. Tem certeza que deseja sair?';
    }
  });

  // NOTA: removemos listener de keydown no campo visível para evitar que inputs convencionais abram o teclado.
}

/* =========================
   Auth state
   ========================= */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userData = await verificarUsuarioAprovado(user.uid);
      if (userData && userData.aprovado) {
        usuarioLogado = {
          uid: user.uid,
          email: user.email,
          nome: userData.nomeLoja || user.email.split('@')[0],
          lojaId: userData.lojaId,
          lojaNome: userData.nomeLoja
        };
        lojaId = userData.lojaId;
        mostrarCaixa();
      } else {
        await signOut(auth);
        showToast('Conta pendente de aprovação administrativa', { type: 'warning', duration: 3000 });
        mostrarLogin();
      }
    } catch (err) {
      console.error(err);
      await signOut(auth);
      showToast('Erro ao verificar conta. Tente novamente.', { type: 'error', duration: 3000 });
      mostrarLogin();
    }
  } else {
    mostrarLogin();
  }
});

async function verificarUsuarioAprovado(uid) {
  try {
    const userSnapshot = await get(ref(db, `users/${uid}`));
    if (userSnapshot.exists()) return userSnapshot.val();
    return null;
  } catch (err) { console.error(err); throw err; }
}

function mostrarLogin() {
  if (modalLogin) modalLogin.style.display = 'flex';
  if (caixaContent) caixaContent.style.display = 'none';
  const le = document.getElementById('loginEmail');
  if (le) le.focus();
}

function mostrarCaixa() {
  if (modalLogin) modalLogin.style.display = 'none';
  if (caixaContent) caixaContent.style.display = 'flex';
  if (lojaNome) lojaNome.textContent = usuarioLogado.lojaNome || 'Minha Loja';
  if (userName) userName.textContent = usuarioLogado.nome || usuarioLogado.email;
  carregarProdutos();
}

function getFriendlyError(code) {
  const errors = {
    'auth/invalid-email': 'Email inválido',
    'auth/user-disabled': 'Esta conta foi desativada',
    'auth/user-not-found': 'Usuário não encontrado',
    'auth/wrong-password': 'Senha incorreta',
    'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde',
    'auth/network-request-failed': 'Erro de conexão. Verifique sua internet',
    'auth/account-exists-with-different-credential': 'Email já está em uso com outro método de login'
  };
  return errors[code] || 'Erro ao fazer login. Tente novamente.';
}

/* =========================
   Promoções & Produtos
   ========================= */
async function verificarPromocoesAtivas() {
  try {
    const promSnap = await get(ref(db, 'promocoes'));
    if (!promSnap.exists()) return [];
    const prom = promSnap.val();
    const res = [];
    const agora = new Date();
    Object.entries(prom).forEach(([id, p]) => {
      if (p.lojaId === lojaId) {
        const dataExp = new Date(p.dataExpiracao);
        if (dataExp > agora) res.push({ id, produtoId: p.produtoId, precoPromocional: p.precoPromocional, dataExpiracao: p.dataExpiracao });
      }
    });
    return res;
  } catch (err) {
    console.error('Erro prom', err);
    return [];
  }
}

async function carregarProdutos() {
  try {
    const produtosSnap = await get(ref(db, `lojas/${lojaId}/produtos`));
    const prom = await verificarPromocoesAtivas();
    if (!produtosSnap.exists()) {
      if (produtosGrid) {
        produtosGrid.innerHTML = `<div class="produto-card" style="grid-column:1/-1;text-align:center;"><i class="fas fa-box-open" style="font-size:3rem;color:#666;margin-bottom:15px;"></i><p>Nenhum produto cadastrado</p><small>Adicione produtos no estoque primeiro</small></div>`;
      }
      produtos = [];
      return;
    }
    const data = produtosSnap.val();
    produtos = Object.entries(data).map(([id, prod]) => {
      const promocaoAtiva = prom.find(p => p.produtoId === id);
      return {
        id,
        ...prod,
        quantidade: prod.quantidade || 0,
        valor: prod.valor || 0,
        precoPromocional: promocaoAtiva ? promocaoAtiva.precoPromocional : null,
        temPromocao: !!promocaoAtiva
      };
    });
    exibirProdutos(produtos);
  } catch (err) {
    console.error('Erro carregar produtos', err);
    showToast('Erro ao carregar produtos da loja.', { type: 'error' });
  }
}

function exibirProdutos(produtosLista) {
  if (!produtosGrid) return;
  produtosGrid.innerHTML = '';
  if (!produtosLista || produtosLista.length === 0) {
    produtosGrid.innerHTML = `<div class="produto-card" style="grid-column:1/-1;text-align:center;"><i class="fas fa-search" style="font-size:3rem;color:#666;margin-bottom:15px;"></i><p>Nenhum produto encontrado</p></div>`;
    return;
  }
  produtosLista.forEach(produto => {
    const temEstoque = produto.quantidade > 0;
    const temPromocao = produto.temPromocao;
    const precoFinal = temPromocao ? produto.precoPromocional : produto.valor;
    const produtoCard = document.createElement('div');
    produtoCard.className = `produto-card ${!temEstoque ? 'sem-estoque' : ''} ${temPromocao ? 'com-promocao' : ''}`;
    produtoCard.onclick = () => temEstoque && adicionarAoCarrinho(produto);
    produtoCard.innerHTML = `
      <div class="produto-nome">${produto.nome}</div>
      ${produto.codigoBarras ? `<div class="produto-codigo">${produto.codigoBarras}</div>` : ''}
      ${temPromocao ?
        `<div class="produto-promocao-tag"><i class="fas fa-tag"></i> PROMOÇÃO</div>
         <div class="produto-preco-promocional">
           <span class="preco-original">R$ ${produto.valor.toFixed(2)}</span>
           <span class="preco-promocional">R$ ${precoFinal.toFixed(2)}</span>
         </div>`
        : `<div class="produto-preco">R$ ${precoFinal.toFixed(2)}</div>`
      }
      <div class="produto-estoque ${!temEstoque ? 'produto-sem-estoque' : ''}">
        ${temEstoque ? `Estoque: ${produto.quantidade}` : 'SEM ESTOQUE'}
      </div>
    `;
    produtosGrid.appendChild(produtoCard);
  });
}

/* =========================
   Filtrar produtos
   ========================= */
window.filtrarProdutos = function() {
  const termoRaw = (campoBuscaElement ? campoBuscaElement.value : '') || '';
  const termo = termoRaw.toLowerCase().trim();
  if (!termo) { exibirProdutos(produtos); return; }
  const produtosFiltrados = produtos.filter(produto => {
    const nomeOk = produto.nome && produto.nome.toLowerCase().includes(termo);
    const codigoOk = produto.codigoBarras && String(produto.codigoBarras).toLowerCase().includes(termo);
    return nomeOk || codigoOk;
  });
  exibirProdutos(produtosFiltrados);
};

/* =========================
   Carrinho
   ========================= */
function adicionarAoCarrinho(produto) {
  const precoFinal = produto.temPromocao ? produto.precoPromocional : produto.valor;
  const itemExistente = carrinho.find(item => item.id === produto.id);
  if (itemExistente) {
    if (itemExistente.quantidade >= produto.quantidade) {
      showToast('Quantidade em estoque insuficiente!', { type: 'warning' });
      return;
    }
    itemExistente.quantidade++;
  } else {
    if (produto.quantidade < 1) {
      showToast('Produto sem estoque!', { type: 'warning' });
      return;
    }
    carrinho.push({
      id: produto.id,
      nome: produto.nome,
      preco: precoFinal,
      quantidade: 1,
      estoque: produto.quantidade,
      temPromocao: produto.temPromocao,
      precoOriginal: produto.valor
    });
  }
  atualizarCarrinho();

  // foco no scanner escondido para evitar teclado virtual
  if (scannerInputElement) {
    try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
  }

  // toast de confirmação
  showToast(`${produto.nome} adicionado ao carrinho`, { type: 'success', duration: 1400 });
}

function removerDoCarrinho(produtoId) {
  carrinho = carrinho.filter(item => item.id !== produtoId);
  atualizarCarrinho();
  showToast('Item removido do carrinho', { type: 'info', duration: 1200 });
}

function alterarQuantidade(produtoId, novaQuantidade) {
  const item = carrinho.find(i => i.id === produtoId);
  const produto = produtos.find(p => p.id === produtoId);
  if (!item || !produto) return;
  if (novaQuantidade < 1) { removerDoCarrinho(produtoId); return; }
  if (novaQuantidade > produto.quantidade) { showToast('Quantidade em estoque insuficiente!', { type: 'warning' }); return; }
  item.quantidade = novaQuantidade;
  atualizarCarrinho();
}

function atualizarCarrinho() {
  // desktop
  if (!carrinhoItems) return;
  carrinhoItems.innerHTML = '';
  if (carrinho.length === 0) {
    carrinhoItems.innerHTML = `<div class="carrinho-vazio"><i class="fas fa-shopping-cart"></i><p>Carrinho vazio</p></div>`;
    if (btnFinalizarVenda) btnFinalizarVenda.disabled = true;
  } else {
    carrinho.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'carrinho-item';
      itemElement.innerHTML = `
        <div class="item-info">
          <div class="item-nome">${item.nome} ${item.temPromocao ? '<span class="item-promocao"><i class="fas fa-tag"></i> PROMO</span>' : ''}</div>
          <div class="item-detalhes"><span>R$ ${item.preco.toFixed(2)}</span><span>Estoque: ${item.estoque}</span></div>
        </div>
        <div class="item-controles">
          <button class="quantidade-btn" onclick="alterarQuantidade('${item.id}', ${item.quantidade - 1})">-</button>
          <span class="quantidade-value">${item.quantidade}</span>
          <button class="quantidade-btn" onclick="alterarQuantidade('${item.id}', ${item.quantidade + 1})">+</button>
          <span class="item-total">R$ ${(item.preco * item.quantidade).toFixed(2)}</span>
          <button class="remover-item" onclick="removerDoCarrinho('${item.id}')"><i class="fas fa-trash"></i></button>
        </div>
      `;
      carrinhoItems.appendChild(itemElement);
    });
    if (btnFinalizarVenda) btnFinalizarVenda.disabled = false;
  }

  const totalItensCount = carrinho.reduce((s, it) => s + it.quantidade, 0);
  const total = carrinho.reduce((s, it) => s + (it.preco * it.quantidade), 0);

  if (totalItens) totalItens.textContent = `${totalItensCount} ${totalItensCount === 1 ? 'item' : 'itens'}`;
  if (subtotalElement) subtotalElement.textContent = `R$ ${total.toFixed(2)}`;
  if (totalVendaElement) totalVendaElement.textContent = `R$ ${total.toFixed(2)}`;

  // mobile
  atualizarCarrinhoModal();
  atualizarBotaoCarrinhoFlutuante(totalItensCount, total);
}

/* =========================
   Modal de Finalização
   ========================= */
function abrirModalFinalizacao() {
  if (!resumoItens || !totalModal || !modalFinalizar) {
    console.warn('Elementos do modal de finalização não encontrados');
    return;
  }
  resumoItens.innerHTML = '';
  carrinho.forEach(item => {
    const itemElement = document.createElement('div');
    itemElement.className = 'resumo-item';
    itemElement.innerHTML = `<span>${item.nome} ${item.temPromocao ? '<small>(Promoção)</small>' : ''} x ${item.quantidade}</span><span>R$ ${(item.preco * item.quantidade).toFixed(2)}</span>`;
    resumoItens.appendChild(itemElement);
  });
  const total = carrinho.reduce((s, it) => s + (it.preco * it.quantidade), 0);
  totalModal.textContent = `R$ ${total.toFixed(2)}`;
  const selectDesktop = document.getElementById('formaPagamento');
  if (selectDesktop) formaPagamentoSelecionada = selectDesktop.value || formaPagamentoSelecionada;
  atualizarSelecaoPagamento();
  atualizarInstrucaoPagamento(total);
  modalFinalizar.style.display = 'flex';
}
window.abrirModalFinalizacao = abrirModalFinalizacao; // expor globalmente

function atualizarSelecaoPagamento() {
  document.querySelectorAll('.opcao-pagamento').forEach(opcao => opcao.classList.remove('selecionada'));
  const opcaoSelecionada = document.querySelector(`.opcao-pagamento[data-pagamento="${formaPagamentoSelecionada}"]`);
  if (opcaoSelecionada) opcaoSelecionada.classList.add('selecionada');
}

function atualizarInstrucaoPagamento(total) {
  const instrucaoFinal = document.getElementById('instrucaoPagamentoFinal');
  const valorPagamento = document.getElementById('valorPagamentoFinal');
  if (valorPagamento) valorPagamento.textContent = `R$ ${total.toFixed(2)}`;
  if (instrucaoFinal) instrucaoFinal.classList.add('mostrar');
}

/* =========================
   Confirmar Venda (pinpad)
   ========================= */
async function confirmarVenda() {
  const total = carrinho.reduce((s, it) => s + (it.preco * it.quantidade), 0);
  try {
    const response = await fetch('/api/pinpad/pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: total, formaPagamento: formaPagamentoSelecionada })
    });
    const resultado = await response.json();

    if (resultado.status === 'aprovado' || resultado.status === 'aprovado_simulado') {
      const vendaData = {
        data: new Date().toISOString(),
        itens: carrinho,
        total,
        formaPagamento: formaPagamentoSelecionada,
        status: 'concluída',
        vendedor: usuarioLogado?.nome || usuarioLogado?.email,
        vendedorId: usuarioLogado?.uid,
        autorizacao: resultado.autorizacao || null,
        nsu: resultado.nsu || null
      };
      const novaVendaRef = push(ref(db, `lojas/${lojaId}/vendas`));
      await set(novaVendaRef, vendaData);

      // atualizar estoque
      for (const item of carrinho) {
        const produtoRef = ref(db, `lojas/${lojaId}/produtos/${item.id}`);
        const produtoSnap = await get(produtoRef);
        if (produtoSnap.exists()) {
          const produto = produtoSnap.val();
          const novaQuantidade = (produto.quantidade || 0) - item.quantidade;
          await update(produtoRef, { quantidade: Math.max(0, novaQuantidade) });
        }
      }

      showToast('💳 Pagamento aprovado! Venda concluída com sucesso!', { type: 'success', duration: 1800 });
      carrinho = [];
      atualizarCarrinho();
      if (modalFinalizar) modalFinalizar.style.display = 'none';
      await carregarProdutos();
      if (scannerInputElement) {
        try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
      }
    } else {
      showToast(`❌ Pagamento não aprovado: ${resultado.mensagem || 'Erro desconhecido'}`, { type: 'error', duration: 3000 });
    }
  } catch (err) {
    console.error('Erro ao processar pagamento:', err);
    showToast('Erro ao processar pagamento. Verifique a maquininha.', { type: 'error', duration: 3000 });
  }
}

/* =========================
   LEITOR (HID) - sem teclado virtual
   ========================= */
function ativarLeitorSemTeclado() {
  const scannerInput = scannerInputElement;
  const campoBuscaVisivel = campoBuscaElement;

  if (!scannerInput) {
    console.warn('scannerInput não encontrado. Adicione o input escondido no HTML.');
    return;
  }

  function garantirFoco() {
    try { scannerInput.focus({ preventScroll: true }); }
    catch { scannerInput.focus(); }
  }
  garantirFoco();

  // garantir foco periodicamente (ajustável)
  const focoInterval = setInterval(() => {
    if (document.activeElement !== scannerInput) garantirFoco();
  }, 700);

  let buffer = '';
  let ultimoTempo = 0;

  async function processarBuffer(termoRaw) {
    const termo = (termoRaw || '').trim();
    if (!termo) return;
    if (campoBuscaVisivel) campoBuscaVisivel.value = termo; // só UX, campo é readonly
    buscarPorTermoOuAdicionar(termo);
    buffer = '';
    scannerInput.value = '';
    setTimeout(() => garantirFoco(), 100);
  }

  // fallback global - captura antes de outros handlers
  window.addEventListener('keydown', (e) => {
    if (!e || typeof e.key !== 'string') return;
    if (e.key.length > 1 && e.key !== 'Enter') return;
    const agora = Date.now();
    if (ultimoTempo && (agora - ultimoTempo) > 200) buffer = '';
    ultimoTempo = agora;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (buffer.length > 0) processarBuffer(buffer);
      buffer = '';
      return;
    }

    if (e.key.length === 1) buffer += e.key;

    if (scannerInput && typeof scannerInput._timeoutProcess !== 'undefined') clearTimeout(scannerInput._timeoutProcess);
    scannerInput._timeoutProcess = setTimeout(() => {
      if (buffer.length > 0) processarBuffer(buffer);
    }, 120);
  }, true);

  // também no input escondido (mais confiável quando ele tem foco)
  scannerInput.addEventListener('keydown', (e) => {
    if (!e || typeof e.key !== 'string') return;
    const agora = Date.now();
    if (ultimoTempo && (agora - ultimoTempo) > 200) buffer = '';
    ultimoTempo = agora;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (buffer.length > 0) processarBuffer(buffer);
      buffer = '';
      return;
    }

    if (e.key.length === 1) buffer += e.key;

    if (typeof scannerInput._timeoutProcess !== 'undefined') clearTimeout(scannerInput._timeoutProcess);
    scannerInput._timeoutProcess = setTimeout(() => {
      if (buffer.length > 0) processarBuffer(buffer);
    }, 120);
  });
}

/* =========================
   buscarPorTermoOuAdicionar
   ========================= */
function buscarPorTermoOuAdicionar(termo) {
  if (!termo) return;
  const termoLower = termo.toString().toLowerCase();

  // busca exata por codigo
  let produtoEncontrado = produtos.find(p => p.codigoBarras && String(p.codigoBarras).toLowerCase() === termoLower);

  // busca parcial por nome
  if (!produtoEncontrado) {
    produtoEncontrado = produtos.find(p => p.nome && p.nome.toLowerCase().includes(termoLower));
  }

  if (produtoEncontrado) {
    if (produtoEncontrado.quantidade > 0) adicionarAoCarrinho(produtoEncontrado);
    else showToast('Produto sem estoque!', { type: 'warning' });
  } else {
    console.warn('Produto não encontrado:', termo);
    showToast(`Produto não encontrado: ${termo}`, { type: 'warning', duration: 2000 });
  }
}

/* =========================
   Carrinho Mobile (flutuante/modal)
   ========================= */
function inicializarCarrinhoMobile() {
  if (!btnAbrirCarrinho || !modalCarrinho) {
    return;
  }

  if (btnAbrirCarrinho) btnAbrirCarrinho.addEventListener('click', abrirCarrinhoMobile);
  if (btnFecharCarrinho) btnFecharCarrinho.addEventListener('click', fecharCarrinhoMobile);

  if (btnFinalizarVendaMobile) {
    btnFinalizarVendaMobile.addEventListener('click', () => {
      if (carrinho.length === 0) { showToast('Adicione produtos ao carrinho antes de finalizar a venda!', { type: 'warning' }); return; }
      fecharCarrinhoMobile();
      abrirModalFinalizacao();
    });
  }
  if (btnCancelarVendaMobile) {
    btnCancelarVendaMobile.addEventListener('click', async () => {
      if (carrinho.length === 0) { showToast('Não há itens no carrinho para cancelar!', { type: 'warning' }); return; }
      const ok = await showConfirm('Deseja cancelar a venda e limpar o carrinho?', { title: 'Cancelar venda', confirmText: 'Sim, cancelar', cancelText: 'Não' });
      if (!ok) return;
      carrinho = [];
      atualizarCarrinho();
      fecharCarrinhoMobile();
      if (scannerInputElement) {
        try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
      }
      showToast('Venda cancelada', { type: 'info' });
    });
  }

  if (modalCarrinho) {
    modalCarrinho.addEventListener('click', (e) => {
      if (e.target === modalCarrinho) fecharCarrinhoMobile();
    });
  }
}

function abrirCarrinhoMobile() {
  if (modalCarrinho) {
    modalCarrinho.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    atualizarCarrinhoModal();
  }
}

function fecharCarrinhoMobile() {
  if (modalCarrinho) {
    modalCarrinho.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function atualizarCarrinhoModal() {
  if (!carrinhoModalItems) return;
  carrinhoModalItems.innerHTML = '';
  if (carrinho.length === 0) {
    carrinhoModalItems.innerHTML = `<div class="carrinho-vazio"><i class="fas fa-shopping-cart"></i><p>Carrinho vazio</p></div>`;
  } else {
    carrinho.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'carrinho-modal-item';
      itemElement.innerHTML = `
        <div class="carrinho-modal-item-info">
          <div class="carrinho-modal-item-nome">${item.nome} ${item.temPromocao ? '<span class="item-promocao"><i class="fas fa-tag"></i> PROMO</span>' : ''}</div>
          <div class="carrinho-modal-item-detalhes"><span>R$ ${item.preco.toFixed(2)}</span><span>Estoque: ${item.estoque}</span></div>
        </div>
        <div class="carrinho-modal-item-controles">
          <button class="carrinho-modal-quantidade-btn" onclick="alterarQuantidade('${item.id}', ${item.quantidade - 1})">-</button>
          <span class="carrinho-modal-quantidade-value">${item.quantidade}</span>
          <button class="carrinho-modal-quantidade-btn" onclick="alterarQuantidade('${item.id}', ${item.quantidade + 1})">+</button>
          <span class="carrinho-modal-item-total">R$ ${(item.preco * item.quantidade).toFixed(2)}</span>
          <button class="carrinho-modal-remover-item" onclick="removerDoCarrinho('${item.id}')"><i class="fas fa-trash"></i></button>
        </div>
      `;
      carrinhoModalItems.appendChild(itemElement);
    });
  }

  const totalItensCount = carrinho.reduce((s, it) => s + it.quantidade, 0);
  const total = carrinho.reduce((s, it) => s + (it.preco * it.quantidade), 0);

  if (carrinhoModalCount) carrinhoModalCount.textContent = `(${totalItensCount} ${totalItensCount === 1 ? 'item' : 'itens'})`;
  if (subtotalModal) subtotalModal.textContent = `R$ ${total.toFixed(2)}`;
  if (totalVendaModal) totalVendaModal.textContent = `R$ ${total.toFixed(2)}`;

  atualizarBotaoCarrinhoFlutuante(totalItensCount, total);
}

function atualizarBotaoCarrinhoFlutuante(totalItens, total) {
  if (carrinhoBadge) {
    carrinhoBadge.textContent = totalItens;
    carrinhoBadge.style.display = totalItens > 0 ? 'flex' : 'none';
  }
  if (carrinhoTotalMobile) carrinhoTotalMobile.textContent = `R$ ${total.toFixed(2)}`;
}

/* =============================
   AUTO-REFRESH POR INATIVIDADE
   ============================= */

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos
const CHECK_INTERVAL_MS = 60 * 1000; // checar a cada 1 minuto
let _lastActivity = Date.now();
let _inactivityChecker = null;

// registra atividade do usuário para resetar o timer
function _resetInactivityTimer() {
  _lastActivity = Date.now();
}

// eventos que consideramos "atividade"
const _activityEvents = ['mousemove','mousedown','touchstart','keydown','wheel','scroll','click','focus'];

// adiciona listeners (passive para touch/scroll)
_activityEvents.forEach(ev => {
  document.addEventListener(ev, _resetInactivityTimer, { passive: true });
});

// função que diz se está aberto algum modal que não devemos interromper
function _isModalOpenOrUserBusy() {
  const modalOpen =
    (typeof modalLogin !== 'undefined' && modalLogin && modalLogin.style.display === 'flex') ||
    (typeof modalFinalizar !== 'undefined' && modalFinalizar && modalFinalizar.style.display === 'flex') ||
    (typeof modalCarrinho !== 'undefined' && modalCarrinho && modalCarrinho.style.display === 'flex');

  const vendaEmAndamento = (typeof carrinho !== 'undefined' && Array.isArray(carrinho) && carrinho.length > 0);

  return modalOpen || vendaEmAndamento;
}

// tenta um "soft refresh" (recarregar somente os produtos/promos)
// caso carregarProdutos não exista ou lance erro, faz reload completo
async function _attemptSoftRefreshThenReloadIfNeeded() {
  try {
    if (typeof carregarProdutos === 'function') {
      await carregarProdutos(); // atualiza produtos/promos
      // se após 5s ainda estiver inativo, faz reload completo (garante que mudanças de configuração também apareçam)
      setTimeout(() => {
        if ((Date.now() - _lastActivity) >= 5000 && !_isModalOpenOrUserBusy()) {
          console.log('Inatividade detectada: recarregando página (após soft refresh).');
          location.reload();
        } else {
          // usuário voltou ou está ocupado — adia reload
          _lastActivity = Date.now();
        }
      }, 5000);
    } else {
      // fallback: reload direto
      location.reload();
    }
  } catch (err) {
    console.warn('Soft refresh falhou — recarregando página:', err);
    location.reload();
  }
}

// inicia o watcher de inatividade
function startInactivityWatcher() {
  if (_inactivityChecker) clearInterval(_inactivityChecker);
  _inactivityChecker = setInterval(() => {
    const idle = Date.now() - _lastActivity;

    if (idle >= INACTIVITY_TIMEOUT) {
      // só recarrega se ninguém estiver com venda e sem modais abertos
      if (_isModalOpenOrUserBusy()) {
        // adia: considera que o usuário pode estar em uma operação crítica
        console.log('Inatividade detectada, mas usuário está ocupado — adiando reload.');
        _lastActivity = Date.now(); // adia o reload
        return;
      }

      console.log('Inatividade detectada -> tentando atualizar automaticamente.');
      // tentar primeiro atualizar produtos/promo (soft), depois recarregar se necessário
      _attemptSoftRefreshThenReloadIfNeeded();
      // e atualiza lastActivity pra não entrar em loop imediato
      _lastActivity = Date.now();
    }
  }, CHECK_INTERVAL_MS);
}

// expor controles (opcional) para debug manual
window.__startInactivityWatcher = startInactivityWatcher;
window.__resetInactivityTimer = _resetInactivityTimer;

// iniciar automaticamente (caso já estejamos com DOM pronto)

/* =========================
   Inicialização final
   ========================= */
document.addEventListener('DOMContentLoaded', () => {
  inicializarElementosDOM();
  // ativar leitor só se scannerInput existir
  if (scannerInputElement) ativarLeitorSemTeclado();
  // expor funções úteis no window (para botoes que usam onclick inline)
  window.alterarQuantidade = alterarQuantidade;
  window.removerDoCarrinho = removerDoCarrinho;
  window.abrirModalFinalizacao = abrirModalFinalizacao;
  // reinicia contador ao carregar a página
  _lastActivity = Date.now();
  startInactivityWatcher();
});

