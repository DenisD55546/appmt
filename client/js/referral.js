let referralData = {
    referrals: [],
    totalEarned: 0,
    totalReferrals: 0,
    referralLink: ''
};

// Инициализация реферальной программы
function initReferralProgram() {
    updateReferralData();
    setupModalEvents();
    
    // Подписываемся на ответ с рефералами
    if (window.socket) {
        window.socket.on('referrals_list', (data) => {
            if (data.success) {
                renderReferralsList(data.referrals);
                
                // ОБНОВЛЯЕМ СТАТИСТИКУ ПОСЛЕ ПОЛУЧЕНИЯ ДАННЫХ
                updateReferralStatsAfterLoad(data.referrals);
            }
        });
    }
}

// Новая функция для обновления статистики после загрузки
function updateReferralStatsAfterLoad(referrals) {
    if (!referrals) return;
    
    // Обновляем количество рефералов
    referralData.totalReferrals = referrals.length;
    
    // Рассчитываем общий доход от рефералов
    const totalEarnedFromReferrals = referrals.reduce((sum, ref) => {
        return sum + (ref.earned || 0);
    }, 0);
    
    // Обновляем данные в объекте
    referralData.totalEarned = totalEarnedFromReferrals;
    
    // Обновляем UI
    updateReferralStats();
    
    console.log(`📊 Updated stats: ${referrals.length} referrals, ${totalEarnedFromReferrals} stars earned`);
}

// Обновление данных рефералов
function updateReferralData() {
    const user = window.Telegram.WebApp.initDataUnsafe?.user;
    if (!user) return;
    
    // Устанавливаем реферальную ссылку
    const botUsername = window.AppConfig?.BOT_USERNAME;
    referralData.referralLink = `https://t.me/${botUsername}/market?startapp=${user.id}`;
    
    // Обновляем ссылку в модальном окне
    const referralLinkInput = document.getElementById('referralLinkModal');
    if (referralLinkInput) {
        referralLinkInput.value = referralData.referralLink;
    }
    
    // Загружаем список рефералов - статистика обновится после получения данных
    loadReferralsList();
}

// Обновление статистики в модальном окне
function updateReferralStats() {
    const elements = {
        referralsCountModal: referralData.totalReferrals,
        earnedBonusesModal: `${formatNumber(referralData.totalEarned)} ⭐`,
        referralsCountBadge: referralData.totalReferrals
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

// Открытие модального окна
function openReferralModal() {
    showSection('referral');
    vibrate(1);
}

// Закрытие реферальной программы 
function closeReferralModal() {
    showSection('profile');
    vibrate(1);
}

// Настройка обработчиков событий для модального окна
function setupModalEvents() {
    const modal = document.getElementById('referralModal');
    if (!modal) return;
    
    // Закрытие при клике вне окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeReferralModal();
        }
    });
    
    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeReferralModal();
        }
    });
}

// Копирование реферальной ссылки
function copyReferralLinkModal() {
    const linkInput = document.getElementById('referralLinkModal');
    if (!linkInput) return;
    
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // Для мобильных устройств
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate([3, 5, 3]);
    }
}

// Поделиться реферальной ссылкой
function shareReferralLinkModal() {
    try {
        const user = window.Telegram.WebApp.initDataUnsafe?.user;
        if (!user) {
            showErrorModal('Данные пользователя не загружены');
            return;
        }
        
        const botUrl = window.AppConfig?.BOT_URL;
        const referralLink = `${botUrl}/market?startapp=${user.id}`;
        const messageText = `🎉 Лучший бот уникальными M-NFT, мгновенная выдача, щедрая реферальная программа!`
        
        if (window.Telegram?.WebApp) {
            if (window.Telegram.WebApp.shareUrl) {
                window.Telegram.WebApp.shareUrl(messageText, referralData.referralLink);
            } else if (window.Telegram.WebApp.openLink) {
                const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(messageText)}`;
                window.Telegram.WebApp.openLink(shareUrl);
            } else {
                // Fallback для десктопа
                window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(messageText)}`, '_blank');
            }
        } else {
            // Fallback вне Telegram
            navigator.clipboard.writeText(referralLink)
                .then(() => {
                    showSuccessModal('Ссылка скопирована. Отправьте ее друзьям!');
                });
        }
        
        // Вибрация
        if (window.vibrate) {
            window.vibrate([5, 3, 5]);
        }
    } catch (error) {
        console.error('Ошибка при попытке поделиться:', error);
        showErrorModal('Не удалось поделиться ссылкой');
    }
}

// Загрузка списка рефералов
function loadReferralsList() {
    const user = window.Telegram.WebApp.initDataUnsafe?.user;
    if (!user?.id || !window.socket) return;
    
    // Запрашиваем список рефералов с сервера
    window.socket.emit('get_referrals', user.id);
}

// Отображение списка рефералов
function renderReferralsList(referrals) {
    const referralsList = document.getElementById('referralsList');
    if (!referralsList) return;
    
    if (!referrals || referrals.length === 0) {
        renderEmptyReferralsList();
        return;
    }
    
    // Отображаем ID, дату и ЗАРАБОТАННЫЕ СРЕДСТВА
    referralsList.innerHTML = referrals.map((referral, index) => `
        <div class="referral-item" style="animation-delay: ${index * 0.1}s">
            <div class="referral-avatar">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4a4 4 0 0 1 4 4a4 4 0 0 1-4 4a4 4 0 0 1-4-4a4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4"/></svg>
            </div>
            <div class="referral-info">
                <div class="referral-name">
                    ID: ${referral.id}
                </div>
                <div class="referral-stats">
                    <div class="referral-date">
                        Приглашен ${formatDate(referral.joined_at)}
                    </div>
                </div>
            </div>
            <div class="referral-earned">
                <div class="earned-amount">+${referral.earned} ⭐</div>
            </div>
        </div>
    `).join('');
}

// Отображение пустого списка рефералов
function renderEmptyReferralsList() {
    const referralsList = document.getElementById('referralsList');
    if (!referralsList) return;
    
    referralsList.innerHTML = `
        <div class="empty-referrals">
            <div class="empty-icon">👥</div>
            <p>Пока нет приглашенных друзей</p>
            <p class="empty-hint">Пригласите друзей по ссылке выше и получайте 20% от их покупок!</p>
        </div>
    `;
}

// Вспомогательные функции
function formatNumber(num) {
    if (typeof num !== 'number') num = parseFloat(num) || 0;
    const rounded = Math.round(num * 10000) / 10000;
    let formatted = rounded.toString();
    
    if (formatted.includes('.')) formatted = formatted.replace(/\.?0+$/, '');
    if (formatted.endsWith('.')) formatted = formatted.slice(0, -1);
    
    return formatted === '' ? '0' : formatted;
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

function showSuccessModal(message) {
    if (window.tg?.showPopup) {
        window.tg.showPopup({ title: 'Успех', message: message });
    } else {
        alert(message);
    }
}

function showErrorModal(message) {
    if (window.tg?.showPopup) {
        window.tg.showPopup({ title: 'Ошибка', message: message });
    } else {
        alert(message);
    }
}

// Экспорт функций в глобальную область видимости
window.openReferralModal = openReferralModal;
window.closeReferralModal = closeReferralModal;
window.copyReferralLinkModal = copyReferralLinkModal;
window.shareReferralLinkModal = shareReferralLinkModal;
window.updateReferralData = updateReferralData;
window.initReferralProgram = initReferralProgram;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initReferralProgram, 100);
});