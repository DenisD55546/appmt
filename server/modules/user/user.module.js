// import { UserService } from './user.service.js';

// export class UserModule {
//     constructor(io, redisClient, db) {
//         this.io = io;
//         this.service = new UserService(db);
//         console.log('⭐ User service ready');
//     }

//     setupSocketHandlers() {
//         this.io.on('connection', (socket) => {
//             console.log(`🔌 Client connected for users: ${socket.id}`);

//             // Регистрация/получение пользователя
//             socket.on('register_user', async (data) => {
//                 try {
//                     const { userId, referrerId } = data;
                    
//                     // Сначала проверяем существует ли пользователь
//                     const existingUser = await this.service.getUser(userId);
                    
//                     // Если пользователя нет - создаем
//                     let isNewUser = false;
//                     if (!existingUser) {
//                         isNewUser = await this.service.createUser(userId, referrerId);
//                     }
                    
//                     // Получаем обновленные данные пользователя
//                     const userData = await this.service.getUserStats(userId);
                    
//                     socket.emit('user_registered', { 
//                         success: true, 
//                         user: userData,
//                         isNewUser: isNewUser
//                     });
                    
//                     console.log(`📝 User ${userId} ${isNewUser ? 'registered' : 'already exists'}`);
//                 } catch (error) {
//                     socket.emit('user_registered', { 
//                         success: false, 
//                         error: error.message 
//                     });
//                 }
//             });

//             // Получение данных пользователя
//             socket.on('get_user_data', async (userId) => {
//                 try {
//                     const userData = await this.service.getUserStats(userId);
//                     socket.emit('user_data', { 
//                         success: true, 
//                         user: userData 
//                     });
//                 } catch (error) {
//                     socket.emit('user_data', { 
//                         success: false, 
//                         error: error.message 
//                     });
//                 }
//             });
//         });
//     }
// }