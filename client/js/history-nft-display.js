// Функция для отображения NFT в истории с поддержкой улучшений
function displayNFTImageForHistory(nft, options = {}) {
    const defaultOptions = {
        size: 'small', // 'small', 'medium', 'large'
        showBackground: true,
        showPattern: true,
        showModel: true,
        interactive: false
    };
    
    const config = { ...defaultOptions, ...options };
    const sizeClass = config.size === 'small' ? 'mini-nft-image' : 
                     config.size === 'medium' ? 'medium-nft-image' : 'large-nft-image';
    
    let html = '';
    
    // 1. ПОДГОТАВЛИВАЕМ ДАННЫЕ
    const isUpgraded = nft.update === 1;
    const modelData = nft.modelData || nft.model;
    const backgroundData = nft.backgroundData || nft.background;
    const patternData = nft.patternData || nft.pattern;
    const collectionName = nft.collection_name || nft.collectionName;
    
    // 2. ЕСЛИ NFT УЛУЧШЕН - ПОКАЗЫВАЕМ УЛУЧШЕННУЮ ВЕРСИЮ
    if (isUpgraded && modelData && modelData.file_name) {
        // Фон для улучшенного NFT
        let backgroundStyle = '';
        if (backgroundData && backgroundData.back_0 && backgroundData.back_100) {
            backgroundStyle = `background: radial-gradient(circle, #${backgroundData.back_0} 0%, #${backgroundData.back_100} 75%);`;
        } else {
            // Если нет данных фона, используем цвет редкости
            const rarityColor = getRarityColorForHistory(nft.rarity);
            backgroundStyle = `background: ${rarityColor}70;`;
        }
        
        // Узор для улучшенного NFT
        let patternHtml = '';
        if (patternData && patternData.file_name && config.showPattern) {
            const svgPath = `/m_nft_image/patterns/${patternData.file_name}.svg`;
            patternHtml = generatePatternForHistory(svgPath, config.size);
        }
        
        // Путь к изображению модели
        const modelImagePath = `/m_nft_image/${collectionName}/${modelData.file_name}.PNG`;
        
        html = `
            <div class="${sizeClass} upgraded-nft-display" 
                 style="${backgroundStyle}; border-radius: 12px; overflow: hidden; position: relative; ${getSizeStyle(config.size)}">
                
                ${patternHtml}
                
                <div style="position: relative; z-index: 2; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                    <img src="${modelImagePath}" 
                         alt="${modelData.name || nft.fullName || 'NFT'}" 
                         style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">
                </div>
            </div>
        `;
    } 
    // 3. ЕСЛИ ОБЫЧНЫЙ NFT - ПОКАЗЫВАЕМ ОБЫЧНУЮ КАРТИНКУ
    else {
        let imageUrl = '';
        
        // Ищем путь к изображению
        if (nft.image && typeof nft.image === 'string') {
            // Если в image уже полный путь
            if (nft.image.startsWith('/') || nft.image.startsWith('http')) {
                imageUrl = nft.image;
            }
            // Если это file_id из БД
            else if (!nft.image.includes('<')) {
                imageUrl = `/m_nft_image/base/${nft.image}`;
            }
        }
        
        // Если нет пути, используем путь по умолчанию
        if (!imageUrl && nft.collectionName) {
            imageUrl = `/m_nft_image/base/${nft.collectionName.toLowerCase().replace(/\s+/g, '-')}.png`;
        }
        
        // Если всё ещё нет пути - пробуем из image_file_id
        if (!imageUrl && nft.image_file_id) {
            imageUrl = `/m_nft_image/base/${nft.image_file_id}`;
        }
        
        // Фон для обычного NFT
        const rarityColor = getRarityColorForHistory(nft.rarity);
        const backgroundStyle = `background: ${rarityColor}70;`;
        
        html = `
            <div class="${sizeClass}" 
                 style="${backgroundStyle}; border-radius: 12px; overflow: hidden; position: relative; ${getSizeStyle(config.size)}">
                
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; z-index: 2;">
                    ${imageUrl ? 
                        `<img src="${imageUrl}" 
                              alt="${nft.fullName || nft.collectionName || 'NFT'}" 
                              style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;"
                              onerror="this.onerror=null; this.style.display='none'; this.parentNode.innerHTML='<div style=\\'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.5em;\\'>📦</div>';">` :
                        `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.5em;">📦</div>`
                    }
                </div>
                
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
                    background: linear-gradient(to top, rgba(13, 13, 16, 0.6) 0%, 
                    rgba(13, 13, 16, 0.15) 30%, 
                    rgba(13, 13, 16, 0.1) 70%, transparent 100%); 
                    border-radius: 12px; z-index: 3; pointer-events: none;"></div>
            </div>
        `;
    }
    
    return html;
}

// Вспомогательная функция для получения цвета редкости
function getRarityColorForHistory(rarity) {
    const colors = {
        'Легендарный': '#FFD700',
        'Эпический': '#9370DB',
        'Редкий': '#4169E1',
        'Обычный': '#808080'
    };
    return colors[rarity] || '#808080';
}

// Вспомогательная функция для генерации узора (упрощенная версия из маркета)
function generatePatternForHistory(svgPath, size) {
    if (!svgPath) return '';
    
    // Размеры в зависимости от размера NFT
    const sizes = {
        small: { icons: 4, radius: 25, iconSize: '12%' },
        medium: { icons: 6, radius: 30, iconSize: '10%' },
        large: { icons: 8, radius: 35, iconSize: '8%' }
    };
    
    const config = sizes[size] || sizes.small;
    
    let patternHtml = '<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;">';
    
    // Создаем один круг иконок
    for (let i = 0; i < config.icons; i++) {
        const angle = (i / config.icons) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * config.radius;
        const y = 50 + Math.sin(angle) * config.radius;
        
        patternHtml += `
            <div style="position: absolute;
                        top: ${y}%;
                        left: ${x}%;
                        width: ${config.iconSize};
                        height: ${config.iconSize};
                        transform: translate(-50%, -50%);
                        opacity: 0.2;
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

// Вспомогательная функция для размеров
function getSizeStyle(size) {
    const sizes = {
        small: 'width: 48px; height: 48px; min-width: 48px;',
        medium: 'width: 60px; height: 60px; min-width: 60px;',
        large: 'width: 120px; height: 120px; min-width: 120px;'
    };
    return sizes[size] || sizes.small;
}

// Функция для быстрого встраивания в существующий HTML истории
function insertNFTImageIntoHistory(containerId, nftData, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return false;
    
    const imageHtml = displayNFTImageForHistory(nftData, options);
    container.innerHTML = imageHtml;
    return true;
}

// Экспорт функций
window.displayNFTImageForHistory = displayNFTImageForHistory;
window.insertNFTImageIntoHistory = insertNFTImageIntoHistory;
window.getRarityColorForHistory = getRarityColorForHistory;