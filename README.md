# 🎨 UnitBoard — Miro Clone MVP

Прототип бесконечной интерактивной доски для совместной работы, созданный в рамках хакатона. Проект позволяет создавать задачи, перемещать их и менять стили в реальном времени.

---

## 🚀 Основные фичи
* **Бесконечный холст:** Свободное перемещение по холсту и зум.
* **Real-time синхронизация:** Совместная работа через Socket.io.
* **Управление задачами:** Создание, ресайз и удаление (Delete/Backspace).
* **Кастомизация:** Смена темы и названия в настройках.
* **Persistence:** Сохранение в MongoDB.

---

## 🛠 Стек технологий
* **Frontend:** HTML5 Canvas, CSS3, JS.
* **Backend:** Node.js, Express, Socket.io.
* **Database:** MongoDB.

---

## 📦 Как запустить проект локально

### 1. Клонирование репозитория

git clone [https://github.com/devharukoo/miro-MVPHackaton.git](https://github.com/devharukoo/miro-MVPHackaton.git)
cd miro-MVPHackaton

2. Установка зависимостей

npm install

3. Настройка окружения
Создайте файл .env в корне:

MONGODB_URI=your_mongodb_connection_string
PORT=3000

4. Запуск сервера

node app.js

После этого откройте: http://localhost:3000

⚠️ Важно
Для удаления карточек используйте клавишу Delete или Backspace при выбранном объекте.

👥 Команда проекта
Harukoo — Lead Developer (Canvas, Sockets, Backend).

Sanya, Vlad, Oleg — Team Collaborators.