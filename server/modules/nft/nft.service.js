export class NFTService {
    constructor(db) {
        this.db = db;
    }

    async getUserNFTs(userId) {
        try {

            const nfts = await this.db.all(`
                SELECT 
                    mn.id,
                    mn.number,
                    mn.collection_id,
                    mn.created_at,
                    mn.model,      
                    mn.background, 
                    mn.pattern,    
                    mn.[update],   
                    mn.pinned, 

                    -- Данные коллекции
                    mnc.name as collection_name,
                    mnc.image_file_id as collection_image,
                    mnc.total_supply as total_supply,
                    mnc.sold_count as sold_count,
                    mnc.price as collection_price,
                    mnc.updateble as updateble,

                    -- Данные продажи
                    mnos.id as sale_id,
                    mnos.price as sale_price,

                    -- Данные модели (если есть)
                    m.id as model_id,
                    m.name as model_name,
                    m.rarity as model_rarity,
                    m.file_name as model_file_name,

                    -- Данные фона (если есть)
                    b.id as background_id,
                    b.back_0,
                    b.back_100,
                    b.name as background_name,
                    b.rarity as background_rarity,

                    -- Данные узора (если есть)
                    p.id as pattern_id,
                    p.name as pattern_name,
                    p.rarity as pattern_rarity,
                    p.file_name as pattern_file_name

                FROM m_nfts mn
                LEFT JOIN m_nft_collections mnc ON mn.collection_id = mnc.id
                LEFT JOIN m_nfts_on_sale mnos ON mn.id = mnos.nft_id
                LEFT JOIN models m ON mn.model = m.id
                LEFT JOIN backgrounds b ON mn.background = b.id
                LEFT JOIN patterns p ON mn.pattern = p.id
                WHERE mn.owner_id = ?
                ORDER BY 
                    CASE WHEN mn.pinned IS NOT NULL THEN 0 ELSE 1 END, -- Сначала закрепленные
                    mn.pinned ASC, -- Порядок закрепления (1, 2, 3...)
                    mn.created_at DESC 
            `, [userId]);

            return nfts.map(nft => {
                // Формируем данные модели
                const modelData = nft.model_id ? {
                    id: nft.model_id,
                    name: nft.model_name,
                    rarity: nft.model_rarity,
                    file_name: nft.model_file_name
                } : null;

                // Формируем данные фона
                const backgroundData = nft.background_id ? {
                    id: nft.background_id,
                    back_0: nft.back_0,
                    back_100: nft.back_100,
                    name: nft.background_name,
                    rarity: nft.background_rarity
                } : null;

                // Формируем данные узора
                const patternData = nft.pattern_id ? {
                    id: nft.pattern_id,
                    name: nft.pattern_name,
                    rarity: nft.pattern_rarity,
                    file_name: nft.pattern_file_name
                } : null;

                return {
                    id: nft.id,
                    number: nft.number,
                    collectionId: nft.collection_id,
                    collectionName: nft.collection_name,
                    totalSupply: nft.total_supply,
                    soldCount: nft.sold_count,
                    fullName: `${nft.collection_name} #${nft.number}`,
                    image: this.getUpgradedNFTImage({
                        update: nft.update,
                        modelData: modelData,
                        backgroundData: backgroundData,
                        patternData: patternData,
                        collection_name: nft.collection_name,
                        // ВАЖНО: передаем СТРОКУ, а не вызов функции
                        image: nft.collection_image ? `/m_nft_image/base/${nft.collection_image}` : '🎴'
                    }),
                    name: nft.collection_image,
                    rarity: this.getRarity(nft.total_supply),
                    createdAt: nft.created_at,
                    collectionType: this.getCollectionType(nft.collection_name),
                    rarityPercentage: Math.round((nft.number / nft.total_supply) * 100) / 100,
                    forSale: !!nft.sale_id,
                    updateble: nft.updateble || 0,
                    update: nft.update || null,
                    model: nft.model,
                    background: nft.background,
                    pattern: nft.pattern,
                    collectionPrice: nft.collection_price || 0,
                    price: nft.sale_id ? nft.sale_price : (nft.collection_price || 0),
                    salePrice: nft.sale_price,
                    pinned: nft.pinned || null,
                    // Добавляем структурированные данные атрибутов
                    modelData: modelData,
                    backgroundData: backgroundData,
                    patternData: patternData
                };
            });
        } catch (error) {
            console.error('❌ Error fetching user NFTs:', error);
            return [];
        }
    }

    getNFTImage(imageFileId, number, collectionName) {
    // Всегда возвращаем путь к картинке
        if (imageFileId) {
            return `/m_nft_image/base/${imageFileId}`;
        }
    }

    getCollectionType(collectionName) {
        const name = (collectionName || '').toLowerCase();
        if (name.includes('cap')) return 'cap';
        if (name.includes('car')) return 'car';
        if (name.includes('pencil')) return 'pencil';
        if (name.includes('pepe')) return 'pepe';
        return 'unknown';
    }

    getRarity(totalSupply, rarityLevels = null) {
        if (typeof totalSupply !== 'number') {
            totalSupply = parseInt(totalSupply) || 1000;
        }

        // Кастомные уровни редкости или по умолчанию
        const levels = rarityLevels || [
            { max: 50, name: 'Легендарный', color: '#FFD700' },
            { max: 200, name: 'Эпический', color: '#9370DB' },
            { max: 1000, name: 'Редкий', color: '#4169E1' },
            { max: 5000, name: 'Обычный', color: '#808080' }
        ];

        for (const level of levels) {
            if (totalSupply <= level.max) {
                return level.name;
            }
        }

        return 'Обычный';
    }

    async getCollections() {
        try {
            const collections = await this.db.all(`
                SELECT id, name, image_file_id, total_supply, sold_count, created_at
                FROM m_nft_collections
                ORDER BY created_at DESC
            `);
            
            // Добавляем эмодзи и редкость для коллекций
            return collections.map(collection => ({
                ...collection,
                emoji: this.getNFTImage(collection.name),
                type: this.getCollectionType(collection.name),
                rarity: this.getRarity(collection.total_supply), // Определяем редкость коллекции
                rarityLevel: this.getRarityLevel(collection.total_supply) // Можно добавить числовой уровень
            }));
        } catch (error) {
            console.error('❌ Error fetching collections:', error);
            return [];
        }
    }

    getRarityLevel(totalSupply) {
        if (totalSupply <= 50) return 4;  
        if (totalSupply <= 200) return 3; 
        if (totalSupply <= 1000) return 2;
        if (totalSupply <= 5000) return 1;             
    }

    // Новая функция для получения статистики по коллекциям пользователя
    async getUserCollectionStats(userId) {
        try {
            const stats = await this.db.all(`
                SELECT 
                    mnc.name as collection_name,
                    COUNT(mn.id) as count,
                    mnc.image_file_id
                FROM m_nfts mn
                JOIN m_nft_collections mnc ON mn.collection_id = mnc.id
                WHERE mn.owner_id = ?
                GROUP BY mn.collection_id, mnc.name
                ORDER BY count DESC
            `, [userId]);
            
            return stats.map(stat => ({
                ...stat,
                emoji: this.getNFTImage(stat.collection_name)
            }));
        } catch (error) {
            console.error('Error fetching collection stats:', error);
            return [];
        }
    }

    async logNFTTransfer(nftId, fromUserId, toUserId, transferType = 'transfer', amount = 0, collectionName = null, nftNumber = null) {
        try {
            // Получаем информацию о NFT для логирования
            let nftInfo = '';
            if (collectionName && nftNumber) {
                const emoji = this.getNFTImage(collectionName);
                nftInfo = `${emoji} ${collectionName} #${nftNumber}`;
            } else {
                // Или получаем из БД
                const nftData = await this.db.get(`
                    SELECT mn.number, mnc.name as collection_name
                    FROM m_nfts mn
                    LEFT JOIN m_nft_collections mnc ON mn.collection_id = mnc.id
                    WHERE mn.id = ?
                `, [nftId]);
                
                if (nftData) {
                    const emoji = this.getNFTImage(nftData.collection_name);
                    nftInfo = `${emoji} ${nftData.collection_name} #${nftData.number}`;
                }
            }

            await this.db.run(
                'INSERT INTO nft_transfers (transfer_type, nft_id, amount, from_user_id, to_user_id) VALUES (?, ?, ?, ?, ?)',
                [transferType, nftId, amount, fromUserId, toUserId]
            );

            return true;
        } catch (error) {
            console.error('❌ Error logging NFT transfer:', error);
            return false;
        }
    }

    async listNFTForSale(nftId, sellerId, price) {
        try {

            await this.db.run(
                'INSERT INTO m_nfts_on_sale (nft_id, price, seller_id) VALUES (?, ?, ?)',
                [nftId, price, sellerId]
            );

            return true;
        } catch (error) {
            console.error('❌ Error listing NFT for sale:', error);
            return false;
        }
    }

    async removeNFTFromSale(nftId) {
        try {
            await this.db.run(
                'DELETE FROM m_nfts_on_sale WHERE nft_id = ?',
                [nftId]
            );
            return true;
        } catch (error) {
            console.error('❌ Error removing NFT from sale:', error);
            return false;
        }
    }

    async isNFTListedForSale(nftId) {
        try {
            const listing = await this.db.get(
                'SELECT * FROM m_nfts_on_sale WHERE nft_id = ?',
                [nftId]
            );
            return !!listing;
        } catch (error) {
            console.error('❌ Error checking NFT listing:', error);
            return false;
        }
    }

    async getNFTsForSale(limit = 50) {
        try {
            const listings = await this.db.all(`
                SELECT 
                    ms.*,
                    mn.number,
                    mn.collection_id,
                    mn.owner_id,
                    mn.created_at,
                    mn.model,        
                    mn.background,    
                    mn.pattern,     
                    mn.[update], 

                    -- Данные коллекции
                    mnc.name as collection_name,
                    mnc.image_file_id,
                    mnc.total_supply as total_supply, 
                    mnc.sold_count as sold_count,
                    mnc.price as collection_price,
                    mnc.updateble as updateble,

                    -- Данные модели (если есть)
                    m.id as model_id,
                    m.name as model_name,
                    m.rarity as model_rarity,
                    m.file_name as model_file_name,

                    -- Данные фона (если есть)
                    b.id as background_id,
                    b.back_0,
                    b.back_100,
                    b.name as background_name,
                    b.rarity as background_rarity,

                    -- Данные узора (если есть)
                    p.id as pattern_id,
                    p.name as pattern_name,
                    p.rarity as pattern_rarity,
                    p.file_name as pattern_file_name

                FROM m_nfts_on_sale ms
                JOIN m_nfts mn ON ms.nft_id = mn.id
                JOIN m_nft_collections mnc ON mn.collection_id = mnc.id
                LEFT JOIN models m ON mn.model = m.id
                LEFT JOIN backgrounds b ON mn.background = b.id
                LEFT JOIN patterns p ON mn.pattern = p.id
                ORDER BY ms.listed_at DESC
                LIMIT ?
            `, [limit]);
            
            return listings.map(listing => {
                // Формируем данные модели
                const modelData = listing.model_id ? {
                    id: listing.model_id,
                    name: listing.model_name,
                    rarity: listing.model_rarity,
                    file_name: listing.model_file_name
                } : null;

                // Формируем данные фона
                const backgroundData = listing.background_id ? {
                    id: listing.background_id,
                    back_0: listing.back_0,
                    back_100: listing.back_100,
                    name: listing.background_name,
                    rarity: listing.background_rarity
                } : null;

                // Формируем данные узора
                const patternData = listing.pattern_id ? {
                    id: listing.pattern_id,
                    name: listing.pattern_name,
                    rarity: listing.pattern_rarity,
                    file_name: listing.pattern_file_name
                } : null;

                return {
                    id: listing.nft_id,
                    price: listing.price,
                    sellerId: listing.seller_id,
                    listedAt: listing.listed_at,
                    number: listing.number,
                    collectionId: listing.collection_id,
                    ownerId: listing.owner_id,  
                    createdAt: listing.created_at,
                    collectionName: listing.collection_name,
                    fullName: `${listing.collection_name} #${listing.number}`,
                    image: this.getUpgradedNFTImage({
                        update: listing.update,
                        modelData: modelData,
                        backgroundData: backgroundData,
                        patternData: patternData,
                        collection_name: listing.collection_name,
                        image: listing.image_file_id ? `/m_nft_image/${listing.image_file_id}` : '🎴'
                    }),
                    rarity: this.getRarity(listing.total_supply), 
                    totalSupply: listing.total_supply,
                    soldCount: listing.sold_count,
                    updateble: listing.updateble || 0,
                    update: listing.update || null,
                    collectionPrice: listing.collection_price || 0, 
                    forSale: true,
                    // Добавляем данные атрибутов
                    modelData: modelData,
                    backgroundData: backgroundData,
                    patternData: patternData
                };
            });
        } catch (error) {
            console.error('❌ Error fetching NFTs for sale:', error);
            return [];
        }
    }

    getUpgradedNFTImage(nft) {
        try {
            let imageHtml = '';
            let patternHtml = '';

            // Получаем SVG для фона из данных узора (pattern)
            if (nft.patternData && nft.patternData.file_name) {
                const svgPath = `/m_nft_image/patterns/${nft.patternData.file_name}.svg`;
                patternHtml = this.getNFTBackgroundPattern(svgPath);
            }

            // Если NFT улучшен (update=1) и есть модель
            if (nft.update === 1 && nft.modelData && nft.modelData.file_name) {
                const modelImagePath = `/m_nft_image/${nft.collection_name}/${nft.modelData.file_name}.PNG`;

                // Если есть данные фона, создаем градиентный фон
                let backgroundStyle = '';
                if (nft.backgroundData && nft.backgroundData.back_0 && nft.backgroundData.back_100) {
                    backgroundStyle = `background: radial-gradient(circle, #${nft.backgroundData.back_0} 0%, #${nft.backgroundData.back_100} 100%);`;
                }

                imageHtml = `
                    <div class="upgraded-nft-container" style="${backgroundStyle} width: 100%; height: 100%; position: relative; border-radius: 8px; overflow: hidden;">
                        ${patternHtml}
                        <img src="${modelImagePath}" 
                             alt="${nft.modelData.name}" 
                             style="width: 100%; height: 100%; object-fit: contain; position: relative; z-index: 2;">
                    </div>
                `;
            } else {
                // Обычный NFT
                imageHtml = `<img src="${nft.image}" alt="${nft.collection_name || 'NFT'}" style="width: 100%; height: 100%; object-fit: contain;">`;
            }

            return imageHtml;
        } catch (error) {
            console.error('❌ Error generating NFT image:', error);
            return '🎴';
        }
    }

    getNFTBackgroundPattern(svgPath, patternRarity = 1) {
        if (!svgPath) return '';
        
        // Параметры для двух кругов
        const innerCircleRadius = 20; // радиус внутреннего круга (в %)
        const outerCircleRadius = 40; // радиус внешнего круга (в %)
        const iconSize = 16; // размер иконок (в пикселях)
        
        let patternHtml = '<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">';
        
        // Внутренний круг - 6 иконок
        const innerIconsCount = 6;
        for (let i = 0; i < innerIconsCount; i++) {
            const angle = (i / innerIconsCount) * Math.PI * 2;
            const x = 50 + Math.cos(angle) * innerCircleRadius;
            const y = 50 + Math.sin(angle) * innerCircleRadius;
            
            patternHtml += `
                <div style="position: absolute;
                            top: ${y}%;
                            left: ${x}%;
                            width: ${iconSize}px;
                            height: ${iconSize}px;
                            transform: translate(-50%, -50%);
                            opacity: 0.8;
                            background-image: url('${svgPath}');
                            background-size: contain;
                            background-repeat: no-repeat;
                            background-position: center;">
                </div>
            `;
        }
        
        // Внешний круг - 12 иконок
        const outerIconsCount = 12;
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
                            opacity: 0.6;
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

    async togglePinNFT(nftId, userId) {
        try {
            // Проверяем, что пользователь владеет NFT
            const nftCheck = await this.db.get(
                'SELECT * FROM m_nfts WHERE id = ? AND owner_id = ?',
                [nftId, userId]
            );

            if (!nftCheck) {
                return {
                    success: false,
                    error: 'NFT не найден или вы не владеете им'
                };
            }

            // Получаем максимальное значение pinned у пользователя
            const maxPinned = await this.db.get(`
                SELECT MAX(pinned) as max_pinned 
                FROM m_nfts 
                WHERE owner_id = ?
            `, [userId]);

            const currentMaxPinned = maxPinned?.max_pinned || 0;
            
            // Если NFT уже закреплен
            if (nftCheck.pinned && nftCheck.pinned > 0) {
                // Снимаем закрепление
                await this.db.run(
                    'UPDATE m_nfts SET pinned = NULL WHERE id = ?',
                    [nftId]
                );

                return {
                    success: true,
                    action: 'unpin',
                    message: 'NFT откреплен',
                    nftId: nftId
                };
            } else {
                // Закрепляем NFT со следующим порядковым номером
                const newPinValue = currentMaxPinned + 1;

                await this.db.run(
                    'UPDATE m_nfts SET pinned = ? WHERE id = ?',
                    [newPinValue, nftId]
                );

                return {
                    success: true,
                    action: 'pin',
                    message: 'NFT закреплен',
                    nftId: nftId,
                    pinOrder: newPinValue
                };
            }
        } catch (error) {
            console.error('❌ Error toggling NFT pin:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}