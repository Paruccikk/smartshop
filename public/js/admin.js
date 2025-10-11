import { db } from './firebase-config.js';
import { ref, get, update, remove, set, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const tabelaUsuarios = document.querySelector('#tabelaUsuarios tbody');
const tabelaLojas = document.querySelector('#tabelaLojas tbody');
const modal = document.getElementById('modalEditar');
const btnFechar = document.getElementById('fecharModal');
const btnAdicionar = document.getElementById('btnAdicionar');
const btnSalvar = document.getElementById('salvarEdicao');
const campoPesquisa = document.getElementById('pesquisa');

const filtroUsuariosPendentes = document.getElementById('filtroUsuariosPendentes');
const filtroLojasPendentes = document.getElementById('filtroLojasPendentes');
const filtroTodos = document.getElementById('filtroTodos');

let usuarios = [];
let lojas = [];
let usuarioEditando = null;

// Carregar usuários e lojas
async function carregarDados() {
  const snapUsers = await get(ref(db, 'users'));
  usuarios = snapUsers.exists() ? Object.entries(snapUsers.val()).map(([id, u]) => ({id, ...u})) : [];

  const snapLojas = await get(ref(db, 'lojas'));
  lojas = snapLojas.exists() ? Object.entries(snapLojas.val()).map(([id, l]) => ({id, ...l})) : [];

  renderUsuarios();
  renderLojasPendentes();
}

// Renderizar tabela de usuários
function renderUsuarios(filtrarPendentes = false) {
  tabelaUsuarios.innerHTML = '';
  let lista = [...usuarios];
  if (filtrarPendentes) lista = lista.filter(u => !u.aprovado);

  lista.forEach(u => {
    tabelaUsuarios.innerHTML += `
      <tr>
        <td>${u.nomeLoja || '-'}</td>
        <td>${u.email || '-'}</td>
        <td>${u.telefone || '-'}</td>
        <td>—</td>
        <td>${u.aprovado ? '✅' : '❌'}</td>
        <td>${u.admin ? '👑' : '—'}</td>
        <td>${new Date(u.createdAt || 0).toLocaleDateString('pt-BR')}</td>
        <td>
          <button class="btn-editar" onclick="editarUsuario('${u.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn-reset" onclick="resetarSenha('${u.id}')"><i class="fas fa-key"></i></button>
          <button class="btn-excluir" onclick="excluirUsuario('${u.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
  });
}

// Renderizar lojas pendentes
function renderLojasPendentes() {
  tabelaLojas.innerHTML = '';
  const pendentes = lojas.filter(l => !l.aprovada);
  pendentes.forEach(l => {
    tabelaLojas.innerHTML += `
      <tr>
        <td>${l.nomeLoja}</td>
        <td>${l.proprietario || '-'}</td>
        <td>${l.telefone || '-'}</td>
        <td>${new Date(l.createdAt || 0).toLocaleDateString('pt-BR')}</td>
        <td>
          <button class="btn-primary" onclick="aprovarLoja('${l.id}')">Aprovar</button>
          <button class="btn-danger" onclick="reprovarLoja('${l.id}')">Reprovar</button>
        </td>
      </tr>
    `;
  });
}

// Aprovar ou reprovar lojas
window.aprovarLoja = async (id) => {
  await update(ref(db, `lojas/${id}`), { aprovada: true });
  alert('Loja aprovada!');
  carregarDados();
};

window.reprovarLoja = async (id) => {
  if (!confirm("Deseja realmente reprovar esta loja?")) return;
  await remove(ref(db, `lojas/${id}`));
  alert('Loja removida!');
  carregarDados();
};

// Filtros rápidos
filtroUsuariosPendentes.addEventListener('click', () => renderUsuarios(true));
filtroLojasPendentes.addEventListener('click', () => renderLojasPendentes());
filtroTodos.addEventListener('click', () => {
  renderUsuarios();
  renderLojasPendentes();
});

// Pesquisa
campoPesquisa.addEventListener('input', (e) => {
  const termo = e.target.value.toLowerCase();
  tabelaUsuarios.innerHTML = '';
  usuarios.filter(u =>
    (u.nomeLoja || '').toLowerCase().includes(termo) ||
    (u.email || '').toLowerCase().includes(termo) ||
    (u.telefone || '').toLowerCase().includes(termo)
  ).forEach(u => {
    tabelaUsuarios.innerHTML += `
      <tr>
        <td>${u.nomeLoja || '-'}</td>
        <td>${u.email || '-'}</td>
        <td>${u.telefone || '-'}</td>
        <td>—</td>
        <td>${u.aprovado ? '✅' : '❌'}</td>
        <td>${u.admin ? '👑' : '—'}</td>
        <td>${new Date(u.createdAt || 0).toLocaleDateString('pt-BR')}</td>
        <td>
          <button class="btn-editar" onclick="editarUsuario('${u.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn-reset" onclick="resetarSenha('${u.id}')"><i class="fas fa-key"></i></button>
          <button class="btn-excluir" onclick="excluirUsuario('${u.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
  });
});

// Modal e funções de edição (mantidas do seu admin.js original)
window.editarUsuario = async (id) => {
  const snap = await get(ref(db, 'users/' + id));
  if (!snap.exists()) return alert("Usuário não encontrado!");
  const user = snap.val();

  usuarioEditando = id;
  document.getElementById('editNomeLoja').value = user.nomeLoja || '';
  document.getElementById('editEmail').value = user.email || '';
  document.getElementById('editTelefone').value = user.telefone || '';
  document.getElementById('editAprovado').value = user.aprovado ? 'true' : 'false';
  document.getElementById('editAdmin').value = user.admin ? 'true' : 'false';
  modal.style.display = 'flex';
};

btnFechar.onclick = () => modal.style.display = 'none';

btnSalvar.onclick = async () => {
  if (!usuarioEditando) return;
  const nomeLoja = document.getElementById('editNomeLoja').value;
  const email = document.getElementById('editEmail').value;
  const telefone = document.getElementById('editTelefone').value;
  const aprovado = document.getElementById('editAprovado').value === 'true';
  const admin = document.getElementById('editAdmin').value === 'true';

  await update(ref(db, 'users/' + usuarioEditando), { nomeLoja, email, telefone, aprovado, admin });

  alert("Alterações salvas!");
  modal.style.display = 'none';
  carregarDados();
};

// Funções adicionais de reset e excluir (mantidas)
window.excluirUsuario = async (id) => {
  if (confirm("Deseja realmente excluir este usuário?")) {
    await remove(ref(db, 'users/' + id));
    alert("Usuário excluído.");
    carregarDados();
  }
};

window.resetarSenha = async (id) => {
  const nova = prompt("Digite a nova senha para este usuário:");
  if (!nova) return;
  await update(ref(db, 'users/' + id), { senha: nova });
  alert("Senha redefinida!");
};

// Adicionar usuário
btnAdicionar.onclick = async () => {
  const email = prompt("Email do novo usuário:");
  if (!email) return;
  const nomeLoja = prompt("Nome da loja:");
  if (!nomeLoja) return;
  const telefone = prompt("Telefone para contato:") || '';

  const novoRef = push(ref(db, 'users'));
  await set(novoRef, { email, nomeLoja, telefone, aprovado: false, admin: false, createdAt: Date.now() });

  alert("Usuário adicionado!");
  carregarDados();
};

// Inicializar
carregarDados();
