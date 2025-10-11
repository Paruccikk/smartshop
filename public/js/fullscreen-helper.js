/**
 * Auxiliar para modo tela cheia e controles de UI
 */
class FullscreenHelper {
    constructor() {
        this.isFullscreen = false;
        this.init();
    }

    init() {
        this.hideAddressBar();
        this.setupFullscreenListeners();
        this.lockOrientation();
    }

    hideAddressBar() {
        // Esconder barra de endereço em mobile
        window.addEventListener('load', () => {
            setTimeout(() => {
                window.scrollTo(0, 1);
            }, 100);
        });

        // Prevenir scroll para mostrar barra de endereço
        window.addEventListener('scroll', () => {
            window.scrollTo(0, 1);
        });
    }

    setupFullscreenListeners() {
        // Tentar entrar em fullscreen automaticamente
        document.addEventListener('click', () => {
            this.enterFullscreen();
        });

        // Também tentar no load
        window.addEventListener('load', () => {
            setTimeout(() => this.enterFullscreen(), 500);
        });
    }

    enterFullscreen() {
        const docEl = document.documentElement;
        
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(e => console.log('Fullscreen error:', e));
        } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
            docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
            docEl.msRequestFullscreen();
        }
        
        this.isFullscreen = true;
    }

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        
        this.isFullscreen = false;
    }

    lockOrientation() {
        // Tentar travar orientação (funciona em alguns WebViews)
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('portrait').catch(e => {
                console.log('Orientation lock not supported:', e);
            });
        }
    }

    // Para o botão voltar do Android
    setupBackButton(handler) {
        window.addEventListener('popstate', (e) => {
            if (webViewDetector.isWebViewEnvironment()) {
                e.preventDefault();
                if (handler && typeof handler === 'function') {
                    handler();
                } else {
                    this.handleBackButton();
                }
            }
        });
    }

    handleBackButton() {
        // Comportamento padrão do botão voltar
        if (history.length > 1) {
            history.back();
        } else {
            // Última página - pedir confirmação para sair
            if (confirm('Deseja sair do aplicativo?')) {
                if (window.AndroidInterface && typeof AndroidInterface.exitApp === 'function') {
                    AndroidInterface.exitApp();
                } else {
                    navigator.app.exitApp();
                }
            }
        }
    }
}