import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, update, push, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const form = document.getElementById('formPerfil');
const mensagem = document.getElementById('mensagem');

let currentUser;
let userData;
let lojasDoUsuario = {};

const listaLojasEl = document.getElementById('listaLojas');
const btnNovaLoja = document.getElementById('btnNovaLoja');
const modalNovaLoja = document.getElementById('modalNovaLoja');
const fecharNovaLoja = document.getElementById('fecharNovaLoja');
const nomeNovaLojaInput = document.getElementById('nomeNovaLoja');
const btnSalvarNovaLoja = document.getElementById('btnSalvarNovaLoja');

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await carregarDados(user);
  } else {
    mensagem.textContent = 'Usuário não autenticado. Faça login novamente.';
    mensagem.style.color = 'red';
    setTimeout(() => window.location.href = '/login.html', 3000);
  }
});

async function carregarDados(user) {
  try {
    const lojaRef = ref(db, `users/${user.uid}`);
    const snapshot = await get(lojaRef);
    if (!snapshot.exists()) return;

    userData = snapshot.val();
    lojasDoUsuario = userData.lojas || {};

    form.nomeLoja.value = userData.nomeLoja || '';
    form.telefone.value = userData.telefone || '';
    form.email.value = user.email || '';

    renderLojas();
  } catch (err) {
    mensagem.textContent = 'Erro ao carregar dados: ' + err.message;
    mensagem.style.color = 'red';
  }
}

// Renderiza lista de lojas do usuário
function renderLojas() {
  listaLojasEl.innerHTML = '';
  Object.keys(lojasDoUsuario).forEach(lojaId => {
    const li = document.createElement('li');
    li.textContent = lojasDoUsuario[lojaId].nomeLoja || lojaId;
    li.dataset.id = lojaId;
    li.classList.add('loja-item');
    li.addEventListener('click', () => selecionarLoja(lojaId));
    listaLojasEl.appendChild(li);
  });
}

// Seleciona loja ativa e salva no localStorage
function selecionarLoja(lojaId) {
  localStorage.setItem('lojaAtiva', lojaId);
  alert('Loja selecionada: ' + lojasDoUsuario[lojaId].nomeLoja);
}

// --- Modal Nova Loja ---
btnNovaLoja.addEventListener('click', () => {
  if (!userData.admin) return alert('Somente administradores podem criar novas lojas.');
  modalNovaLoja.style.display = 'flex';
});

fecharNovaLoja.addEventListener('click', () => modalNovaLoja.style.display = 'none');

btnSalvarNovaLoja.addEventListener('click', async () => {
  const nomeNovaLoja = nomeNovaLojaInput.value.trim();
  if (!nomeNovaLoja) return alert('Digite o nome da loja');

  // Cria loja no Firebase
  const novaLojaRef = push(ref(db, 'lojas'));
  await set(novaLojaRef, { nomeLoja: nomeNovaLoja, produtos: {}, vendas: {} });

  // Adiciona loja ao usuário
  if (!userData.lojas) userData.lojas = {};
  userData.lojas[novaLojaRef.key] = { nomeLoja: nomeNovaLoja };
  await update(ref(db, `users/${currentUser.uid}/lojas`), userData.lojas);

  // Atualiza lista e fecha modal
  renderLojas();
  modalNovaLoja.style.display = 'none';
  nomeNovaLojaInput.value = '';
  alert('Loja criada com sucesso!');
});

// --- Atualização de perfil ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  mensagem.textContent = '';

  if (!currentUser) return;

  let senhaAtual = prompt('Por favor, insira sua senha atual para confirmar alterações de email ou senha:');
  if (!senhaAtual) return alert('Senha atual é necessária para alterar email ou senha.');

  const credential = EmailAuthProvider.credential(currentUser.email, senhaAtual);
  try {
    await reauthenticateWithCredential(currentUser, credential);

    const novoEmail = form.email.value.trim();
    if (novoEmail !== currentUser.email) await updateEmail(currentUser, novoEmail);

    const novaSenha = form.senha.value.trim();
    if (novaSenha.length >= 6) await updatePassword(currentUser, novaSenha);

    await update(ref(db, `users/${currentUser.uid}`), {
      nomeLoja: form.nomeLoja.value.trim(),
      telefone: form.telefone.value.trim(),
    });

    mensagem.textContent = 'Perfil atualizado com sucesso!';
    mensagem.style.color = 'green';
  } catch (err) {
    mensagem.textContent = 'Erro ao atualizar perfil: ' + err.message;
    mensagem.style.color = 'red';
  }
});
