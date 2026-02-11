import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const dotenv = require('dotenv');
dotenv.config();

// Принудительно загружаем модули через require
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const redis = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const cors = require('cors');

// Импорт модулей
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { SocketModule } from './modules/socket/socket.module.js';
import { NFTService } from './modules/nft/nft.service.js';
import { WebhookSetup } from './modules/telegram/webhook.setup.js';
import bodyParser from 'body-parser';

const app = express();
const server = createServer(app);
const port = process.env.PORT;

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Redis клиенты
const pubClient = redis.createClient({ 
  url: process.env.REDIS_URL
});
const subClient = pubClient.duplicate();

// Socket.IO настройка
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const db = await open({
    filename: '../db/mark.db',
    driver: sqlite3.Database
});

let socketModuleInstance = null;

async function initializeModules() {
  try {
    // Подключаем Redis
    await pubClient.connect();
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));

    // Инициализируем единый модуль сокетов
    const socketModule = new SocketModule(io, pubClient, db);
    socketModuleInstance = socketModule;
    
    await setupTelegramWebhook();
    console.log('✅ All modules initialized successfully');
  } catch (error) {
    console.error('❌ Module initialization failed:', error);
    process.exit(1);
  }
}

async function setupTelegramWebhook() {
    try {
        const webhookUrl = `${process.env.APP_URL}/webhook/telegram`;
        
        const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: webhookUrl,
                drop_pending_updates: true,
                allowed_updates: ['pre_checkout_query', 'message']
            })
        });
        
        const data = await response.json();
        console.log(data.ok ? '✅ Webhook установлен' : '❌ Webhook error:', data);
    } catch (error) {
        console.error('Webhook setup error:', error);
    }
}

// Статические файлы для фронтенда
app.use(express.static('../client'));

// API Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    modules: ['currency'],
    connections: io.engine.clientsCount
  });
});

app.get('/api/collections', async (req, res) => {
    try {
        const collections = await db.all(`
            SELECT id, name, image_file_id, total_supply, sold_count
            FROM m_nft_collections
            ORDER BY created_at DESC
        `);
        
        res.json({ success: true, collections });
    } catch (error) {
        console.error('Error fetching collections:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/webhook/telegram', async (req, res) => {
    try {
        console.log('📱 Telegram webhook received');
        
        // ВАЖНО: Немедленно отвечаем Telegram
        res.status(200).json({ ok: true });
        
        // Обрабатываем вебхук асинхронно
        if (socketModuleInstance && socketModuleInstance.handleTelegramWebhook) {
            socketModuleInstance.handleTelegramWebhook(req.body);
        } else {
            console.error('❌ SocketModule not initialized or missing handleTelegramWebhook method');
        }
        
    } catch (error) {
        console.error('Webhook error:', error);
    }
});

// Эндпоинт для ручной установки вебхука
app.post('/setup-webhook', async (req, res) => {
    try {
        const webhookSetup = new WebhookSetup(
            process.env.TELEGRAM_BOT_TOKEN,
            `${process.env.APP_URL}/webhook/telegram`
        );
        
        const result = await webhookSetup.setupWebhook();
        
        res.json({ 
            success: result, 
            message: result ? 'Webhook установлен' : 'Ошибка установки webhook' 
        });
        
    } catch (error) {
        console.error('Setup webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Запуск сервера
server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  initializeModules();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pubClient.quit();
  await subClient.quit();
  server.close(() => {
    process.exit(0);
  });
});