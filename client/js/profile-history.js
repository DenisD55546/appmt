let currentHistoryTab = 'inventory';

// Переключение между вкладками в профиле
function switchProfileTab(tab) {
    currentHistoryTab = tab;
    
    // Обновляем активные кнопки табов
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelectorAll('.profile-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Активируем выбранную вкладку
    const tabButton = document.querySelector(`.tab-button[onclick*="${tab}"]`);
    if (tabButton) tabButton.classList.add('active');
    
    const content = document.getElementById(`${tab}Content`);
    if (content) content.classList.add('active');
    
    // Если переключаемся на историю - загружаем транзакции
    if (tab === 'history') {
        loadProfileHistory();
    }
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate(1);
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

async function loadProfileHistory() {
    console.log('🔍 loadProfileHistory() called');
    try {
        const historyList = document.getElementById('profileHistoryList');
        if (!historyList) return;
        
        const tg = window.Telegram?.WebApp;
        const user = tg?.initDataUnsafe?.user;
        const userId = user?.id;
        console.log('🔍 User ID:', userId);
        
        if (!userId || !window.socket) {
            historyList.innerHTML = `
                <div class="empty-history">
                    <div class="empty-icon">🔒</div>
                    <p>Необходима авторизация</p>
                </div>
            `;
            return;
        }
        
        // Показываем загрузку
        historyList.innerHTML = `
            <div class="empty-history">
                <div class="empty-icon">⏳</div>
                <p>Загрузка истории...</p>
            </div>
        `;
        
        // Запрашиваем историю через socket
        window.socket.emit('get_transaction_history', { userId: userId });
        
        // Обработчик ответа
        window.socket.once('transaction_history', (data) => {
            if (data.success && data.transactions && data.transactions.length > 0) {
                displayProfileTransactionHistory(data.transactions);
            } else {
                historyList.innerHTML = `
                    <div class="empty-history">
                        <div class="empty-icon">📜</div>
                        <p>История транзакций пуста</p>
                        <p class="empty-hint">Здесь будут отображаться ваши операции</p>
                    </div>
                `;
            }
        });
        
    } catch (error) {
        console.error('❌ Error loading profile history:', error);
        const historyList = document.getElementById('profileHistoryList');
        if (historyList) {
            historyList.innerHTML = `
                <div class="empty-history">
                    <div class="empty-icon">⚠️</div>
                    <p>Ошибка загрузки</p>
                    <p class="empty-hint">Попробуйте еще раз</p>
                </div>
            `;
        }
    }
}
function getBackgroundColorByEmoji(emoji) {
    const colorMap = {
        '🧢': '#FF6B6B', // красный для кепки
        '🚗': '#4ECDC4', // бирюзовый для машины
        '✏️': '#FFD166', // желтый для карандаша
        '🐸': '#06D6A0', // зеленый для лягушки
        '🎴': '#A78BFA'  // фиолетовый по умолчанию
    };
    return colorMap[emoji] || '#A78BFA';
}
// Функция для отображения истории в профиле
function displayProfileTransactionHistory(transactions) {
    const historyList = document.getElementById('profileHistoryList');
    if (!historyList) return;
    
    const tg = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tg?.id;
    
    // Карта эмодзи для разных типов операций
    const emojiMap = {
        'Пополнение': '💰',
        'Вывод': '💸',
        'Передача NFT': '🔄',
        'Покупка NFT': '🛒',
        'Продажа NFT': '💵',
        'Получение NFT': '📥'
    };
    
    historyList.innerHTML = transactions.map(transaction => {
        // Получаем ID пользователя из транзакции
        const isSender = transaction.fromUserId == userId;
        const isReceiver = transaction.toUserId == userId;
        
        let typeClass = '';
        let amountText = '';
        let transactionType = transaction.type;
        let notes = transaction.notes || '';
        
        // Определяем правильный тип операции и сумму
        if (transaction.type === 'Передача NFT') {
            if (isSender) {
                transactionType = 'Передача NFT';
                amountText = `-5 ⭐`;
                notes = `Передача NFT: ${transaction.collectionName || 'NFT'} #${transaction.nftNumber || '?'}`;
            } else if (isReceiver) {
                transactionType = 'Получение NFT';
                amountText = '';
                notes = `Получение NFT: ${transaction.collectionName || 'NFT'} #${transaction.nftNumber || '?'}`;
            }
        }
        else if (transaction.type === 'Покупка NFT') {
            typeClass = 'nft-purchase';
            amountText = `-${transaction.amount} ⭐`;
        } else if (transaction.type === 'Продажа NFT') {
            typeClass = 'nft-sale';
            amountText = `+${transaction.amount} ⭐`;
        } else if (transaction.type === 'Пополнение') {
            typeClass = 'deposit';
            amountText = `+${transaction.amount} ⭐`;
        } else if (transaction.type === 'Вывод') {
            typeClass = 'withdrawal';
            amountText = `-${transaction.amount} ⭐`;
        }
        
        // Определяем эмодзи
        let displayEmoji = emojiMap[transactionType] || '🎴';
        
        // Используем данные улучшенного NFT если они есть
        const isUpgradedNFT = transaction.update === 1;
        let displayContent = displayEmoji;
        
        if (isUpgradedNFT && transaction.modelData && transaction.modelData.file_name) {
            // Генерируем улучшенное изображение NFT как в инвентаре
            displayContent = generateUpgradedNFTImageForHistory(transaction);
        } else if (transaction.imageFileId) {
            // Базовое изображение NFT
            const imageUrl = `/m_nft_image/base/${transaction.imageFileId}`;
            displayContent = `<img src="${imageUrl}" alt="${notes}" 
                style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">`;
        }
        
        return `
            <div class="history-item ${transaction.isTransfer ? 'transfer-item' : ''}">
                <div class="history-item-header">
                    <div class="history-icon" style="font-size: 1.7em; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                        ${displayContent}
                    </div>
                    
                    <div class="history-item-info">
                        <span class="history-item-type ${typeClass}">
                            ${notes}
                        </span>
                    </div>
                    
                    ${amountText ? `
                        <span class="history-item-amount ${typeClass}">
                            ${amountText}
                        </span>
                    ` : ''}
                </div>
                
                <div class="history-item-details">
                    <span class="history-item-date">
                        ${formatTransactionDate(transaction.createdAt)}
                    </span>
                    <span class="history-item-status ${transaction.status?.toLowerCase() || 'completed'}">
                        ${transaction.status || 'Успешно'}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// Новая функция для генерации улучшенного изображения NFT в истории
function generateUpgradedNFTImageForHistory(transaction) {
    if (!transaction.update || transaction.update !== 1) {
        return '🎴';
    }
    
    let backgroundStyle = '';
    let patternHtml = '';
    
    // Фон для улучшенного NFT
    if (transaction.backgroundData && transaction.backgroundData.back_0 && transaction.backgroundData.back_100) {
        backgroundStyle = `background: radial-gradient(circle, #${transaction.backgroundData.back_0} 0%, #${transaction.backgroundData.back_100} 100%);`;
    }
    
    // Паттерн для улучшенного NFT (только 2 ряда как в инвентаре)
    if (transaction.patternData && transaction.patternData.file_name) {
        const svgPath = `/m_nft_image/patterns/${transaction.patternData.file_name}.svg`;
        patternHtml = getUpgradedNFTPatternForHistory(svgPath);
    }
    
    // Модель для улучшенного NFT
    if (transaction.modelData && transaction.modelData.file_name) {
        const modelImagePath = `/m_nft_image/${transaction.collectionName}/${transaction.modelData.file_name}.PNG`;
        
        return `
            <div style="${backgroundStyle} width: 100%; height: 100%; position: relative; border-radius: 8px; overflow: hidden;">
                ${patternHtml}
                <img src="${modelImagePath}" 
                     alt="${transaction.modelData.name}" 
                     style="width: 100%; height: 100%; object-fit: contain; position: relative; z-index: 2;">
            </div>
        `;
    }
    
    return '🎴';
}

// Новая функция для создания паттерна с двумя рядами (как в инвентаре)
function getUpgradedNFTPatternForHistory(svgPath) {
    if (!svgPath) return '';
    
    // Параметры как в инвентаре, но только для двух кругов
    const innerCircleRadius = 38;    // Внутренний круг
    const middleCircleRadius = 46;   // Средний круг (второй ряд)
    const innerCircleRadius3 = 58;    // Внутренний круг
    
    let patternHtml = '<div class="card-pattern" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; border-radius: 8px; overflow: hidden;">';
    
    // 1. Внутренний круг - 6 иконок (первый ряд)
    const innerIconsCount = 6;
    for (let i = 0; i < innerIconsCount; i++) {
        const angle = (i / innerIconsCount) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * innerCircleRadius;
        const y = 50 + Math.sin(angle) * innerCircleRadius;
        
        patternHtml += `
            <div style="position: absolute;
                        top: ${y}%;
                        left: ${x}%;
                        width: 12%;
                        height: 12%;
                        min-width: 6px; max-width: 20px;
                        min-height: 6px; max-height: 20px;
                        transform: translate(-50%, -50%);
                        opacity: 0.25;
                        background-image: url('${svgPath}');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;">
            </div>
        `;
    }
    
    // 2. Средний круг - 4 иконки (второй ряд)
    const rotationOffset = Math.PI / 6;
    
    const middleAngles = [
        0,
        (2 * Math.PI) / 3,
        (2 * Math.PI) / 3 + Math.PI / 3,
        (2 * Math.PI) / 3 + Math.PI / 3 + (2 * Math.PI) / 3
    ];
    
    for (let i = 0; i < middleAngles.length; i++) {
        const angle = middleAngles[i] + rotationOffset;
        const x = 50 + Math.cos(angle) * middleCircleRadius;
        const y = 50 + Math.sin(angle) * middleCircleRadius;
        
        patternHtml += `
            <div style="position: absolute;
                        top: ${y}%;
                        left: ${x}%;
                        width: 14%;
                        height: 14%;
                        min-width: 8px; max-width: 22px;
                        min-height: 8px; max-height: 22px;
                        transform: translate(-50%, -50%);
                        opacity: 0.18;
                        background-image: url('${svgPath}');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;">
            </div>
        `;
    }

    
    const innerIconsCount3 = 8;
    for (let i = 0; i < innerIconsCount3; i++) {
        const angle = (i / innerIconsCount3) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * innerCircleRadius3;
        const y = 50 + Math.sin(angle) * innerCircleRadius3;
        
        patternHtml += `
            <div style="position: absolute;
                        top: ${y}%;
                        left: ${x}%;
                        width: 10%;
                        height: 10%;
                        min-width: 6px; max-width: 20px;
                        min-height: 6px; max-height: 20px;
                        transform: translate(-50%, -50%);
                        opacity: 0.1;
                        background-image: url('${svgPath}');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;">
            </div>
        `;
    }
    
    patternHtml += '</div>';
    return patternHtml;
}

// Инициализация истории при загрузке
function initProfileHistory() {
    // Подписываемся на событие загрузки истории транзакций
    if (window.socket) {
        window.socket.on('transaction_history', (data) => {
            console.log('📜 Received transaction history for profile:', data);
            
            if (data.success && data.transactions) {
                // Если активна вкладка истории в профиле - обновляем
                if (currentHistoryTab === 'history') {
                    displayProfileTransactionHistory(data.transactions);
                }
            }
        });
    }
}

// Экспорт функций в глобальную область видимости
window.switchProfileTab = switchProfileTab;
window.loadProfileHistory = loadProfileHistory;
window.displayProfileTransactionHistory = displayProfileTransactionHistory;
window.initProfileHistory = initProfileHistory;