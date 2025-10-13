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

const selectFiltroCategoria = document.getElementById('filtroCategoria');
const selectAddCategoria = document.getElementById('addCategoria');
const inputAddNovaCategoria = document.getElementById('addNovaCategoria');
const selectEditCategoria = document.getElementById('editCategoria');
const inputEditNovaCategoria = document.getElementById('editNovaCategoria');

let produtoIdAtual = null;
let produtosCarregados = [];

// --- Garantir que o botão abre o modal de Adicionar ---
if (btnAdicionarProduto) {
  btnAdicionarProduto.addEventListener('click', async () => {
    if (!modalAdd) {
      console.warn('modalAdd não encontrado no DOM');
      return;
    }
    // limpa o formulário / nova categoria ao abrir
    try {
      if (formAdd) formAdd.reset();
      if (inputAddNovaCategoria) inputAddNovaCategoria.value = '';
    } catch (e) { /* sem problema */ }

    // atualizar selects de categoria antes de abrir
    try { await atualizarSelectCategoriasPersistente(); } catch (e) { console.warn(e); }

    modalAdd.style.display = 'flex';
    // foco no campo nome
    const foco = document.getElementById('addNome');
    if (foco) {
      try { foco.focus({ preventScroll: true }); } catch { foco.focus(); }
    }
  });
} else {
  console.warn('btnAdicionarProduto não encontrado no DOM');
}

// helper: normaliza para chave
function slugify(text) {
  return text.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, '-') // espaços -> hífen
    .replace(/[^\w\-]+/g, '') // remove chars inválidos
    .replace(/\-\-+/g, '-') // múltiplos hífens
    .replace(/^-+/, '').replace(/-+$/, '');
}

async function salvarCategoriaPersistente(categoria) {
  if (!categoria) return;
  const nome = categoria.trim();
  if (!nome) return;
  const chave = slugify(nome);
  const catRef = ref(db, `lojas/${lojaId}/categorias/${chave}`);
  try {
    const snap = await get(catRef);
    if (!snap.exists()) {
      await set(catRef, { name: nome, createdAt: new Date().toISOString() });
    } else {
      const existing = snap.val();
      if (existing.name !== nome) {
        await set(catRef, { ...existing, name: nome });
      }
    }
  } catch (err) {
    console.warn('Erro ao salvar categoria persistente', err);
  }
}

async function carregarCategoriasDoDB() {
  try {
    const snap = await get(ref(db, `lojas/${lojaId}/categorias`));
    if (!snap.exists()) return [];
    const catsObj = snap.val();
    const arr = Object.values(catsObj).map(c => c.name).sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));
    return arr;
  } catch (err) {
    console.warn('Erro ao carregar categorias do DB', err);
    return [];
  }
}

async function atualizarSelectCategoriasPersistente() {
  // tenta carregar do DB; se vazio, cai de volta no derivado de produtos
  let cats = await carregarCategoriasDoDB();
  if (!cats || cats.length === 0) {
    cats = [...new Set((produtosCarregados || []).map(p => (p.categoria || 'Sem categoria')))];
    cats.sort((a,b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }

  // filtro no topo
  if (selectFiltroCategoria) {
    selectFiltroCategoria.innerHTML = '<option value="">Todas as categorias</option>';
    cats.forEach(c => {
      const o = document.createElement('option'); o.value = c; o.textContent = c;
      selectFiltroCategoria.appendChild(o);
    });
  }

  // select do adicionar
  if (selectAddCategoria) {
    selectAddCategoria.innerHTML = '<option value="">-- Selecionar categoria --</option>';
    cats.forEach(c => {
      const o = document.createElement('option'); o.value = c; o.textContent = c;
      selectAddCategoria.appendChild(o);
    });
  }

  // select do editar
  if (selectEditCategoria) {
    selectEditCategoria.innerHTML = '<option value="">-- Selecionar categoria --</option>';
    cats.forEach(c => {
      const o = document.createElement('option'); o.value = c; o.textContent = c;
      selectEditCategoria.appendChild(o);
    });
  }
}

// Função para mostrar mensagem de erro
function mostrarErro(mensagem) {
  const erroExistente = document.getElementById('mensagemErro');
  if (erroExistente) {
    erroExistente.remove();
  }
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
  const form = document.getElementById('formAdicionarProduto');
  if (form && form.parentNode) form.parentNode.insertBefore(mensagemErro, form);
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
  if (!produtos || produtos.length === 0) {
    tabela.innerHTML = '<tr><td colspan="8">Nenhum produto encontrado.</td></tr>';
    return;
  }

  produtos.forEach(produto => {
    const tr = document.createElement('tr');

    if (produto.quantidade <= 0) tr.classList.add('critico');
    else if (produto.quantidade <= produto.estoqueMinimo) tr.classList.add('baixo');

    const categoriaDisplay = produto.categoria || 'Sem categoria';

    tr.innerHTML = `
      <td>${produto.nome}</td>
      <td>${categoriaDisplay}</td>
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
    tabela.innerHTML = '<tr><td colspan="8">Nenhum produto encontrado.</td></tr>';
    produtosCarregados = [];
    try { await atualizarSelectCategoriasPersistente(); } catch(e){ console.warn(e); }
    return;
  }

  const data = snap.val();
  produtosCarregados = Object.entries(data).map(([id, prod]) => ({ id, ...prod }));
  exibirProdutos(produtosCarregados);
  try { await atualizarSelectCategoriasPersistente(); } catch(e){ console.warn(e); }
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

  // atualizar selects de categoria antes de abrir editar
  try { await atualizarSelectCategoriasPersistente(); } catch(e){ console.warn(e); }

  // selecionar categoria no select (ou adicionar como option se não existir)
  if (selectEditCategoria) {
    const cat = produto.categoria || 'Sem categoria';
    if (![...selectEditCategoria.options].some(o => o.value === cat)) {
      const o = document.createElement('option'); o.value = cat; o.textContent = cat;
      selectEditCategoria.appendChild(o);
    }
    selectEditCategoria.value = produto.categoria || '';
    if (inputEditNovaCategoria) inputEditNovaCategoria.value = '';
  }

  modalEdit.style.display = 'flex';
};

if (closeEditModal) closeEditModal.onclick = () => modalEdit.style.display = 'none';
if (closeAddModal) closeAddModal.onclick = () => modalAdd.style.display = 'none';

window.onclick = (e) => {
  if (e.target === modalEdit) modalEdit.style.display = 'none';
  if (e.target === modalAdd) modalAdd.style.display = 'none';
};

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
if (formAdd) {
  formAdd.onsubmit = async (e) => {
    e.preventDefault();

    const nome = formAdd.addNome.value.trim();
    const codigoBarras = formAdd.addCodigoBarras.value.trim();
    const quantidade = parseInt(formAdd.addQuantidade.value);
    const estoqueMinimo = parseInt(formAdd.addEstoqueMinimo.value);
    const validade = formAdd.addValidade.value;
    const valor = parseFloat(formAdd.addValor.value);

    // categoria (nova tem prioridade)
    const categoriaEscolhida = (inputAddNovaCategoria && inputAddNovaCategoria.value.trim()) ? inputAddNovaCategoria.value.trim() : (selectAddCategoria ? selectAddCategoria.value : '');
    const categoriaFinal = categoriaEscolhida || 'Sem categoria';

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
      const verificacao = await verificarProdutoDuplicado(nome, codigoBarras);
      if (verificacao.existe) {
        mostrarErro(`Já existe um produto com este ${verificacao.tipo} cadastrado: "${verificacao.valor}"`);
        return;
      }

      // salva categoria persistente (se necessário)
      try { await salvarCategoriaPersistente(categoriaFinal); } catch(e){ console.warn(e); }

      const novoProduto = {
        nome: nome,
        categoria: categoriaFinal,
        codigoBarras: codigoBarras || null,
        quantidade: quantidade,
        estoqueMinimo: estoqueMinimo,
        validade: validade || null,
        valor: valor
      };

      const novaRef = push(ref(db, `lojas/${lojaId}/produtos`));
      await set(novaRef, novoProduto);

      const erroExistente = document.getElementById('mensagemErro');
      if (erroExistente) erroExistente.remove();

      modalAdd.style.display = 'none';
      formAdd.reset();
      await carregarEstoque();

      alert('Produto adicionado com sucesso!');
    } catch (err) {
      console.error('Erro ao adicionar produto:', err);
      mostrarErro('Erro ao adicionar produto: ' + err.message);
    }
  };
}

// Editar produto
if (formEdit) {
  formEdit.onsubmit = async (e) => {
    e.preventDefault();
    if (!produtoIdAtual) return alert('Produto não selecionado');

    // categoria (nova tem prioridade)
    const categoriaEscolhida = (inputEditNovaCategoria && inputEditNovaCategoria.value.trim()) ? inputEditNovaCategoria.value.trim() : (selectEditCategoria ? selectEditCategoria.value : '');
    const categoriaFinal = categoriaEscolhida || 'Sem categoria';

    const dados = {
      nome: formEdit.editNome.value.trim(),
      categoria: categoriaFinal,
      codigoBarras: formEdit.editCodigoBarras.value.trim(),
      quantidade: parseInt(formEdit.editQuantidade.value),
      estoqueMinimo: parseInt(formEdit.editEstoqueMinimo.value),
      validade: formEdit.editValidade.value || null,
      valor: parseFloat(formEdit.editValor.value)
    };

    try {
      // salvar categoria persistente se nova
      try { await salvarCategoriaPersistente(categoriaFinal); } catch(e){ console.warn(e); }

      await update(ref(db, `lojas/${lojaId}/produtos/${produtoIdAtual}`), dados);
      modalEdit.style.display = 'none';
      await carregarEstoque();
    } catch (err) {
      console.error('Erro ao editar produto:', err);
      mostrarErro('Erro ao editar produto: ' + err.message);
    }
  };
}

// Função para filtrar produtos por nome, código e categoria
window.filtrarProdutos = function() {
  const searchTerm = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const categoriaSelecionada = (selectFiltroCategoria && selectFiltroCategoria.value) ? selectFiltroCategoria.value : '';

  let filtrados = [...produtosCarregados];

  if (searchTerm) {
    filtrados = filtrados.filter(produto => {
      const nomeMatch = produto.nome?.toLowerCase().includes(searchTerm);
      const codigoMatch = produto.codigoBarras?.toLowerCase().includes(searchTerm);
      return nomeMatch || codigoMatch;
    });
  }

  if (categoriaSelecionada) {
    filtrados = filtrados.filter(p => (p.categoria || 'Sem categoria') === categoriaSelecionada);
  }

  exibirProdutos(filtrados);
};

window.excluirProduto = async (id) => {
  if (!confirm("Tem certeza que deseja excluir?")) return;
  await remove(ref(db, `lojas/${lojaId}/produtos/${id}`));
  await carregarEstoque();
};

// UX helpers: desabilita select quando nova categoria preenchida (e vice-versa)
function bindCategoriaInputsUX() {
  if (inputAddNovaCategoria && selectAddCategoria) {
    inputAddNovaCategoria.addEventListener('input', () => {
      selectAddCategoria.disabled = !!inputAddNovaCategoria.value.trim();
    });
    selectAddCategoria.addEventListener('change', () => {
      if (selectAddCategoria.value) inputAddNovaCategoria.value = '';
      selectAddCategoria.disabled = !!inputAddNovaCategoria.value.trim();
    });
  }
  if (inputEditNovaCategoria && selectEditCategoria) {
    inputEditNovaCategoria.addEventListener('input', () => {
      selectEditCategoria.disabled = !!inputEditNovaCategoria.value.trim();
    });
    selectEditCategoria.addEventListener('change', () => {
      if (selectEditCategoria.value) inputEditNovaCategoria.value = '';
      selectEditCategoria.disabled = !!inputEditNovaCategoria.value.trim();
    });
  }
}

// bind inicial
bindCategoriaInputsUX();

// inicializa
carregarEstoque();
