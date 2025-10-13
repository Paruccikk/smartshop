import { auth, signInWithEmailAndPassword, signOut, getFriendlyError, mostrarErro, esconderErro, toast, confirmDialog, setCarrinho } from './caixa.js';
import { inicializarElementosProdutos } from './produtos.js';
import { inicializarElementosCarrinho, inicializarCarrinhoMobile, confirmarVenda, abrirModalFinalizacao, fecharCarrinhoMobile, atualizarCarrinho } from './carrinho.js';
import { carrinho, formaPagamentoSelecionada } from './caixa.js';

// elementos DOM
let modalLogin, caixaContent, loginForm, loginError, errorText;
let lojaNome, userName, btnLogout;
let campoBuscaElement, scannerInputElement;

export function inicializarElementosDOM() {
  // modais e áreas principais
  modalLogin = document.getElementById('modalLogin');
  caixaContent = document.getElementById('caixaContent');
  loginForm = document.getElementById('loginForm');
  loginError = document.getElementById('loginError');
  errorText = document.getElementById('errorText');
  lojaNome = document.getElementById('lojaNome');
  userName = document.getElementById('userName');
  btnLogout = document.getElementById('btnLogout');

  // campo busca e scanner escondido
  campoBuscaElement = document.getElementById('campoBusca');
  scannerInputElement = document.getElementById('scannerInput');

  // Inicializar elementos dos outros módulos
  inicializarElementosProdutos();
  inicializarElementosCarrinho();

  // PROTEÇÕES PARA NÃO ABRIR TECLADO
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

// Event listeners
export function configurarEventListeners() {
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
      if (carrinho.length > 0 && !confirmDialog('Há uma venda em andamento. Tem certeza que deseja sair?')) return;
      try {
        await signOut(auth);
      } catch (err) { console.error(err); toast('Erro ao sair.'); }
    });
  }

  // finalizar (desktop)
  const btnFinalizarVenda = document.getElementById('btnFinalizarVenda');
  if (btnFinalizarVenda) {
    btnFinalizarVenda.addEventListener('click', () => {
      if (carrinho.length === 0) { toast('Adicione produtos ao carrinho antes de finalizar a venda!'); return; }
      abrirModalFinalizacao();
    });
  }

  // confirmar venda no modal
  const btnConfirmarVenda = document.getElementById('btnConfirmarVenda');
  if (btnConfirmarVenda) btnConfirmarVenda.addEventListener('click', confirmarVenda);

  // voltar do modal
  const btnVoltar = document.getElementById('btnVoltar');
  if (btnVoltar) btnVoltar.addEventListener('click', () => { 
    const modalFinalizar = document.getElementById('modalFinalizar');
    if (modalFinalizar) modalFinalizar.style.display = 'none'; 
  });

  // cancelar venda (desktop)
  const btnCancelarVenda = document.getElementById('btnCancelarVenda');
  if (btnCancelarVenda) {
    btnCancelarVenda.addEventListener('click', () => {
      if (carrinho.length === 0) { toast('Não há itens no carrinho para cancelar!'); return; }
      confirmDialog('Deseja cancelar a venda e limpar o carrinho?').then(yes => {
        if (!yes) return;
        setCarrinho([]);
        atualizarCarrinho();
        const scannerInputElement = document.getElementById('scannerInput');
        if (scannerInputElement) scannerInputElement.focus();
        fecharCarrinhoMobile();
      });
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
    const modalFinalizar = document.getElementById('modalFinalizar');
    const modalCarrinho = document.getElementById('modalCarrinho');
    
    if (e.target === modalFinalizar) {
      modalFinalizar.style.display = 'none';
    }
    if (modalCarrinho && e.target === modalCarrinho) {
      fecharCarrinhoMobile();
    }
  });

  // ESC fecha modalFinalizar
  document.addEventListener('keydown', (e) => {
    const modalFinalizar = document.getElementById('modalFinalizar');
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
}

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