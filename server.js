require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

const app = express();
// Connect to SQLite Database
const dbPath = process.env.DB_PATH || path.join(__dirname, 'parts.sqlite');
let db;

function initDB() {
    db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to SQLite database.');
        // Initialize tables
        db.run(`CREATE TABLE IF NOT EXISTS vehicles (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             brand TEXT,
             model TEXT,
             submodel TEXT,
             engine_type TEXT
         )`, () => {
             db.run("ALTER TABLE vehicles ADD COLUMN engine_type TEXT", () => {});
         });

        db.run(`CREATE TABLE IF NOT EXISTS parts (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             part_number TEXT UNIQUE,
             name TEXT,
             description TEXT,
             vehicle_id INTEGER,
             engine_type TEXT,
             category TEXT,
             part_type TEXT DEFAULT 'Genuine',
             brand TEXT,
             specifications TEXT,
             FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
         )`, () => {
             // Silently upgrade existing DB schema
             db.run("ALTER TABLE parts ADD COLUMN part_type TEXT DEFAULT 'Genuine'", () => {});
             db.run("ALTER TABLE parts ADD COLUMN brand TEXT", () => {});
             db.run("ALTER TABLE parts ADD COLUMN description TEXT", () => {});
             db.run("ALTER TABLE parts ADD COLUMN engine_type TEXT", () => {});
             db.run("ALTER TABLE parts ADD COLUMN specifications TEXT", () => {});
         });

        db.run(`CREATE TABLE IF NOT EXISTS part_compatibility (
             oem_part_id INTEGER,
             genuine_part_number TEXT,
             FOREIGN KEY (oem_part_id) REFERENCES parts (id),
             UNIQUE(oem_part_id, genuine_part_number)
         )`);

        db.run(`CREATE TABLE IF NOT EXISTS users (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             username TEXT UNIQUE,
             password TEXT,
             token TEXT
         )`, () => {
             db.get("SELECT COUNT(*) AS count FROM users", (err, row) => {
                 if (row && row.count === 0) {
                     const hash = hashPassword('admin');
                     db.run("INSERT INTO users (username, password) VALUES ('admin', ?)", [hash]);
                 }
             });
         });
    });
}

initDB();

// Middleware
const corsOptions = {
    origin: process.env.ALLOWED_ORIGIN || '*',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// API Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per windowMs
    message: "Too many requests from this IP, please try again later."
});
app.use('/api/', apiLimiter);

// Serve frontend files
app.use(express.static(path.join(__dirname)));

// Auth Middleware
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.split(' ')[1];
    db.get('SELECT * FROM users WHERE token = ?', [token], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Unauthorized' });
        req.user = user;
        next();
    });
};

// === API Routes for Adding Data (Admin) ===

const { promisify } = require('util');

// Get all unique autocomplete suggestions
app.get('/api/suggestions', async (req, res) => {
    const dbAll = promisify(db.all.bind(db));
    try {
        const vBrands = await dbAll("SELECT DISTINCT brand FROM vehicles WHERE brand IS NOT NULL AND brand != ''");
        const vModels = await dbAll("SELECT DISTINCT model FROM vehicles WHERE model IS NOT NULL AND model != ''");
        const vSubmodels = await dbAll("SELECT DISTINCT submodel FROM vehicles WHERE submodel IS NOT NULL AND submodel != ''");
        const pBrands = await dbAll("SELECT DISTINCT brand FROM parts WHERE brand IS NOT NULL AND brand != ''");
        const pNames = await dbAll("SELECT DISTINCT name FROM parts WHERE name IS NOT NULL AND name != ''");
        const pDescriptions = await dbAll("SELECT DISTINCT description FROM parts WHERE description IS NOT NULL AND description != ''");
        const pCategories = await dbAll("SELECT DISTINCT category FROM parts WHERE category IS NOT NULL AND category != ''");
        const pEngines = await dbAll("SELECT DISTINCT engine_type FROM parts WHERE engine_type IS NOT NULL AND engine_type != ''");
        const vEngines = await dbAll("SELECT DISTINCT engine_type FROM vehicles WHERE engine_type IS NOT NULL AND engine_type != ''");

        // Merge engines from parts and vehicles
        const allEngines = [...new Set([...pEngines.map(r => r.engine_type), ...vEngines.map(r => r.engine_type)])];

        res.json({
            vBrands: vBrands.map(r => r.brand),
            vModels: vModels.map(r => r.model),
            vSubmodels: vSubmodels.map(r => r.submodel),
            pBrands: pBrands.map(r => r.brand),
            pNames: pNames.map(r => r.name),
            pDescriptions: pDescriptions.map(r => r.description),
            pCategories: pCategories.map(r => r.category),
            engines: allEngines
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new vehicle
app.post('/api/vehicles', authenticate, (req, res) => {
    const { brand, model, submodel, engine_type } = req.body;
    db.run(`INSERT INTO vehicles (brand, model, submodel, engine_type) VALUES (?, ?, ?, ?)`,
        [brand.toLowerCase(), model, submodel, engine_type || ''],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.status(201).json({ id: this.lastID, brand, model, submodel, engine_type });
        }
    );
});

// Add a new part
app.post('/api/parts', authenticate, (req, res) => {
    const { part_type, brand, part_number, name, description, category, vehicle_id, engine_type, compatible_genuine_numbers, specifications } = req.body;
    
    // Allow saving part even if vehicle_id is missing, as long as it has an engine_type
    const vId = part_type === 'OEM' ? null : (vehicle_id ? vehicle_id : null);

    db.run(`INSERT INTO parts (part_type, brand, part_number, name, description, category, vehicle_id, engine_type, specifications) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [part_type || 'Genuine', brand || null, part_number, name, description, category, vId, engine_type || null, specifications ? JSON.stringify(specifications) : null],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });
            const pId = this.lastID;
            
            if (part_type === 'OEM' && compatible_genuine_numbers) {
                const genNums = compatible_genuine_numbers.split(',').map(s => s.trim()).filter(Boolean);
                if (genNums.length > 0) {
                    const placeholders = genNums.map(() => '(?, ?)').join(',');
                    const values = genNums.flatMap(num => [pId, num]);
                    db.run(`INSERT INTO part_compatibility (oem_part_id, genuine_part_number) VALUES ${placeholders}`, values, (err2) => {
                        if (err2) console.error("Error linking part compatibility:", err2);
                        return res.status(201).json({ id: pId, part_number, name });
                    });
                    return;
                }
            }
            res.status(201).json({ id: pId, part_number, name });
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
            if (!data[b].models[v.model]) data[b].models[v.model] = {};
            if (!data[b].models[v.model][v.submodel]) data[b].models[v.model][v.submodel] = [];
            if (v.engine_type && !data[b].models[v.model][v.submodel].includes(v.engine_type)) {
                data[b].models[v.model][v.submodel].push(v.engine_type);
            }
        });

        // Return object keys if empty to avoid breaking frontend
        res.json(data);
    });
});

// Search Parts by Part Number
app.get('/api/parts/search', (req, res) => {
    const { q } = req.query;
    const query = `
        SELECT p.*,
               (CASE WHEN p.engine_type IS NOT NULL AND p.engine_type != '' THEN 'Engine: ' || p.engine_type ELSE '' END) as engine_fitment,
               GROUP_CONCAT(DISTINCT UPPER(v.brand) || ' ' || v.model || ' ' || v.submodel || COALESCE(' ' || NULLIF(v.engine_type, ''), '')) as vehicle_fits
        FROM parts p
        LEFT JOIN part_compatibility pc ON p.id = pc.oem_part_id
        LEFT JOIN parts gp ON pc.genuine_part_number = gp.part_number
        LEFT JOIN vehicles v ON p.vehicle_id = v.id OR gp.vehicle_id = v.id
        WHERE UPPER(p.part_number) LIKE ? 
           OR UPPER(p.name) LIKE ?
           OR UPPER(p.description) LIKE ?
           OR UPPER(p.brand) LIKE ?
           OR UPPER(p.engine_type) LIKE ?
           OR UPPER(p.specifications) LIKE ?
           OR UPPER(v.brand) LIKE ?
           OR UPPER(v.model) LIKE ?
           OR UPPER(v.submodel) LIKE ?
           OR UPPER(v.engine_type) LIKE ?
           OR UPPER(pc.genuine_part_number) LIKE ?
           OR p.part_number IN (
               SELECT pc2.genuine_part_number 
               FROM part_compatibility pc2 
               JOIN parts p2 ON pc2.oem_part_id = p2.id 
               WHERE UPPER(p2.part_number) LIKE ?
                  OR UPPER(p2.name) LIKE ?
                  OR UPPER(p2.description) LIKE ?
                  OR UPPER(p2.specifications) LIKE ?
           )
        GROUP BY p.id
    `;
    const s = `%${q.toUpperCase()}%`;
    db.all(query, [s, s, s, s, s, s, s, s, s, s, s, s, s, s, s], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Search Parts by Vehicle Details
app.get('/api/parts/vehicle', (req, res) => {
    const { brand, model, submodel, engine_type, category } = req.query;

    let vQuery = `SELECT id, engine_type FROM vehicles WHERE UPPER(brand) = UPPER(?) AND UPPER(model) = UPPER(?) AND UPPER(submodel) = UPPER(?)`;
    let vParams = [brand, model, submodel];
    if (engine_type) {
        vQuery += ` AND UPPER(engine_type) = UPPER(?)`;
        vParams.push(engine_type);
    }

    db.get(vQuery, vParams,
        (err, vehicle) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!vehicle && !engine_type) return res.json([]);
            
            // If vehicle matched, find parts matching the vehicle ID or its engine
            // If no vehicle matched but user provided engine, just search by engine

            let query = `
                SELECT p.*,
                       (CASE WHEN p.engine_type IS NOT NULL AND p.engine_type != '' THEN 'Engine: ' || p.engine_type ELSE '' END) as engine_fitment,
                       GROUP_CONCAT(DISTINCT UPPER(v.brand) || ' ' || v.model || ' ' || v.submodel || COALESCE(' ' || NULLIF(v.engine_type, ''), '')) as vehicle_fits
                FROM parts p
                LEFT JOIN part_compatibility pc ON p.id = pc.oem_part_id
                LEFT JOIN parts gp ON pc.genuine_part_number = gp.part_number
                LEFT JOIN vehicles v ON p.vehicle_id = v.id OR gp.vehicle_id = v.id
                WHERE 1=1 AND (
            `;
            
            let params = [];
            const conditions = [];

            if (vehicle) {
                conditions.push(`(p.vehicle_id = ?)`, `(pc.genuine_part_number IN (SELECT part_number FROM parts WHERE vehicle_id = ?))`);
                params.push(vehicle.id, vehicle.id);
                if (vehicle.engine_type) {
                    conditions.push(`(UPPER(p.engine_type) = UPPER(?) AND p.engine_type != '')`);
                    params.push(vehicle.engine_type);
                }
            }
            if (engine_type) {
                conditions.push(`(UPPER(p.engine_type) = UPPER(?) AND p.engine_type != '')`);
                params.push(engine_type);
            }

            if (conditions.length === 0) {
                 return res.json([]);
            }

            query += conditions.join(' OR ') + ` )`;

            if (category && category !== 'All') {
                query += ` AND UPPER(p.category) = UPPER(?)`;
                params.push(category);
            }
            query += ` GROUP BY p.id`;

            db.all(query, params, (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows);
            });
        });
});
// Download Database Endpoint for Offline Mobile Sync
app.get('/api/database/download', authenticate, (req, res) => {
    res.download(dbPath, 'parts.sqlite', (err) => {
        if (err) console.error("Error downloading database:", err);
    });
});

// Restore Database Endpoint
app.post('/api/database/restore', authenticate, express.raw({ type: 'application/octet-stream', limit: '100mb' }), (req, res) => {
    if (!req.body || req.body.length === 0) return res.status(400).json({ error: 'No database file provided.' });
    
    // Close existing connection safely
    db.close((err) => {
        if (err) console.error("Error closing DB prior to restore:", err);
        
        // Overwrite the database file
        fs.writeFile(dbPath, req.body, (writeErr) => {
            if (writeErr) {
                console.error("Failed to restore database file:", writeErr);
                initDB(); // re-init old DB
                return res.status(500).json({ error: 'Failed to save the uploaded database.' });
            }
            
            console.log("Database file replaced successfully. Reconnecting...");
            initDB();
            res.json({ success: true, message: 'Database successfully restored.' });
        });
    });
});

// === API Routes for Database Management ===

// Get recent parts
app.get('/api/parts/all', (req, res) => {
    db.all(`SELECT id, part_number, name, category, part_type, engine_type FROM parts ORDER BY id DESC LIMIT 100`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get a single part by ID
app.get('/api/parts/:id', (req, res) => {
    db.get(`SELECT * FROM parts WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Not found' });
        
        if (row.part_type === 'OEM') {
            db.all(`SELECT genuine_part_number FROM part_compatibility WHERE oem_part_id = ?`, [row.id], (err2, cmp) => {
                row.compatible_genuine_numbers = (!err2 && cmp) ? cmp.map(c => c.genuine_part_number).join(', ') : '';
                res.json(row);
            });
        } else {
            res.json(row);
        }
    });
});

// Update a part
app.put('/api/parts/:id', authenticate, (req, res) => {
    const pId = req.params.id;
    const { part_type, brand, part_number, name, description, category, vehicle_id, engine_type, compatible_genuine_numbers, specifications } = req.body;
    
    const vId = part_type === 'OEM' ? null : (vehicle_id ? vehicle_id : null);

    db.run(`UPDATE parts SET part_type=?, brand=?, part_number=?, name=?, description=?, category=?, vehicle_id=?, engine_type=?, specifications=? WHERE id=?`,
        [part_type || 'Genuine', brand || null, part_number, name, description, category, vId, engine_type || null, specifications ? JSON.stringify(specifications) : null, pId],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });
            
            db.run(`DELETE FROM part_compatibility WHERE oem_part_id = ?`, [pId], (err2) => {
                if (part_type === 'OEM' && compatible_genuine_numbers) {
                    const genNums = compatible_genuine_numbers.split(',').map(s => s.trim()).filter(Boolean);
                    if (genNums.length > 0) {
                        const placeholders = genNums.map(() => '(?, ?)').join(',');
                        const values = genNums.flatMap(num => [pId, num]);
                        db.run(`INSERT INTO part_compatibility (oem_part_id, genuine_part_number) VALUES ${placeholders}`, values, () => {
                            return res.status(200).json({ success: true });
                        });
                        return;
                    }
                }
                res.status(200).json({ success: true });
            });
        }
    );
});

// Delete a part
app.delete('/api/parts/:id', authenticate, (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM part_compatibility WHERE oem_part_id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.run("DELETE FROM parts WHERE id = ?", [id], function(err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ success: true, changes: this.changes });
        });
    });
});


// === API Routes for User Management ===

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = hashPassword(password);
    db.get("SELECT id FROM users WHERE username = ? AND password = ?", [username, hashedPassword], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(401).json({ error: 'Invalid username or password' });
        
        const token = crypto.randomBytes(32).toString('hex');
        db.run("UPDATE users SET token = ? WHERE id = ?", [token, row.id], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ token, username });
        });
    });
});

app.post('/api/logout', authenticate, (req, res) => {
    db.run("UPDATE users SET token = NULL WHERE id = ?", [req.user.id], () => {
        res.json({ success: true });
    });
});

app.get('/api/users/me', authenticate, (req, res) => res.json({ id: req.user.id, username: req.user.username }));

app.get('/api/users', authenticate, (req, res) => {
    db.all("SELECT id, username FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/users', authenticate, (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const hashedPassword = hashPassword(password);
    db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword], function(err) {
        if (err) return res.status(400).json({ error: 'Username may already exist' });
        res.status(201).json({ id: this.lastID, username });
    });
});

app.put('/api/users/:id', authenticate, (req, res) => {
    const { username, password } = req.body;
    const id = req.params.id;
    
    if (password) {
         const hashedPassword = hashPassword(password);
         db.run("UPDATE users SET username = ?, password = ?, token = NULL WHERE id = ?", [username, hashedPassword, id], function(err) {
             if (err) return res.status(400).json({ error: err.message });
             res.json({ success: true });
         });
    } else {
         db.run("UPDATE users SET username = ? WHERE id = ?", [username, id], function(err) {
             if (err) return res.status(400).json({ error: err.message });
             res.json({ success: true });
         });
    }
});

app.delete('/api/users/:id', authenticate, (req, res) => {
    const id = req.params.id;
    if (req.user.id == id) return res.status(400).json({ error: 'Cannot delete yourself' });
    db.run("DELETE FROM users WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Global 404 Handler for undefined API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: "API Endpoint not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error" });
});

const PORT = process.env.PORT || 0;
const server = app.listen(PORT, '0.0.0.0', () => {
    const port = server.address().port;
    const url = `http://localhost:${port}`;
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (let k in interfaces) {
        for (let k2 in interfaces[k]) {
            let address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }

    console.log(`\n=================================================`);
    console.log(`🚀 API Server is running on Port: ${port}`);
    console.log(`💻 Access on this PC:`);
    console.log(`   -> ${url}`);
    console.log(`   -> Admin Dashboard: ${url}/admin.html`);
    
    if (addresses.length > 0) {
        console.log(`\n🌐 Access over network (Wi-Fi/LAN):`);
        console.log(`   (Use these links on your laptop when connected to the same router)`);
        addresses.forEach(ip => {
            console.log(`   -> http://${ip}:${port}`);
            console.log(`   -> Admin Dashboard: http://${ip}:${port}/admin.html`);
        });
    }
    console.log(`=================================================\n`);

    // Automatically open the website in the default browser
    const { exec } = require('child_process');
    const startCmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
    exec(startCmd, (err) => {
        if (err) console.error('Failed to open browser automatically:', err.message);
    });
});
