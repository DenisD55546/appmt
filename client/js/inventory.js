
let cachedCollectionStats = {};
let cachedCollections = null;
let currentFilterSection = 'profile'; // 'profile', 'market', 'home'
window.currentFilterSection = currentFilterSection;

if (typeof window.cachedUserNFTs === 'undefined') {
    window.cachedUserNFTs = [];
}

let currentFilters = {
    collection: [],      // Теперь массив выбранных коллекций
    model: [],          // Массив выбранных моделей
    symbol: [],         // Массив выбранных символов
    background: [],     // Массив выбранных фонов
    filter: null       // Оставляем один тип сортировки
}; 
window.currentFilters = currentFilters;

function getRarityBySupply(totalSupply) {
    if (!totalSupply || typeof totalSupply !== 'number') return 'Обычный';
    
    if (totalSupply <= 50) return 'Легендарный';
    if (totalSupply <= 200) return 'Эпический';
    if (totalSupply <= 1000) return 'Редкий';
    return 'Обычный';
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

let previousFilters = null;
let filtersSnapshot = null;

async function openFilterModal(filterType) {
    const activeSection = document.querySelector('.section.active')?.id || 'profile';
    window.currentFilterSection = activeSection;

    const modal = document.getElementById('filterModal');
    const modalTitle = document.getElementById('filterModalTitle');
    const modalBody = document.getElementById('filterModalBody');
    
    if (!modal || !modalTitle || !modalBody) return;
    
    // Сохраняем снимок текущих фильтров при открытии
    filtersSnapshot = {
        collection: [...currentFilters.collection],
        model: [...currentFilters.model],
        symbol: [...currentFilters.symbol],
        background: [...currentFilters.background],
        filter: currentFilters.filter
    };
    
    // Сохраняем текущие фильтры при открытии модалки
    previousFilters = JSON.parse(JSON.stringify(currentFilters));
    
    // Устанавливаем заголовок
    const titles = {
        collection: 'Выбор коллекции',
        model: 'Выбор модели',
        symbol: 'Выбор символа',
        background: 'Выбор фона',
        filter: 'Фильтры'
    };
    modalTitle.textContent = titles[filterType] || 'Фильтры';
    
    // Показываем загрузку
    modalBody.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
            <div class="loading-spinner"></div>
            <p style="margin-top: 10px;">Загрузка...</p>
        </div>
    `;
    
    // Показываем модалку
    modal.classList.add('active');
    
    // Настраиваем обработчик клика вне окна
    setupFilterModalClickOutside();
    
    try {
        // Асинхронно загружаем контент фильтра
        const filterContent = await getFilterContent(filterType);
        modalBody.innerHTML = filterContent;
    } catch (error) {
        console.error('Error loading filter content:', error);
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--accent);">
                <div style="font-size: 2em; margin-bottom: 10px;">⚠️</div>
                <p>Ошибка загрузки фильтра</p>
                <p style="font-size: 0.9em; margin-top: 10px;">Попробуйте еще раз</p>
            </div>
        `;
    }
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate(1);
    }
}

// Закрытие модального окна фильтров
function closeFilterModal() {
    const modal = document.getElementById('filterModal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Определяем, в какой секции мы находимся
    const activeSection = document.querySelector('.section.active')?.id;
    
    // Обновляем UI и загружаем данные
    if (activeSection === 'profile') {
        // Используем новую функцию applyProfileFilters
        applyProfileFilters();
    } else if (activeSection === 'market') {
        // Маркет использует свою логику
        if (window.applyMarketFilters) {
            window.applyMarketFilters();
        }
    }
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate(1);
    }
}

// Добавим новую функцию "Отменить" - просто закрывает модалку без изменений
function cancelFilters() {
    // Восстанавливаем фильтры из снимка
    if (filtersSnapshot) {
        currentFilters.collection = [...filtersSnapshot.collection];
        currentFilters.model = [...filtersSnapshot.model];
        currentFilters.symbol = [...filtersSnapshot.symbol];
        currentFilters.background = [...filtersSnapshot.background];
        currentFilters.filter = filtersSnapshot.filter;
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

// Получение контента для фильтра
async function getFilterContent(filterType) {
    // Проверяем текущую секцию
    const section = window.currentFilterSection || 
                    document.querySelector('.section.active')?.id || 
                    'profile';
    
    // Если это не профиль - делегируем соответствующему модулю
    if (section === 'market') {
        if (filterType === 'collection') {
            return await window.getMarketCollectionsContent();
        } else if (filterType === 'rarity') {
            return window.getMarketRarityContent();
        } else if (filterType === 'sort') {
            return window.getMarketSortContent();
        } else if (filterType === 'price') {
            return window.getMarketPriceContent();
        }
    } else if (section === 'home') {
        if (filterType === 'category') {
            return await window.getHomeCategoryContent();
        } else if (filterType === 'rarity') {
            return window.getHomeRarityContent();
        } else if (filterType === 'sort') {
            return window.getHomeSortContent();
        }
    }

    if (filterType === 'collection') {
        try {
            const collections = await fetchCollections();
            
            if (!collections || collections.length === 0) {
                return `
                    <div class="filter-empty-state">
                        <p>Коллекций не найдено</p>
                    </div>
                `;
            }
            
            let html = '<div class="filter-container">';
            
            // Добавляем коллекции
            html += collections.map(collection => {
                const collectionId = collection.id;
                const collectionName = collection.name || 'Без названия';
                const imagePath = collection.image_file_id ? 
                    `/m_nft_image/base/${collection.image_file_id}` : null;
                const userNFTCount = collection.userNFTCount || 0;
                const totalSupply = collection.total_supply || 0;
                const rarity = collection.rarity || getRarityBySupply(totalSupply);
                const safeCollectionName = escapeHtml(collectionName);
                const rarityColor = getRarityColor(rarity);
                const isSelected = currentFilters.collection.includes(`col${collectionId}`);

                let imageHtml = '';
                if (imagePath) {
                    imageHtml = `
                        <div class="filter-item-image">
                            <img src="${imagePath}" 
                                 alt="${safeCollectionName}" 
                                 onerror="this.style.display='none'; this.parentNode.innerHTML='🎴';"
                                 style="width: 35px; height: 35px; border-radius: 6px; object-fit: cover;">
                        </div>
                    `;
                } else {
                    imageHtml = `<span style="font-size: 1.2em; margin-right: 8px;">🎴</span>`;
                }

                return `
                    <div class="filter-item" onclick="selectFilterItem('collection', 'col${collectionId}', '${safeCollectionName}')">
                        <div class="filter-item-content">
                            <span class="filter-item-name">
                                ${imageHtml}
                                ${safeCollectionName}
                                <span style="font-size: 0.8em; color: ${rarityColor}; margin-left: 6px; background: ${rarityColor}20; padding: 2px 6px; border-radius: 8px;">
                                    ${rarity}
                                </span>
                            </span>
                            <span class="filter-item-count">${userNFTCount} шт.</span>
                        </div>
                        <div class="filter-item-checkbox">
                            <input type="checkbox" id="collection_col${collectionId}" ${isSelected ? 'checked' : ''}>
                            <label for="collection_col${collectionId}"></label>
                        </div>
                    </div>
                `;
            }).join('');
            
            html += '</div>';
            return html;
        } catch (error) {
            console.error('Error loading collections:', error);
            return '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Ошибка загрузки коллекций</p>';
        }
    }
    
    else if (filterType === 'filter') {
        // Используем ТАКОЙ ЖЕ ДИЗАЙН как в маркере - с фильтр-карточками и чекбоксами
        const filterOptions = [
            { id: 'newest', name: 'Сначала новые', description: 'Сначала недавно добавленные' },
            { id: 'oldest', name: 'Сначала старые', description: 'Сначала давно добавленные' },
            { id: 'price_low', name: 'Цена по возрастанию', description: 'От дешевых к дорогим' },
            { id: 'price_high', name: 'Цена по убыванию', description: 'От дорогих к дешевым' },
            { id: 'rarity_high', name: 'Сначала редкие', description: 'От легендарных к обычным' },
            { id: 'rarity_low', name: 'Сначала обычные', description: 'От обычных к редким' },
            { id: 'collection', name: 'По коллекциям', description: 'Группировать по коллекции' }
        ];

        let html = '<div class="filter-container">';

        html += filterOptions.map(option => {
            const isSelected = currentFilters.filter === option.id;
            const filterId = option.id;

            return `
                <div class="filter-item" onclick="selectProfileFilterButton('${filterId}', '${option.name}')">
                    <div class="filter-item-content">
                        <span class="filter-item-name">
                            ${option.name}
                        </span>
                    </div>
                    <div class="filter-item-checkbox">
                        <input type="checkbox" 
                               id="filter_${filterId}" 
                               ${isSelected ? 'checked' : ''}
                               onchange="toggleProfileFilter('${filterId}', this.checked)">
                        <label for="filter_${filterId}"></label>
                    </div>
                </div>
            `;
        }).join('');

        html += '</div>';
        return html;
    }
    
    else {
        return '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Фильтр не найден</p>';
    }
}

function toggleProfileFilter(filterId, isChecked) {
    if (isChecked) {
        // Сначала снимаем все остальные чекбоксы
        document.querySelectorAll('input[id^="filter_"]').forEach(cb => {
            if (cb.id !== `filter_${filterId}`) {
                cb.checked = false;
            }
        });
        
        // Устанавливаем новый фильтр
        currentFilters.filter = filterId;
    } else {
        // Снимаем фильтр
        currentFilters.filter = null;
    }
    
    // Обновляем отображение
    updateActiveFilters();
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate([3, 5, 3]);
    }
}

function setupFilterModalClickOutside() {
    const modal = document.getElementById('filterModal');
    if (!modal) return;
    
    modal.addEventListener('click', function(event) {
        // Если клик был на самом модальном окне (не на контенте)
        if (event.target === modal) {
            closeFilterModal();
        }
    });
    
    // Также закрытие по Escape
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal.classList.contains('active')) {
            closeFilterModal();
        }
    });
}

function getFilterTitle(filterType) {
    const titles = {
        'collection': 'Коллекция',
        'model': 'Модель',
        'symbol': 'Символ',
        'background': 'Фон',
        'filter': 'Фильтры'
    };
    return titles[filterType] || filterType;
}

async function fetchCollections(forceRefresh = false) {
    try {
        // Если уже есть кэш и не требуется принудительное обновление
        if (cachedCollections && !forceRefresh) {
            return cachedCollections;
        }
        
        let collections = [];
        
        if (window.socket && window.socket.connected) {
            collections = await new Promise((resolve) => {
                window.socket.emit('get_collections');
                window.socket.once('collections_list', async (data) => {
                    resolve(data.success ? data.collections : []);
                });
            });
        } else {
            const response = await fetch('/api/collections');
            const data = await response.json();
            collections = data.success ? data.collections : [];
        }
        
        // Обрабатываем количество NFT пользователя
        const processedCollections = await processCollectionCounts(collections);
        
        // Кэшируем результат
        cachedCollections = processedCollections;
        
        return processedCollections;
    } catch (error) {
        console.error('Error fetching collections:', error);
        return [];
    }
}

// Функция для подсчета NFT пользователя по коллекциям
async function processCollectionCounts(collections) {
    console.log('🔢 Начало подсчета NFT по коллекциям');
    
    // Получаем ID пользователя
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id;
    
    if (!userId) {
        console.log('⚠️ Нет ID пользователя, пропускаем подсчет');
        return collections;
    }
    
    console.log('👤 User ID для подсчета:', userId);
    
    try {
        // Загружаем NFT пользователя (кэшируем)
        if (cachedUserNFTs.length === 0) {
            console.log('📥 Загружаем NFT пользователя...');
            cachedUserNFTs = await loadUserNFTsFromServer(userId);
            console.log(`📥 NFT пользователя загружено: ${cachedUserNFTs.length}`);
        } else {
            console.log(`📦 Используем кэшированные NFT: ${cachedUserNFTs.length}`);
        }
        
        // Подсчитываем количество NFT по каждой коллекции
        const collectionCounts = {};
        cachedUserNFTs.forEach(nft => {
            if (nft.collectionId) {
                collectionCounts[nft.collectionId] = (collectionCounts[nft.collectionId] || 0) + 1;
            }
        });
        
        console.log('📈 Статистика по коллекциям:', collectionCounts);
        
        // Обновляем коллекции с количеством NFT пользователя
        const result = collections.map(collection => {
            const userNFTCount = collectionCounts[collection.id] || 0;
            console.log(`Коллекция ${collection.id} (${collection.name}): ${userNFTCount} NFT`);
            
            return {
                ...collection,
                userNFTCount: userNFTCount
            };
        });
        
        console.log('✅ Подсчет завершен');
        return result;
    } catch (error) {
        console.error('❌ Ошибка processing collection counts:', error);
        return collections;
    }
}

// Выбор элемента фильтра (для collection, model, symbol, background)
function selectFilterItem(filterType, itemId, itemName) {
    // Определяем, в какой секции мы находимся
    const activeSection = document.querySelector('.section.active')?.id;
    
    if (activeSection === 'profile') {
        // Используем логику профиля
        selectProfileFilterItem(filterType, itemId);
    } else if (activeSection === 'market') {
        // Используем логику маркета
        selectMarketFilterItem(filterType, itemId);
    } else if (activeSection === 'home') {
        // Используем логику главной
        if (window.selectHomeFilterItem) {
            window.selectHomeFilterItem(filterType, itemId, itemName);
        }
    }
}

// Выбор элемента фильтра для маркета
function selectMarketFilterItem(filterType, itemId) {
    const checkbox = document.getElementById(`${filterType}_${itemId}`);
    if (!checkbox) return;
    
    if (checkbox.checked) {
        // Удаляем из массива, если уже был выбран
        const index = marketFilters[filterType].indexOf(itemId);
        if (index > -1) {
            marketFilters[filterType].splice(index, 1);
        }
        checkbox.checked = false;
    } else {
        // Добавляем в массив
        if (!marketFilters[filterType].includes(itemId)) {
            marketFilters[filterType].push(itemId);
        }
        checkbox.checked = true;
    }
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate([3, 5, 3]);
    }
}

// Выбор элемента фильтра для профиля
function selectProfileFilterItem(filterType, itemId) {
    const checkbox = document.getElementById(`${filterType}_${itemId}`);
    if (!checkbox) return;
    
    if (checkbox.checked) {
        // Удаляем из массива, если уже был выбран
        const index = currentFilters[filterType].indexOf(itemId);
        if (index > -1) {
            currentFilters[filterType].splice(index, 1);
        }
        checkbox.checked = false;
    } else {
        // Добавляем в массив
        if (!currentFilters[filterType].includes(itemId)) {
            currentFilters[filterType].push(itemId);
        }
        checkbox.checked = true;
    }
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate([3, 5, 3]);
    }
}

// Выбор кнопки фильтра (для типа 'filter')
function selectFilterButton(filterId, filterName) {
    // Определяем, в какой секции мы находимся
    const activeSection = document.querySelector('.section.active')?.id;
    
    if (activeSection === 'profile') {
        // Используем логику профиля
        selectProfileFilterButton(filterId, filterName);
    } else if (activeSection === 'market') {
        // Используем логику маркета
        selectMarketFilterButton(filterId, filterName);
    }
}

// Выбор кнопки фильтра для маркета
function selectMarketFilterButton(filterId, filterName) {
    // Сначала снимаем выделение со всех кнопок фильтра
    document.querySelectorAll('.filter-button-option').forEach(button => {
        button.classList.remove('active');
    });
    
    if (marketFilters.filter === filterId) {
        // Снимаем выбор
        marketFilters.filter = null;
    } else {
        // Выбираем новый фильтр
        marketFilters.filter = filterId;
        // Добавляем класс active к выбранной кнопке
        const activeButton = document.querySelector(`.filter-button-option[onclick*="${filterId}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate([3, 5, 3]);
    }
}

// Выбор кнопки фильтра для профиля
function selectProfileFilterButton(filterId, filterName) {
    const checkbox = document.getElementById(`filter_${filterId}`);
    if (!checkbox) return;
    
    if (checkbox.checked) {
        // Если уже выбран - снимаем
        checkbox.checked = false;
        currentFilters.filter = null;
    } else {
        // Снимаем все остальные чекбоксы
        document.querySelectorAll('input[id^="filter_"]').forEach(cb => {
            cb.checked = false;
        });
        
        // Выбираем новый
        checkbox.checked = true;
        currentFilters.filter = filterId;
    }
    
    // Обновляем отображение
    updateActiveFilters();
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate([3, 5, 3]);
    }
}

// Обновление отображения активных фильтров
function updateActiveFilters() {
    // Обновляем бейджи на карточках фильтров
    const filterCards = document.querySelectorAll('.profile-filter-card');
    
    filterCards.forEach(card => {
        const onclickAttr = card.getAttribute('onclick');
        if (!onclickAttr) return;
        
        const match = onclickAttr.match(/'([^']+)'/);
        if (!match) return;
        
        const filterType = match[1];
        let isActive = false;
        let count = 0;
        
        // Проверяем активность фильтра
        if (currentFilters[filterType]) {
            if (Array.isArray(currentFilters[filterType])) {
                isActive = currentFilters[filterType].length > 0;
                count = currentFilters[filterType].length;
            } else {
                isActive = currentFilters[filterType] !== null;
                count = currentFilters[filterType] ? 1 : 0;
            }
        }
        
        // Обновляем класс активности
        if (isActive) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
        
        // Обновляем текстовое значение в карточке
        updateFilterCardText(filterType, count, isActive);
    });
}

// Вспомогательная функция для капитализации первой буквы
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Обновление текста в карточке фильтра
function updateFilterCardText(filterType, count, isActive) {
    const filterValueElement = document.getElementById(`selected${capitalizeFirstLetter(filterType)}Filter`);
    if (!filterValueElement) return;
    
    if (filterType === 'filter') {
        // Для типа фильтра показываем название выбранного фильтра
        if (currentFilters.filter) {
            const filterNames = {
                'newest': 'Новые',
                'oldest': 'Старые',
                'rarity-high': 'Редкость ↓',
                'rarity-low': 'Редкость ↑',
                'number-low': 'Номер ↑',
                'number-high': 'Номер ↓',
                'collection': 'Коллекция'
            };
            filterValueElement.textContent = filterNames[currentFilters.filter] || 'Выбрано';
        } else {
            filterValueElement.textContent = 'Нет';
        }
    } else if (isActive) {
        // Для остальных фильтров показываем количество выбранных
        filterValueElement.textContent = count === 1 ? '1 выбрано' : `${count} выбрано`;
    } else {
        // Если ничего не выбрано
        filterValueElement.textContent = filterType === 'filter' ? 'Нет' : 'Все';
    }
}

function hasActiveFilters() {
    return currentFilters.collection.length > 0 || 
           currentFilters.model.length > 0 || 
           currentFilters.symbol.length > 0 || 
           currentFilters.background.length > 0 || 
           currentFilters.filter !== null;
}

// Вспомогательная функция: определяет тип фильтра по заголовку
function getFilterTypeByTitle(title) {
    const titlesMap = {
        'Выбор коллекции': 'collection',
        'Выбор модели': 'model',
        'Выбор символа': 'symbol',
        'Выбор фона': 'background',
        'Фильтры': 'filter'
    };
    return titlesMap[title] || null;
}

// Очистка всех фильтров
function clearFilters(filterType = null) {
    // Определяем активную секцию
    const activeSection = document.querySelector('.section.active')?.id;
    
    if (activeSection === 'market') {
        // Для маркета
        if (window.clearMarketFilters) {
            window.clearMarketFilters();
        }
        return;
    }
    else if (activeSection === 'home') {
        // Для главной
        if (window.clearHomeFilters) {
            window.clearHomeFilters();
            console.log('📦 очиства главной');
        }
        return;
    }
    
    // Для профиля и других секций - старая логика
    if (!filterType) {
        const modalTitle = document.getElementById('filterModalTitle');
        if (modalTitle) {
            const title = modalTitle.textContent;
            filterType = getFilterTypeByTitle(title);
        }
    }
    
    if (filterType) {
        clearFilterType(filterType);
        
        const modal = document.getElementById('filterModal');
        if (modal) {
            modal.classList.remove('active');
        }
        
        updateActiveFilters();
        loadInventoryItems();
    }
}

// Функция очистки конкретного типа фильтра
function clearFilterType(filterType) {
    switch(filterType) {
        case 'collection':
            currentFilters.collection = [];
            document.querySelectorAll('input[id^="collection_"]').forEach(cb => {
                cb.checked = false;
            });
            break;
            
        case 'filter':
            currentFilters.filter = null;
            // Снимаем все чекбоксы фильтров
            document.querySelectorAll('input[id^="filter_"]').forEach(cb => {
                cb.checked = false;
            });
            break;
            
        // Остальные типы пока не реализованы
        case 'model':
        case 'symbol':
        case 'background':
            currentFilters[filterType] = [];
            break;
    }
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate([5, 3, 5]);
    }
}

// Применение фильтров
function applyFilters() {
    updateActiveFilters();
    loadInventoryItems();
    closeFilterModal();
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate([3, 5, 3]);
    }
}

async function loadUserNFTsFromServer(userId) {
    try {
        // Используем socket.io для получения NFT
        if (window.socket && window.socket.connected) {
            return new Promise((resolve) => {
                window.socket.emit('get_user_nfts', userId);
                window.socket.once('user_nfts', (data) => {
                    if (data.success) {
                        // Проверяем структуру данных
                        if (data.nfts && data.nfts.length > 0) {
                            console.log('🔍 Анализ первого NFT:');
                            const firstNFT = data.nfts[0];
                            console.log('Все поля:', Object.keys(firstNFT));
                            console.log('Значение forSale:', firstNFT.forSale);
                            
                            // Проверяем сколько NFT на продаже
                            const forSaleCount = data.nfts.filter(nft => nft.forSale).length;
                            console.log(`💰 NFT на продаже: ${forSaleCount} из ${data.nfts.length}`);
                        }
                        
                        // ОБНОВЛЯЕМ ГЛОБАЛЬНЫЙ КЭШ
                        window.cachedUserNFTs = data.nfts || [];
                        console.log('✅ Кэш обновлен через socket');
                        
                        resolve(window.cachedUserNFTs);
                    } else {
                        console.error('Error loading NFTs:', data.error);
                        resolve([]);
                    }
                });
            });
        } else {
            console.error('Error loading NFTs:', data.error);
        }
    } catch (error) {
        console.error('Error loading NFTs:', error);
        return [];
    }
}

// Загрузка предметов инвентаря

async function loadInventoryItems() {
    console.log('🔄 Начало загрузки инвентаря с серверной фильтрацией...');
    if (window.nftLoadInProgress) return;
    window.nftLoadInProgress = true;
    
    const inventoryGrid = document.getElementById('inventoryGrid');
    if (!inventoryGrid) {
        console.error('❌ Не найден элемент inventoryGrid');
        window.nftLoadInProgress = false;
        return;
    }
    
    // Получаем ID пользователя из Telegram
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id;
    
    if (!userId) {
        inventoryGrid.innerHTML = `
            <div class="empty-inventory">
                <div class="empty-icon">🔒</div>
                <p>Пользователь не авторизован</p>
                <p class="empty-hint">Войдите через Telegram</p>
            </div>
        `;
        window.nftLoadInProgress = false;
        return;
    }
    
    try {
        let userNFTs = [];
        
        // ПОДГОТАВЛИВАЕМ ДАННЫЕ ДЛЯ СЕРВЕРНОЙ ФИЛЬТРАЦИИ
        const filterData = {
            collection: currentFilters.collection.length > 0 ? currentFilters.collection : undefined,
            sort: currentFilters.filter || undefined
        };
        
        console.log('🔄 Запрос NFT с фильтрами:', filterData);
        
        if (window.socket && window.socket.connected) {
            userNFTs = await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    console.log('⚠️ Таймаут загрузки инвентаря');
                    resolve([]);
                }, 10000);
                
                const handleResponse = (data) => {
                    clearTimeout(timeoutId);
                    window.socket.off('user_nfts_with_filters', handleResponse);
                    
                    if (data.success && data.nfts) {
                        console.log(`✅ Загружено ${data.nfts.length} NFT с серверными фильтрами`);
                        
                        // Кэшируем NFT
                        window.cachedUserNFTs = data.nfts;
                        resolve(data.nfts);
                    } else {
                        console.error('❌ Ошибка загрузки инвентаря:', data.error);
                        resolve([]);
                    }
                };
                
                window.socket.once('user_nfts_with_filters', handleResponse);
                window.socket.emit('get_user_nfts_with_filters', { 
                    userId, 
                    filters: filterData 
                });
            });
        } else {
            // Fallback на старую логику, если нет соединения
            console.log('⚠️ Socket не подключен, используем кэшированные данные');
            userNFTs = window.cachedUserNFTs || [];
        }
        
        console.log(`📊 Получено ${userNFTs.length} NFT от сервера с фильтрами`);
        
        if (userNFTs.length === 0) {
            inventoryGrid.innerHTML = `
                <div class="empty-inventory">
                    <div class="empty-icon">🎁</div>
                    <p>Инвентарь пуст</p>
                    <p class="empty-hint">У вас пока нет NFT</p>
                </div>
            `;
            window.nftLoadInProgress = false;
            return;
        }
        
        inventoryGrid.innerHTML = userNFTs.map((nft, index) => {
            const rarityClass = nft.rarity ? nft.rarity.toLowerCase() : 'обычный';
            const rarityColor = getRarityColor(nft.rarity);
            const isOnSale = nft.forSale === true || nft.forSale === 1 || nft.forSale === 'true' || nft.forSale === '1';
            const isUpgraded = nft.update === 1;
            const isPinned = nft.pinned && nft.pinned > 0; // Проверяем закрепление

            // Получаем стиль фона для всей карточки
            const cardBackgroundStyle = getNFTCardBackground(nft);

            // Получаем паттерн если есть
            const patternHtml = (isUpgraded && nft.patternData && nft.patternData.file_name) 
                ? getNFTCardFullPatternProfile(`/m_nft_image/patterns/${nft.patternData.file_name}.svg`,
                    nft.backgroundData?.back_0)
                : '';

            return `
                <div class="inventory-item in" onclick="viewNFT(${nft.id})" 
                     style="${cardBackgroundStyle} animation-delay: ${index * 0.05}s; position: relative;">

                    ${patternHtml}

                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
                        background: linear-gradient(to top, rgba(13, 13, 16, 0.6) 0%, 
                        rgba(13, 13, 16, 0.15) 30%, 
                        rgba(13, 13, 16, 0.1) 70%, transparent 100%);
                        border-radius: 18px; z-index: 1;"></div>

                    <!-- Значок продажи (правая сторона) -->
                    ${isOnSale ? '<div class="on-sale-badge">💰</div>' : ''}

                    <!-- Значок закрепления (левая сторона) -->
                    ${isPinned ? '<div class="pinned-badge" title="Закреплен">📌</div>' : ''}

                    <div class="inventory-item-image" style="position: relative; z-index: 2;">
                        ${generateNFTImageHTML(nft)}
                    </div>

                    <div class="inventory-item-info" style="position: relative; z-index: 3;">
                        <h4 class="nft-name"text-shadow: 0 1px 2px rgba(0,0,0,0.3);">
                            ${nft.fullName || 'NFT #' + (nft.number || '?')}
                        </h4>
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('✅ Инвентарь успешно загружен с серверной фильтрацией');
        window.nftLoadInProgress = false;
        
    } catch (error) {
        console.error('❌ Ошибка загрузки инвентаря:', error);
        inventoryGrid.innerHTML = `
            <div class="empty-inventory">
                <div class="empty-icon">⚠️</div>
                <p>Ошибка загрузки</p>
                <p class="empty-hint">${error.message || 'Неизвестная ошибка'}</p>
            </div>
        `;
        window.nftLoadInProgress = false;
    }
}

// Функция для отмены фильтров профиля (аналогично маркету)
function cancelProfileFilters() {
    // Восстанавливаем фильтры из снимка
    if (filtersSnapshot) {
        currentFilters.collection = [...filtersSnapshot.collection];
        currentFilters.model = [...filtersSnapshot.model];
        currentFilters.symbol = [...filtersSnapshot.symbol];
        currentFilters.background = [...filtersSnapshot.background];
        currentFilters.filter = filtersSnapshot.filter;
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

// Функция применения фильтров профиля
function applyProfileFilters() {
    // Обновляем UI
    updateActiveFilters();
    
    // Загружаем NFT с примененными фильтрами
    loadInventoryItems();
    
    // Закрываем модалку
    const modal = document.getElementById('filterModal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Сбрасываем снимок
    filtersSnapshot = null;
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate([3, 5, 3]);
    }
}

// Обновляем функцию clearFilters для профиля
function clearProfileFilters() {
    const modalTitle = document.getElementById('filterModalTitle');
    const title = modalTitle?.textContent;
    
    let filterType = null;
    if (title === 'Выбор коллекции') filterType = 'collection';
    else if (title === 'Фильтры') filterType = 'filter';
    
    if (!filterType) return;
    
    // Очищаем соответствующий фильтр
    if (filterType === 'collection') {
        currentFilters.collection = [];
    } 
    else if (filterType === 'filter') {
        currentFilters.filter = null;
    }
    
    // Закрываем модалку и сразу применяем сброшенные фильтры
    const modal = document.getElementById('filterModal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Обновляем UI и применяем фильтры
    updateActiveFilters();
    loadInventoryItems();
    
    // Вибрация
    if (window.vibrate) {
        window.vibrate([5, 3, 5]);
    }
}

function getRarityColor(rarity) {
    const colors = {
        'Легендарный': '#FFD700', // золотой
        'Эпический': '#9370DB',   // фиолетовый
        'Редкий': '#4169E1',      // синий
        'Обычный': '#808080'      // серый
    };
    return colors[rarity] || '#808080';
}

function generateNFTImageHTML(nft) {
    // Функция теперь возвращает только изображение без фона
    if (nft.update === 1 && nft.modelData && nft.modelData.file_name) {
        // Улучшенный NFT - только изображение модели
        const modelImagePath = `/m_nft_image/${nft.collectionName || nft.collection_name}/${nft.modelData.file_name}.PNG`;
        
        return `
            <div style="width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center;">
                <img src="${modelImagePath}" 
                     alt="${nft.modelData.name}" 
                     style="width: 100%; height: 100%; object-fit: contain; position: relative; z-index: 2;">
            </div>
        `;
    } else {
        // Не улучшенный NFT
        if (typeof nft.image === 'string' && (nft.image.includes('<') || nft.image.includes('&lt;'))) {
            return nft.image;
        }
        
        if (typeof nft.image === 'string' && (nft.image.startsWith('/') || nft.image.startsWith('http'))) {
            return `<img src="${nft.image}" alt="${nft.fullName}" style="width: 100%; height: 100%; object-fit: contain;">`;
        }
        
        return `<span style="font-size: 2em;">${nft.image || '🎴'}</span>`;
    }
}

// Новая функция для получения данных фона карточки
function getNFTCardBackground(nft) {
    if (nft.update === 1 && nft.backgroundData && nft.backgroundData.back_0 && nft.backgroundData.back_100) {
        // ТОЧНО такой же градиент как в модалке
        return `background: radial-gradient(circle, #${nft.backgroundData.back_0} 0%, #${nft.backgroundData.back_100} 75%);`;
    } else {
        // Для не-апгрейднутых NFT - тот же стиль что в модалке
        const rarityColor = getRarityColor(nft.rarity);
        return `background: ${rarityColor}70;`;
    }
}

function getNFTCardFullPatternProfile(svgPath, bgColor) {
    if (!svgPath) return '';
    
    const filterStyle = window.getPatternFilterStyle(bgColor);
    
    const innerCircleRadius = 18;    // В процентах от размера карточки
    const middleCircleRadius = 28;   
    const outerCircleRadius = 45;    
    const extraCircleRadius = 55;    
    
    let patternHtml = '<div class="card-pattern" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; border-radius: 18px; overflow: hidden;">';
    
    // 1. Внутренний круг - 6 иконок
    const innerIconsCount = 6;
    for (let i = 0; i < innerIconsCount; i++) {
        const angle = (i / innerIconsCount) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * innerCircleRadius;
        const y = 50 + Math.sin(angle) * innerCircleRadius;
        
        patternHtml += `
            <div style="position: absolute;
                        top: ${y}%;
                        left: ${x}%;
                        width: 13%;     <!-- 8% от ширины карточки -->
                        height: 13%;   
                        min-width: 12px; max-width: 20px; <!-- Ограничения -->
                        min-height: 12px; max-height: 20px;
                        transform: translate(-50%, -50%);
                        opacity: 0.25;
                        background-image: url('${svgPath}');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;
                        ${filterStyle}">
            </div>
        `;
    }
    
    // 2. Средний круг - 4 иконки
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
                        width: 14%;     <!-- 9% от ширины карточки -->
                        height: 14%;    <!-- 9% от высоты карточки -->
                        min-width: 14px; max-width: 22px;
                        min-height: 14px; max-height: 22px;
                        transform: translate(-50%, -50%);
                        opacity: 0.18;
                        background-image: url('${svgPath}');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;
                        ${filterStyle}">
            </div>
        `;
    }
    
    // 3. Внешний круг - 12 иконок
    const outerIconsCount = 12;
    for (let i = 0; i < outerIconsCount; i++) {
        const angle = (i / outerIconsCount) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * outerCircleRadius;
        const y = 50 + Math.sin(angle) * outerCircleRadius;
        
        patternHtml += `
            <div style="position: absolute;
                        top: ${y}%;
                        left: ${x}%;
                        width: 12%;     <!-- 7% от ширины карточки -->
                        height: 12%;    <!-- 7% от высоты карточки -->
                        min-width: 12px; max-width: 18px;
                        min-height: 12px; max-height: 18px;
                        transform: translate(-50%, -50%);
                        opacity: 0.12;
                        background-image: url('${svgPath}');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;
                        ${filterStyle}">
            </div>
        `;
    }
    
    // 4. Самый внешний круг - 8 иконок
    const extraCircleIconsCount = 8;
    for (let i = 0; i < extraCircleIconsCount; i++) {
        const angle = (i / extraCircleIconsCount) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * extraCircleRadius;
        const y = 50 + Math.sin(angle) * extraCircleRadius;
        
        patternHtml += `
            <div style="position: absolute;
                        top: ${y}%;
                        left: ${x}%;
                        width: 11%;     <!-- 6% от ширины карточки -->
                        height: 11%;    <!-- 6% от высоты карточки -->
                        min-width: 10px; max-width: 16px;
                        min-height: 10px; max-height: 16px;
                        transform: translate(-50%, -50%);
                        opacity: 0.08;
                        background-image: url('${svgPath}');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;
                        ${filterStyle}">
            </div>
        `;
    }
    
    patternHtml += '</div>';
    return patternHtml;
}

// Добавим функцию для создания паттерна в карточке (аналогично модалке)
function getNFTCardPattern(svgPath) {
    if (!svgPath) return '';
    
    const iconSize = 30; // Меньше для карточки
    const innerCircleRadius = 15;
    const outerCircleRadius = 30;
    
    let patternHtml = '<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; opacity: 0.2;">';
    
    // Внутренний круг
    const innerIconsCount = 6;
    for (let i = 0; i < innerIconsCount; i++) {
        const angle = (i / innerIconsCount) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * innerCircleRadius;
        const y = 50 + Math.sin(angle) * outerCircleRadius;
        
        patternHtml += `
            <div style="position: absolute;
                        top: ${y}%;
                        left: ${x}%;
                        width: ${iconSize}px;
                        height: ${iconSize}px;
                        transform: translate(-50%, -50%);
                        background-image: url('${svgPath}');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;
                        ${filterStyle}">
            </div>
        `;
    }
    
    // Внешний круг
    const outerIconsCount = 8;
    for (let i = 0; i < outerIconsCount; i++) {
        const angle = (i / outerIconsCount) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * outerCircleRadius;
        const y = 50 + Math.sin(angle) * outerCircleRadius;
        
        patternHtml += `
            <div style="position: absolute;
                        top: ${y}%;
                        left: ${x}%;
                        width: ${iconSize}px;
                        height: ${iconSize}px;
                        transform: translate(-50%, -50%);
                        background-image: url('${svgPath}');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;
                        ${filterStyle}">
            </div>
        `;
    }
    
    patternHtml += '</div>';
    return patternHtml;
}

// Просмотр NFT
function viewNFT(nftId) {
    console.log('👀 Открытие NFT из инвентаря:', nftId);
    
    // Находим NFT в кэше пользователя
    const nft = window.cachedUserNFTs.find(item => item.id == nftId); // Используем == вместо ===
    
    if (!nft) {
        console.error('❌ NFT не найден в кэше пользователя');
        return;
    }
    
    console.log('📊 Данные NFT для модалки:', nftId);

    if (window.socket && window.socket.connected) {
        window.socket.emit('check_nft_sale_status', nftId);
        window.socket.once('nft_sale_status', (data) => {
            console.log('📊 Статус продажи от сервера:', data);
            if (data.success && data.onSale) {
                // Принудительно обновляем статус
                nft.forSale = true;
                nft.salePrice = data.price;
                console.log('✅ Обновлен статус продажи:', nft);
            }
        });
    }
    
    // ОБНОВЛЕНО: Подготавливаем данные для модалки
    const nftData = {
        ...nft,
        // Добавляем цену, если NFT на продаже
        price: nft.forSale ? nft.salePrice : 0,
        // Сохраняем статус продажи
        forSale: nft.forSale || false,
        // Явно указываем что пользователь владеет (в инвентаре)
        ownedByUser: true
    };
    
    console.log('🚀 Передаем в модалку:', nftData);
    
    if (window.updateNFTModal) {
        window.updateNFTModal(nftData);
    } else {
        console.error('❌ Функция updateNFTModal не найдена');
    }
    
    if (window.openNFTModal) {
        window.openNFTModal();
    } else {
        console.error('❌ Функция openNFTModal не найдена');
    }
    
    if (window.vibrate) window.vibrate([3, 5, 3]);
}

// Инициализация инвентаря
async function initInventory() {
    await fetchCollections();
    await loadInventoryItems();
    updateActiveFilters();
    setupFilterModalClickOutside();
}

// Экспорт функций
window.openFilterModal = openFilterModal;
window.closeFilterModal = closeFilterModal;
window.selectFilterItem = selectFilterItem;
window.selectFilterButton = selectFilterButton;
window.clearFilters = clearFilters;
window.applyFilters = applyFilters;
window.viewNFT = viewNFT;
window.getRarityColor = getRarityColor;
window.getRarityBySupply = getRarityBySupply;
window.cachedUserNFTs = cachedUserNFTs;