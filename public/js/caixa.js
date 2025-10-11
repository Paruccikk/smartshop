// caixa.js (atualizado para evitar abrir teclado virtual na SK210)
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

// Inicializa todos os elementos do DOM (única função)
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
      // impedir foco direto e redirecionar ao scanner oculto
      campoBuscaElement.addEventListener('focus', (e) => {
        // não deixar o teclado abrir: redireciona foco para o scanner
        if (scannerInputElement) {
          e.preventDefault();
          try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
        }
      }, { passive: false });

      campoBuscaElement.addEventListener('click', (e) => {
        if (scannerInputElement) {
          e.preventDefault();
          try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
        }
      }, { passive: false });

      campoBuscaElement.addEventListener('touchstart', (e) => {
        if (scannerInputElement) {
          e.preventDefault();
          try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
        }
      }, { passive: false });
    } catch (err) {
      // caso alguma plataforma não permita alterar readOnly/tabIndex, ignorar
      console.warn('Não foi possível aplicar readOnly ao campo visível', err);
    }
  }

  configurarEventListeners();
  inicializarCarrinhoMobile(); // se presente
}

// Event listeners (único lugar)
function configurarEventListeners() {
  // login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const senha = document.getElementById('loginPassword').value;
      if (!email || !senha) { mostrarErro('Preencha todos os campos'); return; }
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, senha);
        console.log('Login ok', userCredential.user.email);
      } catch (err) {
        console.error('erro login', err);
        mostrarErro(getFriendlyError(err.code));
      }
    });
  }

  // logout
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (carrinho.length > 0 && !confirm('Há uma venda em andamento. Tem certeza que deseja sair?')) return;
      try { await signOut(auth); } catch (err) { console.error(err); alert('Erro ao sair.'); }
    });
  }

  // finalizar (desktop)
  if (btnFinalizarVenda) {
    btnFinalizarVenda.addEventListener('click', () => {
      if (carrinho.length === 0) { alert('Adicione produtos ao carrinho antes de finalizar a venda!'); return; }
      abrirModalFinalizacao();
    });
  }

  // confirmar venda no modal
  if (btnConfirmarVenda) btnConfirmarVenda.addEventListener('click', confirmarVenda);

  // voltar do modal
  if (btnVoltar) btnVoltar.addEventListener('click', () => { if (modalFinalizar) modalFinalizar.style.display = 'none'; });

  // cancelar venda (desktop)
  if (btnCancelarVenda) {
    btnCancelarVenda.addEventListener('click', () => {
      if (carrinho.length === 0) { alert('Não há itens no carrinho para cancelar!'); return; }
      if (confirm('Deseja cancelar a venda e limpar o carrinho?')) {
        carrinho = [];
        atualizarCarrinho();
        if (scannerInputElement) {
          try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
        }
        fecharCarrinhoMobile();
      }
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

  // beforeunload
  window.addEventListener('beforeunload', (e) => {
    if (carrinho.length > 0) {
      e.preventDefault();
      e.returnValue = 'Há uma venda em andamento. Tem certeza que deseja sair?';
      return 'Há uma venda em andamento. Tem certeza que deseja sair?';
    }
  });

  // NOTA: removemos listener de keydown no campo visível para evitar que inputs convencionais abram o teclado.
}

// auth state
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
        mostrarErro('Conta pendente de aprovação administrativa');
        mostrarLogin();
      }
    } catch (err) {
      console.error(err);
      await signOut(auth);
      mostrarErro('Erro ao verificar conta. Tente novamente.');
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
  esconderErro();
}

function mostrarCaixa() {
  if (modalLogin) modalLogin.style.display = 'none';
  if (caixaContent) caixaContent.style.display = 'flex';
  if (lojaNome) lojaNome.textContent = usuarioLogado.lojaNome || 'Minha Loja';
  if (userName) userName.textContent = usuarioLogado.nome || usuarioLogado.email;
  carregarProdutos();
}

function mostrarErro(m) { if (errorText) errorText.textContent = m; if (loginError) loginError.style.display = 'flex'; }
function esconderErro() { if (loginError) loginError.style.display = 'none'; }

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

// promocoes
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

// carregar produtos
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
    alert('Erro ao carregar produtos da loja.');
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

// filtrar
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

// carrinho
function adicionarAoCarrinho(produto) {
  const precoFinal = produto.temPromocao ? produto.precoPromocional : produto.valor;
  const itemExistente = carrinho.find(item => item.id === produto.id);
  if (itemExistente) {
    if (itemExistente.quantidade >= produto.quantidade) { alert('Quantidade em estoque insuficiente!'); return; }
    itemExistente.quantidade++;
  } else {
    if (produto.quantidade < 1) { alert('Produto sem estoque!'); return; }
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
  // NÃO focar no campo visível — focar no input scanner escondido para evitar teclado
  if (scannerInputElement) {
    try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
  }
}

function removerDoCarrinho(produtoId) {
  carrinho = carrinho.filter(item => item.id !== produtoId);
  atualizarCarrinho();
}

function alterarQuantidade(produtoId, novaQuantidade) {
  const item = carrinho.find(i => i.id === produtoId);
  const produto = produtos.find(p => p.id === produtoId);
  if (!item || !produto) return;
  if (novaQuantidade < 1) { removerDoCarrinho(produtoId); return; }
  if (novaQuantidade > produto.quantidade) { alert('Quantidade em estoque insuficiente!'); return; }
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

// Modal de finalização
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
  // mantém a seleção em PIX por padrão, sincroniza com select desktop se existir
  const selectDesktop = document.getElementById('formaPagamento');
  if (selectDesktop) formaPagamentoSelecionada = selectDesktop.value || formaPagamentoSelecionada;
  atualizarSelecaoPagamento();
  atualizarInstrucaoPagamento(total);
  modalFinalizar.style.display = 'flex';
}
window.abrirModalFinalizacao = abrirModalFinalizacao; // expor globalmente para evitar ReferenceError

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

// Confirmar venda -> enviar para pinpad (rota /api/pinpad/pagar)
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

      alert('💳 Pagamento aprovado! Venda concluída com sucesso!');
      carrinho = [];
      atualizarCarrinho();
      if (modalFinalizar) modalFinalizar.style.display = 'none';
      await carregarProdutos();
      if (scannerInputElement) {
        try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
      }
    } else {
      alert(`❌ Pagamento não aprovado: ${resultado.mensagem || 'Erro desconhecido'}`);
    }
  } catch (err) {
    console.error('Erro ao processar pagamento:', err);
    alert('Erro ao processar pagamento. Verifique a maquininha.');
  }
}

// ***************** LEITOR (HID) - sem teclado virtual *****************
function ativarLeitorSemTeclado() {
  const scannerInput = scannerInputElement;
  const campoBuscaVisivel = campoBuscaElement;

  if (!scannerInput) {
    console.warn('scannerInput não encontrado. Adicione o input escondido no HTML.');
    return;
  }

  function garantirFoco() {
    try { scannerInput.focus({ preventScroll: true }); }
    catch { try { scannerInput.focus(); } catch (e) { /* nothing */ } }
  }
  garantirFoco();

  // garantir foco periodicamente (ajustável)
  const focoInterval = setInterval(() => {
    if (document.activeElement !== scannerInput) garantirFoco();
  }, 700);

  // limpar intervalo ao descarregar a página
  window.addEventListener('unload', () => clearInterval(focoInterval));

  let buffer = '';
  let ultimoTempo = 0;

  async function processarBuffer(termoRaw) {
    const termo = (termoRaw || '').trim();
    if (!termo) return;
    if (campoBuscaVisivel) {
      try { campoBuscaVisivel.value = termo; } catch (e) { /* ignore */ }
    }
    buscarPorTermoOuAdicionar(termo);
    buffer = '';
    try { scannerInput.value = ''; } catch (e) { /* ignore */ }
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

    try { clearTimeout(scannerInput._timeoutProcess); } catch (err) { /* ignore */ }
    scannerInput._timeoutProcess = setTimeout(() => {
      if (buffer.length > 0) processarBuffer(buffer);
    }, 120);
  }, true);

  // também no input escondido (mais confiável quando ele tem foco)
  try {
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

      try { clearTimeout(scannerInput._timeoutProcess); } catch (err) { /* ignore */ }
      scannerInput._timeoutProcess = setTimeout(() => {
        if (buffer.length > 0) processarBuffer(buffer);
      }, 120);
    });
  } catch (err) {
    console.warn('Não foi possível anexar listener ao scannerInput:', err);
  }
}

// busca por termo e adiciona
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
    else alert('Produto sem estoque!');
  } else {
    console.warn('Produto não encontrado:', termo);
    // opcional: mostrar mensagem UI em vez de alert
  }
}

// ************** Carrinho Mobile (flutuante/modal) *****************
function inicializarCarrinhoMobile() {
  if (!btnAbrirCarrinho || !modalCarrinho) {
    return;
  }

  if (btnAbrirCarrinho) btnAbrirCarrinho.addEventListener('click', abrirCarrinhoMobile);
  if (btnFecharCarrinho) btnFecharCarrinho.addEventListener('click', fecharCarrinhoMobile);

  if (btnFinalizarVendaMobile) {
    btnFinalizarVendaMobile.addEventListener('click', () => {
      if (carrinho.length === 0) { alert('Adicione produtos ao carrinho antes de finalizar a venda!'); return; }
      fecharCarrinhoMobile();
      abrirModalFinalizacao();
    });
  }
  if (btnCancelarVendaMobile) {
    btnCancelarVendaMobile.addEventListener('click', () => {
      if (carrinho.length === 0) { alert('Não há itens no carrinho para cancelar!'); return; }
      if (confirm('Deseja cancelar a venda e limpar o carrinho?')) {
        carrinho = [];
        atualizarCarrinho();
        fecharCarrinhoMobile();
        if (scannerInputElement) {
          try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
        }
      }
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
    if (scannerInputElement) {
      try { scannerInputElement.focus({ preventScroll: true }); } catch { scannerInputElement.focus(); }
    }
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

// Inicialização final quando DOM pronto
document.addEventListener('DOMContentLoaded', () => {
  inicializarElementosDOM();
  // ativar leitor só se scannerInput existir
  if (scannerInputElement) ativarLeitorSemTeclado();
  // expor funções úteis no window (para botoes que usam onclick inline)
  window.alterarQuantidade = alterarQuantidade;
  window.removerDoCarrinho = removerDoCarrinho;
  window.abrirModalFinalizacao = abrirModalFinalizacao;
});

// Fim do arquivo
