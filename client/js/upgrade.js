// upgrade-modal.js
let upgradeNFTData = null;
let isUpgradeProcessing = false;

function createUpgradeConfirmationModal() {
    console.log('🛠️ Создание модалки улучшения NFT');
    
    if (document.getElementById('upgradeConfirmationModal')) {
        console.log('⚠️ Модалка улучшения уже существует');
        return;
    }
    
    const modal = document.createElement('div');
    modal.id = 'upgradeConfirmationModal';
    modal.className = 'confirmation-modal upgrade-confirmation';
    modal.innerHTML = `
        <div class="confirmation-modal-overlay" onclick="closeUpgradeConfirmation()"></div>
        <div class="confirmation-modal-content">
            <!-- Заголовок -->
            <div class="upgrade-header">
                <div class="upgrade-title-row">
                    <span class="upgrade-icon">✨</span>
                    <h3>Улучшение NFT</h3>
                </div>
            </div>
            
            <!-- Основной контент - компактно -->
            <div class="upgrade-content">
                <!-- NFT в одной строке -->
                <div class="upgrade-nft-compact">
                    <div class="nft-image-small" id="upgradeNftImage">
                        🎴
                    </div>
                    <div class="nft-details-compact">
                        <div class="nft-name-line">
                            <span class="nft-name" id="upgradeNftName">NFT #123</span>
                            <span class="nft-number" id="upgradeNftNumber">#1</span>
                        </div>
                        <div class="nft-collection" id="upgradeNftCollection">Коллекция</div>
                    </div>
                </div>
                
                <!-- Информация об улучшении -->
                <div class="upgrade-info-cards">
                    
                    <div class="info-card">
                        <div class="info-label">Ваш баланс</div>
                        <div class="info-value" id="upgradeBalanceValue">0 ⭐</div>
                    </div>
                </div>
            </div>
            
            <!-- Кнопки -->
            <div class="upgrade-actions">
                <button class="action-btn cancel-btn" onclick="closeUpgradeConfirmation()">
                    Отмена
                </button>
                <button class="action-btn confirm-btn" onclick="confirmUpgrade()">
                    <span class="btn-price" id="upgradeBtnPrice">1 ⭐</span>
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setupUpgradeModalEvents();
    console.log('✅ Модалка улучшения создана');
}

function setupUpgradeModalEvents() {
    const modal = document.getElementById('upgradeConfirmationModal');
    if (!modal) return;
    
    const overlay = modal.querySelector('.confirmation-modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && !isUpgradeProcessing) {
                closeUpgradeConfirmation();
            }
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active') && !isUpgradeProcessing) {
            closeUpgradeConfirmation();
        }
    });
    
    console.log('✅ События модалки улучшения настроены');
}

function showUpgradeConfirmation(nftData) {
    console.log('🔼 Открытие модалки улучшения для NFT:', nftData);
    
    if (!nftData) {
        console.error('❌ Нет данных NFT для улучшения');
        return;
    }
    
    upgradeNFTData = nftData;
    isUpgradeProcessing = false;
    
    if (!document.getElementById('upgradeConfirmationModal')) {
        createUpgradeConfirmationModal();
    }
    
    updateUpgradeModalContent(nftData);
    
    const modal = document.getElementById('upgradeConfirmationModal');
    modal.classList.add('active');
    
    if (window.vibrate) window.vibrate(1);
    
    console.log('✅ Модалка улучшения открыта');
}

function updateUpgradeModalContent(nft) {
    if (!nft) return;
    
    const userBalance = window.appState?.starsBalance || 0;
    const upgradeCost = 1;
    const canUpgrade = userBalance >= upgradeCost;
    const newRarity = calculateNextRarityLevel(nft.rarity);
    
    // Изображение NFT
    const nftImageElement = document.getElementById('upgradeNftImage');
    if (nftImageElement) {
        updateCompactNFTImage(nftImageElement, nft);
    }
    
    // Название и номер NFT в одну строку
    const nftNameElement = document.getElementById('upgradeNftName');
    const nftNumberElement = document.getElementById('upgradeNftNumber');
    
    if (nftNameElement) {
        nftNameElement.textContent = nft.collectionName || 'NFT';
        const rarityColor = getRarityColor(nft.rarity);
        nftNameElement.style.color = rarityColor;
    }
    
    if (nftNumberElement) {
        nftNumberElement.textContent = `#${nft.number || '?'}`;
    }
    
    // Коллекция
    const collectionElement = document.getElementById('upgradeNftCollection');
    if (collectionElement) {
        collectionElement.textContent = getRarityEmoji(nft.rarity) + ' ' + nft.rarity;
    }
    
    // Стоимость
    const costElement = document.getElementById('upgradeCostValue');
    if (costElement) {
        costElement.textContent = upgradeCost.toLocaleString();
    }
    
    // Баланс
    const balanceElement = document.getElementById('upgradeBalanceValue');
    if (balanceElement) {
        balanceElement.textContent = userBalance.toLocaleString() + ' ⭐';
        balanceElement.style.color = canUpgrade ? 'var(--success)' : 'var(--accent)';
        balanceElement.style.fontWeight = canUpgrade ? '600' : '500';
    }
    
    // Результат улучшения
    const resultElement = document.getElementById('upgradeResultValue');
    if (resultElement) {
        const rarityColor = getRarityColor(newRarity);
        resultElement.innerHTML = `
            <span class="rarity-badge" style="background: ${rarityColor}20; color: ${rarityColor}; border-color: ${rarityColor}40;">
                ${newRarity}
            </span>
        `;
    }
    
    // Кнопка улучшения
    const btnPriceElement = document.getElementById('upgradeBtnPrice');
    const confirmButton = document.querySelector('.upgrade-actions .primary');
    
    if (btnPriceElement) {
        btnPriceElement.textContent = upgradeCost + ' ⭐';
    }
    
    if (confirmButton) {
        confirmButton.disabled = !canUpgrade || isUpgradeProcessing;
        confirmButton.style.opacity = canUpgrade ? '1' : '0.6';
        confirmButton.style.cursor = canUpgrade ? 'pointer' : 'not-allowed';
        
        if (!canUpgrade) {
            confirmButton.querySelector('.btn-text').textContent = 'Недостаточно';
        } else if (isUpgradeProcessing) {
            confirmButton.innerHTML = '<div class="mini-spinner"></div>';
        } else {
            confirmButton.innerHTML = `
                <span class="btn-price">${upgradeCost} ⭐</span>
            `;
        }
    }
}

function updateCompactNFTImage(element, nft) {
    const rarityColor = getRarityColor(nft.rarity);
    const hasImage = nft.image && (nft.image.startsWith('/') || nft.image.startsWith('http'));
    
    element.innerHTML = '';
    
    if (hasImage) {
        const img = document.createElement('img');
        img.src = nft.image;
        img.alt = nft.fullName || 'NFT';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '12px';
        element.appendChild(img);
        element.style.background = 'transparent';
        element.style.padding = '0';
        element.style.boxShadow = `0 4px 12px ${rarityColor}40`;
    } else {
        element.innerHTML = `<span style="font-size: 1.5em;">${nft.image || '🎴'}</span>`;
        element.style.background = `linear-gradient(135deg, ${rarityColor}20, ${rarityColor}10)`;
        element.style.border = `2px solid ${rarityColor}30`;
        element.style.boxShadow = `0 4px 12px ${rarityColor}20`;
    }
    
    element.style.borderRadius = '14px';
    element.style.overflow = 'hidden';
}

function getRarityEmoji(rarity) {
    const emojis = {
        'Легендарный': '👑',
        'Эпический': '💎',
        'Редкий': '🔮',
        'Обычный': '⚪'
    };
    return emojis[rarity] || '⚪';
}

function calculateNextRarityLevel(currentRarity) {
    const progression = {
        'Обычный': 'Редкий',
        'Редкий': 'Эпический',
        'Эпический': 'Легендарный',
        'Легендарный': 'Легендарный+'
    };
    return progression[currentRarity] || 'Редкий';
}

function closeUpgradeConfirmation() {
    if (isUpgradeProcessing) {
        console.log('⚠️ Идет процесс улучшения, отмена невозможна');
        return;
    }
    
    const modal = document.getElementById('upgradeConfirmationModal');
    if (modal) {
        modal.classList.remove('active');
    }
    upgradeNFTData = null;
    
    if (window.vibrate) window.vibrate(1);
}

function confirmUpgrade() {
    if (!upgradeNFTData || isUpgradeProcessing) return;
    
    const upgradeCost = 1;
    const userBalance = window.appState?.starsBalance || 0;
    
    if (userBalance < upgradeCost) {
        window.tg?.showPopup({
            title: 'Недостаточно',
            message: `Нужно ${upgradeCost} ⭐, у вас ${userBalance} ⭐`
        });
        return;
    }
    
    // Начинаем процесс улучшения
    isUpgradeProcessing = true;
    
    // Обновляем кнопку
    const confirmButton = document.querySelector('.upgrade-actions .primary');
    if (confirmButton) {
        confirmButton.innerHTML = '<div class="mini-spinner"></div>';
        confirmButton.disabled = true;
    }
    
    console.log(`🔼 Начало улучшения NFT #${upgradeNFTData.id} за ${upgradeCost} ⭐`);
    
    // Отправляем запрос на сервер
    if (window.socket && window.socket.connected) {
        sendUpgradeRequest(upgradeNFTData.id, upgradeCost);
    } else {
        simulateUpgrade(upgradeCost);
    }
}

function sendUpgradeRequest(nftId, cost) {
    console.log(`📤 Отправка запроса на улучшение NFT #${nftId}`);
    
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    
    if (!user?.id) {
        console.error('❌ User ID not found');
        return;
    }
    
    if (window.socket && window.socket.connected) {
        console.log('📡 Socket подключен, отправляю запрос...');
        
        // Удаляем старый обработчик, если он есть
        window.socket.off('upgrade_result');
        
        window.socket.emit('upgrade_nft', {
            nftId: nftId,
            userId: user.id
        });
        
        console.log('📨 Запрос отправлен, жду ответ...');
        
        window.socket.once('upgrade_result', (data) => {
            console.log('📥 Получен ответ от сервера:', data);
            
            if (data.success) {
                completeUpgrade(nftId, cost, data.newBalance, data.updatedNFT);
            } else {
                handleUpgradeError(data.error);
            }
        });
        
        // Таймаут на случай, если ответ не пришел
        setTimeout(() => {
            const confirmButton = document.querySelector('.upgrade-actions .primary');
            if (confirmButton && confirmButton.innerHTML.includes('mini-spinner')) {
                console.error('⏰ Таймаут ожидания ответа от сервера');
                handleUpgradeError('Таймаут ожидания ответа');
            }
        }, 10000);
        
    } else {
        console.error('❌ Socket не подключен');
        handleUpgradeError('Нет соединения с сервером');
    }
}

function handleUpgradeError(error) {
    console.error('❌ Ошибка улучшения:', error);
    isUpgradeProcessing = false;
    
    const confirmButton = document.querySelector('.upgrade-actions .confirm-btn');
    if (confirmButton) {
        confirmButton.innerHTML = `
            <span class="btn-price">1 ⭐</span>
        `;
        confirmButton.disabled = false;
    }
    
    if (window.tg?.showPopup) {
        window.tg.showPopup({
            title: 'Ошибка',
            message: error || 'Не удалось улучшить NFT'
        });
    }
}

function simulateUpgrade(cost) {
    console.log('⚠️ Нет соединения, эмуляция улучшения');
    
    setTimeout(() => {
        completeUpgrade(upgradeNFTData.id, cost);
    }, 1000);
}

function completeUpgrade(nftId, cost, newBalance, updatedNFT) {
    // Обновляем баланс в приложении
    if (window.appState) {
        window.appState.starsBalance = newBalance;
    }
    
    if (window.updateStarsBalance) {
        window.updateStarsBalance();
    }
    
    // Обновляем кэш NFT
    if (window.cachedUserNFTs) {
        const nftIndex = window.cachedUserNFTs.findIndex(nft => nft.id == nftId);
        if (nftIndex !== -1) {
            window.cachedUserNFTs[nftIndex] = {
                ...window.cachedUserNFTs[nftIndex],
                updateble: 0,
                model: updatedNFT?.model,
                background: updatedNFT?.background,
                pattern: updatedNFT?.pattern
            };
        }
    }
    
    // Сбрасываем состояние
    isUpgradeProcessing = false;
    upgradeNFTData = null;
    
    // Закрываем модалки
    closeUpgradeConfirmation();
    
    const nftModal = document.getElementById('nftModal');
    if (nftModal) {
        nftModal.classList.remove('active');
    }
    
    // Показываем успех
    if (window.tg?.showPopup) {
        window.tg.showPopup({
            title: '🎉 Успех!',
            message: `NFT улучшен!\n-${cost} ⭐\nНовый баланс: ${newBalance} ⭐`
        });
    }
    
    // Вибрация
    if (window.vibrate) window.vibrate([3, 2, 3]);
    
    // Обновляем интерфейс
    setTimeout(() => {
        if (window.loadInventoryItems) {
            window.loadInventoryItems();
        }
    }, 500);
}

function getRarityColor(rarity) {
    const colors = {
        'Легендарный': '#FFD700',
        'Эпический': '#9370DB',
        'Редкий': '#4169E1',
        'Обычный': '#808080',
        'Легендарный+': '#FF4500'
    };
    return colors[rarity] || '#808080';
}

// Инициализация
function initUpgradeModal() {
    console.log('🛠️ Инициализация модуля улучшения');
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createUpgradeConfirmationModal);
    } else {
        setTimeout(createUpgradeConfirmationModal, 100);
    }
}

/**
 * Функция для отображения NFT в маленьких окошках
 * Используется в истории, рефералах и других местах, где нужна компактная картинка NFT
 */
function renderSmallNFT(nftData, options = {}) {
    if (!nftData) {
        return createFallbackImage(options.size || 'sm');
    }
    
    const config = {
        size: options.size || 'sm',
        showBackground: options.showBackground !== false,
        showPattern: options.showPattern !== false,
        containerClass: options.containerClass || ''
    };
    
    // Определяем размеры
    const sizes = {
        'xs': { width: '32px', height: '32px', borderRadius: '6px' },
        'sm': { width: '48px', height: '48px', borderRadius: '8px' },
        'md': { width: '64px', height: '64px', borderRadius: '10px' }
    };
    
    const size = sizes[config.size] || sizes.sm;
    
    // 1. Проверяем, улучшен ли NFT (update=1)
    const isUpgraded = nftData.update === 1;
    
    if (isUpgraded) {
        return renderUpgradedNFT(nftData, size, config);
    }
    
    // 2. Обычный NFT
    return renderRegularNFT(nftData, size, config);
}

/**
 * Отрисовка улучшенного NFT (используем ту же логику что и в маркете)
 */
function renderUpgradedNFT(nftData, size, config) {
    // Проверяем наличие данных модели
    if (!nftData.modelData || !nftData.modelData.file_name) {
        return renderRegularNFT(nftData, size, config);
    }
    
    const modelPath = `/m_nft_image/${nftData.collectionName || nftData.collection_name}/${nftData.modelData.file_name}.PNG`;
    
    // Создаем фон (как в маркете)
    let backgroundStyle = '';
    if (config.showBackground && nftData.backgroundData) {
        const back_0 = nftData.backgroundData.back_0 || '2a2a3a';
        const back_100 = nftData.backgroundData.back_100 || '3a3a4a';
        backgroundStyle = `background: radial-gradient(circle, #${back_0} 0%, #${back_100} 75%);`;
    } else {
        // Фон по умолчанию если нет данных
        backgroundStyle = 'background: radial-gradient(circle, #2a2a3a 0%, #3a3a4a 75%);';
    }
    
    // Создаем узор (как в маркете)
    let patternHtml = '';
    if (config.showPattern && nftData.patternData && nftData.patternData.file_name) {
        patternHtml = createSmallPattern(nftData.patternData.file_name, size);
    }
    
    return `
        <div class="small-nft-container upgraded ${config.containerClass}" 
             style="${backgroundStyle} 
                    width: ${size.width}; 
                    height: ${size.height}; 
                    border-radius: ${size.borderRadius}; 
                    position: relative; 
                    overflow: hidden; 
                    display: inline-block;">
            ${patternHtml}
            <img src="${modelPath}" 
                 alt="${nftData.modelData.name || 'NFT'}" 
                 style="width: 100%; height: 100%; object-fit: contain; position: relative; z-index: 2;"
                 onerror="this.style.display='none'; this.parentNode.innerHTML = '${createFallbackImageHTML(size)}';">
        </div>
    `;
}

/**
 * Отрисовка обычного NFT
 */
function renderRegularNFT(nftData, size, config) {
    // Определяем путь к изображению (как в маркете)
    let imageUrl = '';
    
    if (nftData.image && typeof nftData.image === 'string') {
        // Проверяем, не содержит ли image уже HTML
        if (nftData.image.includes('<img') || nftData.image.includes('&lt;')) {
            // Извлекаем URL из существующего HTML
            const match = nftData.image.match(/src="([^"]+)"/);
            imageUrl = match ? match[1] : '';
        } else if (nftData.image.startsWith('/') || nftData.image.startsWith('http')) {
            // Прямой URL
            imageUrl = nftData.image;
        }
    }
    
    // Пробуем другие источники
    if (!imageUrl && nftData.imageFileId) {
        imageUrl = `/m_nft_image/base/${nftData.imageFileId}`;
    }
    
    if (!imageUrl && nftData.collection_image) {
        imageUrl = `/m_nft_image/base/${nftData.collection_image}`;
    }
    
    if (!imageUrl && nftData.image_file_id) {
        imageUrl = `/m_nft_image/base/${nftData.image_file_id}`;
    }
    
    if (imageUrl) {
        return `
            <div class="small-nft-container regular ${config.containerClass}" 
                 style="width: ${size.width}; height: ${size.height}; border-radius: ${size.borderRadius}; overflow: hidden; display: inline-block;">
                <img src="${imageUrl}" 
                     alt="${nftData.collectionName || nftData.collection_name || 'NFT'}" 
                     style="width: 100%; height: 100%; object-fit: cover;"
                     onerror="this.style.display='none'; this.parentNode.innerHTML = '${createFallbackImageHTML(size, nftData)}';">
            </div>
        `;
    }
    
    // Если нет изображения, создаем цветной блок по редкости
    return createFallbackImageHTML(size, nftData);
}

/**
 * Создание узора для маленького NFT (упрощенная версия маркетной)
 */
function createSmallPattern(patternFileName, size) {
    if (!patternFileName) return '';
    
    const svgPath = `/m_nft_image/patterns/${patternFileName}.svg`;
    
    // Масштабируем в зависимости от размера
    let patternSize = '40%';
    let opacity = 0.15;
    
    if (size.width === '32px') {
        patternSize = '30%';
        opacity = 0.1;
    } else if (size.width === '48px') {
        patternSize = '35%';
        opacity = 0.12;
    }
    
    return `
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; opacity: ${opacity};">
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                        width: ${patternSize}; height: ${patternSize};
                        background-image: url('${svgPath}');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;">
            </div>
        </div>
    `;
}

/**
 * Создание fallback изображения (без эмодзи)
 */
function createFallbackImageHTML(size, nftData = null) {
    const rarity = nftData?.rarity || 'Обычный';
    const collectionName = nftData?.collectionName || nftData?.collection_name || 'NFT';
    const initials = getCollectionInitials(collectionName);
    
    // Цвета по редкости (как в маркете)
    const colors = {
        'Легендарный': 'linear-gradient(135deg, #FFD700, #FFA500)',
        'Эпический': 'linear-gradient(135deg, #9370DB, #8A2BE2)',
        'Редкий': 'linear-gradient(135deg, #4169E1, #1E90FF)',
        'Обычный': 'linear-gradient(135deg, #2a2a3a, #3a3a4a)'
    };
    
    const bgColor = colors[rarity] || colors['Обычный'];
    
    return `
        <div style="width: 100%; height: 100%; 
                    background: ${bgColor}; 
                    border-radius: ${size.borderRadius};
                    display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-weight: bold; font-size: ${size.width === '32px' ? '0.8em' : size.width === '48px' ? '1em' : '1.2em'};">
                ${initials}
            </span>
        </div>
    `;
}

/**
 * Создание fallback изображения для передачи в onerror
 */
function createFallbackImage(size) {
    const sizes = {
        'xs': { width: '32px', height: '32px', borderRadius: '6px' },
        'sm': { width: '48px', height: '48px', borderRadius: '8px' },
        'md': { width: '64px', height: '64px', borderRadius: '10px' }
    };
    
    const s = sizes[size] || sizes.sm;
    return createFallbackImageHTML(s);
}

/**
 * Получение инициалов коллекции
 */
function getCollectionInitials(name) {
    if (!name) return 'NFT';
    
    // Берем первые 2 буквы или первые буквы первых двух слов
    const words = name.split(/\s+/).filter(w => w.length > 0);
    
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    
    return name.substring(0, 2).toUpperCase();
}

/**
 * Функция специально для истории
 */
function renderNFTForHistory(transfer) {
    if (!transfer) return '';
    
    // Собираем данные в формате, который понимает renderSmallNFT
    const nftData = {
        update: transfer.update || 0,
        modelData: transfer.modelData,
        backgroundData: transfer.backgroundData,
        patternData: transfer.patternData,
        collectionName: transfer.collectionName,
        collection_name: transfer.collectionName,
        imageFileId: transfer.imageFileId,
        image_file_id: transfer.imageFileId,
        rarity: transfer.rarity || getRarityFromTransfer(transfer)
    };
    
    return renderSmallNFT(nftData, {
        size: 'md',
        showBackground: true,
        showPattern: true,
        containerClass: 'history-nft-image'
    });
}

/**
 * Определение редкости из данных трансфера
 */
function getRarityFromTransfer(transfer) {
    // Если есть явная редкость
    if (transfer.rarity) return transfer.rarity;
    
    // Определяем по коллекции
    const name = (transfer.collectionName || '').toLowerCase();
    if (name.includes('legendary') || name.includes('легендар')) return 'Легендарный';
    if (name.includes('epic') || name.includes('эпич')) return 'Эпический';
    if (name.includes('rare') || name.includes('редк')) return 'Редкий';
    
    return 'Обычный';
}

// Экспорт
window.renderSmallNFT = renderSmallNFT;
window.renderNFTForHistory = renderNFTForHistory;
window.showUpgradeConfirmation = showUpgradeConfirmation;
window.closeUpgradeConfirmation = closeUpgradeConfirmation;
window.confirmUpgrade = confirmUpgrade;
window.initUpgradeModal = initUpgradeModal;

// Автоинициализация
initUpgradeModal();