// carrinho.js - atualizado completo com toasts e sincronização de totais
'use strict';

let carrinho = [];

// referências DOM (configuradas por caixa.js)
let carrinhoItemsEl = null;
let btnFinalizarVendaEl = null;
let totalItensEl = null;
let subtotalEl = null;
let totalVendaEl = null;

// mobile
let modalCarrinhoEl = null;
let carrinhoModalItemsEl = null;
let carrinhoBadgeEl = null;
let carrinhoTotalMobileEl = null;
let carrinhoModalCountEl = null;
let subtotalModalEl = null;
let totalVendaModalEl = null;
let btnFinalizarVendaMobileEl = null;
let btnCancelarVendaMobileEl = null;
let abrirModalFinalizacaoFn = null;

// container para mensagens tipo toast
let toastContainer = null;

// inicializa o container de toasts
function initToastContainer() {
  toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '20px';
    toastContainer.style.right = '20px';
    toastContainer.style.display = 'flex';
    toastContainer.style.flexDirection = 'column';
    toastContainer.style.gap = '10px';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }
}

// mostra mensagem tipo toast
function showToast(msg, duration = 2000) {
  if (!toastContainer) initToastContainer();
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.background = 'rgba(0,0,0,0.8)';
  t.style.color = '#fff';
  t.style.padding = '8px 12px';
  t.style.borderRadius = '6px';
  t.style.minWidth = '150px';
  t.style.textAlign = 'center';
  t.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
  t.style.fontSize = '14px';
  toastContainer.appendChild(t);
  setTimeout(() => { t.remove(); }, duration);
}

// Configura elementos do carrinho (desktop)
function setCarrinhoElements({ carrinhoItemsEl: ci, btnFinalizarVendaEl: bf, totalItensEl: ti, subtotalEl: sub, totalVendaEl: tot }) {
  carrinhoItemsEl = ci;
  btnFinalizarVendaEl = bf;
  totalItensEl = ti;
  subtotalEl = sub;
  totalVendaEl = tot;
}

// Configura elementos mobile
function setMobileElements(objs) {
  modalCarrinhoEl = objs.modalCarrinhoEl;
  carrinhoModalItemsEl = objs.carrinhoModalItemsEl;
  carrinhoBadgeEl = objs.carrinhoBadgeEl;
  carrinhoTotalMobileEl = objs.carrinhoTotalMobileEl;
  carrinhoModalCountEl = objs.carrinhoModalCountEl;
  subtotalModalEl = objs.subtotalModalEl;
  totalVendaModalEl = objs.totalVendaModalEl;
  btnFinalizarVendaMobileEl = objs.btnFinalizarVendaMobileEl;
  btnCancelarVendaMobileEl = objs.btnCancelarVendaMobileEl;
  abrirModalFinalizacaoFn = objs.abrirModalFinalizacaoFn;

  if (btnFinalizarVendaMobileEl) {
    btnFinalizarVendaMobileEl.addEventListener('click', () => {
      if (carrinho.length === 0) return;
      fecharCarrinhoMobile();
      if (abrirModalFinalizacaoFn) abrirModalFinalizacaoFn();
    });
  }
  if (btnCancelarVendaMobileEl) {
    btnCancelarVendaMobileEl.addEventListener('click', async () => {
      if (carrinho.length === 0) return;

      try {
        const { mostrarConfirmacao } = await import('./caixa.js');
        const yes = await mostrarConfirmacao('Deseja cancelar a venda e limpar o carrinho?');
        if (!yes) return;
        limparCarrinho();
        atualizarCarrinhoUI();
        fecharCarrinhoMobile();
      } catch (error) {
        console.warn('Erro ao importar função de confirmação:', error);
        if (confirm('Deseja cancelar a venda e limpar o carrinho?')) {
          limparCarrinho();
          atualizarCarrinhoUI();
          fecharCarrinhoMobile();
        }
      }
    });
  }
}

// adiciona produto ao carrinho
function adicionarAoCarrinho(produto) {
  const precoFinal = produto.temPromocao ? produto.precoPromocional : produto.valor;
  const itemExistente = carrinho.find(item => item.id === produto.id);

  if (itemExistente) {
    if (itemExistente.quantidade >= produto.quantidade) { 
      showToast('Quantidade em estoque insuficiente!', 2500); 
      return; 
    }
    itemExistente.quantidade++;
  } else {
    if (produto.quantidade < 1) { 
      showToast('Produto sem estoque!', 2500); 
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

  atualizarCarrinhoUI();

  // foco no scanner
  const scannerInput = document.getElementById('scannerInput');
  if (scannerInput) {
    try { scannerInput.focus({ preventScroll: true }); } catch { scannerInput.focus(); }
  }

  // mensagem de sucesso
  showToast('Item adicionado com sucesso', 1500);
}

// remove produto do carrinho
function removerDoCarrinho(produtoId) {
  carrinho = carrinho.filter(item => item.id !== produtoId);
  atualizarCarrinhoUI();
}

// altera quantidade
function alterarQuantidade(produtoId, novaQuantidade) {
  const item = carrinho.find(i => i.id === produtoId);
  if (!item) return;
  if (novaQuantidade < 1) { removerDoCarrinho(produtoId); return; }
  if (novaQuantidade > item.estoque) { showToast('Quantidade em estoque insuficiente!', 2500); return; }
  item.quantidade = novaQuantidade;
  atualizarCarrinhoUI();
}

// atualiza carrinho (desktop + mobile)
function atualizarCarrinhoUI() {
  // desktop
  if (!carrinhoItemsEl) return;
  carrinhoItemsEl.innerHTML = '';
  if (carrinho.length === 0) {
    carrinhoItemsEl.innerHTML = `<div class="carrinho-vazio"><i class="fas fa-shopping-cart"></i><p>Carrinho vazio</p></div>`;
    if (btnFinalizarVendaEl) btnFinalizarVendaEl.disabled = true;
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
      carrinhoItemsEl.appendChild(itemElement);
    });
    if (btnFinalizarVendaEl) btnFinalizarVendaEl.disabled = false;
  }

  const totalItensCount = carrinho.reduce((s, it) => s + it.quantidade, 0);
  const total = carrinho.reduce((s, it) => s + (it.preco * it.quantidade), 0);

  if (totalItensEl) totalItensEl.textContent = `${totalItensCount} ${totalItensCount === 1 ? 'item' : 'itens'}`;
  if (subtotalEl) subtotalEl.textContent = `R$ ${total.toFixed(2)}`;
  if (totalVendaEl) totalVendaEl.textContent = `R$ ${total.toFixed(2)}`;

  // mobile
  atualizarCarrinhoModal();
  atualizarBotaoCarrinhoFlutuante(totalItensCount, total);

  // ATUALIZADO: Chamar função para atualizar todos os totais no sistema
  if (typeof atualizarTodosOsTotais === 'function') {
    atualizarTodosOsTotais();
  }
}

// atualiza carrinho modal (mobile)
function atualizarCarrinhoModal() {
  if (!carrinhoModalItemsEl) return;
  carrinhoModalItemsEl.innerHTML = '';
  if (carrinho.length === 0) {
    carrinhoModalItemsEl.innerHTML = `<div class="carrinho-vazio"><i class="fas fa-shopping-cart"></i><p>Carrinho vazio</p></div>`;
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
      carrinhoModalItemsEl.appendChild(itemElement);
    });
  }

  const totalItensCount = carrinho.reduce((s, it) => s + it.quantidade, 0);
  const total = carrinho.reduce((s, it) => s + (it.preco * it.quantidade), 0);

  if (carrinhoModalCountEl) carrinhoModalCountEl.textContent = `(${totalItensCount} ${totalItensCount === 1 ? 'item' : 'itens'})`;
  if (subtotalModalEl) subtotalModalEl.textContent = `R$ ${total.toFixed(2)}`;
  if (totalVendaModalEl) totalVendaModalEl.textContent = `R$ ${total.toFixed(2)}`;

  atualizarBotaoCarrinhoFlutuante(totalItensCount, total);
}

// atualiza botão flutuante mobile
function atualizarBotaoCarrinhoFlutuante(totalItens, total) {
  if (carrinhoBadgeEl) {
    carrinhoBadgeEl.textContent = totalItens;
    carrinhoBadgeEl.style.display = totalItens > 0 ? 'flex' : 'none';
  }
  if (carrinhoTotalMobileEl) carrinhoTotalMobileEl.textContent = `R$ ${total.toFixed(2)}`;
}

// abrir e fechar modal mobile
function abrirCarrinhoMobile() {
  if (modalCarrinhoEl) {
    modalCarrinhoEl.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    atualizarCarrinhoModal();
  }
}

function fecharCarrinhoMobile() {
  if (modalCarrinhoEl) {
    modalCarrinhoEl.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// getters e setters
function getCarrinho() { return carrinho; }
function limparCarrinho() { carrinho = []; atualizarCarrinhoUI(); }

// EXPORTS
export {
  setCarrinhoElements,
  setMobileElements,
  adicionarAoCarrinho,
  removerDoCarrinho,
  alterarQuantidade,
  atualizarCarrinhoUI,
  abrirCarrinhoMobile,
  fecharCarrinhoMobile,
  getCarrinho,
  limparCarrinho
};