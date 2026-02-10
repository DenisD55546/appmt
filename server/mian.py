import asyncio
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command

BOT_TOKEN = "8469988036:AAFP2DLsA0XlpTkgLoSa_sG9TTAAXBS79wA"
MINI_APP_URL = "https://t.me/m_nft_bot/market"

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def start_command(message: types.Message):
    # Создаем красивую клавиатуру с несколькими кнопками
    keyboard = types.InlineKeyboardMarkup(
        inline_keyboard=[
            [
                types.InlineKeyboardButton(
                    text="🚀 Открыть мини-приложение",
                    url=MINI_APP_URL
                )
            ]
        ]
    )
    
    welcome_text = (
        "🎨 *Добро пожаловать в мир NFT!*\n\n"
        "Здесь вы можете:\n"
        "• Создавать уникальные цифровые активы\n"
        "• Коллекционировать редкие NFT\n"
        "• Торговать на маркетплейсе\n\n"
        "Нажмите кнопку ниже, чтобы начать:"
    )
    
    await message.answer(
        welcome_text,
        parse_mode="Markdown",
        reply_markup=keyboard
    )

# Обработчик нажатий на инлайн-кнопки
@dp.callback_query()
async def handle_callbacks(callback: types.CallbackQuery):
    if callback.data == "help":
        await callback.message.answer(
            "❓ *Помощь*\n\n"
            "Нажмите кнопку 'Открыть мини-приложение', "
            "чтобы начать работу с NFT.\n\n"
            "Если есть вопросы, обратитесь в поддержку.",
            parse_mode="Markdown"
        )
    elif callback.data == "favorites":
        keyboard = types.InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    types.InlineKeyboardButton(
                        text="Перейти в приложение",
                        url=MINI_APP_URL
                    )
                ]
            ]
        )
        await callback.message.answer(
            "⭐️ *Избранное*\n\n"
            "Ваши избранные NFT доступны в мини-приложении.",
            parse_mode="Markdown",
            reply_markup=keyboard
        )
    
    await callback.answer()

async def main():
    print("✅ Бот успешно запущен!")
    print(f"🔗 Ссылка на мини-приложение: {MINI_APP_URL}")
    print("🤖 Бот готов принимать сообщения...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())