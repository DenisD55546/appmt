let depositCurrency = 'stars'; // 'stars' или 'ton'

// Функция для обработки платежа
async function processPayment() {
    const input = document.getElementById('depositAmountInput');
    if (!input) return;
    
    const amount = parseInt(input.value) || 0;
    const user = window.Telegram.WebApp.initDataUnsafe?.user;
    const userId = user?.id;
    
    if (!userId) {
        showError('Пользователь не найден');
        return;
    }
    
    // Проверка минимальной суммы
    if (amount < 5) { // Измените на нужный минимум
        showError('Минимальная сумма пополнения: 5 ⭐');
        return;
    }
    
    const depositBtn = document.getElementById('depositActionBtn');
    if (depositBtn) {
        depositBtn.disabled = true;
        depositBtn.innerHTML = '<span class="loading-spinner-mini"></span> Создание платежа...';
    }
    
    try {
        if (socket && socket.connected) {
            console.log(`💳 Отправка запроса на создание инвойса: userId=${userId}, amount=${amount}`);
            
            // Создаем timestamp для payload
            const timestamp = Date.now();
            const invoicePayload = JSON.stringify({
                userId: userId,
                amount: amount,
                timestamp: timestamp
            });
            
            socket.emit('create_payment_invoice', { 
                userId, 
                amount,
                payload: invoicePayload
            });
            
            // Обработка ответа
            socket.once('payment_invoice_created', (response) => {
                console.log('💳 Ответ от сервера:', response);
                
                if (response.success && response.invoiceUrl) {
                    // Открываем инвойс в Telegram
                    Telegram.WebApp.openInvoice(response.invoiceUrl, (status) => {
                        console.log('💳 Статус платежа от Telegram:', status);
                        
                        // Восстанавливаем кнопку
                        if (depositBtn) {
                            depositBtn.disabled = false;
                            depositBtn.innerHTML = '<span>Пополнить</span><span class="action-amount" id="actionAmount">' + amount + ' ⭐</span>';
                        }
                        
                        if (status === 'paid') {
                            // Платеж успешен - баланс обновится через сокет
                            console.log('✅ Платеж успешно завершен');
                            showSuccess(`Платеж на ${amount} ⭐ успешно завершен!`);
                            
                            // Закрываем модальное окно
                            setTimeout(() => {
                                closeDepositModal();
                                vibrate([5, 3, 5, 3, 5]);
                            }, 1500);
                        } else if (status === 'failed' || status === 'cancelled') {
                            // Платеж не удался
                            showError('Платеж не был завершен');
                            vibrate([5, 5, 5]);
                        }
                    });
                    
                } else {
                    // Ошибка создания инвойса
                    console.error('❌ Ошибка создания платежа:', response.error);
                    showError(response.error || 'Ошибка создания платежа');
                    
                    if (depositBtn) {
                        depositBtn.disabled = false;
                        depositBtn.innerHTML = '<span>Пополнить</span><span class="action-amount" id="actionAmount">' + amount + ' ⭐</span>';
                    }
                }
            });
            
            // Таймаут на случай отсутствия ответа
            setTimeout(() => {
                if (depositBtn && depositBtn.disabled) {
                    depositBtn.disabled = false;
                    depositBtn.innerHTML = '<span>Пополнить</span><span class="action-amount" id="actionAmount">' + amount + ' ⭐</span>';
                    showError('Время ожидания ответа истекло');
                }
            }, 10000);
            
        } else {
            showError('Нет соединения с сервером');
            if (depositBtn) {
                depositBtn.disabled = false;
                depositBtn.innerHTML = '<span>Пополнить</span><span class="action-amount" id="actionAmount">' + amount + ' ⭐</span>';
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка при обработке платежа:', error);
        showError('Ошибка при обработке платежа');
        
        if (depositBtn) {
            depositBtn.disabled = false;
            depositBtn.innerHTML = '<span>Пополнить</span><span class="action-amount" id="actionAmount">' + amount + ' ⭐</span>';
        }
    }
}

// Функция обновления баланса после платежа
function updateBalanceAfterPayment(amount) {
    const user = window.Telegram.WebApp.initDataUnsafe?.user;
    const userId = user?.id;
    
    if (!userId || !socket) return;
    
    // Запрашиваем обновление баланса на сервере
    socket.emit('deposit_stars', { userId, amount });
    
    // Ожидаем ответа
    socket.once('deposit_result', (response) => {
        if (response.success) {
            // Обновляем локальное состояние
            appState.starsBalance = response.newBalance;
            
            // Обновляем UI
            updateStarsBalance();
            updateBalanceModal();
            
            // Показываем успех
            showSuccess(`Баланс пополнен на ${amount.toLocaleString()} ⭐!\nНовый баланс: ${response.newBalance.toLocaleString()} ⭐`);
            
            // Закрываем модальное окно
            closeDepositModal();
            
            // Вибрация успеха
            vibrate([5, 3, 5, 3, 5]);
        } else {
            showError('Ошибка обновления баланса после платежа');
        }
    });
}

// функция для записи транзакции
function recordTransaction(userId, type, amount, status = 'completed') {
    if (!socket || !socket.connected) {
        console.error('Socket not connected for transaction recording');
        return;
    }
    
    socket.emit('record_transaction', {
        userId: userId,
        type: type, // 'deposit' или 'withdrawal'
        amount: amount,
        status: status,
        notes: `Пополнение через Telegram Payments`
    });
    
    console.log(`📝 Recording transaction: ${type} ${amount} stars for user ${userId}`);
}

// Отображение модального окна добавления баланса
function showAddBalanceModal() {
    if (!window.tg?.showPopup) return;
    
    window.tg.showPopup({
        title: 'Пополнить баланс',
        message: `Ваш баланс: ${appState.starsBalance.toLocaleString()} ⭐\n\nДля пополнения перейдите в раздел покупки NFT.`
    });
    
    if (window.vibrate) window.vibrate([3, 5, 3]);
}

// ===== ФУНКЦИИ ДЛЯ МОДАЛЬНОГО ОКНА ПОПОЛНЕНИЯ =====

// Создание модального окна пополнения
function createDepositModal() {
    // Проверяем, не существует ли уже модальное окно
    if (document.getElementById('depositModal')) return;
    
    const modalHTML = `
        <!-- Модальное окно пополнения -->
        <div id="depositModal" class="deposit-modal">
            <div class="deposit-modal-overlay" onclick="closeDepositModal()"></div>
            <div class="deposit-modal-content">
                <!-- Заголовок -->
                <div class="deposit-header">
                    <h4 class="deposit-title">Пополнить баланс</h4>
                    <button class="deposit-close" onclick="closeDepositModal()">×</button>
                </div>
                
                <!-- Селектор валюты -->
                <div class="currency-selector-deposit">
                    <button class="currency-option-deposit active" onclick="selectDepositCurrency('stars')" id="depositStarsBtn">
                        <span class="currency-icon-deposit">⭐</span>
                        <span class="currency-name-deposit">Звезды</span>
                    </button>
                    <button class="currency-option-deposit" id="depositTonBtn">
                        <span class="currency-icon-deposit">⚡</span>
                        <span class="currency-name-deposit">TON soon...</span>
                    </button>
                </div>
                
                <!-- Поле ввода суммы -->
                <div class="deposit-amount-section">
                    <div class="amount-input-container">
                        <input 
                            type="number" 
                            id="depositAmountInput" 
                            class="deposit-amount-input" 
                            placeholder="0"
                            min="5"
                            step="1"
                            value="100"
                            oninput="formatDepositInput()"
                        >
                        <div class="amount-currency">⭐</div>
                    </div>
                </div>
                
                <!-- Информация о пополнении -->
                <div class="deposit-info" id="depositInfo">
                    <div class="deposit-text">
                        Введите сумму для пополнения
                    </div>
                </div>
                
                <!-- Кнопка действия -->
                <div class="deposit-action">
                    <button class="deposit-action-btn" onclick="processPayment()" id="depositActionBtn">
                        <span>Пополнить</span>
                        <span class="action-amount" id="actionAmount">50 ⭐</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setupDepositModalEvents();
    initDepositInput();
}

// Инициализация поля ввода суммы
function initDepositInput() {
    const input = document.getElementById('depositAmountInput');
    if (input) {
        input.focus();
        input.select();
    }
    updateDepositButton();
}

// Форматирование ввода суммы
function formatDepositInput() {
    const input = document.getElementById('depositAmountInput');
    if (!input) return;
    
    updateDepositButton();
    
    if (depositCurrency === 'ton') updateTonDisplay();
}

// Обновление кнопки пополнения
function updateDepositButton() {
    const input = document.getElementById('depositAmountInput');
    const actionAmount = document.getElementById('actionAmount');
    const actionBtn = document.getElementById('depositActionBtn');
    
    if (!input || !actionAmount || !actionBtn) return;
    
    const value = parseInt(input.value) || 0;
    
    let displayText = '';
    if (depositCurrency === 'stars') {
        displayText = `${value.toLocaleString()} ⭐`;
    } else {
        displayText = `${starsToTon(value).toFixed(4)} TON`;
    }
    
    actionAmount.textContent = displayText;
    
    let isValid = true;
    let errorMessage = '';
    
    if (value < 5) {
        isValid = false;
        errorMessage = 'Минимум 5 ⭐';
    } else if (value > 1000) {
        isValid = false;
        errorMessage = 'Максимум 1,000 ⭐';
    }
    
    actionBtn.disabled = !isValid;
    actionBtn.style.opacity = isValid ? '1' : '0.6';
    actionBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
    
    if (!isValid && errorMessage) {
        actionAmount.textContent = errorMessage;
        actionAmount.style.color = 'var(--accent)';
    } else {
        actionAmount.style.color = '';
    }
}

// Настройка обработчиков событий для модального окна пополнения
function setupDepositModalEvents() {
    const depositModal = document.getElementById('depositModal');
    if (!depositModal) return;
    
    // Клик вне модального окна (по overlay)
    const overlay = depositModal.querySelector('.deposit-modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', closeDepositModal);
    }
    
    // Закрытие по Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('depositModal');
            if (modal && modal.classList.contains('active')) {
                closeDepositModal();
            }
        }
    });
}

// Открытие модального окна пополнения
function openDepositModal() {
    // Создаем модальное окно если его нет
    if (!document.getElementById('depositModal')) {
        createDepositModal();
    }
    
    const depositModal = document.getElementById('depositModal');
    if (depositModal) {
        depositModal.classList.add('active');
        updateDepositModal();
    }
    
    // Показываем кнопку "Назад" в Telegram
    if (tg && tg.BackButton) {
        tg.BackButton.show();
        // Устанавливаем обработчик для возврата в баланс
        tg.BackButton.onClick(closeDepositModal);
    }
    
    // Вибрация
    vibrate(1);
}

function starsToTon(stars) {
    return (stars * AppConfig.STAR_PRICE_USD) / AppConfig.TON_PRICE_USD;
}

function updateDepositModal() {
    const depositInfo = document.getElementById('depositInfo');
    if (!depositInfo) return;
    
    if (depositCurrency === 'stars') {
        depositInfo.innerHTML = `
            <div class="deposit-text">
                Сумма будет зачислена на ваш баланс звезд
            </div>
        `;
    } else {
        depositInfo.innerHTML = `
            <div class="deposit-text">
                Сумма будет конвертирована в TON по текущему курсу
            </div>
        `;
    }
}

// Выбор валюты для пополнения
function selectDepositCurrency(currency) {
    const input = document.getElementById('depositAmountInput');
    if (!input) return;
    
    // СОХРАНЯЕМ ТЕКУЩЕЕ ЗНАЧЕНИЕ ИЗ ПОЛЯ ВВОДА
    const currentValue = input.value;
    
    depositCurrency = currency;
    
    const starsBtn = document.getElementById('depositStarsBtn');
    const tonBtn = document.getElementById('depositTonBtn');
    
    if (starsBtn && tonBtn) {
        starsBtn.classList.toggle('active', currency === 'stars');
        tonBtn.classList.toggle('active', currency === 'ton');
    }
    
    // ВОССТАНАВЛИВАЕМ СОХРАНЕННОЕ ЗНАЧЕНИЕ
    input.value = currentValue;
    
    updateDepositModal();
    updateDepositButton();
    
    // Обновляем отображение для TON
    if (currency === 'ton') updateTonDisplay();
    
    vibrate([3, 5, 3]);
}

function updateTonDisplay() {
    const input = document.getElementById('depositAmountInput');
    if (!input) return;
    
    const stars = parseInt(input.value) || 0;
    const ton = starsToTon(stars);
    
    let display = document.getElementById('tonDisplay');
}

function closeDepositModal() {
    const depositModal = document.getElementById('depositModal');
    if (depositModal) {
        depositModal.classList.remove('active');
    }
    openBalanceModal();
    vibrate(1);
}

function setupBalanceListeners() {
    if (socket) {
        socket.on('deposit_result', (data) => {
            if (data.success) {
                const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
                if (tgUser?.id) {
                    appState.starsBalance = data.newBalance;
                    updateStarsBalance();
                    updateBalanceModal(); 
                }
            }
        });
        
        // Также обновляем баланс при получении данных пользователя
        socket.on('user_registered', (data) => {
            if (data.success && data.user) {
                if (data.user.stars_balance !== undefined) {
                    appState.starsBalance = data.user.stars_balance;
                    updateStarsBalance();
                    updateBalanceModal();
                }
            }
        });
    }
}

// Экспорт функций в глобальную область видимости
window.processPayment = processPayment;
window.updateBalanceAfterPayment = updateBalanceAfterPayment;
window.recordTransaction = recordTransaction;
window.showAddBalanceModal = showAddBalanceModal;
window.createDepositModal = createDepositModal;
window.initDepositInput = initDepositInput;
window.formatDepositInput = formatDepositInput;
window.updateDepositButton = updateDepositButton;
window.setupDepositModalEvents = setupDepositModalEvents;
window.openDepositModal = openDepositModal;
window.starsToTon = starsToTon;
window.updateDepositModal = updateDepositModal;
window.selectDepositCurrency = selectDepositCurrency;
window.updateTonDisplay = updateTonDisplay;
window.closeDepositModal = closeDepositModal;
window.setupBalanceListeners = setupBalanceListeners;