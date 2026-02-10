const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export class TelegramService {
    constructor(botToken) {
        this.botToken = botToken;
        this.apiUrl = `https://api.telegram.org/bot${botToken}`;
    }

    async createInvoiceLink(userId, amount, description = 'Пополнение баланса') {
        try {
            const amountInCents = amount;
            
            const payload = JSON.stringify({
                userId: userId,
                amount: amount,
                timestamp: Date.now()
            });

            const response = await fetch(`${this.apiUrl}/createInvoiceLink`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Пополнение баланса',
                    description: description,
                    payload: payload,
                    provider_token: '', // Пустая строка для цифровых товаров
                    currency: 'XTR', // Обязательно 'XTR' для Telegram Stars
                    prices: [{
                        label: 'Telegram Stars',
                        amount: amountInCents // Сумма в центах
                    }]
                })
            });

            const data = await response.json();
            
            if (data.ok) {
                console.log(`✅ Invoice created for user ${userId}: ${amount} stars`);
                return data.result; // URL инвойса
            } else {
                throw new Error(`Telegram API error: ${JSON.stringify(data)}`);
            }
        } catch (error) {
            console.error('❌ Error creating invoice:', error);
            throw error;
        }
    }

    validatePayment(payload) {
        try {
            console.log('🔍 Validating payment payload:', payload);

            const paymentData = JSON.parse(payload);

            // Проверяем обязательные поля
            if (!paymentData.userId || !paymentData.amount || !paymentData.timestamp) {
                console.log('❌ Missing required fields in payload');
                return { isValid: false };
            }

            // Проверяем типы данных
            if (typeof paymentData.userId !== 'number' || 
                typeof paymentData.amount !== 'number' ||
                typeof paymentData.timestamp !== 'number') {
                console.log('❌ Invalid data types in payload');
                return { isValid: false };
            }

            // Проверяем timestamp (не старше 24 часов)
            const now = Date.now();
            const payloadTime = paymentData.timestamp;
            const timeDiff = now - payloadTime;

            if (timeDiff > 24 * 60 * 60 * 1000) { // 24 часа
                console.log('❌ Payload too old:', timeDiff, 'ms');
                return { isValid: false };
            }

            console.log(`✅ Payment validation successful: user ${paymentData.userId}, amount ${paymentData.amount}`);
            return {
                isValid: true,
                userId: paymentData.userId,
                amount: paymentData.amount,
                timestamp: paymentData.timestamp
            };

        } catch (error) {
            console.error('❌ Error validating payment:', error);
            return { isValid: false };
        }
    }
}