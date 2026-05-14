require('dotenv').config();
console.log('Попытка подключения к:', process.env.MONGO_URI);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');

const Task = require('./models/Task');

const app = express();
const PORT = process.env.PORT || 3000;

//1. Прослойки Middlewares (Для обеспечения совместимости между фреймворками и языками).

app.use(cors());  // Разрешаем запросы с других ресурсов
app.use(express.json()); //Позволяем серверу понимать json в теле запроса
app.use(morgan('dev')); // Логирование запросов
app.use(express.static('public')); // Подключаем фронтенд (Папка public)

//2. Подключение к MongoDB через Mongoose

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('База MiroMVP успешно подключена!'))
    .catch(err => console.error('Ошибка подключения к Базе данных', err));

//3. API маршруты
app.get('/api/status', (req, res) => {
    res.json({ message: "Система MiroMVP активна", version: "1.1.0" });
});

app.post('/api/tasks', async (req, res) => {
    try {
        const newTask = new Task ({
        boardId: req.body.boardId,
        x: Math.floor(Math.random() * 300) + 100,
        y: Math.floor(Math.random() * 300) + 100,
        color: '#e14eca' // Твой magic-purple цвет из CSS;
    });

    await newTask.save();
// Отвечаем фронтенду статусом 201 (Создано) и отправляем саму карточку
        res.status(201).json(newTask);
    }

    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Ошибка при создании карточки" });
    }
    
});

app.get('/api/tasks/:boardId', async (req, res) => {
    try {
        const tasks = await Task.find({ boardId: req.params.boardId });
        res.json(tasks);
    }
    catch (err) {
        res.status(500).json({ error: "Ошибка при загрузке задач" });
    }
});

// Сервер
//1. Создание сервера поверх Express
const server = http.createServer(app);

//2. Инициализация Socket.io
const io = new Server(server, {
    cors: {origin: "*"} //Разрешение подключаться с любых адресов
});

io.on('connection', (socket) => {
    console.log(`Подключился новый клиент: ${socket.id}`);

    // --- ВХОД В КОМНАТУ ---
    socket.on('joinBoard', (boardId) => {
        socket.join(boardId);
        console.log(`Клиент ${socket.id} зашел в комнату доски: ${boardId}`);
    });

    // --- ДВИЖЕНИЕ И РЕСАЙЗ ---
    socket.on('updateElement', (data) => {
        socket.to(data.boardId).emit('updateElement', data);
    });

    socket.on('saveElement', async (data) => {
        try {
            await Task.findByIdAndUpdate(data.id, {
                x: data.x,
                y: data.y,
                width: data.width,   // Сохраняем ширину
                height: data.height  // Сохраняем высоту
            });
            console.log(`Позиция и размер элемента ${data.id} сохранены в БД`);
        } catch (err) {
            console.error('Ошибка сохранения в БД:', err);
        }
    }); // <-- Обрати внимание, скобка закрывается ЗДЕСЬ!

    // --- ТЕКСТ ---
    socket.on('updateText', (data) => {
        socket.to(data.boardId).emit('updateText', data);
    });

    socket.on('saveText', async (data) => {
        try {
            await Task.findByIdAndUpdate(data.id, { text: data.text });
            console.log(`Текст для элемента ${data.id} сохранен в БД: ${data.text}`);
        } catch (err) {
            console.error('Ошибка сохранения текста в БД:', err);
        }
    });

    // --- УДАЛЕНИЕ ---
    socket.on('deleteElement', async (data) => {
        try {
            await Task.findByIdAndDelete(data.id);
            // Говорим всем остальным в комнате тоже удалить эту карточку
            socket.to(data.boardId).emit('deleteElement', data.id);
            console.log(`Элемент ${data.id} удален из БД`);
        } catch (err) {
            console.error('Ошибка удаления из БД:', err);
        }
    });

    // --- СОЗДАНИЕ ---
    socket.on('newElement', (data) => {
        socket.to(data.boardId).emit('newElement', data.card);
    });

    // --- ОТКЛЮЧЕНИЕ ---
    socket.on('disconnect', () => {
        console.log(`Клиент вышел с сервера: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});