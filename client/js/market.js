let marketNFTs = [];
let marketFilters = {
    collection: [],
    rarity: [],    
    sort: 'newest',
    priceMin: 0,
    priceMax: 999999
};

let marketLoadInProgress = false;
let marketRequestTimeout = null;
let lastRequestTime = 0;
const REQUEST_DEBOUNCE_DELAY = 300;

// Сохраняем снимок фильтров для отмены
let marketFiltersSnapshot = null;

// Функция получения цвета редкости
function getRarityColor(rarity) {
    const colors = {
        'Легендарный': '#FFD700',
        'Эпический': '#9370DB',
        'Редкий': '#4169E1',
        'Обычный': '#808080'
    };
    return colors[rarity] || '#808080';
}

// Вспомогательная функция
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Функция загрузки NFT на продаже с сервера с фильтрами
async function loadMarketItems() {
    console.log('📊 loadMarketItems вызвана');
    
    if (marketLoadInProgress) return;
    marketLoadInProgress = true;
    
    const marketGrid = document.getElementById('marketGrid');
    if (!marketGrid) {
        marketLoadInProgress = false;
        return;
    }
    
    try {
        marketGrid.innerHTML = `
            <div class="empty-market">
                <div class="loading-spinner"></div>
                <p>Загрузка маркета...</p>
                <p class="empty-hint">Применяем фильтры</p>
            </div>
        `;
        
        // Подготавливаем данные для запроса на сервер
        const filterData = {
            collection: marketFilters.collection.length > 0 ? marketFilters.collection : undefined,
            rarity: marketFilters.rarity.length > 0 ? marketFilters.rarity : undefined,
            sort: marketFilters.sort || 'newest', // ВАЖНО: передаем текущую сортировку
            priceMin: marketFilters.priceMin || 0,
            priceMax: marketFilters.priceMax || 999999
        };
        
        console.log('🔄 Запрос NFT с фильтрами:', filterData);
        
        let listings = [];
        
        // Используем socket для получения данных с фильтрами
        if (window.socket && window.socket.connected) {
            console.log('📡 Отправка запроса через socket...');
            
            listings = await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    console.log('⚠️ Таймаут загрузки маркета');
                    resolve([]);
                }, 10000);
                
                const handleResponse = (data) => {
                    clearTimeout(timeoutId);
                    window.socket.off('nfts_for_sale', handleResponse);
                    
                    if (data.success) {
                        console.log(`✅ Загружено ${data.listings.length} NFT с фильтрами`);
                        resolve(data.listings || []);
                    } else {
                        console.error('❌ Ошибка загрузки маркета:', data.error);
                        resolve([]);
                    }
                };
                
                window.socket.once('nfts_for_sale', handleResponse);
                window.socket.emit('get_nfts_for_sale', filterData);
            });
        } else {
            console.log('⚠️ Socket не подключен, используем демо-данные');
            listings = getDemoMarketNFTs();
            // Применяем фильтры локально для демо
            listings = applyLocalFilters(listings, filterData);
        }
        
        // Отображаем NFT
        displayMarketNFTs(listings);
        
        // Обновляем UI фильтров
        updateMarketActiveFilters();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки маркета:', error);
        marketGrid.innerHTML = `
            <div class="empty-market">
                <div class="empty-icon">⚠️</div>
                <p>Ошибка загрузки</p>
                <p class="empty-hint">${error.message || 'Неизвестная ошибка'}</p>
            </div>
        `;
    } finally {
        marketLoadInProgress = false;
        console.log('✅ Запрос loadMarketItems завершен');
    }
}

function applyLocalFilters(nfts, filters) {
    if (!nfts || nfts.length === 0) return nfts;
    
    let filtered = [...nfts];
    
    // Фильтрация по коллекции (множественный выбор)
    if (filters.collection && filters.collection.length > 0) {
        filtered = filtered.filter(nft => {
            const name = (nft.collectionName || '').toLowerCase();
            // Проверяем, содержит ли название коллекции хотя бы один из выбранных фильтров
            return filters.collection.some(filter => name.includes(filter));
        });
    }
    
    // Фильтрация по редкости (множественный выбор)
    if (filters.rarity && filters.rarity.length > 0) {
        filtered = filtered.filter(nft => {
            // Преобразуем редкость в ID как на фронтенде
            const rarityToId = {
                'Легендарный': 'legendary',
                'Эпический': 'epic',
                'Редкий': 'rare',
                'Обычный': 'common'
            };
            const nftRarityId = rarityToId[nft.rarity];
            return filters.rarity.includes(nftRarityId);
        });
    }
    
    // Сортировка
    if (filters.sort) {
        switch(filters.sort) {
            case 'newest':
                filtered.sort((a, b) => new Date(b.listedAt || b.createdAt) - new Date(a.listedAt || a.createdAt));
                break;
            case 'oldest':
                filtered.sort((a, b) => new Date(a.listedAt || a.createdAt) - new Date(b.listedAt || b.createdAt));
                break;
            case 'price_low':
                filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
                break;
            case 'price_high':
                filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
                break;
            case 'rarity_high':
                // Сортировка по редкости (от самой высокой)
                const rarityOrder = { 'Легендарный': 4, 'Эпический': 3, 'Редкий': 2, 'Обычный': 1 };
                filtered.sort((a, b) => (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0));
                break;
            case 'rarity_low':
                // Сортировка по редкости (от самой низкой)
                const rarityOrderLow = { 'Легендарный': 4, 'Эпический': 3, 'Редкий': 2, 'Обычный': 1 };
                filtered.sort((a, b) => (rarityOrderLow[a.rarity] || 0) - (rarityOrderLow[b.rarity] || 0));
                break;
        }
    }
    
    return filtered;
}

// Отображение NFT в маркете
function displayMarketNFTs(nfts) {
    const marketGrid = document.getElementById('marketGrid');
    if (!marketGrid) return;
    
    // Сохраняем загруженные NFT
    marketNFTs = nfts;
    
    if (!nfts || nfts.length === 0) {
        marketGrid.innerHTML = `
            <div class="empty-market">
                <div class="empty-icon">🔍</div>
                <p>Ничего не найдено</p>
                <p class="empty-hint">Попробуйте изменить фильтры</p>
            </div>
        `;
        return;
    }
    
    marketGrid.innerHTML = nfts.map((nft, index) => {
        const rarityColor = getRarityColor(nft.rarity);
        const rarityClass = nft.rarity ? nft.rarity.toLowerCase() : 'обычный';
        const isOwner = isCurrentUserOwner(nft.ownerId);
        
        // ВАЖНОЕ ИСПРАВЛЕНИЕ: Используем те же функции отображения, что и в профиле
        const isUpgraded = nft.update === 1;
        const cardBackgroundStyle = getNFTCardBackground(nft); // Используем функцию из inventory.js
        
        // Получаем паттерн если есть
        const patternHtml = (isUpgraded && nft.patternData && nft.patternData.file_name) 
            ? getNFTCardFullPattern(`/m_nft_image/patterns/${nft.patternData.file_name}.svg`)
            : '';

        return `
            <div class="inventory-item" onclick="viewMarketNFT(${nft.id})" 
                 style="${cardBackgroundStyle} animation-delay: ${index * 0.05}s; position: relative;">

                ${patternHtml}
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
                    background: linear-gradient(to top, rgba(13, 13, 16, 0.6) 0%, 
                    rgba(13, 13, 16, 0.15) 30%, 
                    rgba(13, 13, 16, 0.1) 70%, transparent 100%);
                    border-radius: 18px; z-index: 1;"></div>
                ${isOwner ? '<div class="on-sale-badge">💰</div>' : ''}

                <div class="inventory-item-image" style="position: relative; z-index: 2;">
                    ${generateNFTImageHTML(nft)} <!-- Используем ту же функцию что и в профиле -->
                </div>

                <div class="inventory-item-info" style="position: relative; z-index: 3;">
                    <h4 class="nft-name" text-shadow: 0 1px 2px rgba(0,0,0,0.3);">
                        ${nft.fullName || 'NFT #' + (nft.number || '?')}
                    </h4>
                    
                    ${isOwner ? `
                        <div style="background: rgba(255, 215, 0, 0.1); border-radius: 10px; padding: 8px; margin: 0 8px 8px;">
                            <div style="font-size: 0.8em; color: #FFD700; text-align: center;">
                                Ваша цена: ${nft.price || 0} ⭐
                            </div>
                        </div>
                    ` : `
                        <div class="market-buy-button-container">
                            <button class="market-buy-button" onclick="buyNFT(${nft.id}, ${nft.price || 0}, event)">
                                <span class="market-buy-price">${nft.price || 0} ⭐</span>
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

function generateNFTImageHTML(nft) {
    // Используем ту же логику, что и в inventory.js
    if (nft.update === 1 && nft.modelData && nft.modelData.file_name) {
        const modelImagePath = `/m_nft_image/${nft.collectionName || nft.collection_name}/${nft.modelData.file_name}.PNG`;
        
        return `
            <div style="width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center;">
                <img src="${modelImagePath}" 
                     alt="${nft.modelData.name}" 
                     style="width: 100%; height: 100%; object-fit: contain; position: relative; z-index: 2;">
            </div>
        `;
    } else {
        if (typeof nft.image === 'string' && (nft.image.includes('<') || nft.image.includes('&lt;'))) {
            return nft.image;
        }
        
        if (typeof nft.image === 'string' && (nft.image.startsWith('/') || nft.image.startsWith('http'))) {
            return `<img src="${nft.image}" alt="${nft.fullName}" style="width: 100%; height: 100%; object-fit: contain;">`;
        }
        
        return `<span style="font-size: 2em;">${nft.image || '🎴'}</span>`;
    }
}

function getNFTCardBackground(nft) {
    // Используем ту же логику, что и в inventory.js
    if (nft.update === 1 && nft.backgroundData && nft.backgroundData.back_0 && nft.backgroundData.back_100) {
        return `background: radial-gradient(circle, #${nft.backgroundData.back_0} 0%, #${nft.backgroundData.back_100} 75%);`;
    } else {
        const rarityColor = getRarityColor(nft.rarity);
        return `background: ${rarityColor}70;`;
    }
}

function getNFTCardFullPattern(svgPath) {
    if (!svgPath) return '';
    
    const innerCircleRadius = 18;
    const middleCircleRadius = 32;
    const outerCircleRadius = 45;
    const extraCircleRadius = 55;
    
    let patternHtml = '<div class="card-pattern" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; border-radius: 18px; overflow: hidden;">';
    
    // 1. Внутренний круг
    const innerIconsCount = 6;
    for (let i = 0; i < innerIconsCount; i++) {
        const angle = (i / innerIconsCount) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * innerCircleRadius;
        const y = 50 + Math.sin(angle) * innerCircleRadius;
        
        patternHtml += `
            <div style="position: absolute;
                        z-index: 1;
                        top: ${y}%;
                        left: ${x}%;
                        width: 12%;    <!-- Больше для маркета -->
                        height: 12%;
                        min-width: 16px; max-width: 28px;
                        min-height: 16px; max-height: 28px;
                        transform: translate(-50%, -50%);
                        opacity: 0.25;
                        background-image: url('${svgPath}');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;">
            </div>
        `;
    }
    
    // 2. Средний круг
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
                        width: 14%;    <!-- Больше для маркета -->
                        height: 14%;
                        min-width: 18px; max-width: 30px;
                        min-height: 18px; max-height: 30px;
                        transform: translate(-50%, -50%);
                        opacity: 0.18;
                        background-image: url('${svgPath}');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;">
            </div>
        `;
    }
    
    // 3. Внешний круг
    const outerIconsCount = 12;
    for (let i = 0; i < outerIconsCount; i++) {
        const angle = (i / outerIconsCount) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * outerCircleRadius;
        const y = 50 + Math.sin(angle) * outerCircleRadius;
        
        patternHtml += `
            <div style="position: absolute;
                        top: ${y}%;
                        left: ${x}%;
                        width: 10%;    <!-- Больше для маркета -->
                        height: 10%;
                        min-width: 12px; max-width: 24px;
                        min-height: 12px; max-height: 24px;
                        transform: translate(-50%, -50%);
                        opacity: 0.12;
                        background-image: url('${svgPath}');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;">
            </div>
        `;
    }
    
    // 4. Самый внешний круг
    const extraCircleIconsCount = 8;
    for (let i = 0; i < extraCircleIconsCount; i++) {
        const angle = (i / extraCircleIconsCount) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * extraCircleRadius;
        const y = 50 + Math.sin(angle) * extraCircleRadius;
        
        patternHtml += `
            <div style="position: absolute;
                        top: ${y}%;
                        left: ${x}%;
                        width: 8%;     <!-- Больше для маркета -->
                        height: 8%;
                        min-width: 10px; max-width: 20px;
                        min-height: 10px; max-height: 20px;
                        transform: translate(-50%, -50%);
                        opacity: 0.08;
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

// Проверка владельца NFT
function isCurrentUserOwner(ownerId) {
    const tg = window.Telegram?.WebApp;
    const currentUser = tg?.initDataUnsafe?.user;
    
    if (!currentUser?.id) return false;
    return parseInt(ownerId) === parseInt(currentUser.id);
}

// Просмотр NFT в маркете
function viewMarketNFT(nftId) {
    const nft = marketNFTs.find(item => item.id === nftId);
    if (!nft || !window.updateNFTModal || !window.openNFTModal) return;
    
    const nftData = {
        ...nft,
        forSale: true,
        ownedByUser: isCurrentUserOwner(nft.ownerId)
    };
    
    window.updateNFTModal(nftData);
    window.openNFTModal();
    
    if (window.vibrate) window.vibrate([3, 5, 3]);
}

// Покупка NFT
function buyNFT(nftId, price, event) {
    if (event) event.stopPropagation();
    
    const nft = marketNFTs.find(item => item.id === nftId);
    if (!nft) return;
    
    // Используем универсальный менеджер покупок
    if (window.purchaseManager) {
        window.purchaseManager.showConfirmation(nft, 'market');
    } else {
        // Fallback на старую логику
        showOldPurchaseConfirmation(nftId, price, nft.fullName);
    }
    
    if (window.vibrate) window.vibrate([5, 3, 5]);
}

// Инициализация маркета
async function initMarket() {
    try {
        await loadMarketItems();
        updateMarketActiveFilters();
        updateMarketBalance();
        setupMarketListeners();
        console.log('✅ Маркет инициализирован');
    } catch (error) {
        console.error('❌ Ошибка инициализации маркета:', error);
    }
}

function setupMarketListeners() {
    if (window.socket) {
        // Обновление маркета при изменениях
        window.socket.on('market_updated', () => {
            console.log('🔄 Обновление маркета');
            loadMarketItems();
        });
        
        // Обновление баланса
        window.socket.on('balance_updated', (data) => {
            if (data.userId === window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
                updateMarketBalance();
            }
        });
    }
}

// Функция открытия модального окна фильтров для маркета
function openMarketFilterModal(filterType) {
    // Сохраняем снимок текущих фильтров
    marketFiltersSnapshot = {
        collection: [...marketFilters.collection],
        rarity: [...marketFilters.rarity],
        sort: marketFilters.sort,
        priceMin: marketFilters.priceMin,
        priceMax: marketFilters.priceMax
    };
    
    // Используем общую функцию открытия модалки
    window.openFilterModal(filterType);
    
    // Загружаем специфичный контент для маркета
    setTimeout(() => {
        const modalBody = document.getElementById('filterModalBody');
        if (modalBody) {
            loadMarketSpecificFilterContent(filterType, modalBody);
        }
    }, 10);
}

// Загрузка специфичного контента для маркета
async function loadMarketSpecificFilterContent(filterType, modalBody) {
    let html = '';
    
    if (filterType === 'collection') {
        html = await getMarketCollectionsContent(); // Добавьте await
    } else if (filterType === 'rarity') {
        html = getMarketRarityContent();
    } else if (filterType === 'sort') {
        html = getMarketSortContent();
    } else if (filterType === 'price') {
        html = getMarketPriceContent();
    }
    
    if (html) {
        modalBody.innerHTML = html;
    }
}

// Контент коллекций для маркета
async function getMarketCollectionsContent() {
    try {
        const collections = await fetchCollectionsForMarket();
        
        if (!collections || collections.length === 0) {
            return '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Коллекций не найдено</p>';
        }
        
        // Генерируем HTML с реальными данными из БД
        return collections.map(collection => {
            const collectionId = collection.id;
            // ИСПРАВЛЕНИЕ: Используем числовой ID без префикса 'col'
            const isSelected = marketFilters.collection.includes(collectionId.toString());
            
            // Используем реальное изображение из БД
            let imageHtml = '';
            if (collection.image_file_id) {
                imageHtml = `
                    <div class="filter-item-image">
                        <img src="/m_nft_image/base/${collection.image_file_id}" 
                             alt="${escapeHtml(collection.name)}" 
                             onerror="this.style.display='none'; this.parentNode.innerHTML='🎴';"
                             style="width: 35px; height: 35px; border-radius: 6px; object-fit: cover;">
                    </div>
                `;
            } else {
                // Fallback если нет изображения
                imageHtml = `<span style="font-size: 1.2em; margin-right: 8px;">🎴</span>`;
            }
            
            // Определяем редкость по total_supply
            const rarity = getRarityBySupplyMarket(collection.total_supply);
            const rarityColor = getRarityColor(rarity);
            
            // ИСПРАВЛЕНИЕ: Используем числовой ID
            return `
                <div class="filter-item" onclick="selectMarketFilterItem('collection', ${collectionId}, '${escapeHtml(collection.name)}')">
                    <div class="filter-item-content">
                        <span class="filter-item-name">
                            ${imageHtml}
                            ${escapeHtml(collection.name)}
                            <span style="font-size: 0.8em; color: ${rarityColor}; margin-left: 6px; background: ${rarityColor}20; padding: 2px 6px; border-radius: 8px;">
                                ${rarity}
                            </span>
                        </span>
                    </div>
                    <div class="filter-item-checkbox">
                        <input type="checkbox" id="collection_${collectionId}" ${isSelected ? 'checked' : ''}>
                        <label for="collection_${collectionId}"></label>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки коллекций для маркета:', error);
        return '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Ошибка загрузки коллекций</p>';
    }
}

// Вспомогательная функция для определения редкости
function getRarityBySupplyMarket(totalSupply) {
    if (!totalSupply || typeof totalSupply !== 'number') return 'Обычный';
    
    if (totalSupply <= 50) return 'Легендарный';
    if (totalSupply <= 200) return 'Эпический';
    if (totalSupply <= 1000) return 'Редкий';
    return 'Обычный';
}

// Функция для получения коллекций (как в профиле)
async function fetchCollectionsForMarket() {
    try {
        let collections = [];
        
        if (window.socket && window.socket.connected) {
            collections = await new Promise((resolve) => {
                window.socket.emit('get_collections');
                window.socket.once('collections_list', (data) => {
                    resolve(data.success ? data.collections : []);
                });
                
                // Таймаут
                setTimeout(() => resolve([]), 5000);
            });
        }
        
        // Возвращаем коллекции без учета userNFTCount (для маркета не нужно)
        return collections.map(collection => ({
            ...collection,
            userNFTCount: 0
        }));
        
    } catch (error) {
        console.error('Error fetching collections for market:', error);
        return [];
    }
}

// Контент редкости для маркета
function getMarketRarityContent() {
    const rarities = [
        { id: 'legendary', name: 'Легендарные', emoji: '🏆' },
        { id: 'epic', name: 'Эпические', emoji: '💎' },
        { id: 'rare', name: 'Редкие', emoji: '🔮' },
        { id: 'common', name: 'Обычные', emoji: '📦' }
    ];
    
    return `
        ${rarities.map(rarity => {
            const isSelected = marketFilters.rarity.includes(rarity.id);
            return `
                <div class="filter-item" onclick="selectMarketFilterItem('rarity', '${rarity.id}', '${rarity.name}')">
                    <div class="filter-item-content">
                        <span class="filter-item-name">
                            <span style="font-size: 1.2em; margin-right: 8px;">${rarity.emoji}</span>
                            ${rarity.name}
                        </span>
                    </div>
                    <div class="filter-item-checkbox">
                        <input type="checkbox" id="rarity_${rarity.id}" ${isSelected ? 'checked' : ''}>
                        <label for="rarity_${rarity.id}"></label>
                    </div>
                </div>
            `;
        }).join('')}
    `;
}

// Контент сортировки для маркета (оставляем одиночный выбор)
function getMarketSortContent() {
    const sorts = [
        { id: 'newest', name: 'Сначала новые', emoji: '', description: 'Сначала недавно добавленные' },
        { id: 'oldest', name: 'Сначала старые', emoji: '', description: 'Сначала давно добавленные' },
        { id: 'price_low', name: 'Цена по возрастанию', emoji: '', description: 'От дешевых к дорогим' },
        { id: 'price_high', name: 'Цена по убыванию', emoji: '', description: 'От дорогих к дешевым' },
        { id: 'rarity_high', name: 'Сначала редкие', emoji: '', description: 'От легендарных к обычным' },
        { id: 'rarity_low', name: 'Сначала обычные', emoji: '', description: 'От обычных к редким' },
        { id: 'collection', name: 'По коллекциям', emoji: '', description: 'Группировать по коллекции' }
    ];
    
    return `
        ${sorts.map(sort => {
            const isSelected = marketFilters.sort === sort.id;
            return `
                <div class="filter-item" onclick="selectMarketFilterItem('sort', '${sort.id}', '${sort.name}')">
                    <div class="filter-item-content">
                        <span class="filter-item-name">
                            <span style="font-size: 1.2em; margin-right: 8px;">${sort.emoji}</span>
                            ${sort.name}
                        </span>
                    </div>
                    <div class="filter-item-checkbox">
                        <input type="checkbox" id="sort_${sort.id}" ${isSelected ? 'checked' : ''}>
                        <label for="sort_${sort.id}"></label>
                    </div>
                </div>
            `;
        }).join('')}
    `;
}

// Контент цены для маркета (особый случай)
function getMarketPriceContent() {
    return `
        <div style="padding: 10px;">
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 0.9em;">
                    Минимальная цена (⭐)
                </label>
                <input type="number" 
                       id="priceMinInput" 
                       value="${marketFilters.priceMin}" 
                       min="0" 
                       max="999999"
                       style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);"
                       onchange="updateMarketPriceFilter('min', this.value)">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 0.9em;">
                    Максимальная цена (⭐)
                </label>
                <input type="number" 
                       id="priceMaxInput" 
                       value="${marketFilters.priceMax === 999999 ? '' : marketFilters.priceMax}" 
                       min="0" 
                       max="999999"
                       placeholder="Без ограничения"
                       style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);"
                       onchange="updateMarketPriceFilter('max', this.value)">
            </div>
        </div>
    `;
}

// Выбор элемента фильтра для маркета (множественный выбор для collection и rarity)
function selectMarketFilterItem(filterType, filterId, filterName) {
    // ИСПРАВЛЕНИЕ: Преобразуем filterId в строку для сравнения
    const filterIdStr = filterId.toString();
    const checkbox = document.getElementById(`${filterType}_${filterIdStr}`);
    
    if (!checkbox) return;
    
    if (filterType === 'collection' || filterType === 'rarity') {
        // МНОЖЕСТВЕННЫЙ выбор (toggle)
        if (checkbox.checked) {
            // Удаляем из массива, если уже был выбран
            const index = marketFilters[filterType].indexOf(filterIdStr);
            if (index > -1) {
                marketFilters[filterType].splice(index, 1);
            }
            checkbox.checked = false;
        } else {
            // Добавляем в массив
            if (!marketFilters[filterType].includes(filterIdStr)) {
                marketFilters[filterType].push(filterIdStr);
            }
            checkbox.checked = true;
        }
    } 
    else if (filterType === 'sort') {
        // Одиночный выбор для сортировки - ПЕРЕКЛЮЧАЕМ
        // Сначала снимаем все чекбоксы
        document.querySelectorAll(`input[id^="sort_"]`).forEach(cb => {
            cb.checked = false;
        });
        
        // Если уже выбран этот фильтр - снимаем
        if (marketFilters.sort === filterIdStr) {
            marketFilters.sort = 'newest'; // сбрасываем на дефолт
        } else {
            marketFilters.sort = filterIdStr;
            checkbox.checked = true;
        }
    }
    
    // Вибрация и ОБНОВЛЕНИЕ ДИСПЛЕЯ
    if (window.vibrate) {
        window.vibrate([3, 5, 3]);
    }
    
    // Немедленно обновляем отображение фильтра
    updateMarketFilterDisplay(filterType, filterName);
}

// Обновление ценового фильтра
function updateMarketPriceFilter(type, value) {
    if (type === 'min') {
        marketFilters.priceMin = parseInt(value) || 0;
    } else if (type === 'max') {
        marketFilters.priceMax = value ? parseInt(value) : 999999;
    }
}

// Обновление отображения выбранного фильтра
function updateMarketFilterDisplay(filterType, filterName) {
    const elementId = `marketSelected${capitalizeFirstLetter(filterType)}`;
    const element = document.getElementById(elementId);
    
    if (!element) return;
    
    if (filterType === 'collection' || filterType === 'rarity') {
        // Для множественных фильтров
        const count = marketFilters[filterType].length;
        if (count === 0) {
            element.textContent = 'Все';
        } else if (count === 1) {
            // Показываем название единственной выбранной
            element.textContent = filterName;
        } else {
            element.textContent = `${count} выбрано`;
        }
    } 
    else if (filterType === 'sort') {
        // Для сортировки показываем понятное название
        const sortNames = {
            'newest': 'Новые',
            'oldest': 'Старые', 
            'price_low': 'Цена ↑',
            'price_high': 'Цена ↓',
            'rarity_high': 'Редкие',
            'rarity_low': 'Обычные',
            'collection': 'Коллекция'
        };
        element.textContent = sortNames[marketFilters.sort] || 'Новые';
    }
    
    // Добавляем/убираем активный класс у карточки
    const card = element.closest('.profile-filter-card');
    if (card) {
        if (filterType === 'collection' || filterType === 'rarity') {
            card.classList.toggle('active', marketFilters[filterType].length > 0);
        } else if (filterType === 'sort') {
            card.classList.toggle('active', marketFilters.sort !== 'newest');
        }
    }
}

// Обновление активных фильтров
function updateMarketActiveFilters() {
    updateMarketFilterDisplay('collection', '');
    updateMarketFilterDisplay('rarity', '');
    
    const sortName = getMarketFilterDisplayName('sort', marketFilters.sort);
    updateMarketFilterDisplay('sort', sortName);
}

// Вспомогательная функция
function getMarketFilterDisplayName(type, value) {
    if (type === 'collection') {
        return '';
    }
    
    if (type === 'rarity') {
        return '';
    }
    
    if (type === 'sort') {
        const sorts = {
            newest: 'Новые',
            oldest: 'Старые',
            price_low: 'Цена ↑',
            price_high: 'Цена ↓',
            rarity_high: 'Редкость ↓',
            rarity_low: 'Редкость ↑'
        };
        return sorts[value] || 'Новые';
    }
    
    return value;
}

// Функция для очистки фильтров маркета (внутри модалки)
function clearMarketFilters() {
    // Получаем тип фильтра из заголовка модалки
    const modalTitle = document.getElementById('filterModalTitle');
    const title = modalTitle?.textContent;
    
    let filterType = null;
    if (title === 'Выбор коллекции') filterType = 'collection';
    else if (title === 'Выбор редкости') filterType = 'rarity';
    else if (title === 'Фильтры') filterType = 'sort';
    
    if (!filterType) return;
    
    // Очищаем соответствующий фильтр
    if (filterType === 'collection') {
        marketFilters.collection = []; // ОЧИЩАЕМ МАССИВ
        document.querySelectorAll('input[id^="collection_"]').forEach(cb => {
            cb.checked = false;
        });
    } 
    else if (filterType === 'rarity') {
        marketFilters.rarity = []; // ОЧИЩАЕМ МАССИВ
        document.querySelectorAll('input[id^="rarity_"]').forEach(cb => {
            cb.checked = false;
        });
    }
    else if (filterType === 'sort') {
        marketFilters.sort = 'newest'; // СБРАСЫВАЕМ НА ЗНАЧЕНИЕ ПО УМОЛЧАНИЮ
        document.querySelectorAll('input[id^="sort_"]').forEach(cb => {
            cb.checked = false;
        });
    }
    
    // Закрываем модалку и сразу применяем сброшенные фильтры
    const modal = document.getElementById('filterModal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Обновляем UI и применяем фильтры
    updateMarketActiveFilters();
    loadMarketItems();
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate([5, 3, 5]);
    }
}

// Функция для отмены изменений в фильтрах маркета
function cancelMarketFilters() {
    // Восстанавливаем из снимка
    if (marketFiltersSnapshot) {
        marketFilters.collection = [...marketFiltersSnapshot.collection];
        marketFilters.rarity = [...marketFiltersSnapshot.rarity];
        marketFilters.sort = marketFiltersSnapshot.sort;
        marketFilters.priceMin = marketFiltersSnapshot.priceMin;
        marketFilters.priceMax = marketFiltersSnapshot.priceMax;
    }
    
    // Закрываем модалку
    const modal = document.getElementById('filterModal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate(1);
    }
}

// Функция для применения фильтров маркета
function applyMarketFilters() {
    // Обновляем отображение
    updateMarketActiveFilters();
    
    // Загружаем NFT с примененными фильтрами
    loadMarketItems();
    
    // Закрываем модалку
    const modal = document.getElementById('filterModal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Сбрасываем снимок
    marketFiltersSnapshot = null;
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate([3, 5, 3]);
    }
}

// Обновление баланса в маркете
function updateMarketBalance() {
    const marketBalanceElement = document.getElementById('marketBalance');
    if (marketBalanceElement && window.appState) {
        marketBalanceElement.textContent = (window.appState.starsBalance || 0).toLocaleString();
    }
}

// Экспорт функций
window.loadMarketItems = loadMarketItems;
window.viewMarketNFT = viewMarketNFT;
window.buyNFT = buyNFT;
window.initMarket = initMarket;
window.openMarketFilterModal = openMarketFilterModal;
window.selectMarketFilterItem = selectMarketFilterItem;
window.cancelMarketFilters = cancelMarketFilters;
window.applyMarketFilters = applyMarketFilters;
window.clearMarketFilters = clearMarketFilters;
window.getMarketSortContent = getMarketSortContent;