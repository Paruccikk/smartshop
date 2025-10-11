/**
 * Arquivo principal que inicializa tudo
 */
class AppMain {
    constructor() {
        this.init();
    }

    init() {
        // Aguardar DOM carregar
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        console.log('Initializing WebView App...');
        
        // Inicializar componentes
        this.webViewDetector = webViewDetector;
        this.fullscreenHelper = new FullscreenHelper();
        this.androidInterface = new AndroidInterface();

        // Aplicar configurações finais
        this.applyFinalConfig();
        this.setupEventListeners();
        
        console.log('WebView App initialized successfully');
    }

    applyFinalConfig() {
        // Garantir que o body ocupe toda a tela
        document.body.style.height = '100vh';
        document.body.style.overflow = 'hidden';

        // Adicionar loading state
        document.body.classList.add('app-loaded');

        // Remover qualquer outline em focos (melhor para touch)
        const style = document.createElement('style');
        style.textContent = `
            .app-loaded *:focus {
                outline: none !important;
            }
            .webview-environment {
                touch-action: pan-x pan-y;
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        // Configurar botão voltar
        this.fullscreenHelper.setupBackButton(() => {
            this.handleBackButton();
        });

        // Listen for Android messages
        window.addEventListener('androidMessage', (e) => {
            this.onAndroidMessage(e.detail);
        });

        // Prevenir context menu longo (como se fosse app nativo)
        document.addEventListener('contextmenu', (e) => {
            if (this.webViewDetector.isWebViewEnvironment()) {
                e.preventDefault();
            }
        });
    }

    handleBackButton() {
        // Lógica customizada do botão voltar
        const currentPage = this.getCurrentPage();
        
        if (currentPage === 'home') {
            this.androidInterface.exitApp();
        } else {
            history.back();
        }
    }

    getCurrentPage() {
        // Implementar lógica para detectar página atual
        const path = window.location.pathname;
        if (path === '/' || path.includes('index')) return 'home';
        if (path.includes('details')) return 'details';
        return 'other';
    }

    onAndroidMessage(data) {
        console.log('Android message received:', data);
        // Implementar ações específicas do seu app
    }

    // Método público para mostrar loading
    showLoading() {
        document.body.classList.add('loading');
    }

    hideLoading() {
        document.body.classList.remove('loading');
    }
}

// Inicializar a aplicação
const appMain = new AppMain();