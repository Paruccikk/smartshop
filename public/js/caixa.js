import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get, push, set, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Sua configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCF2xMRCG8GhGYdMFncB_hPaUHApM7fpRc",
  authDomain: "iatech-aca5f.firebaseapp.com",
  databaseURL: "https://iatech-aca5f-default-rtdb.firebaseio.com",
  projectId: "iatech-aca5f",
  storageBucket: "iatech-aca5f.appspot.com",
  messagingSenderId: "70231377744",
  appId: "1:70231377744:web:61b45200fe2cad738c8e55"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let produtos = [];
let carrinho = [];
let lojaId = null;
let usuarioLogado = null;
let formaPagamentoSelecionada = 'pix'; // Padrão: PIX

// Elementos DOM - serão inicializados quando disponíveis
let modalLogin, caixaContent, loginForm, loginError, errorText;
let lojaNome, userName, btnLogout;
let produtosGrid, carrinhoItems, totalItens, subtotalElement, totalVendaElement;
let modalFinalizar, resumoItens, totalModal, valorPagamentoFinal;
let btnConfirmarVenda, btnVoltar, btnFinalizarVenda, btnCancelarVenda;

// Inicializar elementos DOM quando disponíveis
function inicializarElementosDOM() {
  modalLogin = document.getElementById('modalLogin');
  caixaContent = document.getElementById('caixaContent');
  loginForm = document.getElementById('loginForm');
  loginError = document.getElementById('loginError');
  errorText = document.getElementById('errorText');
  lojaNome = document.getElementById('lojaNome');
  userName = document.getElementById('userName');
  btnLogout = document.getElementById('btnLogout');

  produtosGrid = document.getElementById('produtosGrid');
  carrinhoItems = document.getElementById('carrinhoItems');
  totalItens = document.getElementById('totalItens');
  subtotalElement = document.getElementById('subtotal');
  totalVendaElement = document.getElementById('totalVenda');
  
  modalFinalizar = document.getElementById('modalFinalizar');
  resumoItens = document.getElementById('resumoItens');
  totalModal = document.getElementById('totalModal');
  valorPagamentoFinal = document.getElementById('valorPagamentoFinal');
  
  btnConfirmarVenda = document.getElementById('btnConfirmarVenda');
  btnVoltar = document.getElementById('btnVoltar');
  btnFinalizarVenda = document.getElementById('btnFinalizarVenda');
  btnCancelarVenda = document.getElementById('btnCancelarVenda');

  // Configurar event listeners apenas se os elementos existirem
  configurarEventListeners();
}


// Configurar todos os event listeners
function configurarEventListeners() {
  // Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('loginEmail').value.trim();
      const senha = document.getElementById('loginPassword').value;
      
      if (!email || !senha) {
        mostrarErro('Preencha todos os campos');
        return;
      }
      
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;
        console.log('Login realizado com sucesso:', user.email);
      } catch (error) {
        console.error('Erro no login:', error);
        mostrarErro(getFriendlyError(error.code));
      }
    });
  }

  // Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (carrinho.length > 0 && !confirm('Há uma venda em andamento. Tem certeza que deseja sair?')) {
        return;
      }
      
      try {
        await signOut(auth);
      } catch (error) {
        console.error('Erro ao fazer logout:', error);
        alert('Erro ao sair. Tente novamente.');
      }
    });
  }

  // Finalizar venda
  if (btnFinalizarVenda) {
    btnFinalizarVenda.addEventListener('click', () => {
      if (carrinho.length === 0) {
        alert('Adicione produtos ao carrinho antes de finalizar a venda!');
        return;
      }
      abrirModalFinalizacao();
    });
  }

  // Confirmar venda
  if (btnConfirmarVenda) {
    btnConfirmarVenda.addEventListener('click', confirmarVenda);
  }

  // Voltar do modal
  if (btnVoltar) {
    btnVoltar.addEventListener('click', () => {
      modalFinalizar.style.display = 'none';
    });
  }

  // Cancelar venda
  if (btnCancelarVenda) {
    btnCancelarVenda.addEventListener('click', () => {
      if (carrinho.length === 0) {
        alert('Não há itens no carrinho para cancelar!');
        return;
      }

      if (confirm('Deseja cancelar a venda e limpar o carrinho?')) {
        carrinho = [];
        atualizarCarrinho();
        document.getElementById('searchProduto').focus();
      }
    });
  }

  // Opções de pagamento
  document.querySelectorAll('.opcao-pagamento').forEach(opcao => {
    opcao.addEventListener('click', function() {
      formaPagamentoSelecionada = this.getAttribute('data-pagamento');
      atualizarSelecaoPagamento();
      
      const total = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
      atualizarInstrucaoPagamento(total);
    });
  });

  // Fechar modal clicando fora
  window.onclick = (e) => {
    if (e.target === modalFinalizar) {
      modalFinalizar.style.display = 'none';
    }
  };

  // Tecla ESC fecha o modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalFinalizar.style.display === 'flex') {
      modalFinalizar.style.display = 'none';
    }
  });

  // Prevenir saída da página
  window.addEventListener('beforeunload', (e) => {
    if (carrinho.length > 0) {
      e.preventDefault();
      e.returnValue = 'Há uma venda em andamento. Tem certeza que deseja sair?';
      return 'Há uma venda em andamento. Tem certeza que deseja sair?';
    }
  });
}

// Verificar estado de autenticação
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log('Usuário autenticado:', user.uid);
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
        console.log('Loja ID:', lojaId);
        mostrarCaixa();
      } else {
        await signOut(auth);
        mostrarErro('Conta pendente de aprovação administrativa');
        mostrarLogin();
      }
    } catch (error) {
      console.error('Erro ao verificar usuário:', error);
      await signOut(auth);
      mostrarErro('Erro ao verificar conta. Tente novamente.');
      mostrarLogin();
    }
  } else {
    console.log('Usuário não autenticado');
    mostrarLogin();
  }
});

// Verificar se usuário está aprovado no Realtime Database
async function verificarUsuarioAprovado(uid) {
  try {
    console.log('Buscando usuário:', uid);
    const userSnapshot = await get(ref(db, `users/${uid}`));
    
    if (userSnapshot.exists()) {
      const userData = userSnapshot.val();
      console.log('Dados do usuário:', userData);
      return userData;
    } else {
      console.log('Usuário não encontrado no database');
      return null;
    }
  } catch (error) {
    console.error('Erro ao verificar usuário:', error);
    throw error;
  }
}

// Mostrar tela de login
function mostrarLogin() {
  if (modalLogin) modalLogin.style.display = 'flex';
  if (caixaContent) caixaContent.style.display = 'none';
  document.getElementById('loginEmail').focus();
  esconderErro();
}

// Mostrar caixa após login
function mostrarCaixa() {
  if (modalLogin) modalLogin.style.display = 'none';
  if (caixaContent) caixaContent.style.display = 'flex';
  
  if (lojaNome) lojaNome.textContent = usuarioLogado.lojaNome || 'Minha Loja';
  if (userName) userName.textContent = usuarioLogado.nome || usuarioLogado.email;
  
  console.log('Carregando produtos para loja:', lojaId);
  carregarProdutos();
}

// Funções de erro
function mostrarErro(mensagem) {
  if (errorText) errorText.textContent = mensagem;
  if (loginError) loginError.style.display = 'flex';
}

function esconderErro() {
  if (loginError) loginError.style.display = 'none';
}

// Mapear códigos de erro para mensagens amigáveis
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

// Função para verificar promoções ativas
async function verificarPromocoesAtivas() {
  try {
    const promocoesSnap = await get(ref(db, 'promocoes'));
    
    if (!promocoesSnap.exists()) {
      return [];
    }

    const promocoes = promocoesSnap.val();
    const promocoesAtivas = [];
    const agora = new Date();

    Object.entries(promocoes).forEach(([id, promocao]) => {
      // Verificar se a promoção é para esta loja e está ativa
      if (promocao.lojaId === lojaId) {
        const dataExpiracao = new Date(promocao.dataExpiracao);
        
        if (dataExpiracao > agora) {
          promocoesAtivas.push({
            id: id,
            produtoId: promocao.produtoId,
            precoPromocional: promocao.precoPromocional,
            dataExpiracao: promocao.dataExpiracao
          });
        }
      }
    });

    return promocoesAtivas;
  } catch (error) {
    console.error('Erro ao carregar promoções:', error);
    return [];
  }
}

// Carregar produtos da loja com promoções
async function carregarProdutos() {
  try {
    console.log('Tentando carregar produtos da loja:', lojaId);
    const produtosSnap = await get(ref(db, `lojas/${lojaId}/produtos`));
    const promocoesAtivas = await verificarPromocoesAtivas();
    
    if (!produtosSnap.exists()) {
      console.log('Nenhum produto encontrado para a loja:', lojaId);
      if (produtosGrid) {
        produtosGrid.innerHTML = `
          <div class="produto-card" style="grid-column: 1 / -1; text-align: center;">
            <i class="fas fa-box-open" style="font-size: 3rem; color: #666; margin-bottom: 15px;"></i>
            <p>Nenhum produto cadastrado</p>
            <small>Adicione produtos no estoque primeiro</small>
          </div>
        `;
      }
      return;
    }

    const data = produtosSnap.val();
    console.log('Produtos encontrados:', data);
    
    produtos = Object.entries(data).map(([id, prod]) => {
      // Verificar se há promoção ativa para este produto
      const promocaoAtiva = promocoesAtivas.find(p => p.produtoId === id);
      
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
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    alert('Erro ao carregar produtos da loja.');
  }
}

// Exibir produtos na grade com promoções
function exibirProdutos(produtosLista) {
  if (!produtosGrid) return;
  
  produtosGrid.innerHTML = '';

  if (produtosLista.length === 0) {
    produtosGrid.innerHTML = `
      <div class="produto-card" style="grid-column: 1 / -1; text-align: center;">
        <i class="fas fa-search" style="font-size: 3rem; color: #666; margin-bottom: 15px;"></i>
        <p>Nenhum produto encontrado</p>
      </div>
    `;
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
      ${temPromocao ? `
        <div class="produto-promocao-tag">
          <i class="fas fa-tag"></i> PROMOÇÃO
        </div>
        <div class="produto-preco-promocional">
          <span class="preco-original">R$ ${produto.valor.toFixed(2)}</span>
          <span class="preco-promocional">R$ ${precoFinal.toFixed(2)}</span>
        </div>
      ` : `
        <div class="produto-preco">R$ ${precoFinal.toFixed(2)}</div>
      `}
      <div class="produto-estoque ${!temEstoque ? 'produto-sem-estoque' : ''}">
        ${temEstoque ? `Estoque: ${produto.quantidade}` : 'SEM ESTOQUE'}
      </div>
    `;

    produtosGrid.appendChild(produtoCard);
  });
}

// Filtrar produtos
window.filtrarProdutos = function() {
  const termo = document.getElementById('searchProduto').value.toLowerCase().trim();
  
  if (!termo) {
    exibirProdutos(produtos);
    return;
  }

  const produtosFiltrados = produtos.filter(produto =>
    produto.nome.toLowerCase().includes(termo) ||
    (produto.codigoBarras && produto.codigoBarras.toLowerCase().includes(termo))
  );

  exibirProdutos(produtosFiltrados);
}

// Carrinho functions
function adicionarAoCarrinho(produto) {
  const precoFinal = produto.temPromocao ? produto.precoPromocional : produto.valor;
  const itemExistente = carrinho.find(item => item.id === produto.id);

  if (itemExistente) {
    if (itemExistente.quantidade >= produto.quantidade) {
      alert('Quantidade em estoque insuficiente!');
      return;
    }
    itemExistente.quantidade++;
  } else {
    if (produto.quantidade < 1) {
      alert('Produto sem estoque!');
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
  document.getElementById('searchProduto').focus();
}

function removerDoCarrinho(produtoId) {
  carrinho = carrinho.filter(item => item.id !== produtoId);
  atualizarCarrinho();
}

function alterarQuantidade(produtoId, novaQuantidade) {
  const item = carrinho.find(item => item.id === produtoId);
  const produto = produtos.find(p => p.id === produtoId);

  if (!item || !produto) return;

  if (novaQuantidade < 1) {
    removerDoCarrinho(produtoId);
    return;
  }

  if (novaQuantidade > produto.quantidade) {
    alert('Quantidade em estoque insuficiente!');
    return;
  }

  item.quantidade = novaQuantidade;
  atualizarCarrinho();
}

function atualizarCarrinho() {
  if (!carrinhoItems) return;
  
  carrinhoItems.innerHTML = '';

  if (carrinho.length === 0) {
    carrinhoItems.innerHTML = `
      <div class="carrinho-vazio">
        <i class="fas fa-shopping-cart"></i>
        <p>Carrinho vazio</p>
      </div>
    `;
    if (btnFinalizarVenda) btnFinalizarVenda.disabled = true;
  } else {
    carrinho.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'carrinho-item';
      itemElement.innerHTML = `
        <div class="item-info">
          <div class="item-nome">
            ${item.nome}
            ${item.temPromocao ? '<span class="item-promocao"><i class="fas fa-tag"></i> PROMO</span>' : ''}
          </div>
          <div class="item-detalhes">
            <span>R$ ${item.preco.toFixed(2)}</span>
            <span>Estoque: ${item.estoque}</span>
          </div>
        </div>
        <div class="item-controles">
          <button class="quantidade-btn" onclick="alterarQuantidade('${item.id}', ${item.quantidade - 1})">-</button>
          <span class="quantidade-value">${item.quantidade}</span>
          <button class="quantidade-btn" onclick="alterarQuantidade('${item.id}', ${item.quantidade + 1})">+</button>
          <span class="item-total">R$ ${(item.preco * item.quantidade).toFixed(2)}</span>
          <button class="remover-item" onclick="removerDoCarrinho('${item.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      carrinhoItems.appendChild(itemElement);
    });
    if (btnFinalizarVenda) btnFinalizarVenda.disabled = false;
  }

  const totalItensCount = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
  const total = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);

  if (totalItens) totalItens.textContent = `${totalItensCount} ${totalItensCount === 1 ? 'item' : 'itens'}`;
  if (subtotalElement) subtotalElement.textContent = `R$ ${total.toFixed(2)}`;
  if (totalVendaElement) totalVendaElement.textContent = `R$ ${total.toFixed(2)}`;
}

// Modal de finalização
function abrirModalFinalizacao() {
  if (!resumoItens || !totalModal || !modalFinalizar) return;
  
  resumoItens.innerHTML = '';
  carrinho.forEach(item => {
    const itemElement = document.createElement('div');
    itemElement.className = 'resumo-item';
    itemElement.innerHTML = `
      <span>${item.nome} ${item.temPromocao ? '<small>(Promoção)</small>' : ''} x ${item.quantidade}</span>
      <span>R$ ${(item.preco * item.quantidade).toFixed(2)}</span>
    `;
    resumoItens.appendChild(itemElement);
  });

  const total = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
  totalModal.textContent = `R$ ${total.toFixed(2)}`;

  formaPagamentoSelecionada = 'pix';
  atualizarSelecaoPagamento();
  atualizarInstrucaoPagamento(total);

  modalFinalizar.style.display = 'flex';
}

// Controle das opções de pagamento
function atualizarSelecaoPagamento() {
  document.querySelectorAll('.opcao-pagamento').forEach(opcao => {
    opcao.classList.remove('selecionada');
  });
  
  const opcaoSelecionada = document.querySelector(`.opcao-pagamento[data-pagamento="${formaPagamentoSelecionada}"]`);
  if (opcaoSelecionada) {
    opcaoSelecionada.classList.add('selecionada');
  }
}

function atualizarInstrucaoPagamento(total) {
  const instrucaoFinal = document.getElementById('instrucaoPagamentoFinal');
  const valorPagamento = document.getElementById('valorPagamentoFinal');
  
  if (valorPagamento) valorPagamento.textContent = `R$ ${total.toFixed(2)}`;
  if (instrucaoFinal) instrucaoFinal.classList.add('mostrar');
}

// Confirmar venda
async function confirmarVenda() {
  const total = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);

  try {
    // 1️⃣ Envia o valor para o terminal de pagamento
    const response = await fetch('/api/pinpad/pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valor: total,
        formaPagamento: formaPagamentoSelecionada
      })
    });

    const resultado = await response.json();

    // 2️⃣ Verifica retorno do terminal
    if (resultado.status === 'aprovado') {
      // Pagamento aprovado — registrar venda
      const vendaData = {
        data: new Date().toISOString(),
        itens: carrinho,
        total,
        formaPagamento: formaPagamentoSelecionada,
        status: 'concluída',
        vendedor: usuarioLogado.nome || usuarioLogado.email,
        vendedorId: usuarioLogado.uid
      };

      const novaVendaRef = push(ref(db, `lojas/${lojaId}/vendas`));
      await set(novaVendaRef, vendaData);

      // Atualizar estoque
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
      modalFinalizar.style.display = 'none';
      await carregarProdutos();
      document.getElementById('searchProduto').focus();
    } 
    else {
      alert(`❌ Pagamento não aprovado: ${resultado.mensagem || 'Erro desconhecido'}`);
    }

  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    alert('Erro ao processar pagamento. Verifique a maquininha.');
  }
}


// ------- CAPTURA DO LEITOR (HID) SEM MOSTRAR TECLADO VIRTUAL -------
// Deve ser carregado/ativado após inicializar elementos DOM (inicializarElementosDOM)

function ativarLeitorSemTeclado() {
  const scannerInput = document.getElementById('scannerInput');
  const campoBuscaVisivel = document.getElementById('campoBusca');

  if (!scannerInput) {
    console.warn('scannerInput não encontrado. Adicione o input escondido no HTML.');
    return;
  }

  // Tenta focar no input escondido — inputmode="none" evita keyboard na maioria dos casos
  function garantirFoco() {
    try {
      scannerInput.focus({ preventScroll: true });
    } catch (err) {
      // fallback
      scannerInput.focus();
    }
  }

  garantirFoco();
  // refoca periodicamente caso o foco seja perdido
  const focoInterval = setInterval(() => {
    if (document.activeElement !== scannerInput) garantirFoco();
  }, 700); // ajustável

  // Buffer para juntar caracteres do scanner
  let buffer = '';
  let ultimoTempo = 0;
  const MAX_IDLE = 40; // ms entre caracteres; scanners enviam caracteres muito rápidos (10-30ms)
  
  // Função para processar o conteúdo lido
  async function processarBuffer(termoRaw) {
    const termo = termoRaw.trim();
    if (!termo) return;
    // opcional: exibir no campo visível (só para UX)
    if (campoBuscaVisivel) campoBuscaVisivel.value = termo;

    // Aqui chamamos sua lógica: buscar por código ou por nome e adicionar ao carrinho
    buscarPorTermoOuAdicionar(termo);

    // limpa buffer e garante foco novamente
    buffer = '';
    scannerInput.value = '';
    setTimeout(() => garantirFoco(), 100);
  }

  // Captura global de teclas (fallback caso input escondido não receba)
  window.addEventListener('keydown', (e) => {
    // ignora teclas modificadoras
    if (e.key.length > 1 && e.key !== 'Enter') return;

    const agora = Date.now();

    // se passou muito tempo desde o último caractere, reinicia buffer
    if (ultimoTempo && (agora - ultimoTempo) > 200) {
      buffer = '';
    }

    ultimoTempo = agora;

    if (e.key === 'Enter') {
      e.preventDefault();
      // processa o que estiver no buffer
      if (buffer.length > 0) processarBuffer(buffer);
      buffer = '';
      return;
    }

    // anexa caractere
    buffer += e.key;
    // se não usar Enter (alguns leitores não enviam Enter), podemos usar timeout para processar
    // aqui um timeout que processa 120ms após último caractere
    clearTimeout(scannerInput._timeoutProcess);
    scannerInput._timeoutProcess = setTimeout(() => {
      if (buffer.length > 0) processarBuffer(buffer);
    }, 120);
  }, true); // use capture para pegar antes de outros handlers

  // E também no próprio input escondido (mais confiável quando ele recebe focus)
  scannerInput.addEventListener('keydown', (e) => {
    const agora = Date.now();
    if (ultimoTempo && (agora - ultimoTempo) > 200) buffer = '';
    ultimoTempo = agora;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (buffer.length > 0) processarBuffer(buffer);
      buffer = '';
      return;
    }

    // ignora teclas não-printáveis
    if (e.key.length === 1) buffer += e.key;

    clearTimeout(scannerInput._timeoutProcess);
    scannerInput._timeoutProcess = setTimeout(() => {
      if (buffer.length > 0) processarBuffer(buffer);
    }, 120);
  });
}

// Função utilitária: busca produto por código/nome e adiciona ao carrinho se encontrado
function buscarPorTermoOuAdicionar(termo) {
  const termoLower = termo.toLowerCase();

  // tenta achar por código exato (muito comum)
  let produtoEncontrado = produtos.find(p => p.codigoBarras && p.codigoBarras.toLowerCase() === termoLower);

  // se não achou por código, tenta por nome (partial)
  if (!produtoEncontrado) {
    produtoEncontrado = produtos.find(p => p.nome && p.nome.toLowerCase().includes(termoLower));
  }

  if (produtoEncontrado) {
    if (produtoEncontrado.quantidade > 0) {
      adicionarAoCarrinho(produtoEncontrado);
    } else {
      alert('Produto sem estoque!');
    }
  } else {
    // opcional: mostrar mensagem visual em vez de alert
    console.warn('Produto não encontrado:', termo);
    //alert(`Produto não encontrado: ${termo}`);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  inicializarElementosDOM();
  ativarLeitorSemTeclado();
});


// Exportar funções para o escopo global
window.alterarQuantidade = alterarQuantidade;
window.removerDoCarrinho = removerDoCarrinho;