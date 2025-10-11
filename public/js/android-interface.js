/**
 Interface para comunicação com Android WebView
 */
class AndroidInterface {
    constructor() {
        this.interfaceName = 'AndroidInterface';
        this.setupInterface();
    }

    setupInterface() {
        // Criar interface global que o Android pode acessar
        window[this.interfaceName] = {
            // App chama isso para enviar dados para o web
            sendToWeb: (data) => this.receiveFromApp(data),
            
            // App pode verificar se a interface está pronta
            isReady: () => true,
            
            // Para o app pedir informações
            getAppInfo: () => this.getAppInfo(),
            
            // App pode forçar fullscreen
            requestFullscreen: () => fullscreenHelper.enterFullscreen(),

            // App pode fechar
            exitApp: () => this.exitApp()
        };

        console.log('Android Interface ready');
    }

    receiveFromApp(data) {
        try {
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            console.log('Received from Android:', parsedData);
            
            // Disparar evento customizado
            const event = new CustomEvent('androidMessage', { detail: parsedData });
            window.dispatchEvent(event);
            
            this.handleAppMessage(parsedData);
        } catch (e) {
            console.error('Error parsing data from Android:', e);
        }
    }

    handleAppMessage(data) {
        // Processar mensagens específicas do app
        switch (data.action) {
            case 'showToast':
                this.showToast(data.message);
                break;
            case 'setTheme':
                this.setTheme(data.theme);
                break;
            case 'goBack':
                fullscreenHelper.handleBackButton();
                break;
            default:
                console.log('Unknown action:', data.action);
        }
    }

    // Enviar dados para o Android
    sendToApp(data) {
        if (window.Android && typeof Android.receiveFromWeb === 'function') {
            // Se o app injetou o objeto Android
            Android.receiveFromWeb(JSON.stringify(data));
        } else if (window.chrome && chrome.webview) {
            // Para WebView moderno
            chrome.webview.postMessage(data);
        } else {
            console.log('Send to Android:', data);
            // Fallback - o app pode monitorar console
        }
    }

    showToast(message) {
        // Criar toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 50px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            z-index: 10000;
            font-size: 14px;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 3000);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    getAppInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };
    }

    exitApp() {
        if (confirm('Deseja realmente sair do aplicativo?')) {
            this.sendToApp({ action: 'exitApp' });
        }
    }
}