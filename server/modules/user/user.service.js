export class UserService {
    constructor(db) {
        this.db = db;
    }

    async getUser(userId) {
        try {
            const user = await this.db.get(
                'SELECT * FROM users WHERE id = ?',
                [userId]
            );
            return user;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    }

    async createUser(userId, referrerId = null) {
        try {
            console.log(`🆕 Creating user ${userId} with referrer ${referrerId || 'none'}`);
            
            const result = await this.db.run(
                'INSERT OR IGNORE INTO users (id, referrer_id) VALUES (?, ?)',
                [userId, referrerId]
            );
            
            console.log(`✅ User creation result: ${result.changes} changes`);
            
            // Если был указан реферер, обновляем его счетчик
            if (referrerId && result.changes > 0) {
                await this.db.run(
                    'UPDATE users SET referrals_count = referrals_count + 1 WHERE id = ?',
                    [referrerId]
                );
                console.log(`📈 Updated referrer ${referrerId} referrals count`);
            }
            
            return result.changes > 0;
        } catch (error) {
            console.error('❌ Error creating user:', error);
            return false;
        }
    }

    async getUserStats(userId) {
        try {
            const stats = await this.db.get(`
                SELECT 
                    u.*,
                    (SELECT COUNT(*) FROM users WHERE referrer_id = u.id) as referrals_count_actual
                FROM users u
                WHERE u.id = ?
            `, [userId]);
            
            return stats;
        } catch (error) {
            console.error('Error getting user stats:', error);
            return null;
        }
    }
    
    async getReferrals(userId) {
        try {
            const referrals = await this.db.all(
                'SELECT id, created_at FROM users WHERE referrer_id = ? ORDER BY created_at DESC',
                [userId]
            );

            return referrals.map(ref => ({
                id: ref.id,
                joined_at: ref.created_at,
                // Поскольку в базе нет данных о звездах, можно показывать 0
                earned: 0
            }));
        } catch (error) {
            console.error('Error getting referrals:', error);
            return [];
        }
    }

    async searchUsers(query) {
        try {
            // Очищаем запрос от нецифровых символов
            const cleanQuery = query.replace(/\D/g, '');

            if (cleanQuery.length < 2) {
                return []; // Минимум 2 цифры для поиска
            }

            // Проверяем, является ли запрос числом
            const isNumber = /^\d+$/.test(cleanQuery);

            if (!isNumber) {
                return []; // Только цифры
            }
            const users = await this.db.all(`
                SELECT id, created_at 
                FROM users 
                WHERE CAST(id AS TEXT) LIKE ?
                ORDER BY 
                    CASE 
                        WHEN CAST(id AS TEXT) LIKE ? THEN 1 -- Начинается с
                        ELSE 2 -- Содержит
                    END,
                    LENGTH(id) -- Сначала более короткие (скорее всего более релевантные)
                LIMIT 15
            `, [
                `%${cleanQuery}%`,   // Для WHERE
                `${cleanQuery}%`     // Для сортировки
            ]);

            return users.map(user => ({
                id: user.id,
                username: `user_${user.id}`,
                joined_at: user.created_at,
                // Добавляем релевантность для отображения на фронтенде
                relevance: String(user.id).startsWith(cleanQuery) ? 'high' : 'medium'
            }));
        } catch (error) {
            console.error('Error searching users:', error);
            return [];
        }
    }
    
    async depositStars(userId, amount) {
        try {
            console.log(`💰 Deposit: user ${userId}, amount: ${amount} stars`);

            // Начинаем транзакцию
            await this.db.run('BEGIN TRANSACTION');

            try {
                // Обновляем баланс
                const result = await this.db.run(
                    'UPDATE users SET stars_balance = stars_balance + ? WHERE id = ?',
                    [amount, userId]
                );

                if (result.changes !== 1) {
                    throw new Error('Failed to update balance');
                }

                // СОЗДАЕМ ТРАНЗАКЦИЮ СО СТАТУСОМ completed
                const transactionId = await this.logTransaction(
                    userId, 
                    'deposit', 
                    amount, 
                    'completed', // Сразу completed
                    `Пополнение через Telegram Payments`
                );

                // // Коммитим транзакцию
                // if (type === 'nft_transfer_fee') {
                //     // Логируем списание за трансфер NFT
                //     await this.logTransaction(
                //         userId, 
                //         'withdrawal', // или 'nft_transfer_fee'
                //         amount, 
                //         'completed',
                //         `Списание за передачу NFT (комиссия)`
                //     );
                // }
                await this.db.run('COMMIT');

                // Получаем новый баланс
                const newBalance = await this.getBalance(userId);
                console.log(`✅ Balance updated: ${newBalance} stars`);
                return newBalance;

            } catch (error) {
                // Откатываем при ошибке
                await this.db.run('ROLLBACK');
                throw error;
            }

        } catch (error) {
            console.error('❌ Deposit error:', error);
            return null;
        }
    }
    
    async getBalance(userId) {
        try {
            const user = await this.db.get(
                'SELECT COALESCE(stars_balance, 0) as stars_balance FROM users WHERE id = ?',
                [userId]
            );
            return user ? user.stars_balance : 0;
        } catch (error) {
            console.error('Error getting balance:', error);
            return 0;
        }
    }

    async logTransaction(userId, type, amount, status = 'pending', notes = '') {
        try {
            console.log(`📝 Logging transaction: user ${userId}, type ${type}, amount ${amount}`);

            const result = await this.db.run(
                'INSERT INTO transaction_history (user_id, type, amount, status, notes) VALUES (?, ?, ?, ?, ?)',
                [userId, type, amount, status, notes]
            );

            return result.lastID; // Возвращаем ID новой записи
        } catch (error) {
            console.error('❌ Error logging transaction:', error);
            return null;
        }
    }

    async updateTransactionStatus(transactionId, status) {
        try {
            const updateFields = ['status = ?'];
            const params = [status];

            if (status === 'completed') {
                updateFields.push('completed_at = CURRENT_TIMESTAMP');
            }

            const result = await this.db.run(
                `UPDATE transaction_history SET ${updateFields.join(', ')} WHERE id = ?`,
                [...params, transactionId]
            );

            return result.changes > 0;
        } catch (error) {
            console.error('❌ Error updating transaction status:', error);
            return false;
        }
    }

    async getTransactionHistory(userId, limit = 50) {
        try {
            console.log(`🔍 [UserService] Getting transaction history for user ${userId}, limit ${limit}`);
            
            const transactions = await this.db.all(`
                SELECT 
                    id,
                    type,
                    amount,
                    status,
                    created_at,
                    completed_at,
                    notes
                FROM transaction_history 
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            `, [userId, limit]);
            
            console.log(`🔍 [UserService] Found ${transactions.length} transactions for user ${userId}`);
            
            return transactions.map(transaction => ({
                id: transaction.id,
                type: transaction.type === 'deposit' ? 'Пополнение' : 'Вывод',
                amount: transaction.amount,
                status: this.getTransactionStatusText(transaction.status),
                createdAt: transaction.created_at,
                completedAt: transaction.completed_at,
                notes: transaction.notes
            }));
        } catch (error) {
            console.error('❌ [UserService] Error fetching transaction history:', error);
            return [];
        }
    }

    getTransactionStatusText(status) {
        const statusMap = {
            'pending': 'В обработке',
            'completed': 'Успешно',
            'failed': 'Ошибка',
            'cancelled': 'Отменено'
        };
        return statusMap[status] || status;
    }
    
    async updateSpent(userId, amount) {
        try {
            const result = await this.db.run(
                'UPDATE users SET spent = COALESCE(spent, 0) + ? WHERE id = ?',
                [amount, userId]
            );
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating spent:', error);
            return false;
        }
    }
    async getReferralsWithEarnings(userId) {
        try {
            const referrals = await this.db.all(
                `SELECT 
                    u.id,
                    u.created_at,
                    COALESCE(u.spent, 0) as spent
                FROM users u
                WHERE u.referrer_id = ?
                ORDER BY u.created_at DESC`,
                [userId]
            );
        
            return referrals.map(ref => {
                // Рассчитываем доход: spent * 0.15 * 0.2 = spent * 0.03
                const earned = Math.floor(ref.spent * 0.03);
                
                return {
                    id: ref.id,
                    joined_at: ref.created_at,
                    spent: ref.spent || 0, // Добавляем spent для отладки
                    earned: earned // Доход от реферала
                };
            });
        } catch (error) {
            console.error('Error getting referrals with earnings:', error);
            return [];
        }
    }
}