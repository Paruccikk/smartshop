import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get, set, remove, onValue, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

let usuarioLogado = null;
let produtos = [];
let promocoes = [];
let lojaId = null;

// Elementos DOM
const userInfo = document.getElementById('userInfo');
const produtoSelect = document.getElementById('produtoSelect');
const formPromocao = document.getElementById('formPromocao');
const promocoesList = document.getElementById('promocoesList');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const modalSenha = document.getElementById('modalSenha');
const formSenha = document.getElementById('formSenha');
const conteudoPrincipal = document.getElementById('conteudoPrincipal');
const senhaError = document.getElementById('senhaError');
const senhaErrorText = document.getElementById('senhaErrorText');

// Verificar autenticação
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userData = await verificarUsuario(user.uid);
      if (userData && userData.aprovado) {
        usuarioLogado = {
          uid: user.uid,
          email: user.email,
          nome: userData.nomeLoja || user.email.split('@')[0],
          lojaId: userData.lojaId,
          lojaNome: userData.nomeLoja
        };
        lojaId = userData.lojaId;
        userInfo.textContent = `${usuarioLogado.nome} (${usuarioLogado.lojaNome})`;
        
        // Mostrar modal de confirmação de senha
        mostrarModalSenha();
      } else {
        mostrarErro('Conta pendente de aprovação administrativa');
        setTimeout(() => window.location.href = 'index.html', 3000);
      }
    } catch (error) {
      console.error('Erro ao verificar usuário:', error);
      mostrarErro('Erro ao verificar conta. Tente novamente.');
    }
  } else {
    window.location.href = 'index.html';
  }
});

// Verificar se usuário está aprovado
async function verificarUsuario(uid) {
  const userSnapshot = await get(ref(db, `users/${uid}`));
  return userSnapshot.exists() ? userSnapshot.val() : null;
}

// Mostrar modal de confirmação de senha
function mostrarModalSenha() {
  modalSenha.style.display = 'flex';
  document.getElementById('confirmarSenha').focus();
}

// Esconder modal de senha
function esconderModalSenha() {
  modalSenha.style.display = 'none';
  esconderErroSenha();
}

// Mostrar conteúdo principal
function mostrarConteudoPrincipal() {
  conteudoPrincipal.style.display = 'block';
  carregarProdutos();
  carregarPromocoes();
}

// Configurar formulário de senha
if (formSenha) {
  formSenha.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const senha = document.getElementById('confirmarSenha').value;
    
    if (!senha) {
      mostrarErroSenha('Digite sua senha');
      return;
    }
    
    try {
      // Reautenticar o usuário
      await signInWithEmailAndPassword(auth, usuarioLogado.email, senha);
      
      // Se chegou aqui, a senha está correta
      esconderModalSenha();
      mostrarConteudoPrincipal();
      
    } catch (error) {
      console.error('Erro na confirmação de senha:', error);
      mostrarErroSenha('Senha incorreta. Tente novamente.');
    }
  });
}

// Funções de erro para senha
function mostrarErroSenha(mensagem) {
  senhaErrorText.textContent = mensagem;
  senhaError.style.display = 'flex';
}

function esconderErroSenha() {
  senhaError.style.display = 'none';
}

// Carregar produtos apenas da loja do usuário
async function carregarProdutos() {
  try {
    if (!lojaId) {
      mostrarErro('Loja não identificada.');
      return;
    }

    console.log('Carregando produtos da loja:', lojaId);
    const produtosSnap = await get(ref(db, `lojas/${lojaId}/produtos`));
    
    if (!produtosSnap.exists()) {
      mostrarErro('Nenhum produto encontrado para sua loja.');
      produtoSelect.innerHTML = '<option value="">Nenhum produto cadastrado</option>';
      return;
    }

    produtos = [];
    const data = produtosSnap.val();

    Object.entries(data).forEach(([produtoId, produto]) => {
      produtos.push({
        id: produtoId,
        lojaId: lojaId,
        nome: produto.nome,
        precoOriginal: produto.valor,
        codigoBarras: produto.codigoBarras,
        quantidade: produto.quantidade,
        lojaNome: usuarioLogado.lojaNome
      });
    });

    console.log('Produtos carregados:', produtos);
    preencherSelectProdutos();
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    mostrarErro('Erro ao carregar produtos da sua loja.');
  }
}

// Preencher select de produtos
function preencherSelectProdutos() {
  produtoSelect.innerHTML = '<option value="">Selecione um produto...</option>';
  
  if (produtos.length === 0) {
    produtoSelect.innerHTML = '<option value="">Nenhum produto cadastrado</option>';
    return;
  }
  
  produtos.forEach(produto => {
    const option = document.createElement('option');
    option.value = produto.id;
    option.textContent = `${produto.nome} - R$ ${produto.precoOriginal.toFixed(2)} (Estoque: ${produto.quantidade})`;
    option.setAttribute('data-preco-original', produto.precoOriginal);
    produtoSelect.appendChild(option);
  });
}

// Carregar promoções apenas da loja do usuário
function carregarPromocoes() {
  const promocoesRef = ref(db, 'promocoes');
  
  onValue(promocoesRef, (snapshot) => {
    promocoes = [];
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      
      Object.entries(data).forEach(([promocaoId, promocao]) => {
        // Filtrar apenas promoções da loja do usuário
        if (promocao.lojaId === lojaId) {
          promocoes.push({
            id: promocaoId,
            ...promocao
          });
        }
      });
    }
    
    exibirPromocoes();
  });
}

// Exibir promoções na lista
function exibirPromocoes() {
  if (promocoes.length === 0) {
    promocoesList.innerHTML = `
      <div class="loading">
        <i class="fas fa-tags"></i>
        Nenhuma promoção ativa para sua loja
      </div>
    `;
    return;
  }

  promocoesList.innerHTML = '';

  promocoes.forEach(promocao => {
    const agora = new Date();
    const dataExpiracao = new Date(promocao.dataExpiracao);
    const estaAtiva = dataExpiracao > agora;
    
    const promocaoItem = document.createElement('div');
    promocaoItem.className = 'promocao-item';
    
    promocaoItem.innerHTML = `
      <div class="promocao-info">
        <h4>${promocao.produtoNome}</h4>
        <p>
          <span class="preco-original">R$ ${promocao.precoOriginal.toFixed(2)}</span> → 
          <span class="preco-promocional">R$ ${promocao.precoPromocional.toFixed(2)}</span>
        </p>
        <p><strong>Expira:</strong> ${formatarData(dataExpiracao)}</p>
        <span class="${estaAtiva ? 'status-ativa' : 'status-expirada'}">
          ${estaAtiva ? 'ATIVA' : 'EXPIRADA'}
        </span>
      </div>
      <div class="promocao-actions">
        <button class="btn-danger" onclick="removerPromocao('${promocao.id}')">
          <i class="fas fa-trash"></i>
          Remover
        </button>
      </div>
    `;
    
    promocoesList.appendChild(promocaoItem);
  });
}

// Formatar data
function formatarData(data) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(data);
}

// Criar nova promoção
formPromocao.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const produtoId = produtoSelect.value;
  const precoPromocional = parseFloat(document.getElementById('precoPromocional').value);
  const dataExpiracao = document.getElementById('dataExpiracao').value;
  
  if (!produtoId) {
    mostrarErro('Selecione um produto.');
    return;
  }
  
  // Buscar o produto selecionado
  const produtoSelecionado = produtos.find(p => p.id === produtoId);
  
  if (!produtoSelecionado) {
    mostrarErro('Produto não encontrado.');
    return;
  }
  
  // Usar o preço original do produto
  const precoOriginal = produtoSelecionado.precoOriginal;
  
  if (precoPromocional >= precoOriginal) {
    mostrarErro('O preço promocional deve ser menor que o preço original.');
    return;
  }
  
  // Verificar data de expiração
  const dataExpiracaoObj = new Date(dataExpiracao);
  const agora = new Date();
  if (dataExpiracaoObj <= agora) {
    mostrarErro('A data de expiração deve ser futura.');
    return;
  }
  
  try {
    const novaPromocaoRef = push(ref(db, 'promocoes'));
    
    await set(novaPromocaoRef, {
      lojaId: lojaId,
      produtoId: produtoId,
      produtoNome: produtoSelecionado.nome,
      lojaNome: usuarioLogado.lojaNome,
      precoOriginal: precoOriginal,
      precoPromocional: precoPromocional,
      dataExpiracao: dataExpiracao,
      dataCriacao: new Date().toISOString(),
      criadoPor: usuarioLogado.uid
    });
    
    mostrarSucesso('Promoção criada com sucesso!');
    formPromocao.reset();
    
  } catch (error) {
    console.error('Erro ao criar promoção:', error);
    mostrarErro('Erro ao criar promoção.');
  }
});

// Remover promoção
window.removerPromocao = async function(promocaoId) {
  if (!confirm('Tem certeza que deseja remover esta promoção?')) {
    return;
  }
  
  try {
    await remove(ref(db, `promocoes/${promocaoId}`));
    mostrarSucesso('Promoção removida com sucesso!');
  } catch (error) {
    console.error('Erro ao remover promoção:', error);
    mostrarErro('Erro ao remover promoção.');
  }
}

// Funções de mensagem
function mostrarErro(mensagem) {
  errorMessage.textContent = mensagem;
  errorMessage.style.display = 'block';
  successMessage.style.display = 'none';
  
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 5000);
}

function mostrarSucesso(mensagem) {
  successMessage.textContent = mensagem;
  successMessage.style.display = 'block';
  errorMessage.style.display = 'none';
  
  setTimeout(() => {
    successMessage.style.display = 'none';
  }, 5000);
}

// Função para mostrar loading no botão
function mostrarLoadingBotao(button) {
  button.disabled = true;
  button.classList.add('loading');
  button.innerHTML = '<i class="fas fa-spinner"></i> Verificando...';
}

// Função para esconder loading no botão
function esconderLoadingBotao(button, textoOriginal) {
  button.disabled = false;
  button.classList.remove('loading');
  button.innerHTML = textoOriginal;
}

// Atualize o evento do formulário de senha:
if (formSenha) {
  formSenha.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const senha = document.getElementById('confirmarSenha').value;
    const button = formSenha.querySelector('button[type="submit"]');
    const textoOriginal = button.innerHTML;
    
    if (!senha) {
      mostrarErroSenha('Digite sua senha');
      return;
    }
    
    try {
      mostrarLoadingBotao(button);
      
      // Reautenticar o usuário
      await signInWithEmailAndPassword(auth, usuarioLogado.email, senha);
      
      // Se chegou aqui, a senha está correta
      esconderModalSenha();
      mostrarConteudoPrincipal();
      
    } catch (error) {
      console.error('Erro na confirmação de senha:', error);
      mostrarErroSenha('Senha incorreta. Tente novamente.');
      esconderLoadingBotao(button, textoOriginal);
    }
  });
}

// Fechar modal clicando fora
window.onclick = (e) => {
  if (e.target === modalSenha) {
    // Se clicar fora do modal, redireciona para o caixa
    window.location.href = 'caixa.html';
  }
};

// Tecla ESC fecha o modal e redireciona
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalSenha.style.display === 'flex') {
    window.location.href = 'caixa.html';
  }
});