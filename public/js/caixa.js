// caixa.js - principal (atualizado: modais internos + persistência fullscreen + correção totais)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get, push, set, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import * as produtosModule from "./produtos.js";
import * as carrinhoModule from "./carrinho.js";
import { confirmarVenda as pagamentoConfirmarVenda } from "./pagamento.js";

// Config Firebase (mesmos dados do arquivo original)
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

// estado principal
let lojaId = null;
let usuarioLogado = null;
let formaPagamentoSelecionada = 'pix';

// elementos DOM (serão inicializados)
let modalLogin, caixaContent, loginForm, loginError, errorText;
let lojaNome, userName, btnLogout;
let totalItens, subtotalElement, totalVendaElement, totalVendaDesktop;
let modalFinalizar, resumoItens, totalModal, valorPagamentoFinal;
let btnConfirmarVenda, btnVoltar, btnFinalizarVenda, btnCancelarVenda;
let campoBuscaElement, scannerInputElement;
let modalCarrinho, btnAbrirCarrinho, btnFecharCarrinho, carrinhoModalItems, carrinhoBadge, carrinhoTotalMobile, carrinhoModalCount, subtotalModal, totalVendaModal, btnFinalizarVendaMobile, btnCancelarVendaMobile;

// ------------- MODAL INTERNO (tema do sistema, não sai da fullscreen) -------------
function _getCustomModalEls() {
  return {
    modal: document.getElementById('customModal'),
    messageEl: document.getElementById('customModalMessage'),
    btnConfirm: document.getElementById('customModalConfirm'),
    btnCancel: document.getElementById('customModalCancel')
  };
}

// mostra confirmação (true / false)
export async function mostrarConfirmacao(mensagem) {
  const { modal, messageEl, btnConfirm, btnCancel } = _getCustomModalEls();
  if (!modal || !messageEl || !btnConfirm || !btnCancel) {
    return new Promise(resolve => resolve(confirm(mensagem)));
  }

  return new Promise(resolve => {
    messageEl.textContent = mensagem;
    btnConfirm.textContent = 'Confirmar';
    btnCancel.style.display = 'inline-block';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    function cleanup() {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      btnConfirm.removeEventListener('click', onConfirm);
      btnCancel.removeEventListener('click', onCancel);
    }

    btnConfirm.addEventListener('click', onConfirm);
    btnCancel.addEventListener('click', onCancel);
  });
}

// mostra alerta simples (apenas OK)
export async function mostrarAlerta(mensagem) {
  const { modal, messageEl, btnConfirm, btnCancel } = _getCustomModalEls();
  if (!modal || !messageEl || !btnConfirm) {
    return new Promise(resolve => { alert(mensagem); resolve(); });
  }

  return new Promise(resolve => {
    messageEl.textContent = mensagem;
    btnConfirm.textContent = 'OK';
    btnCancel.style.display = 'none';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const onOk = () => {
      cleanup();
      resolve();
    };
    function cleanup() {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      btnConfirm.removeEventListener('click', onOk);
      btnConfirm.textContent = 'Confirmar';
      btnCancel.style.display = 'inline-block';
    }

    btnConfirm.addEventListener('click', onOk);
  });
}

// Compat layer: exportar nomes antigos usados por outros módulos
export { mostrarConfirmacao as confirmDialog, mostrarAlerta as alertDialog };

// ------------- fullscreen persistence -------------
let _fullscreenRetryInterval = null;
let _fullscreenRetryCount = 0;
const FULLSCREEN_RETRY_MAX = 6;
const FULLSCREEN_RETRY_MS = 5000;

function tryEnterFullscreen() {
  try {
    if (typeof fullscreenHelper !== 'undefined' && fullscreenHelper && typeof fullscreenHelper.enterFullscreen === 'function') {
      fullscreenHelper.enterFullscreen();
      return;
    }
  } catch (e) { /* ignora */ }

  const el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => { });
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
  } else if (el.msRequestFullscreen) {
    el.msRequestFullscreen();
  }
}

function startFullscreenWatcher() {
  stopFullscreenWatcher();
  _fullscreenRetryCount = 0;
  _fullscreenRetryInterval = setInterval(() => {
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    if (!isFullscreen) {
      if (_fullscreenRetryCount < FULLSCREEN_RETRY_MAX) {
        tryEnterFullscreen();
        _fullscreenRetryCount++;
        console.warn('Tentando reentrar em fullscreen (tentativa', _fullscreenRetryCount, ')');
      }
    } else {
      _fullscreenRetryCount = 0;
    }
  }, FULLSCREEN_RETRY_MS);
}

function stopFullscreenWatcher() {
  if (_fullscreenRetryInterval) {
    clearInterval(_fullscreenRetryInterval);
    _fullscreenRetryInterval = null;
  }
}

document.addEventListener('fullscreenchange', () => {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  if (!isFs) {
    tryEnterFullscreen();
  }
});

startFullscreenWatcher();

// ------------- restante do caixa.js (inicialização + listeners) -------------

// Inicializa todos os elementos do DOM (única função)
function inicializarElementosDOM() {
  modalLogin = document.getElementById('modalLogin');
  caixaContent = document.getElementById('caixaContent');
  loginForm = document.getElementById('loginForm');
  loginError = document.getElementById('loginError');
  errorText = document.getElementById('errorText');
  lojaNome = document.getElementById('lojaNome');
  userName = document.getElementById('userName');
  btnLogout = document.getElementById('btnLogout');

  // produtos & carrinho (desktop)
  produtosModule.setProdutosGrid(document.getElementById('produtosGrid'));
  carrinhoModule.setCarrinhoElements({
    carrinhoItemsEl: document.getElementById('carrinhoItems'),
    btnFinalizarVendaEl: document.getElementById('btnFinalizarVenda'),
    totalItensEl: document.getElementById('totalItens'),
    subtotalEl: document.getElementById('subtotal'),
    totalVendaEl: document.getElementById('totalVendaDesktop')
  });

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
  campoBuscaElement = document.getElementById('campoBusca');
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

  // aplica proteções para campo visível (não abrir teclado)
  if (campoBuscaElement) {
    try {
      campoBuscaElement.readOnly = true;
      campoBuscaElement.tabIndex = -1;
      campoBuscaElement.addEventListener('focus', (e) => {
        e.preventDefault();
        if (scannerInputElement) scannerInputElement.focus();
      }, { passive: true });
      campoBuscaElement.addEventListener('click', (e) => {
        e.preventDefault();
        if (scannerInputElement) scannerInputElement.focus();
      }, { passive: true });
      campoBuscaElement.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (scannerInputElement) scannerInputElement.focus();
      }, { passive: true });
    } catch (err) {
      console.warn('Não foi possível aplicar readOnly ao campo visível', err);
    }
  }

  configurarEventListeners();
  inicializarCarrinhoMobile();
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
        await signInWithEmailAndPassword(auth, email, senha);
      } catch (err) {
        console.error('erro login', err);
        mostrarErro(getFriendlyError(err.code));
      }
    });
  }

  // logout
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      const carrinhoAtual = carrinhoModule.getCarrinho();
      if (carrinhoAtual.length > 0) {
        const sair = await mostrarConfirmacao('Há uma venda em andamento. Tem certeza que deseja sair?');
        if (!sair) return;
      }
      try { await signOut(auth); } catch (err) { console.error(err); await mostrarAlerta('Erro ao sair.'); }
    });
  }

  // finalizar (desktop)
  if (btnFinalizarVenda) {
    btnFinalizarVenda.addEventListener('click', () => {
      const carrinhoAtual = carrinhoModule.getCarrinho();
      if (carrinhoAtual.length === 0) { toast('Adicione produtos ao carrinho antes de finalizar a venda!'); return; }
      abrirModalFinalizacao();
    });
  }

  if (btnConfirmarVenda) btnConfirmarVenda.addEventListener('click', async () => {
    const carrinhoAtual = carrinhoModule.getCarrinho();
    const total = carrinhoAtual.reduce((s, it) => s + (it.preco * it.quantidade), 0);
    await pagamentoConfirmarVenda({
      carrinho: carrinhoAtual,
      total,
      formaPagamento: formaPagamentoSelecionada,
      usuarioLogado,
      lojaId,
      db,
      carregarProdutos: produtosModule.carregarProdutos,
      toast,
      atualizarCarrinhoFn: () => { carrinhoModule.limparCarrinho(); carrinhoModule.atualizarCarrinho(); }
    });
    if (modalFinalizar) modalFinalizar.style.display = 'none';
  });

  // voltar do modal
  if (btnVoltar) btnVoltar.addEventListener('click', () => { if (modalFinalizar) modalFinalizar.style.display = 'none'; });

  // cancelar venda (desktop)
  if (btnCancelarVenda) {
    btnCancelarVenda.addEventListener('click', async () => {
      const carrinhoAtual = carrinhoModule.getCarrinho();
      if (carrinhoAtual.length === 0) { toast('Não há itens no carrinho para cancelar!'); return; }
      const yes = await mostrarConfirmacao('Deseja cancelar a venda e limpar o carrinho?');
      if (!yes) return;
      carrinhoModule.limparCarrinho();
      carrinhoModule.atualizarCarrinho();
      if (scannerInputElement) scannerInputElement.focus();
      if (carrinhoModule && typeof carrinhoModule.fecharCarrinhoMobile === 'function') {
        carrinhoModule.fecharCarrinhoMobile();
      }
    });
  }

  // opções de pagamento (visual)
  document.querySelectorAll('.opcao-pagamento').forEach(opcao => {
    opcao.addEventListener('click', function() {
      formaPagamentoSelecionada = this.getAttribute('data-pagamento');
      document.querySelectorAll('.opcao-pagamento').forEach(o => o.classList.remove('selecionada'));
      this.classList.add('selecionada');
      const total = carrinhoModule.getCarrinho().reduce((s, it) => s + (it.preco * it.quantidade), 0);
      atualizarInstrucaoPagamento(total);
    });
  });

  // fechar modal clicando fora
  window.addEventListener('click', (e) => {
    if (e.target === modalFinalizar) modalFinalizar.style.display = 'none';
    if (modalCarrinho && e.target === modalCarrinho) {
      if (carrinhoModule && typeof carrinhoModule.fecharCarrinhoMobile === 'function') {
        carrinhoModule.fecharCarrinhoMobile();
      }
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
    if (carrinhoModule.getCarrinho().length > 0) {
      e.preventDefault();
      e.returnValue = 'Há uma venda em andamento. Tem certeza que deseja sair?';
      return 'Há uma venda em andamento. Tem certeza que deseja sair?';
    }
  });
}

// auth state
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userDataSnap = await get(ref(db, `users/${user.uid}`));
      const userData = userDataSnap.exists() ? userDataSnap.val() : null;
      if (userData && userData.aprovado) {
        usuarioLogado = {
          uid: user.uid,
          email: user.email,
          nome: userData.nomeLoja || user.email.split('@')[0],
          lojaId: userData.lojaId,
          lojaNome: userData.nomeLoja
        };
        lojaId = userData.lojaId;

        // inicializa módulos que precisam de db/lojaId
        produtosModule.init({ db, getLojaId: () => lojaId });
        produtosModule.setProdutoClickCallback((produto) => {
          carrinhoModule.adicionarAoCarrinho(produto);
        });

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
    produtosModule.removerRealtimeListeners();
    mostrarLogin();
  }
});

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

  produtosModule.carregarProdutos().then(() => {
    produtosModule.configurarRealtimeUpdates();
    produtosModule.mostrarCategorias();
  });
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

// Função para atualizar todos os totais do sistema
function atualizarTodosOsTotais() {
  const carrinhoAtual = carrinhoModule.getCarrinho();
  const total = carrinhoAtual.reduce((s, it) => s + (it.preco * it.quantidade), 0);
  const totalItensCount = carrinhoAtual.reduce((s, it) => s + it.quantidade, 0);

  // Atualizar header
  if (totalItens) totalItens.textContent = `${totalItensCount} ${totalItensCount === 1 ? 'item' : 'itens'}`;
  if (totalVendaElement) totalVendaElement.textContent = `R$ ${total.toFixed(2)}`;

  // Atualizar carrinho sidebar
  if (subtotalElement) subtotalElement.textContent = `R$ ${total.toFixed(2)}`;
  if (totalVendaDesktop) totalVendaDesktop.textContent = `R$ ${total.toFixed(2)}`;
  
  // Atualizar botão mobile
  if (carrinhoTotalMobile) carrinhoTotalMobile.textContent = `R$ ${total.toFixed(2)}`;
  if (carrinhoBadge) {
    carrinhoBadge.textContent = totalItensCount;
    carrinhoBadge.style.display = totalItensCount > 0 ? 'flex' : 'none';
  }

  // Se o modal de finalização estiver aberto, atualizar também
  if (modalFinalizar && modalFinalizar.style.display === 'flex') {
    if (totalModal) totalModal.textContent = `R$ ${total.toFixed(2)}`;
    if (valorPagamentoFinal) {
      valorPagamentoFinal.textContent = `R$ ${total.toFixed(2)}`;
    }
    atualizarInstrucaoPagamento(total);
  }
}

// Modal de finalização (abre e popula resumo)
function abrirModalFinalizacao() {
  if (!resumoItens || !totalModal || !modalFinalizar) {
    console.warn('Elementos do modal de finalização não encontrados');
    return;
  }
  resumoItens.innerHTML = '';
  const carrinhoAtual = carrinhoModule.getCarrinho();
  carrinhoAtual.forEach(item => {
    const itemElement = document.createElement('div');
    itemElement.className = 'resumo-item';
    itemElement.innerHTML = `<span>${item.nome} ${item.temPromocao ? '<small>(Promoção)</small>' : ''} x ${item.quantidade}</span><span>R$ ${(item.preco * item.quantidade).toFixed(2)}</span>`;
    resumoItens.appendChild(itemElement);
  });
  const total = carrinhoAtual.reduce((s, it) => s + (it.preco * it.quantidade), 0);
  
  // ATUALIZADO: Garantir que todos os totais sejam atualizados
  if (totalModal) totalModal.textContent = `R$ ${total.toFixed(2)}`;
  if (valorPagamentoFinal) valorPagamentoFinal.textContent = `R$ ${total.toFixed(2)}`;
  
  // sincroniza com select desktop (se existir)
  const selectDesktop = document.getElementById('formaPagamento');
  if (selectDesktop) formaPagamentoSelecionada = selectDesktop.value || formaPagamentoSelecionada;
  atualizarInstrucaoPagamento(total);
  modalFinalizar.style.display = 'flex';
}
window.abrirModalFinalizacao = abrirModalFinalizacao;

function atualizarInstrucaoPagamento(total) {
  const instrucaoFinal = document.getElementById('instrucaoPagamentoFinal');
  const valorPagamento = document.getElementById('valorPagamentoFinal');
  if (valorPagamento) valorPagamento.textContent = `R$ ${total.toFixed(2)}`;
  if (instrucaoFinal) instrucaoFinal.classList.add('mostrar');
}

// LEITOR (HID) - sem teclado virtual
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

  const focoInterval = setInterval(() => {
    if (document.activeElement !== scannerInput) garantirFoco();
  }, 700);

  let buffer = '';
  let ultimoTempo = 0;

  async function processarBuffer(termoRaw) {
    const termo = (termoRaw || '').trim();
    if (!termo) return;
    if (campoBuscaVisivel) campoBuscaVisivel.value = termo;
    const produtoEncontrado = produtosModule.encontrarProdutoPorTermo(termo);
    if (produtoEncontrado) {
      if (produtoEncontrado.quantidade > 0) carrinhoModule.adicionarAoCarrinho(produtoEncontrado);
      else await mostrarAlerta('Produto sem estoque!');
    } else {
      console.warn('Produto não encontrado:', termo);
      await mostrarAlerta('Produto não encontrado');
    }
    buffer = '';
    scannerInput.value = '';
    setTimeout(() => garantirFoco(), 100);
  }

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

// Carrinho mobile (inicialização + abrir/fechar) usando funções do módulo carrinho
function inicializarCarrinhoMobile() {
  if (!btnAbrirCarrinho || !modalCarrinho) return;

  if (btnAbrirCarrinho) btnAbrirCarrinho.addEventListener('click', () => carrinhoModule.abrirCarrinhoMobile());
  if (btnFecharCarrinho) btnFecharCarrinho.addEventListener('click', () => carrinhoModule.fecharCarrinhoMobile());

  carrinhoModule.setMobileElements({
    modalCarrinhoEl: modalCarrinho,
    carrinhoModalItemsEl: carrinhoModalItems,
    carrinhoBadgeEl: carrinhoBadge,
    carrinhoTotalMobileEl: carrinhoTotalMobile,
    carrinhoModalCountEl: carrinhoModalCount,
    subtotalModalEl: subtotalModal,
    totalVendaModalEl: totalVendaModal,
    btnFinalizarVendaMobileEl: btnFinalizarVendaMobile,
    btnCancelarVendaMobileEl: btnCancelarVendaMobile,
    abrirModalFinalizacaoFn: abrirModalFinalizacao
  });

  // registrar funções globais usadas por botões inline
  window.alterarQuantidade = carrinhoModule.alterarQuantidade;
  window.removerDoCarrinho = carrinhoModule.removerDoCarrinho;
}

// Helpers UI (toast)
function toast(msg, timeout = 2500) {
  let t = document.createElement('div');
  t.className = 'caixa-toast';
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    background: 'rgba(0,0,0,0.8)',
    color: 'white',
    padding: '10px 14px',
    borderRadius: '8px',
    zIndex: 9999,
    boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
    fontSize: '14px'
  });
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
  }, timeout - 300);
  setTimeout(() => { try { t.remove(); } catch (e) {} }, timeout);
}

// Expondo utilitários para módulos que precisam
export { toast, atualizarTodosOsTotais };

// Inicialização final quando DOM pronto
document.addEventListener('DOMContentLoaded', () => {
  inicializarElementosDOM();
  tryEnterFullscreen();
  startFullscreenWatcher();

  if (scannerInputElement) ativarLeitorSemTeclado();
  window.filtrarProdutos = produtosModule.filtrarProdutos;
});