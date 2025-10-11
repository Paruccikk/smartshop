const express = require('express');
const router = express.Router(); // ✅ nada dentro dos parênteses
const cors = require('cors');
const bodyParser = require('body-parser');

const authRoutes = require('./routes/auth');
const produtosRoutes = require('./routes/produtos');
const vendasRoutes = require('./routes/vendas');
const relatoriosRoutes = require('./routes/relatorios');
const path = require('path');

const app = express();

// caso for publicar para produção 
// app.use(cors({
//  origin: 'https://www.seusite.com'
// }));

app.use(cors());
app.use(bodyParser.json());

// Servir arquivos estÃ¡ticos da pasta "public"
app.use(express.static('public'));

// Rotas da API
app.use('/auth', authRoutes);
app.use('/produtos', produtosRoutes);
app.use('/vendas', vendasRoutes);
app.use('/relatorios', relatoriosRoutes);
// Rota especÃ­fica para o menu.html
app.get('/menu.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});


// 🧪 TESTE: listar todas as rotas registradas
function listarRotas(app) {
  const rotas = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Rota direta
      rotas.push({
        method: Object.keys(middleware.route.methods)[0].toUpperCase(),
        path: middleware.route.path
      });
    } else if (middleware.name === 'router' && middleware.handle.stack) {
      // Rota dentro de um Router (ex: /auth)
      middleware.handle.stack.forEach((handler) => {
        const caminhoBase = middleware.regexp.toString()
          .replace(/^\/\^\\/, '/')
          .replace(/\\\/\?\(\?=\\\/\|\$\)\/i$/, '')
          .replace(/\\\//g, '/');
        const rota = {
          method: Object.keys(handler.route.methods)[0].toUpperCase(),
          path: caminhoBase + handler.route.path
        };
        rotas.push(rota);
      });
    }
  });

  console.log('\n🚦 ROTAS REGISTRADAS NO EXPRESS:');
  rotas.forEach(r => console.log(`➡️  ${r.method} ${r.path}`));
  console.log('\n');
}

listarRotas(app);


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
