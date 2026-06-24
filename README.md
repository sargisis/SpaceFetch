# SpaceFetch

SpaceFetch — это сервис для очистки, нормализации и предоставления данных NASA API (APOD, NeoWs, EPIC) через единый быстрый API, дополненный AI-описаниями от Groq (Llama 3.3).

В проекте есть две части:
1. **Go Backend** (фоновый сборщик данных + HTTP API сервер с кэшированием в Redis).
2. **React Frontend** (красивая 3D-анимированная посадочная страница на Three.js/Tailwind).

---

## 1. Запуск Backend (Go)

### Шаг 1: Настройка окружения
В корневой директории проекта создайте или отредактируйте файл `.env`. Убедитесь, что там указаны ваши настоящие ключи NASA и Groq:
```env
NASA_API_KEY=YOUR_NASA_API_KEY
GROQ_API_KEY=YOUR_GROQ_API_KEY
MONGO_URI=mongodb://localhost:27017
MONGO_DB=spacefetch
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
API_PORT=8080
WORKER_INTERVAL=6h
CACHE_TTL=3600
```

### Шаг 2: Запуск зависимостей
Убедитесь, что на вашей машине запущены **MongoDB** (порт 27017) и **Redis** (порт 6379).

### Шаг 3: Сборка и запуск сервисов
Соберите бинарные файлы с помощью `make`:
```bash
make build
```

Запустите фоновый воркер (синхронизация с NASA + генерация AI-описаний через Groq):
```bash
export $(grep -v '^#' .env | xargs) && ./bin/worker
```

Запустите API-сервер (раздача данных на порту 8080):
```bash
export $(grep -v '^#' .env | xargs) && ./bin/api
```

Тестирование запроса к API:
```bash
curl -i -H "X-API-Key: test" http://localhost:8080/v1/asteroids/today
```

---

## 2. Запуск Frontend (React + Vite)

Фронтенд расположен в папке `frontend`. Он представляет собой интерактивную страницу с low-poly 3D-моделью Земли, звездным фоном, сравнением данных и интерактивным Live Demo.

### Шаг 1: Переход в директорию фронтенда
```bash
cd frontend
```

### Шаг 2: Установка зависимостей
```bash
npm install
```

### Шаг 3: Запуск сервера разработки
```bash
npm run dev
```
После запуска страница будет доступна по адресу: **`http://localhost:5173`**

### Шаг 4: Сборка для продакшена (Optional)
```bash
npm run build
```
Скомпилированные статические файлы будут сохранены в директории `frontend/dist/`.