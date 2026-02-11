// nft-modal.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
let currentNFT = null;
let selectedTransferUser = null;
let searchDebounceTimer = null;
let isKeyboardOpen = false;
let currentUser = null;


function generateUpgradedNFTDisplay(nft, containerSelector, size = 'medium') {
    const container = document.querySelector(containerSelector);
    if (!container || !nft) return;
    
    // Проверяем, улучшенный ли это NFT
    const isUpgraded = nft.update === 1;
    
    if (!isUpgraded) {
        // Для обычного NFT
        const rarityColor = getRarityColor(nft.rarity);
        const hasImage = nft.image && (nft.image.startsWith('/') || nft.image.startsWith('http'));
        
        if (hasImage) {
            container.innerHTML = `
                <img src="${nft.image}" 
                     alt="${nft.fullName}" 
                     style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px; z-index: 2;">
            `;
            container.style.background = 'transparent';
        } else {
            container.innerHTML = `<span style="font-size: ${size === 'small' ? '1.8em' : '2.5em'}; z-index: 2;">
                ${nft.image || '🎴'}
            </span>`;
            container.style.background = `${rarityColor}20`;
        }
        return;
    }
    
    // Для улучшенного NFT - ТОЧНО КАК В ИСТОРИИ
    let backgroundStyle = '';
    let patternHtml = '';
    
    // 1. Фон (радиальный градиент как в истории)
    if (nft.backgroundData && nft.backgroundData.back_0 && nft.backgroundData.back_100) {
        backgroundStyle = `background: radial-gradient(circle, #${nft.backgroundData.back_0} 0%, #${nft.backgroundData.back_100} 100%);`;
    } else {
        const rarityColor = getRarityColor(nft.rarity);
        backgroundStyle = `background: ${rarityColor}70;`;
    }
    
    // 2. Паттерн (ТОЧНО как в истории - 3 круга)
    if (nft.patternData && nft.patternData.file_name) {
        const svgPath = `/m_nft_image/patterns/${nft.patternData.file_name}.svg`;
        // ПЕРЕДАЕМ ЦВЕТ ФОНА ДЛЯ АДАПТАЦИИ
        const bgColor = nft.backgroundData?.back_0 || null;
        patternHtml = getNFTPatternForModal(svgPath, size, bgColor);
    }
    
    // 3. Модель (центрированная как в истории)
    if (nft.modelData && nft.modelData.file_name) {
        const modelImagePath = `/m_nft_image/${nft.collectionName || nft.collection_name}/${nft.modelData.file_name}.PNG`;
        
        container.innerHTML = `
            <div style="${backgroundStyle} width: 100%; height: 100%; position: relative; border-radius: 8px; overflow: hidden;">
                ${patternHtml}
                <img src="${modelImagePath}" 
                     alt="${nft.modelData.name}" 
                     style="width: 100%; height: 100%; object-fit: contain; position: relative; z-index: 2; padding: 8px;">
            </div>
        `;
    } else {
        // Если нет модели, показываем стандартный фон с паттерном
        container.innerHTML = `
            <div style="${backgroundStyle} width: 100%; height: 100%; position: relative; border-radius: 8px; overflow: hidden;">
                ${patternHtml}
                <span style="position: relative; z-index: 2; font-size: 1.8em; display: flex; align-items: center; justify-content: center; height: 100%;">
                    ${nft.image || '🎴'}
                </span>
            </div>
        `;
    }
    
    // Настройки размера контейнера
    const sizes = {
        'small': { width: '48px', height: '48px' },
        'medium': { width: '60px', height: '60px' },
        'large': { width: '80px', height: '80px' }
    };
    
    const sizeSettings = sizes[size] || sizes.medium;
    container.style.width = sizeSettings.width;
    container.style.height = sizeSettings.height;
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';
}

function getNFTPatternForModal(svgPath, containerSize = 'medium', bgColor = null) {
    if (!svgPath) return '';
    
    // ПОЛУЧАЕМ ФИЛЬТР ДЛЯ АДАПТАЦИИ ЦВЕТА ПОД ФОН - ТОЧНО КАК В МАРКЕТЕ И ПРОФИЛЕ
    const filterStyle = bgColor ? getPatternFilterStyle(bgColor) : '';
    
    // Размеры в зависимости от контейнера
    const sizes = {
        'small': { iconSize: '10%', minMax: '6px 16px' },
        'medium': { iconSize: '12%', minMax: '8px 20px' },
        'large': { iconSize: '14%', minMax: '10px 24px' }
    };
    
    const sizeSettings = sizes[containerSize] || sizes.medium;
    const iconSize = sizeSettings.iconSize;
    const [minSize, maxSize] = sizeSettings.minMax.split(' ');
    
    // Параметры ТОЧНО как в истории (profile-history.js)
    const innerCircleRadius = 38;    // Внутренний круг (первый ряд)
    const middleCircleRadius = 46;   // Средний круг (второй ряд)
    const outerCircleRadius = 58;    // Внешний круг (третий ряд)
    
    let patternHtml = '<div class="nft-pattern" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; border-radius: 8px; overflow: hidden; z-index: 1;">';
    
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
                        width: ${iconSize};
                        height: ${iconSize};
                        min-width: ${minSize}; max-width: ${maxSize};
                        min-height: ${minSize}; max-height: ${maxSize};
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
                        width: ${iconSize};
                        height: ${iconSize};
                        min-width: ${minSize}; max-width: ${maxSize};
                        min-height: ${minSize}; max-height: ${maxSize};
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
    
    // 3. Внешний круг - 8 иконок
    const outerIconsCount = 8;
    for (let i = 0; i < outerIconsCount; i++) {
        const angle = (i / outerIconsCount) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * outerCircleRadius;
        const y = 50 + Math.sin(angle) * outerCircleRadius;
        
        patternHtml += `
            <div style="position: absolute;
                        top: ${y}%;
                        left: ${x}%;
                        width: ${iconSize};
                        height: ${iconSize};
                        min-width: ${minSize}; max-width: ${maxSize};
                        min-height: ${minSize}; max-height: ${maxSize};
                        transform: translate(-50%, -50%);
                        opacity: 0.1;
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

function initCurrentUser() {
    const tg = window.Telegram?.WebApp;
    currentUser = tg?.initDataUnsafe?.user;
}

// ===== Подтверждение =====
function createConfirmationModal() {
    const modal = document.createElement('div');
    modal.id = 'confirmationModal';
    modal.className = 'confirmation-modal';
    modal.innerHTML = `
        <div class="confirmation-modal-overlay" onclick="closeConfirmationModal()"></div>
        <div class="confirmation-modal-content">
            <div class="confirmation-header">
                <h3>Подтверждение передачи</h3>
            </div>
            
            <!-- ИСПРАВЛЕНО: Добавляем строку с NFT как в модалке продажи -->
            <div class="confirmation-nft-row" style="display: flex; align-items: center; padding: 12px; margin: 12px 0; background: var(--surface-dark); border-radius: 12px;">
                <!-- Контейнер для картинки NFT -->
                <div id="confirmationNftImage" 
                     style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 8px; overflow: hidden; margin-right: 12px; flex-shrink: 0;">
                    🎴
                </div>
                
                <!-- Название NFT -->
                <div style="flex: 1; min-width: 0;">
                    <div id="confirmationNftName" 
                         style="font-weight: 600; font-size: 0.95em; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        NFT
                    </div>
                    <div style="font-size: 0.8em; color: var(--text-secondary); margin-top: 2px;">
                        ID получателя: <span id="confirmationUserId">...</span>
                    </div>
                </div>
            </div>
            
            <!-- ИСПРАВЛЕНО: Добавляем информацию о стоимости -->
            <div class="confirmation-cost-row">
                <div style="font-size: 0.9em; color: var(--text-secondary); margin-bottom: 4px;">
                    Стоимость передачи
                </div>
                <div style="font-size: 1.4em; font-weight: 700; color: var(--accent); display: flex; align-items: center; justify-content: center;">
                    <span style="margin-right: 6px;">5</span>
                    <span style="color: #FFD700; font-size: 1.2em;">⭐</span>
                </div>
            </div>
            
            <div class="confirmation-footer">
                <button class="confirmation-cancel" onclick="closeConfirmationModal()">Отменить</button>
                <button class="confirmation-confirm" onclick="processTransfer()">Подтвердить</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Функция открытия модалки подтверждения
function openConfirmationModal() {
    if (!currentNFT || !selectedTransferUser) return;
    
    const modal = document.getElementById('confirmationModal');
    if (!modal) createConfirmationModal();
    
    // Обновляем данные NFT
    updateConfirmationModalContent();
    
    modal.classList.add('active');
    if (window.vibrate) window.vibrate(1);
}

// ИСПРАВЛЕНО: Добавляем функцию обновления контента модалки
function updateConfirmationModalContent() {
    if (!currentNFT || !selectedTransferUser) return;
    
    // 1. Используем ТУ ЖЕ ФУНКЦИЮ что и в модалке продажи
    const nftImageElement = document.getElementById('confirmationNftImage');
    if (nftImageElement) {
        generateUpgradedNFTDisplay(currentNFT, '#confirmationNftImage', 'medium');
    }
    
    // 2. Обновляем название NFT
    const nftNameElement = document.getElementById('confirmationNftName');
    if (nftNameElement) {
        nftNameElement.textContent = currentNFT.fullName || `NFT #${currentNFT.number}`;
        const rarityColor = getRarityColor(currentNFT.rarity);
        nftNameElement.style.color = rarityColor;
    }
    
    // 3. Обновляем ID получателя
    const userIdElement = document.getElementById('confirmationUserId');
    if (userIdElement) {
        userIdElement.textContent = selectedTransferUser;
    }
}

function processTransfer() {
    if (!currentNFT || !selectedTransferUser) return;
    
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    
    if (!user?.id) {
        console.error('❌ User ID not found');
        closeConfirmationModal();
        return;
    }
    
    console.log(`🔄 Processing NFT transfer #${currentNFT.id} from ${user.id} to ${selectedTransferUser}`);
    
    // Показываем индикатор загрузки на кнопке
    const confirmButton = document.querySelector('.confirmation-confirm');
    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.innerHTML = '<div class="mini-spinner" style="width: 20px; height: 20px;"></div>';
    }
    
    // Отправляем запрос на сервер
    if (window.socket && window.socket.connected) {
        window.socket.emit('transfer_nft', {
            nftId: currentNFT.id,
            fromUserId: user.id,
            toUserId: selectedTransferUser
        });
    } else {
        // Восстанавливаем кнопку при ошибке соединения
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Подтвердить';
        }
        
        closeConfirmationModal();
        
        if (window.tg?.showPopup) {
            window.tg.showPopup({
                title: 'Ошибка',
                message: 'Нет соединения с сервером'
            });
        }
    }
}

// Функция закрытия модалки подтверждения
function closeConfirmationModal() {
    const modal = document.getElementById('confirmationModal');
    if (modal) modal.classList.remove('active');
    
    // Восстанавливаем кнопку
    const confirmButton = document.querySelector('.confirmation-confirm');
    if (confirmButton) {
        confirmButton.disabled = false;
        confirmButton.textContent = 'Подтвердить передачу';
    }
    
    if (window.vibrate) window.vibrate(1);
}



function createNFTModal() {
    const modal = document.createElement('div');
    modal.id = 'nftModal';
    modal.className = 'filter-modal nft-modal';
    modal.innerHTML = `
        <div class="filter-modal-content">
            <div class="nft-header">
                <!-- Кнопка меню в правом верхнем углу -->
                <button class="nft-menu-button" onclick="toggleNFTMenu(event)" style="position: absolute; top: 15px; right: 15px; z-index: 10;">
                    ⋮
                </button>
                
                <!-- Выпадающее меню (будет вставлено сюда) -->
                
                <div class="nft-preview">
                    <img id="nftModalImage" class="nft-preview-image" src="" alt="NFT">
                </div>
                <div id="nftModalName" class="nft-title">NFT #123</div>
                
                <!-- Контейнер для кнопок действий (продать/передать) -->
                <div class="nft-actions">
                    <!-- Кнопки будут добавлены динамически -->
                </div>
            </div>
            
            <div class="filter-modal-body">
                <div class="nft-info-section">
                    <div class="nft-info-table">
                        <!-- Строка 1: Дата -->
                        <div class="nft-info-row">
                            <div class="nft-info-label">Дата:</div>
                            <div id="nftModalDate" class="nft-info-value">01.01.2024</div>
                        </div>
                        
                        <!-- Строка 2: Стоимость -->
                        <div class="nft-info-row">
                            <div class="nft-info-label">Стоимость:</div>
                            <div id="nftModalValue" class="nft-info-value">100 ⭐</div>
                        </div>
                        
                        <!-- Строка 3: Редкость -->
                        <div class="nft-info-row">
                            <div class="nft-info-label">Редкость:</div>
                            <div id="nftModalRarity" class="nft-info-value">
                                <span class="rarity-value rarity-legendary">Легендарный</span>
                            </div>
                        </div>
                        
                        <!-- Строка 4: Всего -->
                        <div class="nft-info-row">
                            <div class="nft-info-label">Всего:</div>
                            <div id="nftModalTotalSupply" class="nft-info-value">50 шт.</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                <button class="filter-modal-apply" onclick="closeNFTModal()">OK</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Создаем выпадающее меню
    createNFTDropdownMenu();
    
    setupNFTModalEvents();
}

function createNFTDropdownMenu() {
    const dropdown = document.createElement('div');
    dropdown.className = 'nft-menu-dropdown';
    dropdown.innerHTML = `
        <a class="nft-menu-item-pin" onclick="pinNFT(); closeNFTMenu();">
            <span class="menu-icon">📌</span>
            <span class="menu-text">Закрепить</span>
        </a>
    `;
    
    // ВСТАВЛЯЕМ ПРЯМО ПОСЛЕ КНОПКИ МЕНЮ, а не в конец заголовка
    const menuButton = document.querySelector('.nft-menu-button');
    if (menuButton) {
        menuButton.parentNode.insertBefore(dropdown, menuButton.nextSibling);
    }
}

function toggleNFTMenu(event) {
    event.stopPropagation();
    
    const menuButton = event.currentTarget; // Используем currentTarget вместо target
    const dropdown = menuButton.nextElementSibling;
    
    // Проверяем, что это действительно dropdown
    if (dropdown && dropdown.classList.contains('nft-menu-dropdown')) {
        const isActive = dropdown.classList.contains('active');
        
        // Закрываем все другие меню
        closeAllNFTMenus();
        
        // Открываем/закрываем текущее меню
        if (!isActive) {
            dropdown.classList.add('active');
        }
        
        // Закрытие по клику вне меню
        const closeMenuOnClickOutside = (e) => {
            if (!dropdown.contains(e.target) && !menuButton.contains(e.target)) {
                dropdown.classList.remove('active');
                document.removeEventListener('click', closeMenuOnClickOutside);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenuOnClickOutside);
        }, 10);
    }
    
    if (window.vibrate) window.vibrate(1);
}

function closeAllNFTMenus() {
    // Закрываем все меню
    document.querySelectorAll('.nft-menu-dropdown').forEach(menu => {
        menu.classList.remove('active');
    });
    
    // Закрываем старые меню (если есть)
    document.querySelectorAll('.nft-menu').forEach(m => {
        m.classList.remove('active');
    });
}

function pinNFT() {
    if (!currentNFT) return;
    
    console.log('📌 Запрос закрепления NFT:', currentNFT);
    
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    
    if (!user?.id) {
        console.error('❌ User ID not found');
        return;
    }
    
    // Закрываем меню
    closeAllNFTMenus();
    
    // Показываем индикатор загрузки
    const menuButton = document.querySelector('.nft-menu-button');
    if (menuButton) {
        menuButton.disabled = true;
        menuButton.innerHTML = '<div class="mini-spinner"></div>';
    }
    
    // Отправляем запрос на сервер
    if (window.socket && window.socket.connected) {
        window.socket.emit('toggle_pin_nft', {
            nftId: currentNFT.id,
            userId: user.id
        });
        
        // Обработка ответа
        window.socket.once('pin_toggled', (data) => {
            // Восстанавливаем кнопку меню
            if (menuButton) {
                menuButton.disabled = false;
                menuButton.textContent = '⋮';
            }
            
            if (data.success) {
                const actionText = data.action === 'pin' ? 'закреплен' : 'откреплен';
                
                // Обновляем currentNFT если нужно
                if (currentNFT) {
                    currentNFT.pinned = data.action === 'pin' ? data.pinOrder : null;
                }
                
                // Обновляем отображение в инвентаре если нужно
                if (window.loadInventoryItems) {
                    window.loadInventoryItems();
                }
                
            }
        });
        
        // Таймаут на случай отсутствия ответа
        setTimeout(() => {
            window.socket.off('pin_toggled');
            if (menuButton && menuButton.disabled) {
                menuButton.disabled = false;
                menuButton.textContent = '⋮';
            }
        }, 5000);
        
    } else {
        if (menuButton) {
            menuButton.disabled = false;
            menuButton.textContent = '⋮';
        }
    }
    closeNFTModal();
    if (window.vibrate) window.vibrate([3, 5, 3]);
}

function setupNFTModalEvents() {
    const modal = document.getElementById('nftModal');
    if (!modal) return;
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeNFTModal();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeNFTModal();
        }
    });
}

function openNFTModal() {
    const modal = document.getElementById('nftModal');
    if (modal) {
        modal.classList.add('active');
        updateNFTMenuContent();
    }
    if (window.vibrate) window.vibrate(1);
}

function resetNFTModal() {
    const actionsContainer = document.querySelector('.nft-actions');
    const modalFooter = document.querySelector('.modal-footer');
    
    if (actionsContainer) {
        actionsContainer.style.display = 'flex';
        actionsContainer.innerHTML = `
            <button class="nft-action-btn" onclick="sellNFT()">
                <span class="action-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Prime Icons by PrimeTek - https://github.com/primefaces/primeicons/blob/master/LICENSE --><path fill="currentColor" fill-rule="evenodd" d="M12.121 4.925a.25.25 0 0 0-.242 0l-8.515 4.73a.75.75 0 0 1-.728-1.31l8.514-4.73a1.75 1.75 0 0 1 1.7 0l8.514 4.73a.75.75 0 1 1-.728 1.31zM9.25 9a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5h-4A.75.75 0 0 1 9.25 9M6 11.25a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5a.75.75 0 0 1 .75-.75m4 0a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5a.75.75 0 0 1 .75-.75m4 0a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5a.75.75 0 0 1 .75-.75m4 0a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5a.75.75 0 0 1 .75-.75M4.25 20a.75.75 0 0 1 .75-.75h14a.75.75 0 1 1 0 1.5H5a.75.75 0 0 1-.75-.75" clip-rule="evenodd"/></svg></span>
                <span>Продать</span>
            </button>
            <button class="nft-action-btn" onclick="transferNFT()">
                <span class="action-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16"><!-- Icon from Gitlab SVGs by GitLab B.V. - https://gitlab.com/gitlab-org/gitlab-svgs/-/blob/main/LICENSE --><path fill="currentColor" fill-rule="evenodd" d="M11.78 5.841a.75.75 0 0 1-1.06 0l-1.97-1.97v7.379a.75.75 0 0 1-1.5 0V3.871l-1.97 1.97a.75.75 0 0 1-1.06-1.06l3.25-3.25L8 1l.53.53l3.25 3.25a.75.75 0 0 1 0 1.061M2.5 9.75a.75.75 0 0 0-1.5 0V13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.75a.75.75 0 0 0-1.5 0V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5z" clip-rule="evenodd"/></svg></span>
                <span>Передать</span>
            </button>
        `;
    }
    
    if (modalFooter) {
        modalFooter.innerHTML = `
            <button class="filter-modal-apply" onclick="closeNFTModal()">OK</button>
        `;
    }
    
    currentNFT = null;
}

function closeNFTModal() {
    const modal = document.getElementById('nftModal');
    if (modal) modal.classList.remove('active');
    
    // Очищаем фон и паттерны
    const nftHeader = document.querySelector('.nft-header');
    if (nftHeader) {
        nftHeader.style.background = 'linear-gradient(135deg, #2a7fff20 0%, #00d4aa20 100%)';
        
        const pattern = nftHeader.querySelector('.nft-header-pattern');
        if (pattern) pattern.remove();
    }
    
    // Закрываем меню если открыто
    closeAllNFTMenus();
    
    currentNFT = null;
    resetNFTModal();
    if (window.vibrate) window.vibrate(1);
}

function updateNFTModal(nft) {
    currentNFT = nft;
    
    // Обновляем заголовок и изображение
    document.getElementById('nftModalName').textContent = nft.fullName || `NFT #${nft.number}`;
    updateNFTModalImage(nft);
    
    // Обновляем меню перед открытием
    setTimeout(() => {
        updateNFTMenuContent();
    }, 50);
    
    const nftInfoTable = document.querySelector('.nft-info-table');
    if (!nftInfoTable) return;
    
    let infoHTML = `
        <!-- Дата всегда показываем -->
        <div class="nft-info-row">
            <div class="nft-info-label">Дата:</div>
            <div class="nft-info-value">
                ${nft.createdAt ? new Date(nft.createdAt).toLocaleDateString('ru-RU') : 'Неизвестно'}
            </div>
        </div>
    `;
    
    // ТОЛЬКО для НЕулучшенных NFT показываем стоимость и всего
    if (nft.update !== 1) {
        infoHTML += `
            <div class="nft-info-row">
                <div class="nft-info-label">Стоимость:</div>
                <div class="nft-info-value">${calculateNFTPrice(nft)} ⭐</div>
            </div>
            
            <div class="nft-info-row">
                <div class="nft-info-label">Всего:</div>
                <div class="nft-info-value">${nft.totalSupply || '?'} шт.</div>
            </div>
        `;
    }
    
    infoHTML += `
        <div class="nft-info-row">
            <div class="nft-info-label">Редкость:</div>
            <div class="nft-info-value">
                <span class="rarity-value">${nft.rarity || '0'}</span>
            </div>
        </div>
    `;
    
    // ТОЛЬКО для улучшенных NFT добавляем компоненты с иконками редкости
    if (nft.update === 1) {
        const addComponent = (data, label) => {
            if (!data || !data.name) return '';
            
            const rarityPercent = data.rarity ? `${data.rarity}%` : '';
            const rarityCircle = rarityPercent ? `
                <span class="rarity-circle">${rarityPercent}</span>
            ` : '';
            
            return `
                <div class="nft-info-row">
                    <div class="nft-info-label">${label}:</div>
                    <div class="nft-info-value">
                        <span class="component-name">${data.name}</span>
                        ${rarityCircle}
                    </div>
                </div>
            `;
        };
        
        // Добавляем компоненты если они есть
        infoHTML += addComponent(nft.modelData, 'Модель');
        infoHTML += addComponent(nft.patternData, 'Узор');
        infoHTML += addComponent(nft.backgroundData, 'Фон');
    }
    
    nftInfoTable.innerHTML = infoHTML;
    
    const isOwner = nft.ownedByUser || checkIfUserOwnsNFT(nft.id);
    updateNFTButtons(isOwner, calculateNFTPrice(nft), nft.forSale);
}

function upgradeNFT() {
    console.log('🔼 Запрос на улучшение NFT:', currentNFT);
    
    if (!currentNFT) {
        console.error('❌ Нет текущего NFT для улучшения');
        return;
    }
    
    if (currentNFT.updateble != 1) {
        if (window.tg?.showPopup) {
            window.tg.showPopup({
                title: 'Недоступно',
                message: 'Этот NFT нельзя улучшать'
            });
        }
        return;
    }
    
    if (window.showUpgradeConfirmation) {
        window.showUpgradeConfirmation(currentNFT);
    } else {
        console.error('❌ Функция showUpgradeConfirmation не найдена');
        // Fallback
        window.tg?.showPopup({
            title: 'Улучшение',
            message: `Улучшение "${currentNFT.fullName}" в разработке`
        });
    }
}

function updateNFTFooter() {
    const modalFooter = document.querySelector('.modal-footer');
    if (!modalFooter) return;
    
    // Проверяем все условия для показа кнопки улучшения
    const canUpgrade = currentNFT?.ownedByUser && 
                      currentNFT?.updateble == 1 && 
                      currentNFT?.update !== 1;
    
    console.log('🔍 updateNFTFooter проверка:', {
        canUpgrade,
        ownedByUser: currentNFT?.ownedByUser,
        updateble: currentNFT?.updateble,
        update: currentNFT?.update
    });
    
    if (canUpgrade) {
        modalFooter.innerHTML = `
            <button class="filter-modal-upgrade" onclick="upgradeNFT()">
                Улучшить 1⭐
            </button>
        `;
    } else {
        modalFooter.innerHTML = `
            <button class="filter-modal-apply" onclick="closeNFTModal()">OK</button>
        `;
    }
}


function updateNFTButtons(isOwner, price, forSale = false) {
    const actionsContainer = document.querySelector('.nft-actions');
    const modalFooter = document.querySelector('.modal-footer');
    const menuButton = document.querySelector('.nft-menu-button');
    
    if (!actionsContainer || !modalFooter || !menuButton) {
        console.error('❌ Не найден контейнер для кнопок или кнопка меню');
        return;
    }
    
    let showMenu = false;

    // ВСЕГДА показываем кнопку меню (три точки)
    menuButton.style.display = 'flex';
    
    console.log('🔍 Проверка улучшения NFT:', {
        isOwner,
        updateble: currentNFT?.updateble,
        update: currentNFT?.update,
        currentNFT: currentNFT
    });
    
    // Всегда показываем контейнер действий (он может быть скрыт позже)
    actionsContainer.style.display = 'flex';
    
    // 1. Проверяем, можно ли улучшать
    const canUpgrade = isOwner && 
                      currentNFT?.updateble == 1 && 
                      currentNFT?.update !== 1;
                      
    const isUpgraded = currentNFT?.update === 1;
    
    if (canUpgrade) {
        console.log('✅ Показываем кнопку Улучшить');
        showMenu = false; 
        
        // Прячем стандартные кнопки (продать/передать)
        actionsContainer.style.display = 'none';
        
        // Обновляем футер через специальную функцию
        updateNFTFooter();
        return; // Выходим раньше
    } else {
        if (isUpgraded && isOwner) {
            if (forSale) {
                showMenu = false; // Не показываем меню при продаже
            } else {
                showMenu = true; // ПОКАЗЫВАЕМ меню только здесь
            }
        } else {
            showMenu = false; // Не показываем для не-владельцев
        }
    }
    
    // 2. Стандартная логика для случаев без улучшения
    console.log('🔄 Обновление стандартных кнопок NFT:', { 
        isOwner, 
        price, 
        forSale,
        currentNFTId: currentNFT?.id
    });
    
    if (isUpgraded && isOwner) {
        // Если владеет И NFT выставлен на продажу
        if (forSale) {
            console.log('✅ NFT на продаже - показываем "Снять с продажи"');
            
            actionsContainer.style.display = 'none';
            
            modalFooter.innerHTML = `
                <button class="filter-modal-remove" onclick="removeFromSale(${currentNFT?.id})">
                    Снять с продажи
                </button>
                <button class="filter-modal-apply" onclick="closeNFTModal()">OK</button>
            `;
        } else {
            console.log('✅ NFT НЕ на продаже - показываем обычные кнопки');
            
            actionsContainer.innerHTML = `
                <button class="nft-action-btn" onclick="sellNFT(${currentNFT?.id})">
                    <span class="action-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Prime Icons by PrimeTek - https://github.com/primefaces/primeicons/blob/master/LICENSE --><path fill="currentColor" fill-rule="evenodd" d="M12.121 4.925a.25.25 0 0 0-.242 0l-8.515 4.73a.75.75 0 0 1-.728-1.31l8.514-4.73a1.75 1.75 0 0 1 1.7 0l8.514 4.73a.75.75 0 1 1-.728 1.31zM9.25 9a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5h-4A.75.75 0 0 1 9.25 9M6 11.25a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5a.75.75 0 0 1 .75-.75m4 0a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5a.75.75 0 0 1 .75-.75m4 0a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5a.75.75 0 0 1 .75-.75m4 0a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5a.75.75 0 0 1 .75-.75M4.25 20a.75.75 0 0 1 .75-.75h14a.75.75 0 1 1 0 1.5H5a.75.75 0 0 1-.75-.75" clip-rule="evenodd"/></svg></span>
                    <span>Продать</span>
                </button>
                <button class="nft-action-btn" onclick="transferNFT(${currentNFT?.id})">
                    <span class="action-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16"><!-- Icon from Gitlab SVGs by GitLab B.V. - https://gitlab.com/gitlab-org/gitlab-svgs/-/blob/main/LICENSE --><path fill="currentColor" fill-rule="evenodd" d="M11.78 5.841a.75.75 0 0 1-1.06 0l-1.97-1.97v7.379a.75.75 0 0 1-1.5 0V3.871l-1.97 1.97a.75.75 0 0 1-1.06-1.06l3.25-3.25L8 1l.53.53l3.25 3.25a.75.75 0 0 1 0 1.061M2.5 9.75a.75.75 0 0 0-1.5 0V13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.75a.75.75 0 0 0-1.5 0V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5z" clip-rule="evenodd"/></svg></span>
                    <span>Передать</span>
                </button>
            `;
            
            // Важно: обновляем футер для стандартного случая
            modalFooter.innerHTML = `
                <button class="filter-modal-apply" onclick="closeNFTModal()">OK</button>
            `;
        }
    } else {
        // Если не владеет
        actionsContainer.style.display = 'none';
        
        if (forSale && price > 0) {
            modalFooter.innerHTML = `
                <button class="filter-modal-buy" onclick="buyNFTFromModal(${currentNFT?.id}, ${price})">
                    Купить за ${price} ⭐
                </button>
                <button class="filter-modal-apply" onclick="closeNFTModal()">OK</button>
            `;
        } else {
            modalFooter.innerHTML = `
                <button class="filter-modal-apply" onclick="closeNFTModal()">OK</button>
            `;
        }
    }
    menuButton.style.display = showMenu ? 'flex' : 'none';
}

function removeFromSale() {
    if (!currentNFT) return;
    
    console.log('📥 Запрос на снятие с продажи NFT:', currentNFT);
    
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    
    if (!user?.id) {
        console.error('❌ User ID not found');
        return;
    }
    
    // Показываем подтверждение
    if (window.tg?.showConfirm) {
        window.tg.showConfirm(
            `Снять "${currentNFT.fullName}" с продажи?`,
            (confirmed) => {
                if (confirmed) {
                    processRemoveFromSale();
                }
            }
        );
    } else {
        processRemoveFromSale();
    }
    
    if (window.vibrate) window.vibrate([5, 3, 5]);
}

function processRemoveFromSale() {
    if (!currentNFT) return;
    
    console.log(`📤 Processing remove from sale for NFT #${currentNFT.id}`);
    
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    
    // Показываем индикатор загрузки на кнопке
    const removeButton = document.querySelector('.filter-modal-remove');
    if (removeButton) {
        removeButton.disabled = true;
        removeButton.innerHTML = '<div class="mini-spinner"></div>';
    }
    
    // Отправляем запрос на сервер
    if (window.socket && window.socket.connected) {
        window.socket.emit('remove_nft_from_sale', {
            nftId: currentNFT.id,
            userId: user.id
        });
        
        // Слушаем результат
        window.socket.once('nft_removed_from_sale', (data) => {
            // Восстанавливаем кнопку
            if (removeButton) {
                removeButton.disabled = false;
                removeButton.innerHTML = 'Снять с продажи';
            }
            
            if (data.success) {
                // Показываем уведомление
                if (window.tg?.showPopup) {
                    window.tg.showPopup({
                        title: 'Успешно!',
                        message: 'NFT снят с продажи'
                    });
                }
                
                // Закрываем модалку
                closeNFTModal();
                
                // Обновляем инвентарь и маркет
                if (window.loadInventoryItems) {
                    window.loadInventoryItems();
                }
                
                if (window.loadMarketItems) {
                    window.loadMarketItems();
                }
                
            } else {
                if (window.tg?.showPopup) {
                    window.tg.showPopup({
                        title: 'Ошибка',
                        message: data.error || 'Не удалось снять с продажи'
                    });
                }
            }
        });
        
    } else {
        // Восстанавливаем кнопку при ошибке соединения
        if (removeButton) {
            removeButton.disabled = false;
            removeButton.innerHTML = 'Снять с продажи';
        }
        
        if (window.tg?.showPopup) {
            window.tg.showPopup({
                title: 'Ошибка',
                message: 'Нет соединения с сервером'
            });
        }
    }
}

function buyNFTFromModal() {
    if (!currentNFT) return;
    
    const price = currentNFT.price || calculateNFTPrice(currentNFT);
    
    // Используем универсальный менеджер покупок
    if (window.purchaseManager) {
        // Определяем источник по контексту
        const source = currentNFT.forSale ? 'market' : 'inventory';
        window.purchaseManager.showConfirmation(currentNFT, source);
    } else {
        // Fallback на старую логику
        showOldPurchaseConfirmation(currentNFT.id, price, currentNFT.fullName);
    }
}

function calculateNFTPrice(nft) {
    console.log('🧮 calculateNFTPrice вызвана с:', {
        id: nft.id,
        forSale: nft.forSale,
        price: nft.price,
        collectionPrice: nft.collectionPrice
    });
    
    // Приоритет 1: если NFT на продаже
    if (nft.forSale && nft.price) {
        return nft.price;
    }
    
    // Приоритет 2: цена из коллекции
    if (nft.collectionPrice && nft.collectionPrice > 0) {
        return nft.collectionPrice;
    }
    
    const supplyMultiplier = nft.totalSupply ? Math.max(1, 1000 / nft.totalSupply) : 1;
    const numberBonus = nft.number ? Math.max(1, 100 / nft.number) : 1;
    
    return Math.round(basePrice * numberBonus * supplyMultiplier);
}

function checkIfUserOwnsNFT(nftId) {
    // Проверяем в кэше пользователя
    const userNFT = window.cachedUserNFTs?.find(item => item.id == nftId);
    
    // Если нашли в кэше, проверяем ownedByUser или просто наличие
    if (userNFT) {
        return userNFT.ownedByUser !== false; // Если явно не указано false
    }
    
    // Проверяем текущего пользователя
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!tgUser?.id || !currentNFT?.ownerId) {
        return false;
    }
    
    // Сравниваем ID владельца с ID пользователя
    return currentNFT.ownerId == tgUser.id;
}

function sellNFT() {
    console.log('💰 Вызов sellNFT, currentNFT:', currentNFT);
    
    if (!currentNFT) {
        console.error('❌ Нет текущего NFT для продажи');
        return;
    }
    
    // Открываем модалку продажи вместо показа попапа
    openSellModal();
}

// ФУНКЦИЯ ПЕРЕДАЧИ NFT - ОБНОВЛЕННАЯ
function transferNFT() {
    console.log('🔄 transferNFT вызвана, currentNFT:', currentNFT);
    
    if (!currentNFT) {
        console.error('❌ Нет текущего NFT для передачи');
        return;
    }

    openTransferModal();
}

// Создайте новую модалку передачи
function createTransferModal() {
    const modal = document.createElement('div');
    modal.id = 'transferModal';
    modal.className = 'filter-modal transfer-modal';
    modal.innerHTML = `
        <div class="filter-modal-content">
            <div class="transfer-header">
                <div class="transfer-header-top">
                    <h3>Передача NFT</h3>
                </div>
                
                <!-- КОНТЕЙНЕР ДЛЯ ПОИСКА И ВЫБРАННОГО ПОЛЬЗОВАТЕЛЯ -->
                <div class="search-container-top" id="searchContainer">
                    <!-- Строка поиска по умолчанию -->
                    <div class="search-input-container" id="searchInputContainer">
                        <span class="search-icon">🔍</span>
                        <input 
                            type="text" 
                            id="userSearchInput" 
                            class="search-input" 
                            placeholder="Введите ID пользователя..."
                            oninput="searchUsers()"
                            inputmode="numeric"
                            pattern="[0-9]*"
                        >
                    </div>
                    
                    <!-- Отображение выбранного пользователя (скрыто по умолчанию) -->
                    <div class="selected-user-display" id="selectedUserDisplay" style="display: none;">
                        <button class="selected-user-clear" onclick="clearSelectedUser()">✕</button>
                        <div class="selected-user-avatar">👤</div>
                        <div class="selected-user-info">
                            <div class="selected-user-id" id="selectedUserId">ID: ...</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="transfer-body">
                <div class="search-results" id="searchResults">
                    <div class="empty-search">
                        <div class="empty-search-icon">👤</div>
                        <p>Начните поиск</p>
                        <p class="search-hint">Введите минимум 2 цифры ID пользователя</p>
                    </div>
                </div>
            </div>
            
            <div class="transfer-footer">
                <button class="transfer-back" onclick="closeTransferModal()">Назад</button>
                <button class="transfer-confirm" onclick="confirmTransfer()" disabled>Передать</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setupTransferModalEvents();
}

// Создание модалки продажи NFT
function createSellModal() {
    const modal = document.createElement('div');
    modal.id = 'sellModal';
    modal.className = 'filter-modal sell-modal';
    modal.innerHTML = `
        <div class="filter-modal-content">
            <div class="sell-header">
                <div class="sell-header-top">
                    <h3>Выставить на продажу</h3>
                </div>
            </div>
            
            <div class="sell-body">
                <div class="sell-nft-row">
                    <!-- ИСПРАВЛЕНО: Используем тот же подход что в модалке просмотра -->
                    <div class="sell-nft-image-container" id="sellNftImage" 
                         style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 8px; overflow: hidden; position: relative;">
                        <!-- NFT будет отображен с фоном, паттерном и моделью -->
                    </div>
                    
                    <!-- Название и номер NFT -->
                    <div class="sell-nft-name-container">
                        <div class="sell-nft-name" id="sellNftName">Pepe #7</div>
                    </div>
                    
                    <!-- Правая часть: Your Price и поле ввода -->
                    <div class="sell-price-container">
                        <div class="price-input-wrapper">
                            <input 
                                type="number" 
                                id="sellPriceInput" 
                                class="sell-price-input" 
                                placeholder="Price"
                                min="5"
                                max="1000"
                                oninput="updateSellButton()"
                            >
                            <span class="price-icon-static">⭐</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="sell-footer">
                <button class="sell-cancel" onclick="closeSellModal()">Закрыть</button>
                <button class="sell-confirm" onclick="confirmSell()" disabled>
                    <span class="confirm-price-text">Выставить за</span>
                    <span class="confirm-price-value" id="confirmPrice">0</span>
                    <span class="confirm-price-text"> ⭐</span>
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setupSellModalEvents();
}

// Обновление данных в модалке продажи
function updateSellModalData() {
    if (!currentNFT) return;
    
    const nftImage = document.getElementById('sellNftImage');
    const nftName = document.getElementById('sellNftName');
    const priceInput = document.getElementById('sellPriceInput');
    const confirmButton = document.querySelector('.sell-confirm');
    const confirmPriceSpan = document.getElementById('confirmPrice');
    
    if (nftImage) {
        // ИСПРАВЛЕНО: Используем обновленную функцию с паттерном как в истории
        generateUpgradedNFTDisplay(currentNFT, '#sellNftImage', 'medium');
    }
    
    if (nftName) {
        nftName.textContent = currentNFT.fullName || `NFT #${currentNFT.number}`;
        const rarityColor = getRarityColor(currentNFT.rarity);
        nftName.style.color = rarityColor;
    }
    
    if (priceInput) {
        priceInput.value = '';
        priceInput.placeholder = 'Цена';
    }
    
    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.innerHTML = `
            <span class="confirm-price-text">Выставить за</span>
            <span class="confirm-price-value" id="confirmPrice">0</span>
            <span class="confirm-price-text"> ⭐</span>
        `;
    }
    
    if (confirmPriceSpan) {
        confirmPriceSpan.textContent = '0';
    }
    
    // Обновляем кнопку
    updateSellButton();
}

function setupSellModalEvents() {
    const modal = document.getElementById('sellModal');
    if (!modal) return;
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSellModal();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeSellModal();
        }
    });
    
    // Обработка ввода цены
    const priceInput = document.getElementById('sellPriceInput');
    if (priceInput) {
        priceInput.addEventListener('input', (e) => {
            let value = e.target.value;
            if (value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) {
                e.target.value = value.replace(/^0+/, '');
            }
            if (value.length > 6) {
                e.target.value = value.slice(0, 6);
            }
            updateSellButton();
        });
        
        priceInput.addEventListener('focus', (e) => {
            e.target.parentElement.style.borderColor = 'var(--primary)';
            e.target.parentElement.style.background = 'var(--surface)';
        });
        
        priceInput.addEventListener('blur', (e) => {
            if (!e.target.value || parseInt(e.target.value) < 1) {
                e.target.value = '';
            }
            e.target.parentElement.style.borderColor = 'var(--border)';
            e.target.parentElement.style.background = 'var(--surface-dark)';
        });
        
        modal.addEventListener('animationend', () => {
            if (modal.classList.contains('active') && priceInput) {
                setTimeout(() => priceInput.focus(), 300);
            }
        });
    }
}

// Открытие модалки продажи
function openSellModal() {
    console.log('💰 Открытие sellModal для NFT:', currentNFT);
    
    if (!currentNFT) {
        console.error('❌ Нет текущего NFT для продажи');
        return;
    }
    
    const modal = document.getElementById('sellModal');
    if (!modal) {
        createSellModal();
    }
    
    selectedTransferUser = null;
    
    // Обновляем данные ДО показа модалки
    setTimeout(() => {
        updateSellModalData();
        modal.classList.add('active');
        updateSellButton();
    }, 50);
    
    setTimeout(() => {
        const priceInput = document.getElementById('sellPriceInput');
        if (priceInput) {
            priceInput.value = '';
            priceInput.focus();
        }
    }, 350);
    
    if (window.vibrate) window.vibrate(1);
}

// Закрытие модалки продажи
function closeSellModal() {
    console.log('📥 Закрытие sellModal');
    const modal = document.getElementById('sellModal');
    if (modal) {
        modal.classList.remove('active');
        
        const priceInput = document.getElementById('sellPriceInput');
        if (priceInput) priceInput.value = '';
        
        const confirmButton = document.querySelector('.sell-confirm');
        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.innerHTML = `
                <span class="confirm-price-text">Выставить за</span>
                <span class="confirm-price-value" id="confirmPrice">0</span>
                <span class="confirm-price-text"> ⭐</span>
            `;
        }
    }
    if (window.vibrate) window.vibrate(1);
}

// Обновление текста кнопки продажи
function updateSellButton() {
    const priceInput = document.getElementById('sellPriceInput');
    const confirmButton = document.querySelector('.sell-confirm');
    const confirmPriceSpan = document.getElementById('confirmPrice');
    
    if (!priceInput || !confirmButton || !confirmPriceSpan) return;
    
    const price = parseInt(priceInput.value) || 0;
    
    if (price > 0 && price <= 999999) {
        confirmButton.disabled = false;
        const priceWithCommission = Math.ceil(price * 1.15);
        confirmPriceSpan.textContent = priceWithCommission.toLocaleString();
        
        // Добавляем подсказку
        confirmPriceSpan.title = `Цена: ${price} + комиссия 15%`;
    } else {
        confirmButton.disabled = true;
        confirmPriceSpan.textContent = '0';
    }
}

// Подтверждение продажи
function confirmSell() {
    const priceInput = document.getElementById('sellPriceInput');
    if (!priceInput || !currentNFT) return;
    
    const price = parseInt(priceInput.value) || 0;
    
    if (price < 1) {
        if (window.tg?.showPopup) {
            window.tg.showPopup({
                title: 'Ошибка',
                message: 'Введите корректную цену'
            });
        }
        return;
    }
    
    if (price > 999999) {
        if (window.tg?.showPopup) {
            window.tg.showPopup({
                title: 'Ошибка',
                message: 'Максимальная цена - 999,999 ⭐'
            });
        }
        return;
    }
    
    const priceWithCommission = Math.ceil(price * 1.15);
    
    console.log(`💰 Подтверждение продажи NFT #${currentNFT.id}: ${price} ⭐ + комиссия = ${priceWithCommission} ⭐`);
    
    if (window.tg?.showConfirm) {
        window.tg.showConfirm(
            `Выставить "${currentNFT.fullName}" на продажу?\n\n` +
            `Цена: ${price} ⭐\n` +
            `С комиссией 15%: ${priceWithCommission} ⭐\n\n` +
            `Вы получите: ${Math.floor(price * 0.85)} ⭐`,
            (confirmed) => {
                if (confirmed) {
                    processSellNFT(priceWithCommission, price);
                }
            }
        );
    } else {
        processSellNFT(priceWithCommission, price);
    }
    
    if (window.vibrate) window.vibrate([5, 3, 5]);
}

function processSellNFT(priceWithCommission, originalPrice) {
    if (!currentNFT) return;
    
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    
    if (!user?.id) {
        console.error('❌ User ID not found');
        closeSellModal();
        return;
    }
    
    const confirmButton = document.querySelector('.sell-confirm');
    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.innerHTML = '<div class="mini-spinner"></div>';
    }
    
    let gotResponse = false;
    
    const handleResponse = (data) => {
        if (gotResponse) return; 
        gotResponse = true;
        
        console.log('🔄 Получен ответ от сервера:', data);
        
        // Восстанавливаем кнопку
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.innerHTML = `
                <span class="confirm-price-text">Выставить за</span>
                <span class="confirm-price-value">${priceWithCommission}</span>
                <span class="confirm-price-text"> ⭐</span>
            `;
        }
        
        if (data.success) {
            const sellerGets = Math.floor(originalPrice * 0.85);
            if (window.tg?.showPopup) {
                window.tg.showPopup({
                    title: 'Успешно!',
                    message: `NFT выставлен на продажу за ${priceWithCommission} ⭐!\n` +
                             `(Цена: ${originalPrice} ⭐, вы получите: ${sellerGets} ⭐)`
                });
            }
            
            closeSellModal();
            closeNFTModal();
            
            // Обновляем данные
            setTimeout(() => {
                if (window.loadInventoryItems) window.loadInventoryItems();
                if (window.loadMarketItems) window.loadMarketItems();
            }, 500);
            
        } else {
            if (window.tg?.showPopup) {
                window.tg.showPopup({
                    title: 'Ошибка',
                    message: data.error || 'Ошибка сервера'
                });
            }
        }
    };
    
    window.socket.on('nft_sale_listed', handleResponse);
    
    if (window.socket && window.socket.connected) {
        window.socket.emit('list_nft_for_sale', {
            nftId: currentNFT.id,
            sellerId: user.id,
            price: priceWithCommission
        });
        
        setTimeout(() => {
            window.socket.off('nft_sale_listed', handleResponse);
            
            if (!gotResponse && confirmButton && confirmButton.disabled) {
                confirmButton.disabled = false;
                confirmButton.innerHTML = `
                    <span class="confirm-price-text">Выставить за</span>
                    <span class="confirm-price-value">${priceWithCommission}</span>
                    <span class="confirm-price-text"> ⭐</span>
                `;
            }
        }, 10000);
    }
}

function setupTransferModalEvents() {
    const modal = document.getElementById('transferModal');
    if (!modal) return;
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeTransferModal();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeTransferModal();
        }
    });
}

function openTransferModal() {
    console.log('📤 Открытие transferModal');
    const modal = document.getElementById('transferModal');
    if (modal) {
        modal.classList.add('active');
        selectedTransferUser = null;
        updateTransferButton();
    }
    if (window.vibrate) window.vibrate(1);
}

function closeTransferModal() {
    console.log('📥 Закрытие transferModal');
    const modal = document.getElementById('transferModal');
    if (modal) {
        modal.classList.remove('active');
        selectedTransferUser = null;
        clearSelectedUser();
        
        const searchInput = document.getElementById('userSearchInput');
        if (searchInput) searchInput.value = '';
    }
    if (window.vibrate) window.vibrate(1);
}

// Функция поиска пользователей
async function searchUsers() {
    const searchInput = document.getElementById('userSearchInput');
    const results = document.getElementById('searchResults');
    
    if (!searchInput || !results) return;
    
    const query = searchInput.value.trim();
    
    // Очищаем предыдущий таймер
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }
    
    if (query.length < 2) {
        showEmptySearchState('Введите минимум 2 цифры');
        return;
    }
    
    const onlyDigits = /^\d+$/.test(query);
    if (!onlyDigits) {
        showEmptySearchState('Вводите только цифры');
        return;
    }
    
    // Показываем загрузку
    showLoadingState();
    
    searchDebounceTimer = setTimeout(async () => {
        try {
            if (window.socket && window.socket.connected) {
                window.socket.emit('search_users', query);
                
                window.socket.on('search_users_result', (data) => {
                    if (data.success) {
                        displaySearchResults(data.users, query);
                    } else {
                        showErrorState('Ошибка поиска');
                    }
                });
            } else {
                showErrorState('Нет соединения с сервером');
            }
        } catch (error) {
            console.error('Ошибка поиска:', error);
            showErrorState('Ошибка поиска');
        }
    }, 1000);
}

function showEmptySearchState(message = 'Начните поиск') {
    const results = document.getElementById('searchResults');
    if (!results) return;
    
    results.innerHTML = `
        <div class="empty-search">
            <div class="empty-search-icon">🔍</div>
            <p>${message}</p>
            <p class="search-hint">Поиск по ID или username</p>
        </div>
    `;
}

function showLoadingState() {
    const results = document.getElementById('searchResults');
    if (!results) return;
    
    results.innerHTML = `
        <div class="loading-search">
            <div class="search-spinner"></div>
            <p>Поиск пользователей...</p>
        </div>
    `;
}

function showErrorState(message) {
    const results = document.getElementById('searchResults');
    if (!results) return;
    
    results.innerHTML = `
        <div class="empty-search">
            <div class="empty-search-icon">⚠️</div>
            <p>${message}</p>
            <p class="search-hint">Попробуйте позже</p>
        </div>
    `;
}

function displaySearchResults(users, query) {
    const results = document.getElementById('searchResults');
    if (!results) return;
    
    if (!users || users.length === 0) {
        results.innerHTML = `
            <div class="empty-search">
                <div class="empty-search-icon">😕</div>
                <p>Пользователи не найдены</p>
                <p class="search-hint">Попробуйте другой запрос</p>
            </div>
        `;
        return;
    }
    results.innerHTML = users.map(user => {
        const userIdStr = String(user.id);
        const queryStr = query.replace(/\D/g, '');
        
        // Подсвечиваем совпадающую часть ID
        let displayId = userIdStr;
        if (userIdStr.startsWith(queryStr)) {
            displayId = `<span style="color: var(--success); font-weight: 600;">${queryStr}</span>${userIdStr.slice(queryStr.length)}`;
        } else if (userIdStr.includes(queryStr)) {
            const index = userIdStr.indexOf(queryStr);
            displayId = `${userIdStr.slice(0, index)}<span style="color: var(--success); font-weight: 600;">${queryStr}</span>${userIdStr.slice(index + queryStr.length)}`;
        }
        
        return `
            <div class="user-result" onclick="selectUser(${user.id})" id="user-${user.id}">
                <div class="user-avatar">
                    👤
                </div>
                <div class="user-info">
                    <div class="user-name">user_${user.id}</div>
                    <div class="user-id">ID: ${displayId}</div>
                </div>
                <button class="select-button">Выбрать</button>
            </div>
        `;
    }).join('');
}

// Выбор пользователя
function selectUser(userId) {
    const allUserElements = document.querySelectorAll('.user-result');
    allUserElements.forEach(el => el.style.borderColor = 'var(--border)');
    
    const selectedElement = document.getElementById(`user-${userId}`);
    if (selectedElement) {
        selectedElement.style.borderColor = 'var(--success)';
        selectedTransferUser = userId;
        showSelectedUser(userId);
        updateTransferButton();
        
        if (window.vibrate) window.vibrate([3, 5, 3]);
    }
}

// Показать выбранного пользователя вместо строки поиска
function showSelectedUser(userId) {
    const searchInputContainer = document.getElementById('searchInputContainer');
    const selectedUserDisplay = document.getElementById('selectedUserDisplay');
    const selectedUserIdElement = document.getElementById('selectedUserId');
    
    if (searchInputContainer && selectedUserDisplay && selectedUserIdElement) {
        searchInputContainer.style.display = 'none';
        selectedUserIdElement.textContent = `ID: ${userId}`;
        selectedUserDisplay.style.display = 'flex';
        
        // Очищаем поле ввода поиска
        const searchInput = document.getElementById('userSearchInput');
        if (searchInput) searchInput.value = '';
        
        // Очищаем результаты поиска
        const results = document.getElementById('searchResults');
        if (results) {
            results.innerHTML = `
                <div class="empty-search">
                    <div class="empty-search-icon">✅</div>
                    <p>Пользователь выбран</p>
                    <p class="search-hint">Нажмите "✕" слева, чтобы изменить выбор</p>
                </div>
            `;
        }
    }
}

function clearSelectedUser() {
    const searchInputContainer = document.getElementById('searchInputContainer');
    const selectedUserDisplay = document.getElementById('selectedUserDisplay');
    
    if (searchInputContainer && selectedUserDisplay) {
        searchInputContainer.style.display = 'flex';
        selectedUserDisplay.style.display = 'none';
        selectedTransferUser = null;
        updateTransferButton();
        
        const results = document.getElementById('searchResults');
        if (results) {
            results.innerHTML = `
                <div class="empty-search">
                    <div class="empty-search-icon">👤</div>
                    <p>Начните поиск</p>
                    <p class="search-hint">Введите минимум 2 цифры ID пользователя</p>
                </div>
            `;
        }
        
        // Фокус на поле ввода
        const searchInput = document.getElementById('userSearchInput');
        if (searchInput) {
            searchInput.focus();
        }
        
        if (window.vibrate) window.vibrate(1);
    }
}

// Обновление кнопки подтверждения
function updateTransferButton() {
    const confirmButton = document.querySelector('.transfer-confirm');
    if (confirmButton) {
        if (selectedTransferUser) {
            confirmButton.disabled = false;
            confirmButton.textContent = `Передать #${currentNFT?.number || ''}`;
        } else {
            confirmButton.disabled = true;
            confirmButton.textContent = 'Передать';
        }
    }
}

function confirmTransfer() {
    if (!currentNFT || !selectedTransferUser) return;
    openConfirmationModal();
}

function showPurchaseConfirmation(nftId, price, nftName, nftData = null) {
    const modalId = 'purchaseConfirmationModal';
    let modal = document.getElementById(modalId);
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'confirmation-modal purchase-confirmation';
        modal.innerHTML = `
            <div class="confirmation-modal-overlay" onclick="closePurchaseConfirmation()"></div>
            <div class="confirmation-modal-content">
                <!-- ОДНА строка с NFT -->
                <div class="purchase-nft-row">
                    <div class="purchase-nft-icon">🎴</div>
                    <div class="purchase-nft-info">
                        <div class="purchase-nft-name">NFT</div>
                    </div>
                    <div class="purchase-price-display">
                        <span class="purchase-price-value">0</span>
                        <span style="color: #FFD700">⭐</span>
                    </div>
                </div>
                
                <!-- Баланс одной строкой -->
                <div class="purchase-balance-section">
                    Ваш баланс: <span class="purchase-balance-value">0 ⭐</span>
                </div>
                
                <!-- Кнопки -->
                <div class="purchase-footer">
                    <button class="purchase-cancel-btn" onclick="closePurchaseConfirmation()">
                        Отмена
                    </button>
                    <button class="purchase-confirm-btn" onclick="confirmPurchase(${nftId}, ${price})">
                        Купить
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    const nft = nftData || window.marketNFTs?.find(item => item.id === nftId);
    const userBalance = window.appState?.starsBalance || 0;
    const canBuy = userBalance >= price;
    
    const nftIcon = modal.querySelector('.purchase-nft-icon');
    const nftNameEl = modal.querySelector('.purchase-nft-name');
    const priceValue = modal.querySelector('.purchase-price-value');
    const balanceValue = modal.querySelector('.purchase-balance-value');
    const confirmBtn = modal.querySelector('.purchase-confirm-btn');
    
    if (nftIcon && nft) {
        nftIcon.textContent = nft.image || '🎴';
        const rarityColor = getRarityColor(nft.rarity);
        nftIcon.style.background = `${rarityColor}20`;
    }
    
    if (nftNameEl) {
        nftNameEl.textContent = nft?.fullName || nftName || `NFT #${nftId}`;
        if (nft?.rarity) {
            const rarityColor = getRarityColor(nft.rarity);
            nftNameEl.style.color = rarityColor;
        }
    }
    
    if (priceValue) {
        priceValue.textContent = price.toLocaleString();
    }
    
    if (balanceValue) {
        balanceValue.textContent = `${userBalance} ⭐`;
        balanceValue.style.color = canBuy ? 'var(--text-primary)' : 'var(--accent)';
    }
    
    if (confirmBtn) {
        confirmBtn.setAttribute('onclick', `confirmPurchase(${nftId}, ${price})`);
        confirmBtn.disabled = !canBuy;
        confirmBtn.innerHTML = canBuy ? 'Купить' : 'Недостаточно';
    }
    
    modal.classList.add('active');
}

// Вспомогательная функция для обновления содержимого модалки покупки
function updatePurchaseModalContent(modal, nft, price) {
    if (!modal) return;
    
    const nftImage = modal.querySelector('#purchaseNftImage');
    if (nftImage && nft) {
        nftImage.textContent = nft.image || '🎴';
        const rarityColor = getRarityColor(nft.rarity);
        nftImage.style.background = `${rarityColor}20`;
    }
    
    const nftName = modal.querySelector('#purchaseNftName');
    if (nftName && nft) {
        nftName.textContent = nft.fullName || `NFT #${nft.number || nft.id}`;
        const rarityColor = getRarityColor(nft.rarity);
        nftName.style.color = rarityColor;
    }
    
    const nftNumber = modal.querySelector('#purchaseNftNumber');
    if (nftNumber && nft) {
        nftNumber.textContent = nft.collectionName ? 
            `Коллекция: ${nft.collectionName}` : 
            `#${nft.number || nft.id}`;
    }
    
    const priceValue = modal.querySelector('#purchasePriceValue');
    if (priceValue) {
        priceValue.textContent = price.toLocaleString();
    }
    
    const confirmPrice = modal.querySelector('#purchaseConfirmPrice');
    if (confirmPrice) {
        confirmPrice.textContent = price.toLocaleString();
    }
    
    const confirmButton = modal.querySelector('.sell-confirm');
    if (confirmButton) {
        confirmButton.setAttribute('onclick', `confirmPurchase(${nft?.id || 0}, ${price})`);
    }
    
    const userBalance = window.appState?.starsBalance || 0;
    const balanceAfter = Math.max(0, userBalance - price);
    
    const userBalanceElement = modal.querySelector('#purchaseUserBalance');
    const balanceAfterElement = modal.querySelector('#purchaseBalanceAfter');
    
    if (userBalanceElement) {
        userBalanceElement.textContent = `${userBalance.toLocaleString()} ⭐`;
        if (userBalance < price) {
            userBalanceElement.style.color = 'var(--accent)';
        } else {
            userBalanceElement.style.color = 'var(--text-primary)';
        }
    }
    
    if (balanceAfterElement) {
        balanceAfterElement.textContent = `${balanceAfter.toLocaleString()} ⭐`;
        if (userBalance >= price) {
            balanceAfterElement.style.color = 'var(--success)';
        } else {
            balanceAfterElement.style.color = 'var(--text-tertiary)';
        }
    }
    
    if (confirmButton) {
        if (userBalance >= price && price > 0) {
            confirmButton.disabled = false;
            confirmButton.style.opacity = '1';
        } else {
            confirmButton.disabled = true;
            confirmButton.style.opacity = '0.5';
        }
    }
}

function closePurchaseConfirmation() {
    const modal = document.getElementById('purchaseConfirmationModal');
    if (modal) modal.classList.remove('active');
}

function confirmPurchase(nftId, price) {
    closePurchaseConfirmation();
    
    if (window.processNFTPurchase) {
        const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (user?.id) {
            window.processNFTPurchase(nftId, price, user.id);
        }
    }
}

function updateNFTModalImage(nft) {
    const nftHeader = document.querySelector('.nft-header');
    const nftPreview = document.querySelector('.nft-preview');
    if (!nftHeader || !nftPreview) return;
    
    // 1. Очищаем
    nftHeader.style.background = '';
    nftHeader.style.position = 'relative';
    nftHeader.style.overflow = 'hidden';
    nftHeader.style.minHeight = '200px';
    
    const oldPattern = nftHeader.querySelector('.nft-header-pattern');
    if (oldPattern) oldPattern.remove();
    
    // 2. Применяем фон и паттерн
    if (nft.update === 1 && nft.backgroundData && nft.backgroundData.back_0 && nft.backgroundData.back_100) {
        nftHeader.style.cssText = getNFTCardBackground(nft) + 
            'border-radius: 20px 20px 0 0; position: relative; overflow: hidden; min-height: 200px;';
        
        if (nft.patternData && nft.patternData.file_name) {
            const svgPath = `/m_nft_image/patterns/${nft.patternData.file_name}.svg`;
            // ПЕРЕДАЕМ ЦВЕТ ФОНА ДЛЯ АДАПТАЦИИ
            const bgColor = nft.backgroundData?.back_0 || null;
            const patternHtml = getNFTCardFullPatternForHeader(svgPath, bgColor);
            nftHeader.insertAdjacentHTML('beforeend', patternHtml);
        }
    } else {
        // Для обычных NFT - градиент по редкости как в маркете
        const rarityColor = getRarityColor(nft.rarity);
        nftHeader.style.background = `${rarityColor}70`;
        nftHeader.style.borderRadius = '20px 20px 0 0';
    }
    
    // 3. Обновляем изображение NFT в превью (оставляем как есть)
    if (nft.update === 1 && nft.modelData && nft.modelData.file_name) {
        // Улучшенный NFT - берем тот же путь что и в маркете
        const modelImagePath = `/m_nft_image/${nft.collectionName || nft.collection_name}/${nft.modelData.file_name}.PNG`;
        
        nftPreview.innerHTML = `
            <div style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center;">
                <img src="${modelImagePath}" 
                     alt="${nft.modelData.name}" 
                     style="width: 100%; height: 100%; object-fit: contain; position: relative; z-index: 2;">
            </div>
        `;
        nftPreview.style.background = 'transparent';
    } else {
        // Не улучшенный NFT
        if (nft.image && (nft.image.startsWith('/') || nft.image.startsWith('http'))) {
            nftPreview.innerHTML = `<img src="${nft.image}" alt="${nft.fullName}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;">`;
        } else {
            nftPreview.innerHTML = `<span style="font-size: 3.5em; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${nft.image || '🎴'}</span>`;
        }
    }
}

function getNFTCardFullPatternForHeader(svgPath, bgColor = null) {
    if (!svgPath) return '';
    
    const filterStyle = bgColor ? getPatternFilterStyle(bgColor) : '';
    
    const innerCircleRadius = 25;
    const middleCircleRadius = 32;
    const outerCircleRadius = 45;
    const extraCircleRadius = 55;
    
    let patternHtml = '<div class="nft-header-pattern" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; border-radius: 20px 20px 0 0; overflow: hidden;">';
    
    // 1. Внутренний круг - ТОЧНО ТАК ЖЕ
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
                        width: 10%;
                        height: 10%;
                        min-width: 14px; max-width: 28px;
                        min-height: 14px; max-height: 28px;
                        transform: translate(-50%, -50%);
                        opacity: 0.2;
                        background-image: url('${svgPath}');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;
                        ${filterStyle}">
            </div>
        `;
    }
    
    // 2. Средний круг - ТОЧНО ТАК ЖЕ
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
                        width: 12%;
                        height: 12%;
                        min-width: 16px; max-width: 30px;
                        min-height: 16px; max-height: 30px;
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
    
    // 3. Внешний круг - ТОЧНО ТАК ЖЕ
    const outerIconsCount = 12;
    for (let i = 0; i < outerIconsCount; i++) {
        const angle = (i / outerIconsCount) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * outerCircleRadius;
        const y = 50 + Math.sin(angle) * outerCircleRadius;
        
        patternHtml += `
            <div style="position: absolute;
                        top: ${y}%;
                        left: ${x}%;
                        width: 8%;
                        height: 8%;
                        min-width: 10px; max-width: 24px;
                        min-height: 10px; max-height: 24px;
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
    
    // 4. Самый внешний круг - ТОЧНО ТАК ЖЕ
    const extraCircleIconsCount = 8;
    for (let i = 0; i < extraCircleIconsCount; i++) {
        const angle = (i / extraCircleIconsCount) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * extraCircleRadius;
        const y = 50 + Math.sin(angle) * extraCircleRadius;
        
        patternHtml += `
            <div style="position: absolute;
                        top: ${y}%;
                        left: ${x}%;
                        width: 6%;
                        height: 6%;
                        min-width: 8px; max-width: 20px;
                        min-height: 8px; max-height: 20px;
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

function createNFTMenuModal() {
    const modal = document.createElement('div');
    modal.id = 'nftMenuModal';
    modal.className = 'nft-menu-modal';
    modal.innerHTML = `
        <div class="nft-menu-overlay" onclick="closeNFTMenu()"></div>
        <div class="nft-menu-content">
            <button class="pin-nft-btn" onclick="pinNFT()">
                <span class="pin-icon">📌</span>
                <span class="pin-text">Закрепить</span>
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

function updateNFTMenuContent() {
    const dropdown = document.querySelector('.nft-menu-dropdown');
    if (!dropdown || !currentNFT) return;
    
    const isPinned = currentNFT.pinned && currentNFT.pinned > 0;
    const pinText = isPinned ? 'Открепить' : 'Закрепить';
    const pinIcon = isPinned ? '📌🔓' : '📌';
    
    dropdown.innerHTML = `
        <a class="nft-menu-item-pin" onclick="pinNFT(); closeNFTMenu();">
            <span class="menu-icon">${pinIcon}</span>
            <span class="menu-text">${pinText}</span>
        </a>
    `;
}

function closeNFTMenu() {
    const dropdown = document.querySelector('.nft-menu-dropdown.active');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        createNFTModal();
        createTransferModal();
        createConfirmationModal();
        createSellModal();
        createNFTMenuModal(); 
    });
} else {
    createNFTModal();
    createTransferModal();
    createConfirmationModal(); 
    createSellModal();
    createNFTMenuModal(); 
}

window.openNFTModal = openNFTModal;
window.closeNFTModal = closeNFTModal;
window.updateNFTModal = updateNFTModal;
window.sellNFT = sellNFT;
window.transferNFT = transferNFT;
window.openTransferModal = openTransferModal;
window.closeTransferModal = closeTransferModal;
window.searchUsers = searchUsers;
window.selectUser = selectUser;
window.confirmTransfer = confirmTransfer;
window.openConfirmationModal = openConfirmationModal;
window.closeConfirmationModal = closeConfirmationModal;
window.processTransfer = processTransfer;
window.openSellModal = openSellModal;
window.closeSellModal = closeSellModal;
window.updateSellButton = updateSellButton;
window.confirmSell = confirmSell;
window.processSellNFT = processSellNFT;
window.showPurchaseConfirmation = showPurchaseConfirmation;
window.closePurchaseConfirmation = closePurchaseConfirmation;
window.confirmPurchase = confirmPurchase;
window.openBalanceModal = openBalanceModal;
window.closeBalanceModal = closeBalanceModal;
window.depositFunds = depositFunds;
window.upgradeNFT = upgradeNFT;
window.toggleNFTMenu = toggleNFTMenu;
window.closeAllNFTMenus = closeAllNFTMenus;
window.pinNFT = pinNFT;
window.closeNFTMenu = closeNFTMenu;