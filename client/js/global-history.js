// Функция загрузки глобальной истории через Socket.IO
function loadGlobalSalesHistory() {
    console.log('🔄 Загрузка глобальной истории продаж...');
    
    const historyList = document.getElementById('historyList');
    if (!historyList) {
        console.error('❌ historyList не найден');
        return;
    }
    
    // Показываем состояние загрузки
    historyList.innerHTML = `
        <div class="empty-history">
            <div class="loading-spinner" style="width: 40px; height: 40px; border-width: 3px;"></div>
            <p style="margin-top: 10px;">Загрузка истории продаж...</p>
        </div>
    `;
    
    // Запрашиваем данные через Socket.IO
    if (window.socket && window.socket.connected) {
        window.socket.emit('get_global_sales_history', { limit: 50 });
    } else {
        // Если сокет не подключен
        historyList.innerHTML = `
            <div class="empty-history">
                <div class="empty-icon">⚠️</div>
                <p>Нет соединения</p>
                <p class="empty-hint">Перезагрузите приложение</p>
            </div>
        `;
    }
}

// Функция отображения глобальной истории
function displayGlobalSalesHistory(transfers) {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    
    // Если нет данных
    if (!transfers || transfers.length === 0) {
        historyList.innerHTML = `
            <div class="empty-history">
                <div class="empty-icon">📊</div>
                <p>История продаж пуста</p>
                <p class="empty-hint">Продаж NFT еще не было</p>
            </div>
        `;
        return;
    }
    
    // Форматируем дату для отображения
    function formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    }
    
    // Создаем HTML для каждой продажи
    historyList.innerHTML = transfers.map(transfer => {
        const amount = transfer.amount || 0;
        const nftName = transfer.nftFullName || `NFT #${transfer.nftNumber || '?'}`;
        
        // Проверяем, является ли продавец системой (0)
        const isFromSystem = transfer.fromUserId === 0 || transfer.fromUserId === '0' || transfer.fromUserId === 'system';
        
        // Определяем что показывать: улучшенное или базовое изображение
        let imageContent = '';
        const isUpgradedNFT = transfer.update === 1;
        
        if (isUpgradedNFT && transfer.modelData && transfer.modelData.file_name) {
            // Генерируем улучшенное изображение
            imageContent = generateUpgradedNFTImageForHistory(transfer);
        } else if (transfer.imageFileId) {
            // Базовое изображение NFT
            const imageUrl = `/m_nft_image/base/${transfer.imageFileId}`;
            imageContent = `<img src="${imageUrl}" alt="${nftName}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">`;
        } else {
            // Эмодзи по умолчанию
            imageContent = `<span>${transfer.emoji || '🎴'}</span>`;
        }
        
        return `
            <div class="history-item global-sale-item">
                <div class="history-item-header">
                    <div class="history-icon" style="font-size: 1.8em; margin-right: 10px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
                        ${imageContent}
                    </div>
                    
                    <div class="history-item-info" style="flex: 1;">
                        <div class="history-item-title">
                            <span class="history-item-type nft-sale" style="color: var(--accent);">
                                ${isFromSystem ? 'Новая покупка' : 'Продажа NFT'}
                            </span>
                            <span class="history-item-amount nft-sale" style="font-weight: bold;">
                                ${amount} ⭐
                            </span>
                        </div>
                        
                        <div class="history-item-nft" style="margin: 5px 0; font-size: 0.9em;">
                            ${nftName}
                        </div>
                        
                        <div class="history-item-users" style="font-size: 0.8em; color: var(--text-secondary);">
                            ${isFromSystem ? 
                                `<span>ID: ${transfer.toUserId} </span>` :
                                `<span>ID: ${transfer.fromUserId} → ID: ${transfer.toUserId}</span>`
                            }
                        </div>
                    </div>
                </div>
                
                <div class="history-item-footer" style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span class="history-item-date" style="font-size: 0.8em; color: var(--text-tertiary);">
                        ${formatDate(transfer.createdAt)}
                    </span>
                    <span class="history-item-status completed" style="background: var(--success); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.7em;">
                        Успешно
                    </span>
                </div>
            </div>
        `;
    }).join('');
    
    console.log(`✅ Отображено ${transfers.length} продаж`);
}

// Добавляем функцию generateUpgradedNFTImageForHistory в глобальную область
if (!window.generateUpgradedNFTImageForHistory) {
    window.generateUpgradedNFTImageForHistory = function(transaction) {
        if (!transaction.update || transaction.update !== 1) {
            return '🎴';
        }
        
        let backgroundStyle = '';
        let patternHtml = '';
        
        // Фон для улучшенного NFT
        if (transaction.backgroundData && transaction.backgroundData.back_0 && transaction.backgroundData.back_100) {
            backgroundStyle = `background: radial-gradient(circle, #${transaction.backgroundData.back_0} 0%, #${transaction.backgroundData.back_100} 100%);`;
        }
        
        // Паттерн для улучшенного NFT (только 2 ряда)
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
    };
}

// Добавляем вспомогательную функцию для паттерна
if (!window.getUpgradedNFTPatternForHistory) {
    window.getUpgradedNFTPatternForHistory = function(svgPath) {
        if (!svgPath) return '';
        
        // Параметры как в инвентаре, но только для двух кругов
        const innerCircleRadius = 18;    // Внутренний круг
        const middleCircleRadius = 28;   // Средний круг (второй ряд)
        
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
                            width: 13%;
                            height: 13%;
                            min-width: 12px; max-width: 20px;
                            min-height: 12px; max-height: 20px;
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
                            min-width: 14px; max-width: 22px;
                            min-height: 14px; max-height: 22px;
                            transform: translate(-50%, -50%);
                            opacity: 0.18;
                            background-image: url('${svgPath}');
                            background-size: contain;
                            background-repeat: no-repeat;
                            background-position: center;">
                </div>
            `;
        }
        
        patternHtml += '</div>';
        return patternHtml;
    };
}

// Инициализация глобальной истории
function initGlobalHistory() {
    console.log('🔄 Инициализация глобальной истории');
    
    // Подписываемся на обновления маркета, чтобы перезагружать историю
    if (window.socket) {
        window.socket.on('market_updated', () => {
            // Если секция истории активна - обновляем
            const historySection = document.getElementById('history');
            if (historySection && historySection.classList.contains('active')) {
                console.log('🔄 Обновление истории после продажи');
                setTimeout(() => loadGlobalSalesHistory(), 500); // Даем время на сохранение в БД
            }
        });
    }
}

// Экспортируем функции
window.loadGlobalSalesHistory = loadGlobalSalesHistory;
window.displayGlobalSalesHistory = displayGlobalSalesHistory;
window.initGlobalHistory = initGlobalHistory;