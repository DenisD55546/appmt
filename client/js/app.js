let tg = window.Telegram.WebApp;
let user = tg.initDataUnsafe?.user;
tg.BackButton.show();

const BOT_USERNAME = window.AppConfig?.BOT_USERNAME || 'FternStarsBot';

function vibrate(pattern = 1) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

let appState = {
    userData: null,
    bonusBalance: 0,
    starsBalance: 0,
    currentRate: 0
};

// Делаем appState и функции доступными глобально
window.appState = appState;
window.updateUI = updateUI;

let isProcessing = false;
const DEBOUNCE_DELAY = 500;

function smoothScrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function initApp() {
    tg.expand();
    tg.setHeaderColor('#1a1a1a');
    tg.setBackgroundColor('#0f0f0f');
    
    if (tg && tg.platform !== 'unknown') {
        tg.requestFullscreen?.();
        setTimeout(() => tg.expand(), 50);
    }
    
    // 1. Сначала инициализируем socket и данные пользователя
    initSocket(); 
    updateUI();
    setupBalanceListeners();
    
    // 2. Подождите немного чтобы socket подключился
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 3. Затем инициализируем главную страницу
    if (window.initHome) {
        await window.initHome();
    }
    
    // 4. Показываем главную страницу
    showSection('home');
    
    // 5. Остальная инициализация в фоне
    setTimeout(() => {
        createDepositModal();
        initTonConnect();
        initInventory();
        initProfileHistory();
        setupMarketListeners();
        
        // Инициализация модалки улучшения
        if (window.initUpgradeModal) {
            window.initUpgradeModal();
        }
        
        if (window.initReferralProgram) {
            window.initReferralProgram();
        }
        if (window.initMarket) {
            window.initMarket();
        }
        if (window.initGlobalHistory) {
            window.initGlobalHistory();
        }
    }, 100);
    
    // Пытаемся получить текущий баланс
    if (socket && socket.connected && user?.id) {
        socket.emit('register_user', { userId: user.id });
    }

    // После небольшой задержки, если socket еще не подключился
    setTimeout(() => {
        if (user?.id && (!socket || !socket.connected)) {
            console.log('⚠️ Socket not connected, manual registration needed');
        }
    }, 2000);
}

function setupMarketListeners() {
    if (window.socket) {
        window.socket.on('market_updated', () => {
            console.log('🔄 Обновление маркета - перезагрузка данных');

            // Перезагружаем маркет
            if (window.loadMarketItems) {
                window.loadMarketItems();
            }

            // Также перезагружаем инвентарь чтобы обновить статус "На продаже"
            if (window.loadInventoryItems && document.getElementById('profile')?.classList.contains('active')) {
                window.loadInventoryItems();
            }
        });

        window.socket.on('balance_updated', (data) => {
            if (data.userId === window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
                window.appState.starsBalance = data.newBalance;
                updateStarsBalance();
                updateMarketBalance();
            }
        });
    }
}

function createDefaultUserData() {
    return {
        id: user?.id || 'Unknown',
        username: user?.username || 'Не установлен',
        bonusBalance: 0,
        referralCount: 0,
        referrals: [],
        referralLink: `${window.AppConfig?.BOT_URL}`,
        purchaseStats: {},
        starsBalance: 0
    };
}

function updateUI() {
    const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
    const displayId = tgUser?.id || appState.userData?.id || 'Unknown';
    const displayUsername = tgUser?.username || appState.userData?.username || 'Не установлен';
    
    
    updateElementText('profileId', `ID: ${displayId}`);
    document.getElementById('profileId').onclick = copyUserId;
    document.getElementById('profileId').style.cursor = 'pointer';
    updateElementText('profileUsername', `@${displayUsername}`);
    
    const avatarImg = document.getElementById('userAvatar');
    const avatarFallback = document.getElementById('avatarFallback');
    
    if (tgUser?.photo_url && avatarImg) {
        avatarImg.src = tgUser.photo_url;
        avatarImg.style.display = 'block';
        avatarFallback.style.display = 'none';
    }
    
    if (appState.userData) {
        updateElementText('referralsCount', appState.userData.referrals_count || 0);
        updateElementText('earnedBonuses', `${formatNumber(appState.userData.bonusBalance || 0)} ⭐`);
        
        updateStarsBalance();
        
        const referralLink = document.getElementById('referralLink');
        if (referralLink) referralLink.value = appState.userData.referralLink;
        
        appState.bonusBalance = appState.userData.bonusBalance || 0;
    }
}

function copyUserId() {
    const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
    const userId = tgUser?.id || 'Unknown';
    
    navigator.clipboard.writeText(userId.toString())
        .then(() => window.tg?.showPopup({title: 'Скопировано', message: `ID ${userId} скопирован`}))
        .catch(() => {
            // Fallback для старых браузеров
            const input = document.createElement('input');
            input.value = userId;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            window.tg?.showPopup({title: 'Скопировано', message: `ID ${userId} скопирован`});
        });
    
    if (window.vibrate) window.vibrate(1);
}

function updateRateDisplay() {
    const currentRateElement = document.getElementById('currentRate');
    const profileRateElement = document.getElementById('profileRate');
    
    if (currentRateElement) {
        currentRateElement.textContent = formatNumber(appState.currentRate);
    }
    if (profileRateElement) {
        profileRateElement.textContent = formatNumber(appState.currentRate);
    }
}

function updateStarsBalance() {
    const balance = appState.starsBalance || 0;
    const balanceText = balance.toLocaleString();
    
    // Обновляем все возможные места отображения баланса
    const balanceElements = [
        'headerBalance',
        'marketBalance', 
        'profileBalance',
        'starsBalance'
    ];
    
    balanceElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = balanceText;
        }
    });
    
    // Также обновляем userData
    if (appState.userData) {
        appState.userData.starsBalance = balance;
    }
}

// ===== ФУНКЦИИ ДЛЯ МОДАЛЬНОГО ОКНА БАЛАНСА =====

let currentCurrency = 'stars'; // 'stars' или 'ton'

// Открытие модального окна баланса
function openBalanceModal() {
    // Скрываем все секции
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Показываем модальное окно баланса
    const balanceModal = document.getElementById('balanceModal');
    if (balanceModal) {
        balanceModal.classList.add('active');
    }
    
    // Показываем кнопку "Назад" в Telegram
    if (tg && tg.BackButton) {
        tg.BackButton.show();
        tg.BackButton.offClick(closeBalanceModal); // Убираем старый
        tg.BackButton.onClick(closeBalanceModal); // Добавляем новый
    }
    
    // Обновляем данные в модальном окне
    updateBalanceModal();
    
    // Вибрация
    vibrate(1);
}

// Закрытие модального окна баланса
function closeBalanceModal() {
    const balanceModal = document.getElementById('balanceModal');
    if (balanceModal) {
        balanceModal.classList.remove('active');
    }
    
    // Если есть открытое окно пополнения, закрываем его
    const depositModal = document.getElementById('depositModal');
    if (depositModal && depositModal.classList.contains('active')) {
        depositModal.classList.remove('active');
    }
    
    showSection('profile');
    vibrate(1);
}

// Обновление данных в модальном окне баланса
function updateBalanceModal() {
    const balanceAmount = document.getElementById('balanceAmount');
    const balanceLabel = document.getElementById('balanceText'); // исправлено: balanceText вместо balanceLabel
    
    if (!balanceAmount || !balanceLabel) return;
    
    if (currentCurrency === 'stars') {
        // Отображаем звезды
        const starsBalance = appState.starsBalance || 0;
        balanceAmount.textContent = starsBalance.toLocaleString();
        balanceLabel.textContent = 'на вашем счету';
    } else {
        // Отображаем TON (нужно будет добавить логику получения баланса TON)
        const tonBalance = 0; // Замените на реальный баланс TON
        balanceAmount.textContent = tonBalance.toFixed(2);
        balanceLabel.textContent = 'TON на счету';
    }
}

// Переключение валюты
function switchCurrency(currency) {
    currentCurrency = currency;
    
    // Обновляем активные кнопки
    const starsBtn = document.getElementById('starsCurrencyBtn');
    const tonBtn = document.getElementById('tonCurrencyBtn');
    
    if (starsBtn && tonBtn) {
        starsBtn.classList.toggle('active', currency === 'stars');
        tonBtn.classList.toggle('active', currency === 'ton');
    }
    
    // Обновляем отображение баланса
    updateBalanceModal();
    
    // Вибрация
    vibrate([3, 5, 3]);
}

// Пополнение баланса
function depositFunds() {
    openDepositModal();
    
    vibrate([3, 5, 3]);
}

function updateElementText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}

function formatNumber(num) {
    if (typeof num !== 'number') num = parseFloat(num) || 0;
    const rounded = Math.round(num * 10000) / 10000;
    let formatted = rounded.toString();
    
    if (formatted.includes('.')) formatted = formatted.replace(/\.?0+$/, '');
    if (formatted.endsWith('.')) formatted = formatted.slice(0, -1);
    
    return formatted === '' ? '0' : formatted;
}

function showSection(sectionId) {
    const currentActiveSection = document.querySelector('.section.active');
    if (currentActiveSection && currentActiveSection.id === sectionId) {
        vibrate(1);
        return;
    }
    
    const sections = ['home', 'profile', 'history', 'referral', 'market', 'balanceModal']; 
    
    // Скрыть все секции
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (section) section.classList.remove('active');
    });
    
    // Показать нужную секцию
    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.add('active');
    
    // ВСЕГДА обновляем навигацию при смене секции
    updateNavigation(sectionId);
    
    // УПРАВЛЕНИЕ КНОПКОЙ "НАЗАД"
    if (tg && tg.BackButton) {
        if (sectionId === 'profile' || sectionId === 'market' || sectionId === 'home') {
            tg.BackButton.hide();
        } else if (sectionId === 'balanceModal') {
            tg.BackButton.show();
            tg.BackButton.onClick(closeBalanceModal);
        } else if (sectionId === 'referral') {
            tg.BackButton.show();
            tg.BackButton.onClick(closeReferralModal);
        } else {
            tg.BackButton.hide();
        }
    }
    
    // Загружаем данные в зависимости от секции
    if (sectionId === 'profile' && window.loadInventoryItems) {
        window.loadInventoryItems();
    } else if (sectionId === 'market' && window.loadMarketItems) {
        window.loadMarketItems();
    } else if (sectionId === 'history' && window.loadGlobalSalesHistory) {
        window.loadGlobalSalesHistory();
    } else if (sectionId === 'home' && window.initHome) {
        window.initHome();
    }
    
    vibrate(1);
}

function updateNavigation(sectionId) {
    const navItems = document.querySelectorAll('.nav-item');
    const sectionMap = {
        'home': 0,
        'market': 1,
        'profile': 2,
        'history': 3
    };
    
    navItems.forEach((item, index) => {
        item.classList.remove('active');
    });
    
    // Подсвечиваем только основные секции (не модальные)
    if (sectionMap.hasOwnProperty(sectionId)) {
        const navIndex = sectionMap[sectionId];
        if (navItems[navIndex]) {
            navItems[navIndex].classList.add('active');
        }
    }
}

// Добавляем функцию обновления баланса в маркете
function updateMarketBalance() {
    const marketBalanceElement = document.getElementById('marketBalance');
    if (marketBalanceElement) {
        marketBalanceElement.textContent = (appState.starsBalance || 0).toLocaleString();
    }
}

function copyReferralLink() {
    const linkInput = document.getElementById('referralLink');
    if (linkInput) {
        linkInput.select();
        document.execCommand('copy');
        vibrate([3, 5, 3]);
    }
}

function showSuccess(message) { 
    tg.showPopup({title: 'Успех', message: message}); 
}

function showError(message) { 
    tg.showPopup({title: 'Ошибка', message: message}); 
}

async function shareReferralLink() {
    try {
        const user = window.Telegram.WebApp.initDataUnsafe?.user;
        if (!user) {
            showError('Данные пользователя не загружены');
            return;
        }
        const botUrl = window.AppConfig?.BOT_URL;
        const referralLink = `${botUrl}/market?startapp=${user.id}`;
        const messageText = '🎉 Лучший бот уникальными M-NFT, мгновенная выдача, щедрая реферальная программа!';
        
        if (window.Telegram && window.Telegram.WebApp) {
            if (window.Telegram.WebApp.shareUrl) {
                window.Telegram.WebApp.shareUrl(messageText, referralLink);
            } else if (window.Telegram.WebApp.openLink) {
                const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(messageText)}`;
                window.Telegram.WebApp.openLink(shareUrl);
            } 
        }
        
        vibrate([5, 3, 5]);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

function formatTransactionDate(dateString) {
    if (!dateString) return 'Дата неизвестна';
    
    try {
        const date = new Date(dateString);
        
        if (isNaN(date.getTime())) {
            return dateString;
        }
        
        // Форматируем дату: день.месяц.год
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric'
        });
        
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setTimeout(() => {
        if (window.initInventory) {
            window.initInventory();
        }
    }, 500);
    // Инициализация маркета
    if (window.initMarket) {
        window.initMarket();
    }
});

window.openBalanceModal = openBalanceModal;
window.closeBalanceModal = closeBalanceModal;
window.depositFunds = depositFunds;
window.copyUserId = copyUserId;
window.updateNavigation = updateNavigation;