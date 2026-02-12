import dotenv from 'dotenv';
dotenv.config();

import { CurrencyService } from '../currency/currency.service.js';
import { NFTService } from '../nft/nft.service.js';
import { UserService } from '../user/user.service.js'; 
import { TelegramService } from '../telegram/telegram.service.js';

export class SocketModule {
    constructor(io, redisClient, db) {
        this.io = io;
        this.db = db;
        this.redis = redisClient;
        
        // Инициализируем сервисы
        this.currencyService = new CurrencyService(redisClient);
        this.nftService = new NFTService(db);
        this.userService = new UserService(db);
        
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        console.log(`🤖 TelegramService токен: ${botToken.substring(0, 10)}...`);
        
        this.telegramService = new TelegramService(botToken);
        
        this.setupSocketHandlers();
        this.startPriceBroadcasting();
        
        console.log('⭐ Socket module started');
        this.currencyService.startPriceUpdates();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`[SocketModule] 🔌 Client connected: ${socket.id}`);

            // ========== ОБРАБОТЧИК РЕГИСТРАЦИИ ПОЛЬЗОВАТЕЛЯ ==========
            socket.on('register_user', async (data) => {
                try {
                    console.log('🔵 [SERVER] Received register_user event:', data);

                    const { userId } = data;
                    console.log('👤 User ID:', userId);

                    // ПРЕОБРАЗУЕМ referrerId В ЧИСЛО
                    let referrerId = null;
                    if (data.referrerId) {
                        const numId = Number(data.referrerId);
                        if (!isNaN(numId) && numId > 0) {
                            referrerId = numId;
                        }
                    }
                    
                    console.log('🎯 Using referrerId:', referrerId);

                    // ВСЕГДА создаем/обновляем пользователя
                    const userCreated = await this.userService.createUser(userId, referrerId);
                    
                    // Получаем обновленные данные пользователя
                    const userData = await this.userService.getUserStats(userId);

                    socket.emit('user_registered', { 
                        success: true, 
                        user: userData,
                        isNewUser: userCreated
                    });

                    console.log('🟢 User registration complete:', {
                        userId: userId,
                        referrerId: referrerId,
                        isNewUser: userCreated,
                        userData: userData
                    });

                } catch (error) {
                    console.error('🔴 Registration error:', error);
                    socket.emit('user_registered', { 
                        success: false, 
                        error: error.message 
                    });
                }
            });

            // ========== ОБРАБОТЧИКИ ВАЛЮТЫ ==========
            socket.on('get_currency_rate', async () => {
                const rateData = await this.currencyService.getCurrentRate();
                socket.emit('currency_rate', { 
                    tonPrice: rateData.tonPrice.toFixed(4),
                    timestamp: rateData.timestamp
                });
            });

            socket.on('subscribe_currency', () => {
                socket.join('currency_updates');
                console.log(`📊 Client ${socket.id} subscribed to currency updates`);
            });

            socket.on('unsubscribe_currency', () => {
                socket.leave('currency_updates');
                console.log(`📊 Client ${socket.id} unsubscribed from currency updates`);
            });

            // ========== ОБРАБОТЧИКИ NFT ==========
            socket.on('get_user_nfts', async (userId) => {
                try {
                    const nfts = await this.nftService.getUserNFTs(userId);
                    socket.emit('user_nfts', { 
                        success: true, 
                        nfts,
                        count: nfts.length
                    });
                } catch (error) {
                    socket.emit('user_nfts', { 
                        success: false, 
                        error: error.message 
                    });
                }
            });

            socket.on('get_collections', async () => {
                try {
                    const collections = await this.nftService.getCollections();
                    socket.emit('collections_list', { 
                        success: true, 
                        collections 
                    });
                } catch (error) {
                    socket.emit('collections_list', { 
                        success: false, 
                        error: error.message 
                    });
                }
            });
            
            socket.on('get_referrals', async (userId) => {
                try {
                    // ЗАМЕНЯЕМ вызов старого метода на новый
                    const referrals = await this.userService.getReferralsWithEarnings(userId);
                    
                    socket.emit('referrals_list', { 
                        success: true, 
                        referrals: referrals
                    });
                    
                    console.log(`📊 Sent referrals with earnings for user ${userId}:`, referrals);
                } catch (error) {
                    console.error('Error getting referrals:', error);
                    socket.emit('referrals_list', { 
                        success: false, 
                        error: error.message 
                    });
                }
            });
            
            socket.on('transfer_nft', async (data) => {
                try {
                    const { nftId, fromUserId, toUserId } = data;
                    
                    // ПРОВЕРЯЕМ БАЛАНС ПОЛЬЗОВАТЕЛЯ (5 ЗВЕЗД)
                    const userBalance = await this.db.get(
                        'SELECT stars_balance FROM users WHERE id = ?',
                        [fromUserId]
                    );
                    
                    if (!userBalance || userBalance.stars_balance < 5) {
                        socket.emit('nft_transfer_result', {
                            success: false,
                            error: 'Недостаточно звезд. Нужно 5 ⭐ для передачи'
                        });
                        return;
                    }
                    
                    // Проверяем, что пользователь владеет NFT
                    const nftCheck = await this.db.get(
                        'SELECT * FROM m_nfts WHERE id = ? AND owner_id = ?',
                        [nftId, fromUserId]
                    );
                    
                    if (!nftCheck) {
                        socket.emit('nft_transfer_result', {
                            success: false,
                            error: 'NFT не найден или вы не владеете им'
                        });
                        return;
                    }
                    
                    // Проверяем, что получатель существует
                    const receiverCheck = await this.db.get(
                        'SELECT id FROM users WHERE id = ?',
                        [toUserId]
                    );
                    
                    if (!receiverCheck) {
                        socket.emit('nft_transfer_result', {
                            success: false,
                            error: 'Получатель не найден'
                        });
                        return;
                    }
                    
                    // НАЧИНАЕМ ТРАНЗАКЦИЮ
                    await this.db.run('BEGIN TRANSACTION');
                    
                    try {
                        // СПИСЫВАЕМ 5 ЗВЕЗД С ОТПРАВИТЕЛЯ
                        await this.db.run(
                            'UPDATE users SET stars_balance = stars_balance - 5 WHERE id = ?',
                            [fromUserId]
                        );
                        
                        // Обновляем владельца NFT
                        await this.db.run(
                            'UPDATE m_nfts SET owner_id = ?, pinned = NULL WHERE id = ?',
                            [toUserId, nftId]
                        );
                        
                        await this.nftService.logNFTTransfer(
                            nftId,          // ID NFT
                            fromUserId,     // Отправитель
                            toUserId,       // Получатель
                            'transfer',     // Тип операции
                            5               // Стоимость в звездах
                        );
                        
                        // КОММИТИМ ТРАНЗАКЦИЮ
                        await this.db.run('COMMIT');
                        
                        console.log(`✅ NFT #${nftId} transferred from ${fromUserId} to ${toUserId}, 5 stars deducted`);
                        
                        // Получаем новый баланс для отправки клиенту
                        const newBalance = await this.db.get(
                            'SELECT stars_balance FROM users WHERE id = ?',
                            [fromUserId]
                        );
                        
                        // Отправляем результат клиенту
                        socket.emit('nft_transfer_result', {
                            success: true,
                            message: 'NFT успешно передан',
                            newBalance: newBalance.stars_balance // добавляем новый баланс
                        });
                        
                        // Также отправляем событие обновления инвентаря
                        socket.emit('inventory_updated', {
                            userId: fromUserId,
                            timestamp: new Date().toISOString()
                        });
                        
                        // ОТПРАВЛЯЕМ СОБЫТИЕ ОБНОВЛЕНИЯ БАЛАНСА
                        socket.emit('balance_updated', {
                            userId: fromUserId,
                            newBalance: newBalance.stars_balance,
                            timestamp: new Date().toISOString()
                        });
                        
                    } catch (error) {
                        // ОТКАТ ПРИ ОШИБКЕ
                        await this.db.run('ROLLBACK');
                        throw error;
                    }
                    
                } catch (error) {
                    console.error('❌ NFT transfer error:', error);
                    socket.emit('nft_transfer_result', {
                        success: false,
                        error: error.message
                    });
                }
            });

            // ОБРАБОТЧИК ДЛЯ ПОИСКА ПОЛЬЗОВАТЕЛЕЙ
            socket.on('search_users', async (query) => {
                try {
                    
                    const users = await this.userService.searchUsers(query);
                    
                    socket.emit('search_users_result', {
                        success: true,
                        users: users,
                        query: query
                    });
                    
                } catch (error) {
                    socket.emit('search_users_result', {
                        success: false,
                        error: error.message,
                        query: query
                    });
                }
            });

            // ========== ОБРАБОТЧИК ПОПОЛНЕНИЯ БАЛАНСА ==========
            socket.on('deposit_stars', async (data) => {
                try {
                    const { userId, amount } = data;

                    // ЛОГИРУЕМ ТРАНЗАКЦИЮ (статус pending)
                    const transactionId = await this.userService.logTransaction(
                        userId, 
                        'deposit', 
                        amount, 
                        'pending',
                        `Пополнение баланса через мини-приложение`
                    );

                    // Обновляем баланс в БД
                    const success = await this.userService.updateBalance(userId, amount);

                    if (success) {
                        // Получаем новый баланс
                        const newBalance = await this.userService.getBalance(userId);

                        // ОБНОВЛЯЕМ СТАТУС ТРАНЗАКЦИИ НА completed
                        if (transactionId) {
                            await this.userService.updateTransactionStatus(transactionId, 'completed');
                        }

                        socket.emit('deposit_result', {
                            success: true,
                            amount: amount,
                            newBalance: newBalance,
                            transactionId: transactionId,
                            message: `Баланс пополнен на ${amount} ⭐`
                        });

                        // Также отправляем обновление UI
                        socket.emit('balance_updated', {
                            userId: userId,
                            newBalance: newBalance,
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        // ЕСЛИ ОШИБКА - ОБНОВЛЯЕМ СТАТУС ТРАНЗАКЦИИ НА failed
                        if (transactionId) {
                            await this.userService.updateTransactionStatus(transactionId, 'failed');
                        }

                        socket.emit('deposit_result', {
                            success: false,
                            error: 'Ошибка при обновлении баланса'
                        });
                    }

                } catch (error) {
                    console.error('❌ Deposit error:', error);
                    socket.emit('deposit_result', {
                        success: false,
                        error: 'Внутренняя ошибка сервера'
                    });
                }
            });
            
            // ========== ОБРАБОТЧИК СОЗДАНИЯ ПЛАТЕЖНОГО ИНВОЙСА ==========
            socket.on('create_payment_invoice', async (data) => {
                try {
                    const { userId, amount } = data;
                    
                    // Создаем инвойс через Telegram Bot API
                    const invoiceUrl = await this.telegramService.createInvoiceLink(
                        userId, 
                        amount,
                        `Пополнение баланса на ${amount} звезд`
                    );
                    
                    socket.emit('payment_invoice_created', {
                        success: true,
                        invoiceUrl: invoiceUrl,
                        amount: amount
                    });
                    
                } catch (error) {
                    console.error('❌ Error creating invoice:', error);
                    socket.emit('payment_invoice_created', {
                        success: false,
                        error: 'Ошибка при создании платежа'
                    });
                }
            });

            socket.on('get_transaction_history', async (data) => {
                try {
                
                    // ПРОВЕРЯЕМ ФОРМАТ ДАННЫХ
                    let userId;
                
                    if (typeof data === 'object' && data.userId) {
                        userId = data.userId;
                    } else if (typeof data === 'number' || (typeof data === 'string' && !isNaN(data))) {
                        userId = Number(data);
                    } else {
                        console.error('❌ Invalid data format for transaction history:', data);
                        socket.emit('transaction_history', {
                            success: false,
                            error: 'Invalid user ID format',
                            transactions: []
                        });
                        return;
                    }

                    // Получаем историю транзакций ПОПОЛНЕНИЙ/ВЫВОДОВ
                    const history = await this.userService.getTransactionHistory(userId, 50);

                    // Получаем историю ПЕРЕДАЧ NFT
                    const transfers = await this.getNFTTransfersHistory(userId);

                    // Объединяем все записи и сортируем по дате (новые сверху)
                    const allRecords = [...history, ...transfers].sort((a, b) => 
                        new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp)
                    );
                
                    socket.emit('transaction_history', {
                        success: true,
                        transactions: allRecords,
                        count: allRecords.length
                    });
                
                } catch (error) {
                    console.error('❌ Error fetching transaction history:', error);
                    socket.emit('transaction_history', {
                        success: false,
                        error: error.message,
                        transactions: []
                    });
                }
            });

            // ========== ОБРАБОТЧИК ПРОДАЖИ NFT ==========
            socket.on('list_nft_for_sale', async (data) => {
                try {

                    const { nftId, sellerId, price } = data;

                    // Проверяем, что пользователь владеет NFT
                    const nftCheck = await this.db.get(
                        'SELECT * FROM m_nfts WHERE id = ? AND owner_id = ?',
                        [nftId, sellerId]
                    );

                    if (!nftCheck) {
                        socket.emit('nft_sale_listed', {
                            success: false,
                            error: 'NFT не найден или вы не владеете им'
                        });
                        return;
                    }

                    // Проверяем, что цена корректная
                    if (price < 1 || price > 999999) {
                        socket.emit('nft_sale_listed', {
                            success: false,
                            error: 'Некорректная цена. Допустимый диапазон: 1-999,999 ⭐'
                        });
                        return;
                    }

                    // Проверяем, не выставлен ли уже NFT на продажу
                    const existingListing = await this.db.get(
                        'SELECT * FROM m_nfts_on_sale WHERE nft_id = ?',
                        [nftId]
                    );

                    if (existingListing) {
                        socket.emit('nft_sale_listed', {
                            success: false,
                            error: 'NFT уже выставлен на продажу'
                        });
                        return;
                    }

                    // Выставляем NFT на продажу
                    const success = await this.nftService.listNFTForSale(nftId, sellerId, price);

                    if (success) {
                        console.log(`✅ NFT #${nftId} listed for sale at ${price} stars`);

                        socket.emit('nft_sale_listed', {
                            success: true,
                            message: 'NFT успешно выставлен на продажу',
                            nftId: nftId,
                            price: price
                        });

                        // Отправляем событие обновления маркета всем клиентам
                        this.io.emit('market_updated', {
                            timestamp: new Date().toISOString()
                        });

                    } else {
                        socket.emit('nft_sale_listed', {
                            success: false,
                            error: 'Ошибка при выставлении NFT на продажу'
                        });
                    }

                } catch (error) {
                    console.error('❌ NFT sale listing error:', error);
                    socket.emit('nft_sale_listed', {
                        success: false,
                        error: error.message
                    });
                }
            });
            
            socket.on('get_nfts_for_sale', async (data) => {
                try {
                    // Базовый запрос с JOIN для атрибутов
                    let query = `
                        SELECT 
                            ms.id as sale_id,
                            ms.price,
                            ms.seller_id,
                            ms.listed_at,
                            mn.id as nft_id,
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
                            mnc.total_supply,
                            mnc.sold_count,
                            mnc.price as collection_price,
                            mnc.updateble,

                            -- Данные модели
                            m.id as model_id,
                            m.name as model_name,
                            m.rarity as model_rarity,
                            m.file_name as model_file_name,

                            -- Данные фона
                            b.id as background_id,
                            b.back_0,
                            b.back_100,
                            b.name as background_name,
                            b.rarity as background_rarity,

                            -- Данные узора
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
                        WHERE 1=1
                    `;
                
                    const params = [];
                
                    // ФИЛЬТРАЦИЯ ПО КОЛЛЕКЦИИ (множественный выбор)
                    if (data.collection && data.collection.length > 0) {
                        // ИСПРАВЛЕНИЕ: Используем IN для числовых ID
                        const collectionIds = data.collection.map(id => {
                            const numId = parseInt(id);
                            return isNaN(numId) ? null : numId;
                        }).filter(id => id !== null);

                        if (collectionIds.length > 0) {
                            query += ' AND mnc.id IN (' + collectionIds.map(() => '?').join(',') + ')';
                            params.push(...collectionIds);
                        }
                    }

                    // ФИЛЬТРАЦИЯ ПО МОДЕЛИ (если выбрана коллекция и модели)
                    if (data.model && data.model.length > 0 && data.collection && data.collection.length > 0) {
                        const modelIds = data.model.map(id => parseInt(id)).filter(id => !isNaN(id));
                        if (modelIds.length > 0) {
                            query += ' AND mn.model IN (' + modelIds.map(() => '?').join(',') + ')';
                            params.push(...modelIds);
                        }
                    }

                    // ФИЛЬТРАЦИЯ ПО ФОНУ
                    if (data.background && data.background.length > 0) {
                        const bgIds = data.background.map(id => parseInt(id)).filter(id => !isNaN(id));
                        if (bgIds.length > 0) {
                            query += ' AND mn.background IN (' + bgIds.map(() => '?').join(',') + ')';
                            params.push(...bgIds);
                        }
                    }

                    // ФИЛЬТРАЦИЯ ПО УЗОРУ
                    if (data.pattern && data.pattern.length > 0) {
                        const patternIds = data.pattern.map(id => parseInt(id)).filter(id => !isNaN(id));
                        if (patternIds.length > 0) {
                            query += ' AND mn.pattern IN (' + patternIds.map(() => '?').join(',') + ')';
                            params.push(...patternIds);
                        }
                    }
                
                    // ФИЛЬТРАЦИЯ ПО РЕДКОСТИ (множественный выбор)
                    if (data.rarity && data.rarity.length > 0) {
                        const rarityConditions = [];

                        data.rarity.forEach(rarity => {
                            switch(rarity) {
                                case 'legendary':
                                    rarityConditions.push('mnc.total_supply <= 50');
                                    break;
                                case 'epic':
                                    rarityConditions.push('(mnc.total_supply > 50 AND mnc.total_supply <= 200)');
                                    break;
                                case 'rare':
                                    rarityConditions.push('(mnc.total_supply > 200 AND mnc.total_supply <= 1000)');
                                    break;
                                case 'common':
                                    rarityConditions.push('mnc.total_supply > 1000');
                                    break;
                            }
                        });

                        if (rarityConditions.length > 0) {
                            query += ' AND (' + rarityConditions.join(' OR ') + ')';
                        }
                    }
                
                    // ФИЛЬТРАЦИЯ ПО ЦЕНЕ
                    if (data.priceMin && data.priceMin > 0) {
                        query += ' AND ms.price >= ?';
                        params.push(data.priceMin);
                    }
                
                    if (data.priceMax && data.priceMax < 999999) {
                        query += ' AND ms.price <= ?';
                        params.push(data.priceMax);
                    }
                
                    // СОРТИРОВКА
                    let orderBy = 'ms.listed_at DESC'; // по умолчанию

                    if (data.sort) {
                        switch(data.sort) {
                            case 'newest':
                                orderBy = 'ms.listed_at DESC';
                                break;
                            case 'oldest':
                                orderBy = 'ms.listed_at ASC';
                                break;
                            case 'price_low':
                                orderBy = 'ms.price ASC';
                                break;
                            case 'price_high':
                                orderBy = 'ms.price DESC';
                                break;
                            case 'rarity_high':
                                // Сначала легендарные (total_supply <= 50), затем эпические и т.д.
                                orderBy = `CASE 
                                    WHEN mnc.total_supply <= 50 THEN 1
                                    WHEN mnc.total_supply <= 200 THEN 2
                                    WHEN mnc.total_supply <= 1000 THEN 3
                                    ELSE 4
                                END ASC, ms.listed_at DESC`;
                                break;
                            case 'rarity_low':
                                // Сначала обычные, затем редкие и т.д.
                                orderBy = `CASE 
                                    WHEN mnc.total_supply <= 50 THEN 4
                                    WHEN mnc.total_supply <= 200 THEN 3
                                    WHEN mnc.total_supply <= 1000 THEN 2
                                    ELSE 1
                                END ASC, ms.listed_at DESC`;
                                break;
                            case 'collection':
                                // Группировка по коллекциям
                                orderBy = 'mnc.name ASC, ms.listed_at DESC';
                                break;
                        }
                    }
                    
                    query += ` ORDER BY ${orderBy}`;
                    query += ' LIMIT 100';
                
                    const listings = await this.db.all(query, params);
                
                    // Функция определения редкости по total_supply
                    const getRarityBySupply = (totalSupply) => {
                        if (!totalSupply) return 'Обычный';
                        if (totalSupply <= 50) return 'Легендарный';
                        if (totalSupply <= 200) return 'Эпический';
                        if (totalSupply <= 1000) return 'Редкий';
                        return 'Обычный';
                    };
    
                    const formattedListings = listings.map(listing => {
                        const rarity = getRarityBySupply(listing.total_supply);
                    
                        // Формируем данные атрибутов
                        const modelData = listing.model_id ? {
                            id: listing.model_id,
                            name: listing.model_name,
                            rarity: listing.model_rarity,
                            file_name: listing.model_file_name
                        } : null;
                    
                        const backgroundData = listing.background_id ? {
                            id: listing.background_id,
                            back_0: listing.back_0,
                            back_100: listing.back_100,
                            name: listing.background_name,
                            rarity: listing.background_rarity
                        } : null;
                    
                        const patternData = listing.pattern_id ? {
                            id: listing.pattern_id,
                            name: listing.pattern_name,
                            rarity: listing.pattern_rarity,
                            file_name: listing.pattern_file_name
                        } : null;
                    
                        return {
                            id: listing.nft_id,
                            saleId: listing.sale_id,
                            price: listing.price,
                            sellerId: listing.seller_id,
                            listedAt: listing.listed_at,
                            number: listing.number,
                            collectionId: listing.collection_id,
                            ownerId: listing.owner_id,
                            createdAt: listing.created_at,
                            collectionName: listing.collection_name,
                            fullName: `${listing.collection_name} #${listing.number}`,
                            image: listing.image_file_id ? `/m_nft_image/base/${listing.image_file_id}` : '🎴',
                            rarity: rarity,
                            totalSupply: listing.total_supply,
                            soldCount: listing.sold_count,
                            collectionPrice: listing.collection_price || 0,
                            forSale: true,
                            update: listing.update,
                            // Добавляем данные атрибутов
                            modelData: modelData,
                            backgroundData: backgroundData,
                            patternData: patternData,
                            // Вычисляемые поля для фронтенда
                            rarityPercentage: listing.number && listing.total_supply ? 
                                Math.round((listing.number / listing.total_supply) * 10000) / 100 : 0
                        };
                    });
                
                    socket.emit('nfts_for_sale', {
                        success: true,
                        listings: formattedListings
                    });
                
                
                } catch (error) {
                    console.error('❌ Ошибка получения NFT с фильтрами:', error);
                    socket.emit('nfts_for_sale', {
                        success: false,
                        error: error.message
                    });
                }
            });

            socket.on('buy_nft', async (data) => {
                try {
                    const { nftId, userId, price } = data;
                
                    // 1. Проверяем баланс пользователя
                    const userBalance = await this.db.get(
                        'SELECT stars_balance FROM users WHERE id = ?',
                        [userId]
                    );
                
                    if (!userBalance || userBalance.stars_balance < price) {
                        socket.emit('buy_nft_result', {
                            success: false,
                            error: `Недостаточно средств. Нужно ${price} ⭐, у вас ${userBalance?.stars_balance || 0} ⭐`
                        });
                        return;
                    }
                
                    // 2. Проверяем, что NFT еще на продаже
                    const listing = await this.db.get(`
                        SELECT ms.*, mn.*, mnc.name as collection_name 
                        FROM m_nfts_on_sale ms 
                        JOIN m_nfts mn ON ms.nft_id = mn.id 
                        LEFT JOIN m_nft_collections mnc ON mn.collection_id = mnc.id 
                        WHERE ms.nft_id = ?`,
                        [nftId]
                    );
                
                    if (!listing) {
                        socket.emit('buy_nft_result', {
                            success: false,
                            error: 'NFT больше не доступен для покупки'
                        });
                        return;
                    }
                
                    // 3. Начинаем транзакцию
                    await this.db.run('BEGIN TRANSACTION');
                
                    try {
                        // 4. Списываем звезды у покупателя
                        await this.db.run(
                            'UPDATE users SET stars_balance = stars_balance - ? WHERE id = ?',
                            [price, userId]
                        );

                        // 5. ОБНОВЛЯЕМ СПЕНТ покупателя (только для покупки на маркете)
                        await this.userService.updateSpent(userId, price);
                    
                        // 6. Вычисляем 20% комиссии для реферера (если есть)
                        const serviceFee = Math.floor(price * 0.15); // 15% комиссия сервиса
                        const referrerBonus = Math.floor(serviceFee * 0.20); // 20% от цены

                        // 7. Зачисляем 85% продавцу (как было)
                        const sellerAmount = Math.floor(price * 0.85);
                        await this.db.run(
                            'UPDATE users SET stars_balance = stars_balance + ? WHERE id = ?',
                            [sellerAmount, listing.seller_id]
                        );

                        // 8. Если у покупателя есть реферер, начисляем ему 20% комиссии
                        const buyer = await this.db.get(
                            'SELECT referrer_id FROM users WHERE id = ?',
                            [userId]
                        );

                        if (buyer && buyer.referrer_id) {
                            // Начисляем бонус рефереру
                            await this.db.run(
                                'UPDATE users SET stars_balance = stars_balance + ? WHERE id = ?',
                                [referrerBonus, buyer.referrer_id]
                            );

                            console.log(`💰 Referral bonus ${referrerBonus} stars to ${buyer.referrer_id} from user ${userId} purchase`);
                        }
                    
                        // 9. Обновляем владельца NFT
                        await this.db.run(
                            'UPDATE m_nfts SET owner_id = ?, pinned = NULL WHERE id = ?',
                            [userId, nftId]
                        );
                    
                        // 10. Удаляем из таблицы продаж
                        await this.db.run(
                            'DELETE FROM m_nfts_on_sale WHERE nft_id = ?',
                            [nftId]
                        );
                    
                        // 11. Логируем трансфер
                        await this.nftService.logNFTTransfer(
                            nftId,
                            listing.seller_id,
                            userId,
                            'purchase',
                            price,
                            listing.collection_name,
                            listing.number
                        );
                    
                        await this.db.run('COMMIT');
                    
                        // 12. Получаем новый баланс покупателя
                        const newBalance = await this.db.get(
                            'SELECT stars_balance FROM users WHERE id = ?',
                            [userId]
                        );
                    
                        socket.emit('buy_nft_result', {
                            success: true,
                            message: 'NFT успешно куплен',
                            newBalance: newBalance.stars_balance
                        });
                    
                        // Обновляем баланс покупателя
                        socket.emit('balance_updated', {
                            userId: userId,
                            newBalance: newBalance.stars_balance,
                            timestamp: new Date().toISOString()
                        });

                        // Обновляем баланс реферера (если есть)
                        if (buyer && buyer.referrer_id) {
                            const referrerNewBalance = await this.db.get(
                                'SELECT stars_balance FROM users WHERE id = ?',
                                [buyer.referrer_id]
                            );

                            // Отправляем событие обновления баланса рефереру
                            const referrerSocketId = Object.keys(socket.adapter.sids).find(id => 
                                socket.adapter.sids[id] === buyer.referrer_id
                            );
                            if (referrerSocketId) {
                                socket.to(referrerSocketId).emit('balance_updated', {
                                    userId: buyer.referrer_id,
                                    newBalance: referrerNewBalance.stars_balance,
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                    
                        // Обновляем маркет для всех
                        this.io.emit('market_updated', {
                            timestamp: new Date().toISOString()
                        });
                    
                    } catch (error) {
                        await this.db.run('ROLLBACK');
                        throw error;
                    }
                
                } catch (error) {
                    console.error('❌ NFT purchase error:', error);
                    socket.emit('buy_nft_result', {
                        success: false,
                        error: error.message
                    });
                }
            });

            socket.on('remove_nft_from_sale', async (data) => {
                try {
                    const { nftId, userId } = data;

                    // Проверяем, что пользователь владеет NFT И он на продаже
                    const listing = await this.db.get(`
                        SELECT ms.*, mn.owner_id 
                        FROM m_nfts_on_sale ms
                        JOIN m_nfts mn ON ms.nft_id = mn.id
                        WHERE ms.nft_id = ? AND ms.seller_id = ?
                    `, [nftId, userId]);
                    
                    if (!listing) {
                        socket.emit('nft_removed_from_sale', {
                            success: false,
                            error: 'NFT не найден на продаже или вы не владеете им'
                        });
                        return;
                    }

                    // Удаляем из таблицы продаж
                    await this.db.run(
                        'DELETE FROM m_nfts_on_sale WHERE nft_id = ?',
                        [nftId]
                    );
                    socket.emit('nft_removed_from_sale', {
                        success: true,
                        message: 'NFT успешно снят с продажи'
                    });

                    // Отправляем событие обновления маркета всем
                    this.io.emit('market_updated', {
                        timestamp: new Date().toISOString()
                    });

                } catch (error) {
                    console.error('❌ Error removing NFT from sale:', error);
                    socket.emit('nft_removed_from_sale', {
                        success: false,
                        error: error.message
                    });
                }
            });
            
            socket.on('get_global_sales_history', async (data = {}) => {
                try {
                    const limit = data.limit || 50;
                    
                    // Получаем все NFT-трансферы из БД (только продажи)
                    const transfers = await this.db.all(`
                        SELECT 
                            nt.id,
                            nt.transfer_type,
                            nt.amount,
                            nt.from_user_id,
                            nt.to_user_id,
                            nt.timestamp,
                            mn.number as nft_number,
                            mn.collection_id,
                            mn.model,
                            mn.background,
                            mn.pattern,
                            mn.[update],
                            mnc.name as collection_name,
                            mnc.image_file_id as image_file_id,
                            
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
                            
                        FROM nft_transfers nt
                        LEFT JOIN m_nfts mn ON nt.nft_id = mn.id
                        LEFT JOIN m_nft_collections mnc ON mn.collection_id = mnc.id
                        LEFT JOIN models m ON mn.model = m.id
                        LEFT JOIN backgrounds b ON mn.background = b.id
                        LEFT JOIN patterns p ON mn.pattern = p.id
                        WHERE nt.transfer_type IN ('purchase', 'sale')
                        ORDER BY nt.timestamp DESC
                        LIMIT ?
                    `, [limit]);
                    
                    // Форматируем данные для фронтенда
                    const formattedTransfers = transfers.map(transfer => {
                        // Добавляем данные улучшенных атрибутов
                        const modelData = transfer.model_id ? {
                            id: transfer.model_id,
                            name: transfer.model_name,
                            rarity: transfer.model_rarity,
                            file_name: transfer.model_file_name
                        } : null;
                    
                        const backgroundData = transfer.background_id ? {
                            id: transfer.background_id,
                            back_0: transfer.back_0,
                            back_100: transfer.back_100,
                            name: transfer.background_name,
                            rarity: transfer.background_rarity
                        } : null;
                    
                        const patternData = transfer.pattern_id ? {
                            id: transfer.pattern_id,
                            name: transfer.pattern_name,
                            rarity: transfer.pattern_rarity,
                            file_name: transfer.pattern_file_name
                        } : null;
                    
                        // Определяем эмодзи для коллекции
                        const getCollectionEmoji = (name) => {
                            if (!name) return '🎴';
                            name = name.toLowerCase();
                            if (name.includes('cap')) return '🧢';
                            if (name.includes('car')) return '🚗';
                            if (name.includes('pencil')) return '✏️';
                            if (name.includes('pepe')) return '🐸';
                            return '🎴';
                        };
                        
                        return {
                            id: transfer.id,
                            type: 'Продажа NFT',
                            amount: transfer.amount,
                            fromUserId: transfer.from_user_id,
                            toUserId: transfer.to_user_id,
                            collectionName: transfer.collection_name,
                            nftNumber: transfer.nft_number,
                            nftFullName: `${transfer.collection_name || 'NFT'} #${transfer.nft_number || '?'}`,
                            emoji: getCollectionEmoji(transfer.collection_name),
                            imageFileId: transfer.image_file_id,
                            createdAt: transfer.timestamp,
                            timestamp: transfer.timestamp,
                            status: 'Успешно',
                            isGlobalSale: true,
                            
                            // ДОБАВЛЯЕМ ДАННЫЕ УЛУЧШЕННЫХ АТРИБУТОВ:
                            collectionId: transfer.collection_id,
                            update: transfer.update || null,
                            model: transfer.model,
                            background: transfer.background,
                            pattern: transfer.pattern,
                            modelData: modelData,
                            backgroundData: backgroundData,
                            patternData: patternData
                        };
                    });
                    
                    socket.emit('global_sales_history', {
                        success: true,
                        transfers: formattedTransfers,
                        count: formattedTransfers.length
                    });
                    
                    
                } catch (error) {
                    console.error('❌ Ошибка загрузки глобальной истории:', error);
                    socket.emit('global_sales_history', {
                        success: false,
                        error: error.message,
                        transfers: []
                    });
                }
            });

            socket.on('get_available_nfts', async (data) => {
                try {
                    let query = `
                        SELECT 
                            mnc.id,
                            mnc.name,
                            mnc.image_file_id,
                            mnc.total_supply,
                            mnc.sold_count,
                            mnc.price,
                            mnc.created_at,
                            (mnc.total_supply - mnc.sold_count) as available
                        FROM m_nft_collections mnc
                        WHERE 1=1
                    `;
                    
                    const params = [];
                    
                    // Фильтр по категории (теперь принимает ID коллекций)
                    if (data.category && data.category.length > 0) {
                        // Проверяем формат - могут быть имена или ID
                        const isNumericIds = data.category.every(id => !isNaN(id));
                        
                        if (isNumericIds) {
                            // Это числовые ID коллекций
                            query += ' AND mnc.id IN (' + data.category.map(() => '?').join(',') + ')';
                            params.push(...data.category);
                        } else {
                            // Это имена категорий (старый формат)
                            const categoryConditions = [];
                            data.category.forEach(category => {
                                categoryConditions.push('mnc.name LIKE ?');
                                params.push(`%${category}%`);
                            });
                            
                            if (categoryConditions.length > 0) {
                                query += ' AND (' + categoryConditions.join(' OR ') + ')';
                            }
                        }
                    }
                
                    // Фильтр по редкости (МНОЖЕСТВЕННЫЙ)
                    if (data.rarity && data.rarity.length > 0) {
                        const rarityConditions = [];
                    
                        data.rarity.forEach(rarity => {
                            switch(rarity) {
                                case 'legendary':
                                    rarityConditions.push('mnc.total_supply <= 50');
                                    break;
                                case 'epic':
                                    rarityConditions.push('(mnc.total_supply > 50 AND mnc.total_supply <= 200)');
                                    break;
                                case 'rare':
                                    rarityConditions.push('(mnc.total_supply > 200 AND mnc.total_supply <= 1000)');
                                    break;
                                case 'common':
                                    rarityConditions.push('mnc.total_supply > 1000');
                                    break;
                            }
                        });
                    
                        if (rarityConditions.length > 0) {
                            query += ' AND (' + rarityConditions.join(' OR ') + ')';
                        }
                    }

                    if (data.sort) {
                        switch(data.sort) {
                            case 'newest':
                                query += ' ORDER BY mnc.created_at DESC';
                                break;
                            case 'oldest':
                                query += ' ORDER BY mnc.created_at ASC';
                                break;
                            case 'price_low':
                                query += ' ORDER BY mnc.price ASC';
                                break;
                            case 'price_high':
                                query += ' ORDER BY mnc.price DESC';
                                break;
                            case 'rarity_high':
                                query += ' ORDER BY mnc.total_supply ASC, mnc.created_at DESC';
                                break;
                            case 'rarity_low':
                                query += ' ORDER BY mnc.total_supply DESC, mnc.created_at DESC';
                                break;
                            case 'collection':
                                query += ' ORDER BY mnc.name ASC, mnc.created_at DESC';
                                break;
                            default:
                                query += ' ORDER BY mnc.created_at DESC';
                        }
                    } else {
                        query += ' ORDER BY mnc.created_at DESC';
                    }
                
                    const collections = await this.db.all(query, params);
                
                    const getRarityBySupply = (totalSupply) => {
                        if (totalSupply <= 50) return 'Легендарный';
                        if (totalSupply <= 200) return 'Эпический';
                        if (totalSupply <= 1000) return 'Редкий';
                        return 'Обычный';
                    };
                
                    const formattedNFTs = collections.map(collection => {
                        const rarity = getRarityBySupply(collection.total_supply);
                        const available = Math.max(0, collection.total_supply - collection.sold_count);
                    
                        return {
                            id: collection.id,
                            collectionId: collection.id,
                            collectionName: collection.name,
                            totalSupply: collection.total_supply,
                            soldCount: collection.sold_count,
                            available: available,
                            price: collection.price || 0,
                            rarity: rarity,
                            fullName: collection.name,
                            // ВАЖНО: Передаем дату создания
                            created_at: collection.created_at, // SQL поле
                            createdAt: collection.created_at,  // JS поле
                            image: collection.image_file_id ? `/m_nft_image/base/${collection.image_file_id}` : '🎴',
                            number: collection.sold_count + 1
                        };
                    });
                
                    socket.emit('available_nfts_list', {
                        success: true,
                        nfts: formattedNFTs
                    });
                
                } catch (error) {
                    console.error('❌ Ошибка получения доступных NFT:', error);
                    socket.emit('available_nfts_list', {
                        success: false,
                        error: error.message || 'Внутренняя ошибка сервера',
                        nfts: []
                    });
                }
            });

            function getRarityBySupply(totalSupply) {
                if (totalSupply <= 50) return 'Легендарный';
                if (totalSupply <= 200) return 'Эпический';
                if (totalSupply <= 1000) return 'Редкий';
                return 'Обычный';
            }

            socket.on('buy_available_nft', async (data) => {
                try {
                    const { userId, nftId, price } = data;
                    
                    // 1. Проверяем баланс пользователя
                    const userBalance = await this.db.get(
                        'SELECT stars_balance FROM users WHERE id = ?',
                        [userId]
                    );
                    
                    if (!userBalance) {
                        socket.emit('nft_purchased', {
                            success: false,
                            error: 'Пользователь не найден'
                        });
                        return;
                    }
                    
                    if (userBalance.stars_balance < price) {
                        socket.emit('nft_purchased', {
                            success: false,
                            error: `Недостаточно средств. Нужно ${price} ⭐, у вас ${userBalance.stars_balance} ⭐`
                        });
                        return;
                    }
                    
                    // 2. Проверяем доступность NFT
                    const collection = await this.db.get(
                        'SELECT * FROM m_nft_collections WHERE id = ?',
                        [nftId]
                    );
                    
                    if (!collection) {
                        socket.emit('nft_purchased', {
                            success: false,
                            error: 'Коллекция не найдена'
                        });
                        return;
                    }
                    
                    const available = collection.total_supply - collection.sold_count;
                    if (available <= 0) {
                        socket.emit('nft_purchased', {
                            success: false,
                            error: 'Все NFT этой коллекции уже распроданы'
                        });
                        return;
                    }
                    
                    // 3. Начинаем транзакцию
                    await this.db.run('BEGIN TRANSACTION');
                    
                    try {
                        // 4. Списываем средства
                        await this.db.run(
                            'UPDATE users SET stars_balance = stars_balance - ? WHERE id = ?',
                            [price, userId]
                        );
                        
                        // 5. ОБНОВЛЯЕМ СПЕНТ покупателя
                        await this.userService.updateSpent(userId, price);
                        
                        // 6. Вычисляем 20% комиссии для реферера (если есть)
                        const serviceFee = Math.floor(price * 0.15); // 15% комиссия сервиса
                        const referrerBonus = Math.floor(serviceFee * 0.20);
                        
                        // 7. Если у покупателя есть реферер, начисляем ему 20% комиссии
                        const buyer = await this.db.get(
                            'SELECT referrer_id FROM users WHERE id = ?',
                            [userId]
                        );
                        
                        if (buyer && buyer.referrer_id) {
                            // Начисляем бонус рефереру
                            await this.db.run(
                                'UPDATE users SET stars_balance = stars_balance + ? WHERE id = ?',
                                [referrerBonus, buyer.referrer_id]
                            );
                            
                            console.log(`💰 Referral bonus ${referrerBonus} stars to ${buyer.referrer_id} from user ${userId} purchase`);
                        }
                        
                        // 8. Увеличиваем счетчик проданных
                        await this.db.run(
                            'UPDATE m_nft_collections SET sold_count = sold_count + 1 WHERE id = ?',
                            [nftId]
                        );
                        
                        // 9. ГЕНЕРИРУЕМ УНИКАЛЬНЫЙ ID ДЛЯ NFT
                        const maxIdResult = await this.db.get(
                            'SELECT MAX(id) as max_id FROM m_nfts'
                        );
                        const newNFTId = (maxIdResult?.max_id || 0) + 1;
                        const nftNumber = collection.sold_count + 1;
                        
                        // 10. Создаем NFT для пользователя
                        await this.db.run(
                            `INSERT INTO m_nfts (id, collection_id, number, owner_id, created_at) 
                             VALUES (?, ?, ?, ?, datetime('now'))`,
                            [newNFTId, nftId, nftNumber, userId]
                        );
                        
                        // 11. Логируем покупку
                        await this.db.run(
                            'INSERT INTO nft_transfers (transfer_type, nft_id, amount, from_user_id, to_user_id) VALUES (?, ?, ?, ?, ?)',
                            ['purchase', newNFTId, price, 0, userId]
                        );
                        
                        await this.db.run('COMMIT');
                        
                        // 12. Получаем новый баланс
                        const newBalance = await this.db.get(
                            'SELECT stars_balance FROM users WHERE id = ?',
                            [userId]
                        );
                        
                        socket.emit('nft_purchased', {
                            success: true,
                            newBalance: newBalance.stars_balance,
                            message: 'NFT успешно куплен',
                            nftId: newNFTId
                        });
                        
                        // 13. Обновляем баланс покупателя
                        socket.emit('balance_updated', {
                            userId: userId,
                            newBalance: newBalance.stars_balance
                        });
                        
                        // 14. Обновляем баланс реферера (если есть)
                        if (buyer && buyer.referrer_id) {
                            const referrerNewBalance = await this.db.get(
                                'SELECT stars_balance FROM users WHERE id = ?',
                                [buyer.referrer_id]
                            );
                            
                            // Отправляем событие обновления баланса рефереру
                            const referrerSocketId = Object.keys(socket.adapter.sids).find(id => 
                                socket.adapter.sids[id] === buyer.referrer_id
                            );
                            if (referrerSocketId) {
                                socket.to(referrerSocketId).emit('balance_updated', {
                                    userId: buyer.referrer_id,
                                    newBalance: referrerNewBalance.stars_balance,
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                        
                        // 15. Обновляем список доступных NFT для всех
                        this.io.emit('available_nfts_updated', {
                            collectionId: nftId,
                            timestamp: new Date().toISOString()
                        });
                        
                    } catch (error) {
                        await this.db.run('ROLLBACK');
                        console.error('❌ Transaction error:', error);
                        throw error;
                    }
                    
                } catch (error) {
                    console.error('❌ Ошибка покупки NFT:', error);
                    socket.emit('nft_purchased', {
                        success: false,
                        error: error.message || 'Внутренняя ошибка при покупке'
                    });
                }
            });

            socket.on('upgrade_nft', async (data) => {
                try {
                    const { nftId, userId } = data;

                    // 1. Проверяем баланс пользователя (5 звезд)
                    const userBalance = await this.db.get(
                        'SELECT stars_balance FROM users WHERE id = ?',
                        [userId]
                    );

                    if (!userBalance || userBalance.stars_balance < 1) {
                        socket.emit('upgrade_result', {
                            success: false,
                            error: 'Недостаточно звезд. Нужно 1 ⭐ для улучшения'
                        });
                        return;
                    }

                    // 2. Проверяем, что пользователь владеет NFT
                    const nftCheck = await this.db.get(
                        'SELECT * FROM m_nfts WHERE id = ? AND owner_id = ?',
                        [nftId, userId]
                    );

                    if (!nftCheck) {
                        socket.emit('upgrade_result', {
                            success: false,
                            error: 'NFT не найден или вы не владеете им'
                        });
                        return;
                    }

                    // 3. Проверяем, что NFT еще не был улучшен
                    if (nftCheck.update === 1) {
                        socket.emit('upgrade_result', {
                            success: false,
                            error: 'Этот NFT уже был улучшен'
                        });
                        return;
                    }

                    // 4. Проверяем, что коллекция позволяет улучшение
                    const collectionCheck = await this.db.get(
                        `SELECT mnc.updateble 
                         FROM m_nfts mn
                         JOIN m_nft_collections mnc ON mn.collection_id = mnc.id
                         WHERE mn.id = ?`,
                        [nftId]
                    );

                    if (!collectionCheck || collectionCheck.updateble !== 1) {
                        socket.emit('upgrade_result', {
                            success: false,
                            error: 'NFT этой коллекции нельзя улучшить'
                        });
                        return;
                    }

                    // 5. Выбираем случайные атрибуты на основе редкости
                    const [model, background, pattern] = await Promise.all([
                        this.getRandomModel(),
                        this.getRandomBackground(),
                        this.getRandomPattern()
                    ]);

                    // 6. Начинаем транзакцию
                    await this.db.run('BEGIN TRANSACTION');

                    try {
                        // 7. Списываем 1 звезд
                        await this.db.run(
                            'UPDATE users SET stars_balance = stars_balance - 1 WHERE id = ?',
                            [userId]
                        );

                        // 8. Обновляем NFT с новыми атрибутами и ставим флаг улучшения
                        await this.db.run(
                            `UPDATE m_nfts 
                             SET model = ?, background = ?, pattern = ?, [update] = 1 
                             WHERE id = ?`,
                            [model.id, background.id, pattern.id, nftId]
                        );

                        await this.db.run('COMMIT');

                        console.log(`✅ NFT #${nftId} успешно улучшен`);

                        // 10. Получаем обновленный баланс
                        const newBalance = await this.db.get(
                            'SELECT stars_balance FROM users WHERE id = ?',
                            [userId]
                        );

                        // 11. Получаем обновленные данные NFT
                        const updatedNFT = await this.db.get(`
                            SELECT mn.*, mnc.name as collection_name, mnc.image_file_id
                            FROM m_nfts mn
                            LEFT JOIN m_nft_collections mnc ON mn.collection_id = mnc.id
                            WHERE mn.id = ?
                        `, [nftId]);
                        
                        socket.emit('upgrade_result', {
                            success: true,
                            message: 'NFT успешно улучшен',
                            newBalance: newBalance.stars_balance,
                            updatedNFT: {
                                ...updatedNFT,
                                modelName: model.name,
                                backgroundName: background.name,
                                patternName: pattern.name,
                                modelFileName: model.file_name,
                                backgroundFileName: background.file_name,
                                patternFileName: pattern.file_name
                            }
                        });

                        // 12. Отправляем события обновления
                        socket.emit('balance_updated', {
                            userId: userId,
                            newBalance: newBalance.stars_balance,
                            timestamp: new Date().toISOString()
                        });

                        socket.emit('inventory_updated', {
                            userId: userId,
                            timestamp: new Date().toISOString()
                        });

                    } catch (error) {
                        await this.db.run('ROLLBACK');
                        console.error('❌ Ошибка транзакции:', error);
                        throw error;
                    }

                } catch (error) {
                    console.error('❌ NFT upgrade error:', error);
                    socket.emit('upgrade_result', {
                        success: false,
                        error: error.message || 'Внутренняя ошибка сервера'
                    });
                }
            });

            socket.on('toggle_pin_nft', async (data) => {
                try {
                    const { nftId, userId } = data;
                    
                    console.log(`📌 Toggling pin for NFT #${nftId} for user ${userId}`);
                    
                    const result = await this.nftService.togglePinNFT(nftId, userId);
                    
                    socket.emit('pin_toggled', result);
                    
                    if (result.success) {
                        console.log(`✅ NFT pin toggled: ${result.action}`);
                        
                        // Обновляем инвентарь пользователя
                        socket.emit('inventory_updated', {
                            userId: userId,
                            timestamp: new Date().toISOString()
                        });
                    }
                    
                } catch (error) {
                    console.error('❌ Error toggling pin:', error);
                    socket.emit('pin_toggled', {
                        success: false,
                        error: error.message
                    });
                }
            });
            
            socket.on('get_user_nfts_with_filters', async (data) => {
                try {
                    const { userId, filters = {} } = data;

                    let query = `
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
                    `;

                    const params = [userId];

                    // ФИЛЬТРАЦИЯ ПО КОЛЛЕКЦИИ (множественный выбор)
                    if (filters.collection && filters.collection.length > 0) {
                        // Преобразуем 'col1', 'col2' в [1, 2]
                        const collectionIds = filters.collection
                            .map(id => parseInt(id.replace('col', '')))
                            .filter(id => !isNaN(id));

                        if (collectionIds.length > 0) {
                            query += ' AND mnc.id IN (' + collectionIds.map(() => '?').join(',') + ')';
                            params.push(...collectionIds);
                        }
                    }

                    // БАЗОВАЯ СОРТИРОВКА ПО ЗАКРЕПЛЕНИЮ
                    let orderBy = `
                        CASE WHEN mn.pinned IS NOT NULL THEN 0 ELSE 1 END,
                        mn.pinned ASC,
                        mn.created_at DESC
                    `;

                    // ПРИМЕНЯЕМ ФИЛЬТРЫ СОРТИРОВКИ
                    if (!filters.sort || filters.sort === 'newest') {
                        // Фильтр "Новые" или фильтр не выбран (по умолчанию) - закрепленные сверху
                        orderBy = `
                            CASE WHEN mn.pinned IS NOT NULL THEN 0 ELSE 1 END,
                            mn.pinned ASC,
                            mn.created_at DESC
                        `;
                    } else {
                        // Для всех других фильтров - сортировка по выбранному критерию
                        switch(filters.sort) {
                            case 'rarity-high':
                                orderBy = `
                                    CASE 
                                        WHEN mnc.total_supply <= 50 THEN 1
                                        WHEN mnc.total_supply <= 200 THEN 2
                                        WHEN mnc.total_supply <= 1000 THEN 3
                                        ELSE 4
                                    END ASC,
                                    mn.created_at DESC
                                `;
                                break;
                            case 'rarity-low':
                                orderBy = `
                                    CASE 
                                        WHEN mnc.total_supply <= 50 THEN 4
                                        WHEN mnc.total_supply <= 200 THEN 3
                                        WHEN mnc.total_supply <= 1000 THEN 2
                                        ELSE 1
                                    END ASC,
                                    mn.created_at DESC
                                `;
                                break;
                            case 'oldest':
                                orderBy = 'mn.created_at ASC';
                                break;
                            case 'number-low':
                                orderBy = 'mn.number ASC';
                                break;
                            case 'number-high':
                                orderBy = 'mn.number DESC';
                                break;
                            case 'collection':
                                orderBy = 'mnc.name ASC, mn.number ASC';
                                break;
                            default:
                                // На всякий случай - если что-то пошло не так
                                orderBy = 'mn.created_at DESC';
                        }
                    }

                    query += ` ORDER BY ${orderBy}`;

                    const nfts = await this.db.all(query, params);

                    const formattedNFTs = nfts.map(nft => {
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
                            image: nft.collection_image ? `/m_nft_image/base/${nft.collection_image}` : '🎴',
                            name: nft.collection_image,
                            rarity: this.nftService.getRarity(nft.total_supply),
                            createdAt: nft.created_at,
                            rarityPercentage: nft.number && nft.total_supply ? 
                                Math.round((nft.number / nft.total_supply) * 10000) / 100 : 0,
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
                            modelData: modelData,
                            backgroundData: backgroundData,
                            patternData: patternData
                        };
                    });

                    socket.emit('user_nfts_with_filters', { 
                        success: true, 
                        nfts: formattedNFTs,
                        count: formattedNFTs.length
                    });

                } catch (error) {
                    console.error('❌ Error fetching user NFTs with filters:', error);
                    socket.emit('user_nfts_with_filters', { 
                        success: false, 
                        error: error.message 
                    });
                }
            });

            socket.on('get_market_attributes', async () => {
                try {
                    // Загружаем все атрибуты одним запросом
                    const [models, backgrounds, patterns] = await Promise.all([
                        this.db.all('SELECT id, name, rarity, file_name FROM models ORDER BY rarity DESC, name ASC'),
                        this.db.all('SELECT id, name, back_0, back_100, rarity FROM backgrounds ORDER BY rarity DESC, name ASC'),
                        this.db.all('SELECT id, name, rarity, file_name FROM patterns ORDER BY rarity DESC, name ASC')
                    ]);
                
                    socket.emit('market_attributes_result', {
                        success: true,
                        models: models || [],
                        backgrounds: backgrounds || [],
                        patterns: patterns || []
                    });
                } catch (error) {
                    console.error('❌ Ошибка загрузки атрибутов маркета:', error);
                    socket.emit('market_attributes_result', {
                        success: false,
                        models: [],
                        backgrounds: [],
                        patterns: [],
                        error: error.message
                    });
                }
            });

            socket.on('disconnect', () => {
                console.log(`🔌 Client disconnected: ${socket.id}`);
            });
        });
    }
    async getRandomModel() {
        // Выбираем модель с учетом редкости (чем выше rarity, тем меньше шанс)
        const models = await this.db.all('SELECT * FROM models ORDER BY rarity DESC');
        return this.weightedRandom(models, 'rarity');
    }

    async getRandomBackground() {
        const backgrounds = await this.db.all('SELECT * FROM backgrounds ORDER BY rarity DESC');
        return this.weightedRandom(backgrounds, 'rarity');
    }

    async getRandomPattern() {
        const patterns = await this.db.all('SELECT * FROM patterns ORDER BY rarity DESC');
        return this.weightedRandom(patterns, 'rarity');
    }

    weightedRandom(items, rarityKey = 'rarity') {
        // Преобразуем редкость в вес (чем выше редкость, тем меньше вес)
        const weights = items.map(item => 1 / (item[rarityKey] || 1));
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        let random = Math.random() * totalWeight;

        for (let i = 0; i < items.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return items[i];
            }
        }

        return items[items.length - 1];
    }

    async getNFTTransfersHistory(userId) {
        try {

            const transfers = await this.db.all(`
                SELECT 
                    nt.id,
                    nt.transfer_type,
                    nt.amount,
                    nt.from_user_id,
                    nt.to_user_id,
                    nt.timestamp,
                    mn.number as nft_number,
                    mn.collection_id,
                    mn.model,
                    mn.background,
                    mn.pattern,
                    mn.[update],
                    mnc.name as collection_name,
                    mnc.image_file_id as image_file_id,

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

                FROM nft_transfers nt
                LEFT JOIN m_nfts mn ON nt.nft_id = mn.id
                LEFT JOIN m_nft_collections mnc ON mn.collection_id = mnc.id
                LEFT JOIN models m ON mn.model = m.id
                LEFT JOIN backgrounds b ON mn.background = b.id
                LEFT JOIN patterns p ON mn.pattern = p.id
                WHERE nt.from_user_id = ? OR nt.to_user_id = ?
                ORDER BY nt.timestamp DESC
                LIMIT 50
            `, [userId, userId]);
            
            
            // Преобразуем в формат для отображения
            return transfers.map(transfer => {
                const isSender = transfer.from_user_id == userId;
                const isReceiver = transfer.to_user_id == userId;

                let transferType = '';
                let displayAmount = 0;
                let notes = '';

                if (isReceiver) {
                    // Получатель
                    transferType = 'Получение NFT';
                    displayAmount = 0;
                    notes = `Получение NFT: ${transfer.collection_name || 'NFT'} #${transfer.nft_number || '?'}`;
                } else if (isSender) {
                    // Отправитель
                    if (transfer.transfer_type === 'sale' || transfer.transfer_type === 'purchase') {
                        transferType = 'Продажа NFT';
                        displayAmount = Math.floor(transfer.amount * 0.85);
                        notes = `Продажа NFT: ${transfer.collection_name || 'NFT'} #${transfer.nft_number || '?'}`;
                    } else {
                        transferType = 'Передача NFT';
                        displayAmount = -5;
                        notes = `Передача NFT: ${transfer.collection_name || 'NFT'} #${transfer.nft_number || '?'}`;
                    }
                }

                // Добавляем данные улучшенных атрибутов
                const modelData = transfer.model_id ? {
                    id: transfer.model_id,
                    name: transfer.model_name,
                    rarity: transfer.model_rarity,
                    file_name: transfer.model_file_name
                } : null;

                const backgroundData = transfer.background_id ? {
                    id: transfer.background_id,
                    back_0: transfer.back_0,
                    back_100: transfer.back_100,
                    name: transfer.background_name,
                    rarity: transfer.background_rarity
                } : null;

                const patternData = transfer.pattern_id ? {
                    id: transfer.pattern_id,
                    name: transfer.pattern_name,
                    rarity: transfer.pattern_rarity,
                    file_name: transfer.pattern_file_name
                } : null;

                return {
                    id: `transfer_${transfer.id}`,
                    type: transferType,
                    amount: Math.abs(displayAmount), 
                    displayAmount: displayAmount, 
                    status: 'Успешно',
                    createdAt: transfer.timestamp,
                    completedAt: transfer.timestamp,
                    notes: notes,
                    isTransfer: true,
                    direction: isSender ? 'outgoing' : 'incoming',
                    isSale: transfer.transfer_type === 'sale' || transfer.transfer_type === 'purchase',
                    collectionName: transfer.collection_name,
                    nftNumber: transfer.nft_number,
                    imageFileId: transfer.image_file_id,
                    fromUserId: transfer.from_user_id,
                    toUserId: transfer.to_user_id,

                    // ДОБАВЛЯЕМ ДАННЫЕ УЛУЧШЕННЫХ АТРИБУТОВ:
                    collectionId: transfer.collection_id,
                    update: transfer.update || null,
                    model: transfer.model,
                    background: transfer.background,
                    pattern: transfer.pattern,
                    modelData: modelData,
                    backgroundData: backgroundData,
                    patternData: patternData
                };
            });
        } catch (error) {
            console.error('❌ Error fetching NFT transfers:', error);
            return [];
        }
    }
    
    async handleTelegramWebhook(data) {
        try {
            if (data.message && data.message.text && data.message.text === '/start') {
                const userId = data.message.from.id;
                const chatId = data.message.chat.id;

                console.log(`📱 Received /start command from user ${userId}`);

                // Отправляем приветственное сообщение с инлайн-кнопкой
                await this.sendWelcomeMessage(chatId);
                return;
            }
            if (data.pre_checkout_query) {
                const query = data.pre_checkout_query;
                const validation = this.telegramService.validatePayment(query.invoice_payload);
                
                if (validation.isValid) {
                    
                    try {
                        const response = await fetch(`${this.telegramService.apiUrl}/answerPreCheckoutQuery`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                pre_checkout_query_id: query.id,
                                ok: true
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (this.io) {
                            this.io.emit('pre_checkout_confirmed', {
                                userId: validation.userId,
                                amount: validation.amount
                            });
                        }
                        
                    } catch (error) {
                        console.error('❌ Error answering pre-checkout:', error);
                    }
                } else {
                    console.error('❌ Payment validation failed');
                    
                    try {
                        await fetch(`${this.telegramService.apiUrl}/answerPreCheckoutQuery`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                pre_checkout_query_id: query.id,
                                ok: false,
                                error_message: 'Invalid payment data'
                            })
                        });
                        
                        console.log('❌ Pre-checkout rejected');
                        
                    } catch (error) {
                        console.error('❌ Error rejecting pre-checkout:', error);
                    }
                }
                return;
            }
            
            if (data.message && data.message.successful_payment) {
                const payment = data.message.successful_payment;
                const userId = data.message.from.id;

                console.log('💰 Successful payment:', payment);

                try {
                    const payload = JSON.parse(payment.invoice_payload);
                    const amount = payload.amount;
                
                    console.log(`✅ Parsed payment: user ${userId}, amount ${amount}`);
                
                    // НАЧИСЛЯЕМ ЗВЕЗДЫ И СОЗДАЕМ ТРАНЗАКЦИЮ В ОДНОЙ ОПЕРАЦИИ
                    this.userService.depositStars(userId, amount)
                        .then(newBalance => {
                            if (newBalance !== null) {
                                console.log(`✅ Stars added: user ${userId} +${amount} stars, new balance: ${newBalance}`);
                            
                                // Отправляем сообщение
                                fetch(`${this.telegramService.apiUrl}/sendMessage`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        chat_id: userId,
                                        text: `✅ Платеж успешен! На ваш баланс зачислено ${amount} ⭐\nНовый баланс: ${newBalance} ⭐`
                                    })
                                }).catch(err => console.error('Error sending message:', err));
                            
                                // Отправляем событие
                                if (this.io) {
                                    this.io.emit('payment_successful', {
                                        userId: userId,
                                        amount: amount,
                                        newBalance: newBalance
                                    });
                                    socket.emit('get_transaction_history', { userId: userId });
                                }
                            }
                        })
                        .catch(error => {
                            console.error('❌ Error processing payment:', error);
                        });
                    
                } catch (error) {
                    console.error('❌ Error parsing payment payload:', error);
                }
            }
            
        } catch (error) {
            console.error('❌ Webhook handling error:', error);
        }
    }

    async sendWelcomeMessage(chatId) {
        try {
            const inlineKeyboard = {
                inline_keyboard: [
                    [{
                        text: '🚀 Открыть Маркет NFT',
                        url: 'https://t.me/m_nft_bot/market'
                    }]
                ]
            };

            const response = await fetch(`${this.telegramService.apiUrl}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: '👋 Добро пожаловать в M-NFT Маркет!\n\nЗдесь вы можете покупать, продавать и коллекционировать уникальные NFT.\n\nНажмите кнопку ниже, чтобы открыть маркет:',
                    reply_markup: inlineKeyboard,
                    parse_mode: 'HTML'
                })
            });

            const data = await response.json();

            if (data.ok) {
                console.log(`✅ Welcome message sent to chat ${chatId}`);
            } else {
                console.error('❌ Failed to send welcome message:', data);
            }

        } catch (error) {
            console.error('❌ Error sending welcome message:', error);
        }
    }

    startPriceBroadcasting() {
        setInterval(async () => {
            try {
                const rateData = await this.currencyService.getCurrentRate();
                this.io.to('currency_updates').emit('currency_update', {
                    tonPrice: rateData.tonPrice.toFixed(4),
                    timestamp: rateData.timestamp
                });
                console.log(`📢 Broadcasted TON price update to clients: $${rateData.tonPrice.toFixed(4)}`);
            } catch (error) {
                console.log('❌ Error broadcasting price update:', error.message);
            }
        }, 10000);
    }
}