import { db } from './firebase-config.js';
import { ref, get, onChildAdded } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const nomeLojaEl = document.getElementById('nomeLoja');
const totalProdutosEl = document.getElementById('totalProdutos');
const vendasDiaEl = document.getElementById('vendasDia');
const produtosForaEstoqueEl = document.getElementById('produtosForaEstoque');
const produtosVencidosEl = document.getElementById('produtosVencidos');
const listaVendasRecentesEl = document.getElementById('listaVendasRecentes');

const valorInicialEl = document.createElement('div');
valorInicialEl.className = 'stat-card';
valorInicialEl.innerHTML = `
  <div class="stat-icon"><i class="fas fa-wallet"></i></div>
  <div class="stat-info">
    <h3>Caixa Inicial</h3>
    <span id="caixaInicial" class="stat-value">R$ 0,00</span>
  </div>`;
document.querySelector('.stats-grid').appendChild(valorInicialEl);

const totalCaixaEl = document.createElement('div');
totalCaixaEl.className = 'stat-card';
totalCaixaEl.innerHTML = `
  <div class="stat-icon"><i class="fas fa-money-bill-wave"></i></div>
  <div class="stat-info">
    <h3>Total no Caixa</h3>
    <span id="totalCaixa" class="stat-value">R$ 0,00</span>
  </div>`;
document.querySelector('.stats-grid').appendChild(totalCaixaEl);

const lojaId = localStorage.getItem('lojaId');
if (!lojaId) {
  nomeLojaEl.textContent = 'Usuário não autenticado. Faça login novamente.';
  alert('Loja não encontrada. Faça login novamente.');
  window.location.href = '/login.html';
} else {
  const nomeLoja = localStorage.getItem('nomeLoja') || 'Loja não identificada';
  nomeLojaEl.textContent = nomeLoja;

  async function carregarEstoque() {
    try {
      const produtosRef = ref(db, `lojas/${lojaId}/produtos`);
      const snapshot = await get(produtosRef);
      if (!snapshot.exists()) {
        totalProdutosEl.textContent = '0';
        return;
      }

      const produtos = snapshot.val();
      let totalQuantidade = 0;
      produtosForaEstoqueEl.innerHTML = '';
      produtosVencidosEl.innerHTML = '';
      const hoje = new Date();

      Object.values(produtos).forEach(produto => {
        const quantidade = Number(produto.quantidade) || 0;
        totalQuantidade += quantidade;

        if (quantidade <= 0) {
          const li = document.createElement('li');
          li.textContent = produto.nome;
          produtosForaEstoqueEl.appendChild(li);
        }

        if (produto.validade) {
          const dataVencimento = new Date(produto.validade);
          if (dataVencimento < hoje) {
            const li = document.createElement('li');
            li.textContent = `${produto.nome} (Vencido em: ${dataVencimento.toLocaleDateString()})`;
            produtosVencidosEl.appendChild(li);
          }
        }
      });

      totalProdutosEl.textContent = totalQuantidade;
    } catch (error) {
      console.error('Erro ao carregar estoque:', error);
      totalProdutosEl.textContent = 'Erro';
    }
  }

  async function carregarVendasEDadosCaixa() {
    try {
      const hojeStr = new Date().toISOString().split('T')[0];
      let totalDia = 0;
      let totalDinheiroDia = 0;

      const vendasRef = ref(db, `lojas/${lojaId}/vendas`);
      const vendasSnap = await get(vendasRef);
      if (vendasSnap.exists()) {
        Object.values(vendasSnap.val()).forEach(venda => {
          if (venda.data) {
            const dataVenda = typeof venda.data === "string"
              ? venda.data.split('T')[0]
              : new Date(venda.data).toISOString().split('T')[0];

            if (dataVenda === hojeStr) {
              const totalVenda = parseFloat(venda.total) || 0;
              totalDia += totalVenda;

              if (venda.formaPagamento === "Dinheiro") {
                totalDinheiroDia += totalVenda;
              }
            }
          }
        });
      }

      vendasDiaEl.textContent = totalDia.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });

      const caixaSnap = await get(ref(db, `lojas/${lojaId}/caixa/${hojeStr}/valorInicial`));
      const valorInicial = caixaSnap.exists() ? parseFloat(caixaSnap.val()) : 0;

      document.getElementById('caixaInicial').textContent = valorInicial.toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL'
      });

      const totalCaixa = valorInicial + totalDinheiroDia;
      document.getElementById('totalCaixa').textContent = totalCaixa.toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL'
      });

    } catch (error) {
      console.error('Erro ao carregar vendas ou caixa:', error);
      vendasDiaEl.textContent = 'Erro';
    }
  }

  function monitorarVendasRecentes() {
    const vendasRef = ref(db, `lojas/${lojaId}/vendas`);
    listaVendasRecentesEl.innerHTML = '';
    const vendasCache = [];

    onChildAdded(vendasRef, (snapshot) => {
      const venda = snapshot.val();
      if (!venda || !venda.data) return;
      vendasCache.unshift(venda);
      if (vendasCache.length > 100) vendasCache.pop();
      renderVendasFiltradas();
    });

    function renderVendasFiltradas() {
      const filtro = document.getElementById('filtroFormaPagamento').value;
      listaVendasRecentesEl.innerHTML = '';
      let vendasFiltradas = filtro !== 'todos'
        ? vendasCache.filter(v => v.formaPagamento === filtro)
        : vendasCache;

      if (vendasFiltradas.length === 0) {
        listaVendasRecentesEl.innerHTML = '<li>Nenhuma venda encontrada.</li>';
        return;
      }

      vendasFiltradas.slice(0, 10).forEach(venda => {
        const dataHora = new Date(venda.data).toLocaleString('pt-BR');
        const valor = (parseFloat(venda.total) || 0).toLocaleString('pt-BR', {
          style: 'currency', currency: 'BRL'
        });

        const li = document.createElement('li');
        li.textContent = `${dataHora} - Total: ${valor} - Forma: ${venda.formaPagamento || 'N/A'}`;
        listaVendasRecentesEl.appendChild(li);
      });
    }

    document.getElementById('filtroFormaPagamento').addEventListener('change', renderVendasFiltradas);
  }

  carregarEstoque();
  carregarVendasEDadosCaixa();
  monitorarVendasRecentes();
}

document.getElementById('btnEstoque').onclick = () => {
  window.location.href = '/estoque.html';
};

document.getElementById('btnCaixa').onclick = () => {
  window.location.href = '/caixa.html';
};

document.getElementById('btnSair').onclick = () => {
  localStorage.clear();
  window.location.href = '/login.html';
};
