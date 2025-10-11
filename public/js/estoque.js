import { db } from './firebase-config.js';
import { ref, get, remove, update, push, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const lojaId = localStorage.getItem('lojaId');
if (!lojaId) {
  alert("Usuário não autenticado.");
  throw new Error("lojaId não encontrado.");
}

const tabela = document.getElementById('listaProdutos');
const modalEdit = document.getElementById('modalEdit');
const formEdit = document.getElementById('formEditarProduto');
const closeEditModal = document.getElementById('closeEditModal');

const modalAdd = document.getElementById('modalAdd');
const btnAdicionarProduto = document.getElementById('btnAdicionarProduto');
const closeAddModal = document.getElementById('closeAddModal');
const formAdd = document.getElementById('formAdicionarProduto');

let produtoIdAtual = null;
let produtosCarregados = [];

// Função para mostrar mensagem de erro
function mostrarErro(mensagem) {
  // Remove mensagens de erro existentes
  const erroExistente = document.getElementById('mensagemErro');
  if (erroExistente) {
    erroExistente.remove();
  }
  
  // Cria nova mensagem de erro
  const mensagemErro = document.createElement('div');
  mensagemErro.id = 'mensagemErro';
  mensagemErro.style.cssText = `
    background: #ffe6e6;
    border: 1px solid #e63946;
    color: #e63946;
    padding: 12px 15px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 10px;
  `;
  mensagemErro.innerHTML = `
    <i class="fas fa-exclamation-triangle"></i>
    ${mensagem}
  `;
  
  // Insere a mensagem antes do formulário
  const form = document.getElementById('formAdicionarProduto');
  form.parentNode.insertBefore(mensagemErro, form);
}

// Função auxiliar para formatar datas
function formatarDataBrasileira(dataString) {
  if (!dataString || dataString === '-' || dataString === 'null') return '-';
  
  try {
    const data = new Date(dataString + 'T00:00:00');
    
    if (isNaN(data.getTime())) return '-';
    
    return data.toLocaleDateString('pt-BR');
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return '-';
  }
}

function exibirProdutos(produtos) {
  tabela.innerHTML = '';
  produtos.forEach(produto => {
    const tr = document.createElement('tr');

    if (produto.quantidade <= 0) tr.classList.add('critico');
    else if (produto.quantidade <= produto.estoqueMinimo) tr.classList.add('baixo');

    tr.innerHTML = `
      <td>${produto.nome}</td>
      <td>${produto.codigoBarras || '-'}</td>
      <td>${produto.quantidade}</td>
      <td>${produto.estoqueMinimo}</td>
      <td>${formatarDataBrasileira(produto.validade)}</td>
      <td>R$ ${produto.valor.toFixed(2)}</td>
      <td>
        <button onclick="abrirEditar('${produto.id}')">✏️</button>
        <button onclick="excluirProduto('${produto.id}')">🗑️</button>
      </td>
    `;
    tabela.appendChild(tr);
  });
}

window.carregarEstoque = async function carregarEstoque() {
  const refProdutos = ref(db, `lojas/${lojaId}/produtos`);
  const snap = await get(refProdutos);
  if (!snap.exists()) {
    tabela.innerHTML = '<tr><td colspan="7">Nenhum produto encontrado.</td></tr>';
    return;
  }

  const data = snap.val();
  produtosCarregados = Object.entries(data).map(([id, prod]) => ({ id, ...prod }));
  exibirProdutos(produtosCarregados);
};

window.filtrar = (tipo) => {
  let filtrados = [...produtosCarregados];

  if (tipo === 'validade') {
    filtrados = filtrados
      .filter(p => p.validade)
      .sort((a, b) => new Date(a.validade) - new Date(b.validade));
  } else if (tipo === 'quantidade') {
    filtrados = filtrados.sort((a, b) => a.quantidade - b.quantidade);
  }

  exibirProdutos(filtrados);
};

window.abrirEditar = async (id) => {
  const produto = produtosCarregados.find(p => p.id === id);
  if (!produto) return alert('Produto não encontrado');
  produtoIdAtual = id;

  formEdit.editNome.value = produto.nome || '';
  formEdit.editCodigoBarras.value = produto.codigoBarras || '';
  formEdit.editQuantidade.value = produto.quantidade || 0;
  formEdit.editEstoqueMinimo.value = produto.estoqueMinimo || 0;
  formEdit.editValidade.value = produto.validade || '';
  formEdit.editValor.value = produto.valor || 0;

  modalEdit.style.display = 'flex';
};

closeEditModal.onclick = () => modalEdit.style.display = 'none';
closeAddModal.onclick = () => modalAdd.style.display = 'none';

window.onclick = (e) => {
  if (e.target === modalEdit) modalEdit.style.display = 'none';
  if (e.target === modalAdd) modalAdd.style.display = 'none';
};

formEdit.onsubmit = async (e) => {
  e.preventDefault();
  if (!produtoIdAtual) return alert('Produto não selecionado');

  const dados = {
    nome: formEdit.editNome.value.trim(),
    codigoBarras: formEdit.editCodigoBarras.value.trim(),
    quantidade: parseInt(formEdit.editQuantidade.value),
    estoqueMinimo: parseInt(formEdit.editEstoqueMinimo.value),
    validade: formEdit.editValidade.value,
    valor: parseFloat(formEdit.editValor.value)
  };

  await update(ref(db, `lojas/${lojaId}/produtos/${produtoIdAtual}`), dados);
  modalEdit.style.display = 'none';
  carregarEstoque();
};

btnAdicionarProduto.onclick = () => modalAdd.style.display = 'flex';

// Função para verificar qual campo está duplicado
async function verificarProdutoDuplicado(nome, codigoBarras) {
  const refProdutos = ref(db, `lojas/${lojaId}/produtos`);
  const snap = await get(refProdutos);
  
  if (!snap.exists()) return { existe: false };
  
  const produtos = snap.val();
  const nomeLower = nome.toLowerCase().trim();
  const codigoLower = codigoBarras ? codigoBarras.toLowerCase().trim() : '';
  
  for (const [id, produto] of Object.entries(produtos)) {
    const produtoNomeLower = produto.nome?.toLowerCase().trim();
    const produtoCodigoLower = produto.codigoBarras?.toLowerCase().trim();
    
    if (produtoNomeLower === nomeLower) {
      return { 
        existe: true, 
        tipo: 'nome', 
        valor: produto.nome 
      };
    }
    
    if (codigoBarras && produtoCodigoLower && produtoCodigoLower === codigoLower) {
      return { 
        existe: true, 
        tipo: 'código de barras', 
        valor: produto.codigoBarras 
      };
    }
  }
  
  return { existe: false };
}

// Modifique o formAdd.onsubmit para usar a versão avançada
formAdd.onsubmit = async (e) => {
  e.preventDefault();

  const nome = formAdd.addNome.value.trim();
  const codigoBarras = formAdd.addCodigoBarras.value.trim();
  const quantidade = parseInt(formAdd.addQuantidade.value);
  const estoqueMinimo = parseInt(formAdd.addEstoqueMinimo.value);
  const validade = formAdd.addValidade.value;
  const valor = parseFloat(formAdd.addValor.value);

  // Validações básicas
  if (!nome) {
    mostrarErro('Por favor, informe o nome do produto.');
    return;
  }

  if (quantidade < 0) {
    mostrarErro('A quantidade não pode ser negativa.');
    return;
  }

  if (estoqueMinimo < 0) {
    mostrarErro('O estoque mínimo não pode ser negativo.');
    return;
  }

  if (valor < 0) {
    mostrarErro('O valor não pode ser negativo.');
    return;
  }

  try {
    // Verifica se o produto já existe
    const verificacao = await verificarProdutoDuplicado(nome, codigoBarras);
    
    if (verificacao.existe) {
      mostrarErro(`Já existe um produto com este ${verificacao.tipo} cadastrado: "${verificacao.valor}"`);
      return;
    }

    const novoProduto = {
      nome: nome,
      codigoBarras: codigoBarras || null,
      quantidade: quantidade,
      estoqueMinimo: estoqueMinimo,
      validade: validade || null,
      valor: valor
    };

    const novaRef = push(ref(db, `lojas/${lojaId}/produtos`));
    await set(novaRef, novoProduto);
    
    // Remove mensagem de erro se existir
    const erroExistente = document.getElementById('mensagemErro');
    if (erroExistente) {
      erroExistente.remove();
    }
    
    modalAdd.style.display = 'none';
    formAdd.reset();
    carregarEstoque();
    
    // Mostra mensagem de sucesso
    alert('Produto adicionado com sucesso!');
    
  } catch (err) {
    console.error('Erro ao adicionar produto:', err);
    mostrarErro('Erro ao adicionar produto: ' + err.message);
  }
};

// Função para filtrar produtos por nome ou código de barras
window.filtrarProdutos = function() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
  
  if (!searchTerm) {
    // Se não há termo de busca, mostra todos os produtos
    exibirProdutos(produtosCarregados);
    return;
  }
  
  // Filtra os produtos pelo nome ou código de barras
  const produtosFiltrados = produtosCarregados.filter(produto => {
    const nomeMatch = produto.nome?.toLowerCase().includes(searchTerm);
    const codigoMatch = produto.codigoBarras?.toLowerCase().includes(searchTerm);
    return nomeMatch || codigoMatch;
  });
  
  exibirProdutos(produtosFiltrados);
};

window.excluirProduto = async (id) => {
  if (!confirm("Tem certeza que deseja excluir?")) return;
  await remove(ref(db, `lojas/${lojaId}/produtos/${id}`));
  carregarEstoque();
};

carregarEstoque();