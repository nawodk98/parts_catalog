const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
// Connect to SQLite Database
const dbPath = path.join(__dirname, 'parts.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to SQLite database.');
        // Initialize tables
        db.run(`CREATE TABLE IF NOT EXISTS vehicles (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             brand TEXT,
             model TEXT,
             submodel TEXT
         )`);

        db.run(`CREATE TABLE IF NOT EXISTS parts (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             part_number TEXT UNIQUE,
             name TEXT,
             price REAL,
             stock INTEGER,
             vehicle_id INTEGER,
             category TEXT,
             FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
         )`);
    }
});

// Middleware
app.use(cors());
app.use(express.json());
// Serve frontend files
app.use(express.static(path.join(__dirname)));

// === API Routes for Adding Data (Admin) ===

// Add a new vehicle
app.post('/api/vehicles', (req, res) => {
    const { brand, model, submodel } = req.body;
    db.run(`INSERT INTO vehicles (brand, model, submodel) VALUES (?, ?, ?)`,
        [brand.toLowerCase(), model, submodel],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.status(201).json({ id: this.lastID, brand, model, submodel });
        }
    );
});

// Add a new part
app.post('/api/parts', (req, res) => {
    const { part_number, name, price, stock, category, vehicle_id } = req.body;
    db.run(`INSERT INTO parts (part_number, name, price, stock, category, vehicle_id) 
            VALUES (?, ?, ?, ?, ?, ?)`,
        [part_number, name, price, stock, category, vehicle_id],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.status(201).json({ id: this.lastID, part_number, name });
        }
    );
});

// Get raw list of all vehicles (for admin dropdown)
app.get('/api/vehicles/raw', (req, res) => {
    db.all(`SELECT * FROM vehicles`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// === API Routes for Frontend Searching ===

// Get Vehicles Structure (Brand -> Models -> Submodels)
app.get('/api/vehicles', (req, res) => {
    db.all(`SELECT * FROM vehicles`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const data = {};
        rows.forEach(v => {
            const b = v.brand;
            if (!data[b]) data[b] = { name: b.charAt(0).toUpperCase() + b.slice(1), models: {} };
            if (!data[b].models[v.model]) data[b].models[v.model] = [];
            if (!data[b].models[v.model].includes(v.submodel)) data[b].models[v.model].push(v.submodel);
        });

        // Return object keys if empty to avoid breaking frontend
        res.json(data);
    });
});

// Search Parts by Part Number
app.get('/api/parts/search', (req, res) => {
    const { q } = req.query;
    db.all(`SELECT * FROM parts WHERE part_number LIKE ?`, [`%${q}%`], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Search Parts by Vehicle Details
app.get('/api/parts/vehicle', (req, res) => {
    const { brand, model, submodel, category } = req.query;

    // First find matching vehicles
    db.get(`SELECT id FROM vehicles WHERE brand = ? AND model = ? AND submodel = ?`,
        [brand.toLowerCase(), model, submodel],
        (err, vehicle) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!vehicle) return res.json([]); // No matching vehicle found

            // Fetch parts matching the vehicle ID and category
            const query = category && category !== 'All'
                ? `SELECT * FROM parts WHERE vehicle_id = ? AND category = ?`
                : `SELECT * FROM parts WHERE vehicle_id = ?`;
            const params = category && category !== 'All' ? [vehicle.id, category] : [vehicle.id];

            db.all(query, params, (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows);
            });
        });
});


const server = app.listen(0, () => {
    const port = server.address().port;
    const url = `http://localhost:${port}`;
    console.log(`\n=================================================`);
    console.log(`🚀 API Server is running at ${url}`);
    console.log(`🛠️  Admin Dashboard accessible at ${url}/admin.html`);
    console.log(`=================================================\n`);

    // Automatically open the website in the default browser
    const { exec } = require('child_process');
    const startCmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
    exec(startCmd, (err) => {
        if (err) console.error('Failed to open browser automatically:', err.message);
    });
});
