let socket = null;

function initSocket() {
    socket = io('https://test.fternstars.ru', {
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log('✅ Connected to server');
        
        // Получаем user из Telegram WebApp
        const tg = window.Telegram?.WebApp;
        const user = tg?.initDataUnsafe?.user;
        
        if (user?.id) {
            console.log(`🔄 Registering user ${user.id}`);
            
            // Получаем referrerId из start_param
            const referrerId = tg.initDataUnsafe?.start_param;
            console.log('🔗 Referrer ID from Telegram:', referrerId);
            
            // Регистрируем пользователя через socket
            socket.emit('register_user', { 
                userId: user.id,
                referrerId: referrerId
            });
            
            // После регистрации запрашиваем NFT
            socket.on('user_registered', async (data) => {
                if (data.success) {
                    console.log(`✅ User registered successfully`);
                }
            });
            
            // Подписываемся на курс валюты
            socket.emit('subscribe_currency');
            socket.emit('get_currency_rate');
            if (user?.id) {
                setTimeout(() => {
                    console.log(`📜 Auto-requesting transaction history for user: ${user.id}`);
                    socket.emit('get_transaction_history', { userId: user.id });
                }, 1000);
            }
        }
    });

    // обработчик обновления инвентаря
    socket.on('inventory_updated', (data) => {
        console.log('🔄 Inventory update received for user:', data.userId);
        
        // Если это обновление для текущего пользователя
        const tg = window.Telegram?.WebApp;
        const user = tg?.initDataUnsafe?.user;
        
        if (user?.id && user.id === data.userId && window.loadInventoryItems) {
            // Задержка для гарантии обновления в БД
            setTimeout(() => {
                console.log('🔄 Reloading inventory...');
                window.loadInventoryItems();
            }, 300);
        }
    });

    socket.on('user_registered', (data) => {
        console.log('📝 User registration response:', data);
        if (data.success && window.appState) {
            window.appState.userData = data.user;
            if (window.updateUI) window.updateUI();
        }
    });
    socket.on('transaction_history', (data) => {
        console.log('📜 Received transaction history:', data);
        
        // Проверяем, какая вкладка активна - упрощаем логику
        const profileHistoryList = document.getElementById('profileHistoryList');
        
        if (data.success && data.transactions) {
            if (profileHistoryList && window.displayProfileTransactionHistory) {
                window.displayProfileTransactionHistory(data.transactions);
            }
        } else if (profileHistoryList) {
            // Если нет данных, показываем пустое состояние
            profileHistoryList.innerHTML = `
                <div class="empty-history">
                    <div class="empty-icon">📜</div>
                    <p>История транзакций пуста</p>
                    <p class="empty-hint">Здесь будут отображаться ваши операции</p>
                </div>
            `;
        }
    });

    socket.on('user_nfts', (data) => {
        console.log('🎨 User NFTs loaded:', data.count || 0);
        if (data.success) {
            // Критически важно: обновляем кэш
            window.cachedUserNFTs = data.nfts;
            console.log('✅ NFT кэш обновлен:', window.cachedUserNFTs.length, 'NFT');

            // Принудительно обновляем инвентарь
            if (window.loadInventoryItems) {
                console.log('🔄 Вызов loadInventoryItems...');
                window.loadInventoryItems();
            }
        } else {
            console.error('❌ Ошибка загрузки NFT:', data.error);
        }
    });

    socket.on('nft_transfer_result', (data) => {
        console.log('🔄 NFT transfer result received:', data);
        
        if (data.success) {
            console.log('✅ NFT transfer successful');

            // ОБНОВЛЯЕМ БАЛАНС В ЛОКАЛЬНОМ СОСТОЯНИИ
            if (window.appState && data.newBalance !== undefined) {
                window.appState.starsBalance = data.newBalance;
            }

            // ОБНОВЛЯЕМ UI БАЛАНСА
            if (window.updateStarsBalance) {
                window.updateStarsBalance();
            }

            // Закрываем модалки
            if (window.closeConfirmationModal) window.closeConfirmationModal();
            if (window.closeTransferModal) window.closeTransferModal();
            if (window.closeNFTModal) window.closeNFTModal();

            // КРИТИЧЕСКО ВАЖНО: Полностью сбрасываем кэш
            window.cachedUserNFTs = [];
            console.log('🧹 Кэш NFT полностью очищен');

            // Показываем уведомление
            if (window.tg?.showPopup) {
                window.tg.showPopup({
                    title: 'Успешно',
                    message: `NFT успешно передан. Списано 5 ⭐`
                });
            }

            // Запрашиваем обновленные NFT СРАЗУ
            const tg = window.Telegram?.WebApp;
            const user = tg?.initDataUnsafe?.user;

            if (user?.id) {
                console.log('🔄 Запрашиваем обновленные NFT...');
                socket.emit('get_user_nfts', user.id);

                // Дополнительно: принудительно обновляем инвентарь через 500мс
                setTimeout(() => {
                    if (window.loadInventoryItems) {
                        console.log('🔄 Принудительное обновление инвентаря...');
                        window.loadInventoryItems();
                    }
                }, 500);
            }

        } else {
            console.error('❌ NFT transfer failed:', data.error);

            if (window.tg?.showPopup) {
                window.tg.showPopup({
                    title: 'Ошибка',
                    message: data.error || 'Не удалось передать NFT'
                });
            }
        }
    });

    socket.on('balance_updated', (data) => {
        console.log('💰 Balance update received:', data);
        
        const tg = window.Telegram?.WebApp;
        const user = tg?.initDataUnsafe?.user;
        
        if (user?.id && user.id == data.userId) {
            // Обновляем состояние
            if (window.appState) {
                window.appState.starsBalance = data.newBalance;
            }

            // Обновляем UI
            if (window.updateStarsBalance) {
                window.updateStarsBalance();
            }

            // Обновляем модальное окно баланса если оно открыто
            if (window.updateBalanceModal) {
                window.updateBalanceModal();
            }
        }
    });

    socket.on('payment_successful', (data) => {
        console.log('💰 Payment successful event:', data);

        const tg = window.Telegram?.WebApp;
        const user = tg?.initDataUnsafe?.user;

        // Проверяем, что платеж для текущего пользователя
        if (user?.id && user.id == data.userId) {
            console.log(`✅ Adding ${data.amount} stars to balance`);

            // Обновляем состояние
            if (window.appState) {
                window.appState.starsBalance = data.newBalance;
            }

            // Обновляем UI
            if (window.updateStarsBalance) {
                window.updateStarsBalance();
            }

            // Показываем уведомление
            if (window.showSuccess) {
                window.showSuccess(`Баланс пополнен на ${data.amount} ⭐!\nНовый баланс: ${data.newBalance} ⭐`);
            }

            // Вибрация
            if (window.vibrate) {
                window.vibrate([5, 3, 5, 3, 5]);
            }
        }
    });

    socket.on('global_sales_history', (data) => {
        console.log('📊 Получена глобальная история продаж:', data.count || 0);
        
        // Сохраняем в глобальной переменной
        window.globalSalesHistory = data.transfers || [];
        
        // Если секция истории активна - обновляем
        const historySection = document.getElementById('history');
        if (historySection && historySection.classList.contains('active')) {
            if (window.displayGlobalSalesHistory) {
                window.displayGlobalSalesHistory(window.globalSalesHistory);
            }
        }
    });
    
    socket.on('nft_purchased', (data) => {
        console.log('🏠 Покупка NFT на главной:', data);
        if (window.handlePurchaseResponse) {
            window.handlePurchaseResponse(data);
        }
    });

    // Обработчик покупки NFT на маркете
    socket.on('market_nft_purchased', (data) => {
        console.log('🛒 Покупка NFT на маркете:', data);
        if (window.handlePurchaseResponse) {
            window.handlePurchaseResponse(data);
        }
    });

    // Обработчик подтверждения pre-checkout
    socket.on('pre_checkout_confirmed', (data) => {
        console.log('✅ Pre-checkout confirmed:', data);
        // Можно обновить UI или показать статус
    });

    socket.on('payment_invoice_created', (response) => {
        console.log('💳 Invoice created response:', response);
        // Этот обработчик используется в processPayment через socket.once
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
    });

    window.socket = socket;
}

function getSocket() {
    return socket;
}