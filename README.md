# JC TECH ZONE — IT Service Portal

Web-based IT service ticketing, home-service booking, and management system with hardware catalog.

---

## ⚡ Tech Stack

* **Frontend**: HTML5, Bootstrap 5, jQuery, Vanilla CSS (served static from `/client`)
* **Backend**: Node.js, Express 4, Supabase (`@supabase/supabase-js`)
* **Database**: Supabase PostgreSQL

---

## 🚀 Quick Start

### 1. Start Server & Frontend
```bash
npm run dev
```
* **Application**: [http://localhost:5000](http://localhost:5000)
* **API Endpoints**: [http://localhost:5000/api](http://localhost:5000/api)

### 2. Seed Database
```bash
npm run seed
```

### 3. Run Smoke Check
```bash
npm test --prefix server
```

---

## 📁 Project Structure

```
jc tech zone/
├── package.json
├── client/                     # Static frontend (Bootstrap + jQuery)
│   ├── index.html              # Home & guest booking portal
│   ├── track.html              # Live ticket tracking & feedback
│   ├── catalog.html            # Hardware catalog & price checker
│   ├── admin.html              # Admin dispatch & metrics
│   ├── tech.html               # Technician bench terminal
│   ├── api.js                  # jQuery AJAX client
│   └── styles.css              # Dark cyber theme styles
└── server/                     # Express + Supabase API
    ├── src/
    │   ├── db.js               # Supabase client
    │   ├── index.js            # Express server entry point
    │   ├── seed.js             # Supabase database seeder
    │   └── routes/
    │       ├── tickets.js      # Tickets REST API
    │       ├── products.js     # Products catalog REST API
    │       ├── technicians.js  # Technicians REST API
    │       └── feedback.js     # Feedback REST API
    └── test_api.js             # Assert-based smoke test
```
