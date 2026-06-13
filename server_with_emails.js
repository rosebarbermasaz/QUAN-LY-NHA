const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const dotenv = require('dotenv');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3001;
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@ubytovna.sk';

// Email konfigurácia - MAILTRAP verzia (bez Gmail problémov!)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
  port: process.env.EMAIL_PORT || 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// In-memory databáza
let reservations = [
  {
    id: 'RES001',
    name: 'Nguyễn Văn A',
    email: 'nguyen@email.com',
    phone: '+421',
    room: 'P001',
    checkIn: '2026-06-01',
    checkOut: '2026-06-30',
    guests: 1,
    price: 300,
    totalPrice: 8700,
    deposit: 500,
    status: 'Potvrdená',
    paymentStatus: 'Zaplatené',
    notes: 'Dlhodobý nájom',
    createdAt: '2026-05-15'
  }
];

// EMAIL ŠABLÓNY
const emailTemplates = {
  newReservation: (name, room, checkIn, checkOut, totalPrice) => ({
    subject: `🏨 Nová rezervácia - Ubytovňa Trnava`,
    html: `
      <h2>Nová rezervácia!</h2>
      <p><strong>Hosť:</strong> ${name}</p>
      <p><strong>Izba:</strong> ${room}</p>
      <p><strong>Príchod:</strong> ${checkIn}</p>
      <p><strong>Odchod:</strong> ${checkOut}</p>
      <p><strong>Cena:</strong> ${totalPrice}€</p>
      <p style="color: #ff9800;"><strong>⚠️ Čakajúca na potvrdenie!</strong></p>
      <p>Potvrď rezerváciu v admin paneli.</p>
    `
  }),

  confirmationSent: (name, room, checkIn, checkOut) => ({
    subject: `✓ Vaša rezervácia bola potvrdená - Ubytovňa Trnava`,
    html: `
      <h2>Váša rezervácia je potvrdená!</h2>
      <p>Ahoj ${name},</p>
      <p><strong>Izba:</strong> ${room}</p>
      <p><strong>Príchod:</strong> ${checkIn}</p>
      <p><strong>Odchod:</strong> ${checkOut}</p>
      <p>Čakáme na vás!</p>
      <p>S pozdravom,<br/>Ubytovňa Trnava</p>
    `
  }),

  paymentReceived: (name, amount, remaining) => ({
    subject: `💳 Platba prijatá - Ubytovňa Trnava`,
    html: `
      <h2>Platba prijatá!</h2>
      <p><strong>Hosť:</strong> ${name}</p>
      <p><strong>Zaplatená čiastka:</strong> ${amount}€</p>
      <p><strong>Zostávajúce do úhrady:</strong> ${remaining}€</p>
      <p style="color: green;"><strong>✓ Aktualizované!</strong></p>
    `
  })
};

// FUNKCIA NA POSIELANIE EMAILU
async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"Ubytovňa Trnava" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log(`✓ Email poslal: ${to}`);
    return { success: true };
  } catch (error) {
    console.error(`✗ Email chyba:`, error.message);
    return { success: false, error: error.message };
  }
}

// API ENDPOINTS

// GET - Všetky rezervácie
app.get('/api/reservations', (req, res) => {
  res.json(reservations);
});

// POST - Nová rezervácia
app.post('/api/reservations', async (req, res) => {
  const { name, email, phone, room, checkIn, checkOut, guests, price, totalPrice } = req.body;

  if (!name || !email || !room || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'Chýbajú povinné polia' });
  }

  const newReservation = {
    id: 'RES' + Date.now(),
    name,
    email,
    phone,
    room,
    checkIn,
    checkOut,
    guests: parseInt(guests) || 1,
    price: parseFloat(price) || 0,
    totalPrice: parseFloat(totalPrice) || 0,
    deposit: 0,
    status: 'Nová',
    paymentStatus: 'Nezaplatené',
    notes: '',
    createdAt: new Date().toISOString().split('T')[0]
  };

  reservations.push(newReservation);

  // POŠLI EMAIL MAJITEĽOVI
  const roomNum = room.replace('P', '');
  const mailTemplate = emailTemplates.newReservation(name, `${room} (Izba ${roomNum})`, checkIn, checkOut, totalPrice);
  await sendEmail(OWNER_EMAIL, mailTemplate.subject, mailTemplate.html);

  // POŠLI POTVRDENIE HOSTOVI
  const confirmTemplate = {
    subject: `📅 Vaša rezervácia bola vytvorená - Ubytovňa Trnava`,
    html: `
      <h2>Ďakujeme za vašu rezerváciu!</h2>
      <p>Ahoj ${name},</p>
      <p>Vaša rezervácia bola vytvorená. Čoskoro vás budeme kontaktovať s potvrdením.</p>
      <p><strong>Detaily:</strong><br/>
      Izba: ${room}<br/>
      Príchod: ${checkIn}<br/>
      Odchod: ${checkOut}<br/>
      Cena: ${totalPrice}€</p>
      <p>S pozdravom,<br/>Ubytovňa Trnava</p>
    `
  };
  await sendEmail(email, confirmTemplate.subject, confirmTemplate.html);

  res.status(201).json({ success: true, reservation: newReservation });
});

// PUT - Potvrdiť rezerváciu
app.put('/api/reservations/:id/confirm', async (req, res) => {
  const res_item = reservations.find(r => r.id === req.params.id);
  
  if (!res_item) return res.status(404).json({ error: 'Rezervácia nenájdená' });

  res_item.status = 'Potvrdená';

  // POŠLI EMAIL HOSTOVI
  const roomNum = res_item.room.replace('P', '');
  const mailTemplate = emailTemplates.confirmationSent(res_item.name, `${res_item.room} (Izba ${roomNum})`, res_item.checkIn, res_item.checkOut);
  await sendEmail(res_item.email, mailTemplate.subject, mailTemplate.html);

  // POŠLI NOTIFIKÁCIU MAJITEĽOVI
  const ownerMail = {
    subject: `✓ Rezervácia potvrdená - ${res_item.name}`,
    html: `<p>${res_item.name} - Izba ${roomNum} - Potvrdená</p>`
  };
  await sendEmail(OWNER_EMAIL, ownerMail.subject, ownerMail.html);

  res.json({ success: true, reservation: res_item });
});

// PUT - Označiť platbu
app.put('/api/reservations/:id/payment', async (req, res) => {
  const { amount } = req.body;
  const res_item = reservations.find(r => r.id === req.params.id);
  
  if (!res_item) return res.status(404).json({ error: 'Rezervácia nenájdená' });

  const paid = res_item.deposit + amount;
  res_item.deposit = paid;
  res_item.paymentStatus = paid >= res_item.totalPrice ? 'Zaplatené' : 'Čiastočne zaplatené';

  // POŠLI EMAIL
  const remaining = Math.max(0, res_item.totalPrice - paid);
  const mailTemplate = emailTemplates.paymentReceived(res_item.name, amount, remaining);
  await sendEmail(OWNER_EMAIL, mailTemplate.subject, mailTemplate.html);

  res.json({ success: true, reservation: res_item });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await transporter.verify();
    res.json({ status: 'OK', email: '✓ Email nakonfigurovaný a testovaný' });
  } catch (error) {
    res.json({ status: 'ERROR', email: '✗ Email problém: ' + error.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Chyba servera' });
});

app.listen(PORT, () => {
  console.log(`🏨 Ubytovňa Trnava Backend spustený na http://localhost:${PORT}`);
  console.log(`📧 Email: ${OWNER_EMAIL}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
