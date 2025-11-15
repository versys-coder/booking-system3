const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// --- CORS ---
const cors = require('cors');
app.use(cors()); // разрешает все домены, для разработки этого достаточно

// --- API маршруты ---
// ВАЖНО: Все app.use('/api/...') идут до раздачи статики!
app.use('/api/book', require('./routes/book'));
app.use('/api/client', require('./routes/client'));
app.use('/api/confirm_phone', require('./routes/confirm_phone'));
app.use('/api/slots', require('./routes/slots'));
app.use('/api/sms', require('./routes/sms'));
app.use('/api/set_password', require('./routes/set_password'));
app.use('/api/pools-temps', require('./routes/temps')); // <--- Твой эндпоинт температур

app.use('/api/pool-workload', require('./routes/poolWorkload')); // <--- Новый эндпоинт загруженности

// --- Раздача статики (build) ---
app.use(express.static(path.join(__dirname, '../build')));

// Все остальные запросы (кроме API) — на React SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});