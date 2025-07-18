// index.js (cleaned with OpenAI fallback)
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(express.json());

// 🔗 MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err.message));

// 🎫 Ticket schema & model
const ticketSchema = new mongoose.Schema({
  name: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});
const Ticket = mongoose.model('Ticket', ticketSchema);

// 🔊 POST /chat → save ticket & AI reply (fallback if quota exceeded)
app.post('/chat', async (req, res) => {
  const name = req.body.name || 'Guest';
  const message = req.body.message || 'No message';

  try {
    const newTicket = await Ticket.create({ name, message });

    let reply;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful customer‑support assistant.' },
          { role: 'user', content: message },
        ],
      });
      reply = completion.choices[0].message.content;
    } catch (apiErr) {
      console.warn('⚠️  OpenAI quota/error:', apiErr.code || apiErr.message);
      reply =
        'Thanks for your message! Our support team has received your ticket and will respond shortly.';
    }

    res.json({ ticketId: newTicket._id, reply });
  } catch (err) {
    console.error('❌ Chat endpoint error:', err.message);
    res.status(500).json({ error: 'Failed to save ticket' });
  }
});

// 📋 GET /tickets → list all tickets
app.get('/tickets', async (_req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json({ tickets });
  } catch (err) {
    console.error('❌ Ticket list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
// 🏠 GET / → homepage with form UI
app.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>AssistIQ</title>
      <style>
        body {
          font-family: 'Poppins', sans-serif;
          background: #f8fafc;
          color: #333;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem;
        }
        img {
          max-width: 160px;
        }
        h1 {
          color: #3B82F6;
          font-size: 2.5rem;
          margin: 1rem 0 0.5rem;
        }
        p {
          color: #555;
          font-size: 1.1rem;
        }
        form {
          margin-top: 2rem;
          width: 100%;
          max-width: 400px;
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        input, textarea, button {
          width: 100%;
          margin-bottom: 1rem;
          padding: 0.75rem;
          border: 1px solid #ccc;
          border-radius: 8px;
          font-size: 1rem;
        }
        button {
          background: #3B82F6;
          color: white;
          border: none;
          cursor: pointer;
        }
        .reply {
          background: #e0f7ff;
          padding: 1rem;
          border-radius: 8px;
          margin-top: 1rem;
        }
      </style>
    </head>
    <body>
      <img src="https://user-gen-media-assets.s3.amazonaws.com/gpt4o_images/ba0b84ef-ebde-43e1-83ee-38a460834d83.png" alt="AssistIQ Logo" />
      <h1>AssistIQ</h1>
      <p><em>Smart Support. Human Touch.</em></p>

      <form id="chatForm">
        <input type="text" name="name" placeholder="Your Name" required />
        <textarea name="message" placeholder="Type your support request here..." required></textarea>
        <button type="submit">Send</button>
      </form>

      <div id="reply" class="reply" style="display:none;"></div>

      <script>
        const form = document.getElementById('chatForm');
        const replyDiv = document.getElementById('reply');

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(form);
          const name = formData.get('name');
          const message = formData.get('message');

          const res = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, message })
          });

          const data = await res.json();
          replyDiv.innerText = data.reply;
          replyDiv.style.display = 'block';
          form.reset();
        });
      </script>
    </body>
    </html>
  `);
});
