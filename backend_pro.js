const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3001;

// IN-MEMORY DATA (V produkcii by sme použili MongoDB)
let reservations = [];
let companies = [];
let beds = {};
let prices = { short: 25, long: 500 };

// INIT BEDS
function initBeds() {
  for (let room = 1; room <= 8; room++) {
    beds[room] = { 1: null, 2: null, 3: null };
  }
}

initBeds();

// API ENDPOINTS

// GET - Všetky rezervácie
app.get('/api/reservations', (req, res) => {
  res.json(reservations);
});

// GET - Prehľad izieb a postieľ
app.get('/api/beds', (req, res) => {
  res.json(beds);
});

// GET - Všetky firmy
app.get('/api/companies', (req, res) => {
  res.json(companies);
});

// GET - Ceny
app.get('/api/prices', (req, res) => {
  res.json(prices);
});

// GET - Štatistika
app.get('/api/stats', (req, res) => {
  let empty = 0, occupied = 0, companyBeds = 0;
  for (let room = 1; room <= 8; room++) {
    for (let bed = 1; bed <= 3; bed++) {
      if (beds[room][bed]) {
        if (beds[room][bed].company) companyBeds++;
        else occupied++;
      } else {
        empty++;
      }
    }
  }
  
  res.json({
    totalBeds: 24,
    emptyBeds: empty,
    occupiedBeds: occupied,
    companyBeds: companyBeds,
    totalReservations: reservations.length,
    totalCompanies: companies.length
  });
});

// POST - Nová rezervácia
app.post('/api/reservations', (req, res) => {
  const { name, email, phone, room, bed, checkIn, checkOut, type, price, company } = req.body;

  if (!name || !room || !bed || !checkIn || !checkOut || !type || !price) {
    return res.status(400).json({ error: 'Chýbajú povinné polia' });
  }

  // CHECK ak je postel voľná
  if (beds[room][bed]) {
    return res.status(409).json({ error: 'Postel je už obsadená' });
  }

  const reservation = {
    id: 'RES' + Date.now(),
    name,
    email,
    phone,
    room: parseInt(room),
    bed: parseInt(bed),
    checkIn,
    checkOut,
    type,
    price: parseFloat(price),
    company: company || null,
    createdAt: new Date().toISOString().split('T')[0],
    totalPrice: type === 'short' 
      ? parseFloat(price) * Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))
      : parseFloat(price)
  };

  reservations.push(reservation);
  beds[room][bed] = reservation;

  res.status(201).json({ success: true, reservation });
});

// POST - Nová firma
app.post('/api/companies', (req, res) => {
  const { name, email, phone, ico, beds: bedCount } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Meno firmy je povinné' });
  }

  const company = {
    id: 'COMP' + Date.now(),
    name,
    email: email || null,
    phone: phone || null,
    ico: ico || null,
    beds: parseInt(bedCount) || 0,
    createdAt: new Date().toISOString().split('T')[0]
  };

  companies.push(company);

  res.status(201).json({ success: true, company });
});

// PUT - Aktualizovať ceny
app.put('/api/prices', (req, res) => {
  const { short, long } = req.body;

  if (short) prices.short = parseFloat(short);
  if (long) prices.long = parseFloat(long);

  res.json({ success: true, prices });
});

// DELETE - Zmazať rezerváciu
app.delete('/api/reservations/:id', (req, res) => {
  const reservation = reservations.find(r => r.id === req.params.id);

  if (!reservation) {
    return res.status(404).json({ error: 'Rezervácia nenájdená' });
  }

  beds[reservation.room][reservation.bed] = null;
  reservations = reservations.filter(r => r.id !== req.params.id);

  res.json({ success: true, message: 'Rezervácia zmazaná' });
});

// DELETE - Zmazať firmu
app.delete('/api/companies/:id', (req, res) => {
  companies = companies.filter(c => c.id !== req.params.id);
  res.json({ success: true, message: 'Firma zmazaná' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Ubytovňa Trnava Backend je LIVE!',
    rooms: 8,
    beds: 24,
    features: ['Reservations', 'Companies', 'Dynamic Pricing', 'Calendar View']
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Chyba servera' });
});

app.listen(PORT, () => {
  console.log(`🏨 Ubytovňa Trnava Backend LIVE na http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`📊 API endpoints:`);
  console.log(`   GET /api/reservations`);
  console.log(`   GET /api/beds`);
  console.log(`   GET /api/companies`);
  console.log(`   GET /api/prices`);
  console.log(`   GET /api/stats`);
  console.log(`   POST /api/reservations`);
  console.log(`   POST /api/companies`);
  console.log(`   PUT /api/prices`);
  console.log(`   DELETE /api/reservations/:id`);
  console.log(`   DELETE /api/companies/:id`);
});

module.exports = app;
