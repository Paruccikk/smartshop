/**
 * Detecta se está rodando em WebView e aplica ajustes
 */
class WebViewDetector {
    constructor() {
        this.isWebView = this.checkWebView();
        this.init();
    }

    checkWebView() {
        const userAgent = navigator.userAgent.toLowerCase();
        return (
            /(android|iphone|ipad).*version\/[0-9].*safari|webview/.test(userAgent) ||
            /wv|webview/.test(userAgent) ||
            window.navigator.standalone ||
            document.referrer.includes('android-app://') ||
            this.isStandalone()
        );
    }

    isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    }

    init() {
        if (this.isWebView) {
            console.log('WebView detectado - Aplicando otimizações');
            this.applyWebViewOptimizations();
            this.disableUnwantedBehaviors();
        } else {
            console.log('Navegador normal detectado');
        }
    }

    applyWebViewOptimizations() {
        // Forçar viewport mobile
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no');
        }

        // Aplicar classes CSS para estilização específica
        document.documentElement.classList.add('webview-environment');
        document.body.classList.add('webview-body');
    }

    disableUnwantedBehaviors() {
        // Prevenir zoom com gestos
        document.addEventListener('gesturestart', (e) => e.preventDefault());
        document.addEventListener('gesturechange', (e) => e.preventDefault());
        document.addEventListener('gestureend', (e) => e.preventDefault());

        // Prevenir double tap zoom
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }

    // Método público para verificar status
    isWebViewEnvironment() {
        return this.isWebView;
    }
}

// Inicializar automaticamente
const webViewDetector = new WebViewDetector();