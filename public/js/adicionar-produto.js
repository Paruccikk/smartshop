import Quagga from 'https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js';
import { db } from './firebase-config.js';
import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const form = document.getElementById('formProduto');
const mensagem = document.getElementById('mensagem');
const btnScan = document.getElementById('btnScan');
const scannerContainer = document.getElementById('scanner-container');
const videoElement = document.getElementById('video');
const btnCloseScanner = document.getElementById('btnCloseScanner');
const inputCodigo = document.getElementById('codigoBarras');

const selectCategoria = document.getElementById('categoria');
const inputNovaCategoria = document.getElementById('novaCategoria');

const lojaId = localStorage.getItem('lojaId');

// --- helpers de categoria (slug + salvar persistente) ---
function slugify(text) {
  return text.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
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

// --- carregar categorias do Realtime DB (fallback para endpoint HTTP se quiser) ---
async function carregarCategorias() {
  // limpa primeiro
  if (!selectCategoria) return;
  selectCategoria.innerHTML = '<option value="">-- Selecionar categoria --</option>';

  try {
    if (!lojaId) return;
    // tenta carregar do Realtime DB
    const snap = await get(ref(db, `lojas/${lojaId}/categorias`));
    let cats = [];
    if (snap.exists()) {
      const obj = snap.val();
      cats = Object.values(obj).map(c => c.name).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
    }

    // fallback: tenta endpoint HTTP (compatibilidade com seu backend antigo)
    if ((!cats || cats.length === 0) && typeof fetch === 'function') {
      try {
        const res = await fetch(`/categorias?lojaId=${encodeURIComponent(lojaId)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            cats = data.map(c => (typeof c === 'string' ? c : (c.name || c.nome || ''))).filter(Boolean);
          }
        }
      } catch (err) {
        // ignora
      }
    }

    // popula select
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      selectCategoria.appendChild(opt);
    });
    // garante estado UX (se o input nova preenchido, select fica disabled)
    updateCategoriaInputsUX();
  } catch (err) {
    console.warn('Erro ao carregar categorias:', err);
  }
}

// Scanner (mesma lógica)
btnScan.onclick = () => {
  scannerContainer.style.display = 'block';

  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: videoElement,
      constraints: { facingMode: "environment" },
    },
    decoder: { readers: ["code_128_reader", "ean_reader", "ean_8_reader", "upc_reader"] },
    locate: true,
  }, function(err) {
    if (err) {
      console.error(err);
      alert('Erro ao iniciar a câmera para leitura de código.');
      scannerContainer.style.display = 'none';
      return;
    }
    Quagga.start();
  });

  Quagga.onDetected(result => {
    const code = result.codeResult.code;
    inputCodigo.value = code;
    try { Quagga.stop(); } catch (e) {}
    scannerContainer.style.display = 'none';
  });
};

btnCloseScanner.onclick = () => {
  try { Quagga.stop(); } catch (e) {}
  scannerContainer.style.display = 'none';
};

// UX: quando digita nova categoria, desabilita select; quando seleciona select, limpa input nova
function updateCategoriaInputsUX() {
  if (!selectCategoria || !inputNovaCategoria) return;
  selectCategoria.disabled = !!inputNovaCategoria.value.trim();
  // se select preenchido, limpa campo nova
  if (selectCategoria.value) inputNovaCategoria.value = '';
}
if (inputNovaCategoria) {
  inputNovaCategoria.addEventListener('input', updateCategoriaInputsUX);
}
if (selectCategoria) {
  selectCategoria.addEventListener('change', updateCategoriaInputsUX);
}

// carregar categorias ao iniciar
document.addEventListener('DOMContentLoaded', () => {
  carregarCategorias();
});

// submit do formulário
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  mensagem.textContent = '';

  if (!lojaId) {
    mensagem.style.color = 'red';
    mensagem.textContent = 'Loja não encontrada. Por favor, faça login novamente.';
    return;
  }

  const categoriaEscolhida = (inputNovaCategoria && inputNovaCategoria.value.trim()) ? inputNovaCategoria.value.trim() : (selectCategoria ? selectCategoria.value : '') ;
  const categoriaFinal = categoriaEscolhida || 'Sem categoria';

  const produto = {
    nome: e.target.nome.value.trim(),
    valor: parseFloat(e.target.valor.value),
    validade: e.target.validade.value || null,
    codigoBarras: e.target.codigoBarras.value.trim() || null,
    quantidade: parseInt(e.target.quantidade.value, 10) || 0,
    estoqueMinimo: parseInt(e.target.estoqueMinimo.value, 10) || 0,
    lojaId,
    categoria: categoriaFinal
  };

  try {
    const res = await fetch('/produtos/adicionar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lojaId, produto })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(()=>({}));
      throw new Error(errorData.error || 'Erro ao adicionar produto');
    }

    // salva categoria como persistente no DB (caso precise)
    try { await salvarCategoriaPersistente(categoriaFinal); } catch (err) { console.warn(err); }

    mensagem.style.color = 'green';
    mensagem.textContent = 'Produto adicionado com sucesso!';
    form.reset();

    // recarrega categorias (agora teremos a categoria recém-criada)
    setTimeout(() => carregarCategorias(), 300);
  } catch (err) {
    mensagem.style.color = 'red';
    mensagem.textContent = err.message;
  }
});
