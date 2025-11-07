const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../front')));

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '5544',
    database: 'golden_ring_travel'
};

// Middleware для аутентификации пользователя
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Токен отсутствует' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Неверный токен' });
    }
};

// Middleware для аутентификации администратора
const authenticateAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Токен отсутствует' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (!decoded.isAdmin) {
            return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Неверный токен' });
    }
};

// Восстановление пароля - проверка пользователя
app.post('/api/check-user', async (req, res) => {
    let connection;
    try {
        const { contact } = req.body;
        
        console.log('=== ПРОВЕРКА ПОЛЬЗОВАТЕЛЯ ===');
        console.log('Контакт:', contact);
        
        if (!contact) {
            return res.status(400).json({ error: 'Введите email или телефон' });
        }

        connection = await mysql.createConnection(dbConfig);
        
        const [users] = await connection.execute(
            'SELECT id, email FROM users WHERE email = ? OR phone = ?',
            [contact, contact]
        );

        console.log('Найдено пользователей:', users.length);

        if (users.length === 0) {
            await connection.end();
            console.log('❌ Пользователь не найден');
            return res.status(400).json({ error: 'Пользователь не найден' });
        }

        const user = users[0];
        await connection.end();
        
        console.log('✅ Пользователь найден:', user.email);
        
        res.json({ 
            success: true, 
            message: 'Пользователь найден',
            email: user.email
        });
        
    } catch (error) {
        if (connection) await connection.end();
        console.error('❌ Ошибка проверки пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
});

// Восстановление пароля - установка нового пароля
app.post('/api/reset-password', async (req, res) => {
    let connection;
    try {
        const { contact, newPassword } = req.body;
        
        console.log('=== СБРОС ПАРОЛЯ ===');
        console.log('Контакт:', contact);
        
        if (!contact || !newPassword) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }

        connection = await mysql.createConnection(dbConfig);
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        const [result] = await connection.execute(
            'UPDATE users SET password = ? WHERE email = ? OR phone = ?',
            [hashedPassword, contact, contact]
        );

        await connection.end();
        
        if (result.affectedRows === 0) {
            console.log('❌ Пользователь не найден для сброса пароля');
            return res.status(400).json({ error: 'Пользователь не найден' });
        }
        
        console.log('✅ Пароль успешно обновлен для контакта:', contact);
        
        res.json({ 
            success: true, 
            message: 'Пароль успешно изменен'
        });
        
    } catch (error) {
        if (connection) await connection.end();
        console.error('❌ Ошибка сброса пароля:', error);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
});

// Регистрация пользователя
app.post('/api/register', async (req, res) => {
    let connection;
    try {
        const { full_name, email, phone, passport, password } = req.body;
        
        if (!full_name || !email || !phone || !passport || !password) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }

        connection = await mysql.createConnection(dbConfig);
        
        const [existing] = await connection.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            await connection.end();
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await connection.execute(
            'INSERT INTO users (full_name, email, phone, passport, password) VALUES (?, ?, ?, ?, ?)',
            [full_name, email, phone, passport, hashedPassword]
        );

        const token = jwt.sign(
            { id: result.insertId, email: email, full_name: full_name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        await connection.end();
        
        res.json({ 
            success: true, 
            message: 'Регистрация успешна',
            token,
            user: {
                id: result.insertId,
                email: email,
                full_name: full_name,
                phone: phone,
                passport: passport
            }
        });
        
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход пользователя
app.post('/api/login', async (req, res) => {
    let connection;
    try {
        const { email, password } = req.body;
        
        connection = await mysql.createConnection(dbConfig);
        
        const [users] = await connection.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            await connection.end();
            return res.status(400).json({ error: 'Пользователь не найден' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            await connection.end();
            return res.status(400).json({ error: 'Неверный пароль' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, full_name: user.full_name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        await connection.end();
        res.json({ 
            success: true, 
            token, 
            user: { 
                id: user.id, 
                email: user.email, 
                full_name: user.full_name,
                phone: user.phone,
                passport: user.passport
            } 
        });
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход администратора
app.post('/api/admin/login', async (req, res) => {
    let connection;
    try {
        const { username, password } = req.body;
        
        console.log('=== АДМИН ЛОГИН ===');
        console.log('Введенный логин:', username);
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }
        
        connection = await mysql.createConnection(dbConfig);
        
        const [admins] = await connection.execute(
            'SELECT * FROM admins WHERE username = ?',
            [username]
        );

        console.log('Найдено администраторов:', admins.length);

        if (admins.length === 0) {
            await connection.end();
            console.log('❌ Администратор не найден');
            return res.status(400).json({ error: 'Администратор не найден' });
        }

        const admin = admins[0];
        
        const validPassword = (password === admin.password);
        console.log('✅ Результат сравнения пароля:', validPassword);

        if (!validPassword) {
            await connection.end();
            console.log('❌ Неверный пароль');
            return res.status(400).json({ error: 'Неверный пароль' });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username, isAdmin: true },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        await connection.end();
        
        console.log('✅ Админ вошел успешно!');
        
        res.json({ 
            success: true, 
            token,
            user: {
                id: admin.id,
                username: admin.username,
                isAdmin: true
            }
        });
        
    } catch (error) {
        if (connection) await connection.end();
        console.error('❌ Ошибка входа администратора:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение профиля пользователя
app.get('/api/user/profile', authenticateUser, async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const [users] = await connection.execute(
            'SELECT id, email, full_name, phone, passport FROM users WHERE id = ?',
            [req.user.id]
        );

        await connection.end();
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json(users[0]);
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка получения профиля:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление профиля пользователя
app.put('/api/user/profile', authenticateUser, async (req, res) => {
    let connection;
    try {
        const { full_name, email, phone, passport } = req.body;
        
        connection = await mysql.createConnection(dbConfig);
        
        await connection.execute(
            'UPDATE users SET full_name = ?, email = ?, phone = ?, passport = ? WHERE id = ?',
            [full_name, email, phone, passport, req.user.id]
        );

        await connection.end();
        
        res.json({ 
            success: true, 
            message: 'Профиль обновлен'
        });
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка обновления профиля:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Смена пароля пользователя
app.put('/api/user/password', authenticateUser, async (req, res) => {
    let connection;
    try {
        const { currentPassword, newPassword } = req.body;
        
        connection = await mysql.createConnection(dbConfig);
        
        const [users] = await connection.execute(
            'SELECT password FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(currentPassword, user.password);

        if (!validPassword) {
            await connection.end();
            return res.status(400).json({ error: 'Неверный текущий пароль' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await connection.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, req.user.id]
        );

        await connection.end();
        
        res.json({ 
            success: true, 
            message: 'Пароль изменен'
        });
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка смены пароля:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение городов
app.get('/api/cities', async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const [cities] = await connection.execute(`
            SELECT 
                id,
                name,
                description
            FROM cities 
            ORDER BY name
        `);

        await connection.end();
        
        console.log('✅ Загружено городов:', cities.length);
        res.json(cities);
    } catch (error) {
        if (connection) await connection.end();
        console.error('❌ Ошибка загрузки городов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Get all tours
app.get('/api/tours', async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const [tours] = await connection.execute(`
            SELECT 
                t.*,
                c.name as city_name,
                COALESCE((SELECT AVG(rating) FROM reviews WHERE tour_id = t.id), 0) as rating,
                COALESCE((SELECT COUNT(*) FROM reviews WHERE tour_id = t.id), 0) as review_count
            FROM tours t 
            JOIN cities c ON t.city_id = c.id 
            ORDER BY t.created_at DESC
        `);

        await connection.end();
        res.json(tours);
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка загрузки туров:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Get tours by city ID
app.get('/api/tours/:cityId', async (req, res) => {
    let connection;
    try {
        const { cityId } = req.params;
        connection = await mysql.createConnection(dbConfig);
        
        const [tours] = await connection.execute(`
            SELECT 
                t.*,
                c.name as city_name,
                COALESCE((SELECT AVG(rating) FROM reviews WHERE tour_id = t.id), 0) as rating,
                COALESCE((SELECT COUNT(*) FROM reviews WHERE tour_id = t.id), 0) as review_count
            FROM tours t 
            JOIN cities c ON t.city_id = c.id 
            WHERE t.city_id = ?
            ORDER BY t.created_at DESC
        `, [cityId]);

        await connection.end();
        res.json(tours);
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка загрузки туров по городу:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Get single tour
app.get('/api/tour/:id', async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await mysql.createConnection(dbConfig);
        
        const [tours] = await connection.execute(`
            SELECT 
                t.*,
                c.name as city_name,
                COALESCE((SELECT AVG(rating) FROM reviews WHERE tour_id = t.id), 0) as rating,
                COALESCE((SELECT COUNT(*) FROM reviews WHERE tour_id = t.id), 0) as review_count
            FROM tours t 
            JOIN cities c ON t.city_id = c.id 
            WHERE t.id = ?
        `, [id]);

        await connection.end();
        
        if (tours.length === 0) {
            return res.status(404).json({ error: 'Тур не найден' });
        }

        res.json(tours[0]);
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка загрузки тура:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Get all tours for admin
app.get('/api/admin/tours', authenticateAdmin, async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const [tours] = await connection.execute(`
            SELECT t.*, c.name as city_name 
            FROM tours t 
            JOIN cities c ON t.city_id = c.id 
            ORDER BY t.created_at DESC
        `);

        await connection.end();
        res.json(tours);
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка загрузки туров:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Admin add tour
app.post('/api/admin/tours', authenticateAdmin, async (req, res) => {
    let connection;
    try {
        const { city_id, title, description, full_description, price, duration_days, available_seats, image_url } = req.body;
        
        connection = await mysql.createConnection(dbConfig);
        
        const [result] = await connection.execute(
            `INSERT INTO tours (city_id, title, description, full_description, price, duration_days, available_seats, image_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [city_id, title, description, full_description, price, duration_days, available_seats || 20, image_url]
        );

        await connection.end();
        res.json({ success: true, message: 'Тур добавлен', id: result.insertId });
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка добавления тура:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Update tour
app.put('/api/admin/tours/:id', authenticateAdmin, async (req, res) => {
    let connection;
    try {
        const { city_id, title, description, full_description, price, duration_days, available_seats, image_url } = req.body;
        
        connection = await mysql.createConnection(dbConfig);
        
        await connection.execute(
            `UPDATE tours SET 
                city_id = ?, 
                title = ?, 
                description = ?, 
                full_description = ?, 
                price = ?, 
                duration_days = ?, 
                available_seats = ?,
                image_url = ?,
                updated_at = NOW()
             WHERE id = ?`,
            [city_id, title, description, full_description, price, duration_days, available_seats, image_url, req.params.id]
        );

        await connection.end();
        res.json({ success: true, message: 'Тур обновлен' });
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка обновления тура:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Delete tour
app.delete('/api/admin/tours/:id', authenticateAdmin, async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        
        await connection.execute(
            'DELETE FROM tours WHERE id = ?',
            [req.params.id]
        );

        await connection.end();
        res.json({ success: true, message: 'Тур удален' });
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка удаления тура:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Create booking
app.post('/api/booking', authenticateUser, async (req, res) => {
    let connection;
    try {
        console.log('=== НАЧАЛО БРОНИРОВАНИЯ ===');
        console.log('Данные запроса:', req.body);
        console.log('ID пользователя:', req.user.id);
        
        const { tour_id, ticket_count, total_price, customer_email } = req.body;
        const user_id = req.user.id;
        
        connection = await mysql.createConnection(dbConfig);
        
        // Получаем полную информацию о туре
        const [tours] = await connection.execute(`
            SELECT t.*, c.name as city_name 
            FROM tours t 
            JOIN cities c ON t.city_id = c.id 
            WHERE t.id = ?
        `, [tour_id]);
        
        if (tours.length === 0) {
            await connection.end();
            console.log('❌ Тур не найден');
            return res.status(404).json({ error: 'Тур не найден' });
        }
        
        const tour = tours[0];
        
        // Проверяем доступность мест
        console.log('Доступно мест:', tour.available_seats);
        console.log('Запрошено билетов:', ticket_count);
        
        if (tour.available_seats < ticket_count) {
            await connection.end();
            console.log('❌ Недостаточно мест');
            return res.status(400).json({ error: 'Недостаточно мест' });
        }
        
        // Создаем заказ
        console.log('Создаем бронирование...');
        const [bookingResult] = await connection.execute(
            'INSERT INTO bookings (user_id, tour_id, ticket_count, total_price, customer_email) VALUES (?, ?, ?, ?, ?)',
            [user_id, tour_id, ticket_count, total_price, customer_email]
        );
        
        const bookingId = bookingResult.insertId;
        
        // Обновляем количество доступных мест
        console.log('Обновляем доступные места...');
        await connection.execute(
            'UPDATE tours SET available_seats = available_seats - ? WHERE id = ?',
            [ticket_count, tour_id]
        );
        
        await connection.end();
        
        // Формируем детали заказа для alert и "отправки на почту"
        const bookingDetails = `
🎫 БРОНИРОВАНИЕ УСПЕШНО ОФОРМЛЕНО!

📋 ДЕТАЛИ ЗАКАЗА:
─────────────────
🔸 Номер заказа: #${bookingId}
🔸 Тур: "${tour.title}"
🔸 Город: ${tour.city_name}
🔸 Продолжительность: ${tour.duration_days} дней
🔸 Дата создания: ${new Date().toLocaleString('ru-RU')}

👤 ИНФОРМАЦИЯ О БРОНИРОВАНИИ:
─────────────────────────
🔸 Количество билетов: ${ticket_count}
🔸 Цена за билет: ${tour.price} ₽
🔸 Общая стоимость: ${total_price} ₽
🔸 Email для билетов: ${customer_email}

📄 ОПИСАНИЕ ТУРА:
────────────────
${tour.full_description || tour.description}

📍 МЕСТО СБОРА:
──────────────
Точное место сбора будет отправлено за 24 часа до начала тура.

💡 ВАЖНАЯ ИНФОРМАЦИЯ:
───────────────────
• Сохраните этот номер заказа: #${bookingId}
• Билеты будут отправлены на указанный email
• При себе иметь документ, удостоверяющий личность
• Отмена возможна за 48 часов до начала тура

📞 ТЕХНИЧЕСКАЯ ПОДДЕРЖКА:
──────────────────────
По всем вопросам обращайтесь: 
support@golden-ring-travel.ru
+7 (800) 555-35-35

Спасибо за выбор нашей компании! 🎉
        `;
        
        console.log('✅ Бронирование успешно!');
        res.json({ 
            success: true, 
            message: 'Заказ оформлен',
            bookingId: bookingId,
            bookingDetails: bookingDetails,
            alertMessage: `✅ Заказ оформлен успешно!\n\n🎫 Тур: "${tour.title}"\n📧 Билеты отправлены на: ${customer_email}\n🎟️ Количество билетов: ${ticket_count}\n💰 Общая стоимость: ${total_price} ₽\n\nСпасибо за заказ!` 
        });
        
    } catch (error) {
        if (connection) await connection.end();
        console.error('❌ ОШИБКА БРОНИРОВАНИЯ:', error);
        console.error('Детали ошибки:', error.message);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
});

// СИСТЕМА ОТЗЫВОВ

// Получить отзывы для тура
app.get('/api/tours/:tourId/reviews', async (req, res) => {
    let connection;
    try {
        const { tourId } = req.params;
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        let userReview = null;
        let userId = null;

        connection = await mysql.createConnection(dbConfig);

        // Получаем ID пользователя из токена
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.id;
                
                // Найти отзыв текущего пользователя
                const [userRows] = await connection.execute(
                    'SELECT * FROM reviews WHERE tour_id = ? AND user_id = ?',
                    [tourId, userId]
                );
                userReview = userRows[0];
            } catch (error) {
                // Невалидный токен - игнорируем
            }
        }
        
        // Отзывы других пользователей
        const [reviewRows] = await connection.execute(
            `SELECT r.*, u.full_name as user_name 
             FROM reviews r 
             LEFT JOIN users u ON r.user_id = u.id 
             WHERE r.tour_id = ? 
             ORDER BY r.created_at DESC`,
            [tourId]
        );
        
        await connection.end();
        
        res.json({
            reviews: reviewRows.filter(r => !userReview || r.id !== userReview.id),
            userReview: userReview
        });
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка загрузки отзывов:', error);
        res.status(500).json({ error: 'Ошибка загрузки отзывов' });
    }
});

// Создать отзыв
app.post('/api/tours/:tourId/reviews', authenticateUser, async (req, res) => {
    let connection;
    try {
        const { tourId } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.id;
        
        connection = await mysql.createConnection(dbConfig);
        
        // Проверяем есть ли уже отзыв
        const [existing] = await connection.execute(
            'SELECT * FROM reviews WHERE tour_id = ? AND user_id = ?',
            [tourId, userId]
        );
        
        if (existing.length > 0) {
            await connection.end();
            return res.status(400).json({ error: 'Вы уже оставили отзыв для этого тура' });
        }
        
        // Проверяем валидность рейтинга
        if (rating < 1 || rating > 5) {
            await connection.end();
            return res.status(400).json({ error: 'Рейтинг должен быть от 1 до 5' });
        }
        
        // Создаем новый отзыв
        await connection.execute(
            'INSERT INTO reviews (tour_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, NOW())',
            [tourId, userId, rating, comment]
        );
        
        await connection.end();
        res.json({ success: true, message: 'Отзыв добавлен' });
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка создания отзыва:', error);
        res.status(500).json({ error: 'Ошибка сохранения отзыва' });
    }
});

// Обновить отзыв
app.put('/api/tours/:tourId/reviews/:reviewId', authenticateUser, async (req, res) => {
    let connection;
    try {
        const { rating, comment } = req.body;
        const userId = req.user.id;
        const { reviewId } = req.params;
        
        connection = await mysql.createConnection(dbConfig);
        
        // Проверяем что отзыв принадлежит пользователю
        const [userRows] = await connection.execute(
            'SELECT * FROM reviews WHERE id = ? AND user_id = ?',
            [reviewId, userId]
        );
        
        if (userRows.length === 0) {
            await connection.end();
            return res.status(403).json({ error: 'Недостаточно прав для редактирования этого отзыва' });
        }
        
        // Проверяем валидность рейтинга
        if (rating < 1 || rating > 5) {
            await connection.end();
            return res.status(400).json({ error: 'Рейтинг должен быть от 1 до 5' });
        }
        
        await connection.execute(
            'UPDATE reviews SET rating = ?, comment = ?, updated_at = NOW() WHERE id = ?',
            [rating, comment, reviewId]
        );
        
        await connection.end();
        res.json({ success: true, message: 'Отзыв обновлен' });
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка обновления отзыва:', error);
        res.status(500).json({ error: 'Ошибка обновления отзыва' });
    }
});

// Удалить отзыв
app.delete('/api/tours/:tourId/reviews/:reviewId', authenticateUser, async (req, res) => {
    let connection;
    try {
        const userId = req.user.id;
        const { reviewId } = req.params;
        
        connection = await mysql.createConnection(dbConfig);
        
        // Проверяем что отзыв принадлежит пользователю
        const [userRows] = await connection.execute(
            'SELECT * FROM reviews WHERE id = ? AND user_id = ?',
            [reviewId, userId]
        );
        
        if (userRows.length === 0) {
            await connection.end();
            return res.status(403).json({ error: 'Недостаточно прав для удаления этого отзыва' });
        }
        
        await connection.execute(
            'DELETE FROM reviews WHERE id = ?',
            [reviewId]
        );
        
        await connection.end();
        res.json({ success: true, message: 'Отзыв удален' });
    } catch (error) {
        if (connection) await connection.end();
        console.error('Ошибка удаления отзыва:', error);
        res.status(500).json({ error: 'Ошибка удаления отзыва' });
    }
});

// Статические файлы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../front/index.html'));
});

app.get('/tour.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../front/tour.html'));
});

app.get('/main.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../front/main.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});