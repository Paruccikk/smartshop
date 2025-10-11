import { db } from './firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let entradas = [];
let saidas = [];
let codigosBarrasMap = {};
const lojaId = localStorage.getItem('lojaId');
if (!lojaId) alert("Loja não identificada.");

// Função única carregarRelatorio
async function carregarRelatorio() {
  const produtosSnap = await get(ref(db, `lojas/${lojaId}/produtos`));
  const produtos = produtosSnap.exists() ? produtosSnap.val() : {};
  
  // Carrega o mapa de códigos de barras
  codigosBarrasMap = {};
  Object.values(produtos).forEach(produto => {
    if (produto.nome && produto.codigoBarras) {
      codigosBarrasMap[produto.nome] = produto.codigoBarras;
    }
  });
  
  entradas = Object.values(produtos).map(p => ({
    nome: p.nome,
    quantidade: p.quantidade || 0,
    data: p.dataAdicionado || '-',
    codigoBarras: p.codigoBarras || null
  }));

  const vendasSnap = await get(ref(db, `lojas/${lojaId}/vendas`));
  const vendas = vendasSnap.exists() ? vendasSnap.val() : {};
  saidas = [];
  Object.values(vendas).forEach(venda => {
    if (!venda.itens) return;
    venda.itens.forEach(item => {
      saidas.push({
        nome: item.nome,
        quantidade: item.qtd || 0,
        data: venda.data ? new Date(venda.data).toLocaleString() : '-',
        observacao: venda.formaPagamento || '-',
        codigoBarras: codigosBarrasMap[item.nome] || null
      });
    });
  });

  filtrarRelatorio();
}

function calcularTotaisPorProduto(saidasFiltradas) {
  const totais = {};
  saidasFiltradas.forEach(s => {
    if (!totais[s.nome]) totais[s.nome] = 0;
    totais[s.nome] += s.quantidade;
  });
  return totais;
}

function popularTabelas(entFiltradas, saiFiltradas) {
  const tbodyEntradas = document.querySelector('#tabelaEntradas tbody');
  const tbodySaidas = document.querySelector('#tabelaSaidas tbody');
  const tbodyTotais = document.querySelector('#tabelaTotaisProdutos tbody');

  tbodyEntradas.innerHTML = '';
  entFiltradas.forEach(p => {
    tbodyEntradas.innerHTML += `<tr>
      <td>${p.nome}${p.codigoBarras ? `<br><small style="color: #666;">Cód: ${p.codigoBarras}</small>` : ''}</td>
      <td>${p.quantidade}</td>
      <td>${p.data}</td>
    </tr>`;
  });

  tbodySaidas.innerHTML = '';
  saiFiltradas.forEach(p => {
    tbodySaidas.innerHTML += `<tr>
      <td>${p.nome}${p.codigoBarras ? `<br><small style="color: #666;">Cód: ${p.codigoBarras}</small>` : ''}</td>
      <td>${p.quantidade}</td>
      <td>${p.data}</td>
      <td>${p.observacao}</td>
    </tr>`;
  });

  tbodyTotais.innerHTML = '';
  const totaisPorProduto = calcularTotaisPorProduto(saiFiltradas);
  for (const [nome, total] of Object.entries(totaisPorProduto)) {
    const codigoBarras = codigosBarrasMap[nome];
    tbodyTotais.innerHTML += `<tr>
      <td>${nome}${codigoBarras ? `<br><small style="color: #666;">Cód: ${codigoBarras}</small>` : ''}</td>
      <td>${total}</td>
    </tr>`;
  }

  const totalEntradas = entFiltradas.reduce((sum, p) => sum + (p.quantidade || 0), 0);
  const totalSaidas = saiFiltradas.reduce((sum, s) => sum + (s.quantidade || 0), 0);
  document.getElementById('totalEntradas').textContent = totalEntradas;
  document.getElementById('totalSaidas').textContent = totalSaidas;
}

// Função de filtro corrigida
window.filtrarRelatorio = () => {
  const dataInicio = document.getElementById('dataInicio').value;
  const dataFim = document.getElementById('dataFim').value;
  const produtoFiltro = document.getElementById('filtroProduto').value.toLowerCase().trim();

  let entFiltradas = entradas;
  let saiFiltradas = saidas;

  // Filtro por data
  if (dataInicio) {
    entFiltradas = entFiltradas.filter(e => {
      if (!e.data || e.data === '-') return true;
      return new Date(e.data) >= new Date(dataInicio);
    });
    saiFiltradas = saiFiltradas.filter(s => {
      if (!s.data || s.data === '-') return true;
      return new Date(s.data) >= new Date(dataInicio);
    });
  }
  
  if (dataFim) {
    const fim = new Date(dataFim);
    fim.setHours(23,59,59);
    entFiltradas = entFiltradas.filter(e => {
      if (!e.data || e.data === '-') return true;
      return new Date(e.data) <= fim;
    });
    saiFiltradas = saiFiltradas.filter(s => {
      if (!s.data || s.data === '-') return true;
      return new Date(s.data) <= fim;
    });
  }

  // Filtro por nome OU código de barras
  if (produtoFiltro) {
    entFiltradas = entFiltradas.filter(e => {
      const nomeMatch = e.nome && e.nome.toLowerCase().includes(produtoFiltro);
      const codigoMatch = e.codigoBarras && e.codigoBarras.toLowerCase().includes(produtoFiltro);
      return nomeMatch || codigoMatch;
    });
    
    saiFiltradas = saiFiltradas.filter(s => {
      const nomeMatch = s.nome && s.nome.toLowerCase().includes(produtoFiltro);
      const codigoMatch = s.codigoBarras && s.codigoBarras.toLowerCase().includes(produtoFiltro);
      return nomeMatch || codigoMatch;
    });
  }

  popularTabelas(entFiltradas, saiFiltradas);
};

// PNG com qualidade melhorada
document.getElementById('btnPDF').addEventListener('click', async () => {
  const btnOriginal = document.getElementById('btnPDF');
  const originalText = btnOriginal.innerHTML;
  btnOriginal.innerHTML = '⏳ Gerando imagem...';
  btnOriginal.disabled = true;

  try {
    // Cria um HTML otimizado para captura
    const relatorioHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 40px;
            background: white;
            color: #000;
            line-height: 1.4;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #333;
            padding-bottom: 20px;
          }
          .nome-loja {
            font-size: 28px;
            font-weight: bold;
            color: #4A148C;
            margin-bottom: 10px;
          }
          h1 {
            font-size: 24px;
            color: #333;
            margin: 30px 0 20px 0;
            border-bottom: 2px solid #4361ee;
            padding-bottom: 10px;
          }
          h2 {
            font-size: 20px;
            color: #4361ee;
            margin: 25px 0 15px 0;
            background: #f0f4ff;
            padding: 10px;
            border-left: 4px solid #4361ee;
          }
          .totais {
            display: flex;
            gap: 20px;
            margin: 20px 0;
          }
          .total-card {
            background: #4361ee;
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-weight: bold;
            min-width: 200px;
            text-align: center;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0 30px 0;
            background: white;
          }
          table th {
            background: #4361ee;
            color: white;
            padding: 12px 15px;
            text-align: left;
            font-weight: bold;
            border: 1px solid #3a56d4;
          }
          table td {
            padding: 10px 15px;
            border: 1px solid #ddd;
          }
          table tr:nth-child(even) {
            background: #f8f9fa;
          }
          table tr:hover {
            background: #e3f2fd;
          }
          .filtros-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #2a9d8f;
          }
          .data-relatorio {
            text-align: right;
            color: #666;
            font-style: italic;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="nome-loja">${document.querySelector('.nome-loja').textContent}</div>
          <h1>Relatório de Estoque</h1>
          <div class="data-relatorio">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
        </div>

        <div class="filtros-info">
          <strong>Filtros Aplicados:</strong><br>
          Produto: ${document.getElementById('filtroProduto').value || 'Todos'}<br>
          Data Início: ${document.getElementById('dataInicio').value || 'Não informada'}<br>
          Data Fim: ${document.getElementById('dataFim').value || 'Não informada'}
        </div>

        <div class="totais">
          <div class="total-card">
            Total Entradas: ${document.getElementById('totalEntradas').textContent}
          </div>
          <div class="total-card">
            Total Saídas: ${document.getElementById('totalSaidas').textContent}
          </div>
        </div>

        <h2>📥 Entradas (Produtos Adicionados)</h2>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Quantidade Adicionada</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from(document.querySelectorAll('#tabelaEntradas tbody tr')).map(row => 
              `<tr>${row.innerHTML}</tr>`
            ).join('')}
          </tbody>
        </table>

        <h2>📤 Saídas (Produtos Vendidos)</h2>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Quantidade Vendida</th>
              <th>Data</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from(document.querySelectorAll('#tabelaSaidas tbody tr')).map(row => 
              `<tr>${row.innerHTML}</tr>`
            ).join('')}
          </tbody>
        </table>

        <h2>📈 Totais por Produto (Saídas)</h2>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Total Vendido</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from(document.querySelectorAll('#tabelaTotaisProdutos tbody tr')).map(row => 
              `<tr>${row.innerHTML}</tr>`
            ).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Cria um iframe para renderizar o HTML
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '800px';
    iframe.style.height = '600px';
    iframe.srcdoc = relatorioHTML;
    
    document.body.appendChild(iframe);

    iframe.onload = function() {
      setTimeout(() => {
        html2canvas(iframe.contentDocument.body, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          width: iframe.contentDocument.body.scrollWidth,
          height: iframe.contentDocument.body.scrollHeight,
          onclone: function(clonedDoc) {
            // Garante que todos os elementos sejam visíveis
            const body = clonedDoc.body;
            body.style.visibility = 'visible';
            body.style.background = '#ffffff';
          }
        }).then(canvas => {
          // Converte para PNG
          const imgData = canvas.toDataURL('image/png', 1.0);

          // Cria link para download
          const link = document.createElement('a');
          link.href = imgData;
          link.download = `relatorio_${new Date().toISOString().split('T')[0]}_${Date.now()}.png`;
          link.click();

          // Limpa o iframe
          document.body.removeChild(iframe);
        }).catch(err => {
          console.error('Erro ao gerar imagem:', err);
          alert('Erro ao gerar relatório. Tente novamente.');
          document.body.removeChild(iframe);
        });
      }, 1000);
    };

  } catch (err) {
    console.error('Erro:', err);
    alert('Erro ao gerar relatório. Tente novamente.');
  } finally {
    btnOriginal.innerHTML = originalText;
    btnOriginal.disabled = false;
  }
});

carregarRelatorio();