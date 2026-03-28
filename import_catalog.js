const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

// Connect to existing database (and create if missing)
const dbPath = path.join(__dirname, 'parts.sqlite');
const db = new sqlite3.Database(dbPath);
const CATALOG_DIR = path.join(__dirname, 'catalogs');

// Ensure tables exist before running (in case the server hasn't been started yet)
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
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
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

// Ensure catalog directory exists
if (!fs.existsSync(CATALOG_DIR)) {
    fs.mkdirSync(CATALOG_DIR);
    console.log(`Created ${CATALOG_DIR} folder. Please drop your PDFs or JPGs here.`);
}

// Function to find or create a default "Imported" vehicle for these parts
function getOrCreateDefaultVehicle() {
    return new Promise((resolve, reject) => {
        db.get(`SELECT id FROM vehicles WHERE brand = 'generic' LIMIT 1`, (err, vehicle) => {
            if (err) return reject(err);
            if (vehicle) return resolve(vehicle.id);

            db.run(`INSERT INTO vehicles (brand, model, submodel) VALUES ('generic', 'Imported', 'Catalog')`, function (err) {
                if (err) return reject(err);
                resolve(this.lastID);
            });
        });
    });
}

// Process a single file (PDF or Image)
async function processFile(filePath, vehicleId) {
    const ext = path.extname(filePath).toLowerCase();
    let text = '';

    console.log(`Processing: ${path.basename(filePath)}...`);

    try {
        if (ext === '.pdf') {
            // NOTE: pdf-parse works great on "text-based" PDFs.
            // If your PDF is just a scanned image, it will extract nothing. 
            // In that case, convert the PDF to JPGs first, or use an LLM extraction tool.
            const dataBuffer = fs.readFileSync(filePath);

            // Handle different npm versions of pdf-parse exporting formats!
            let parseFunc = typeof pdfParse === 'function' ? pdfParse : pdfParse.default || pdfParse.pdfParse;

            // IF it is still not a function, let's log everything it has!
            if (typeof parseFunc !== 'function') {
                console.log("PDF-PARSE EXPORT DUMP:", typeof pdfParse, Object.keys(pdfParse));
                if (pdfParse.default) console.log("Has default:", typeof pdfParse.default);
            }

            const data = await parseFunc(dataBuffer);
            text = data.text;
        }
        else if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
            // Tesseract handles the OCR (Optical Character Recognition) for images
            const { data } = await Tesseract.recognize(filePath, 'eng', {
                logger: m => { } // Suppress progress bars in terminal
            });
            text = data.text;
        } else {
            console.log(`Skipping unsupported format: ${ext}`);
            return;
        }

        parseAndInsert(text, vehicleId, path.basename(filePath));

    } catch (err) {
        console.error(`Error processing ${filePath}:`, err.message);
    }
}

// Parse text and insert into SQLite Database
function parseAndInsert(rawText, vehicleId, sourceFile) {
    // Split extracted text into lines to process
    const lines = rawText.split('\n');
    let insertedCount = 0;

    // =========================================================================
    // 🧠 THE MAGIC PARSER (REGEX) - YOU MAY NEED TO EDIT THIS!
    // =========================================================================
    // This regular expression assumes your catalog lines look exactly like:
    // "PART-1234  Brake Pad Set  $45.99"
    // It captures group 1 (Part Number), group 2 (Description), group 3 (Price)
    const catalogLineRegex = /^([A-Z0-9\-]{4,})\s+(.+?)\s+\$([0-9]+\.[0-9]{2})/i;
    // =========================================================================

    db.serialize(() => {
        // We use INSERT OR IGNORE so we don't crash on duplicate part_numbers
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO parts (part_number, name, price, stock, category, vehicle_id) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const line of lines) {
            const cleanLine = line.trim();
            const match = cleanLine.match(catalogLineRegex);

            if (match) {
                const partNumber = match[1].trim();
                const description = match[2].trim();
                const price = parseFloat(match[3]);

                stmt.run(partNumber, description, price, 15, 'Bulk Import', vehicleId);
                insertedCount++;
            }
        }

        stmt.finalize();
        console.log(`✅ Extracted & Imported ${insertedCount} parts from ${sourceFile}`);
    });
}

// Main execution loop
async function startImport() {
    console.log("=========================================");
    console.log("    BATCH CATALOG IMPORT TOOL RUNNING");
    console.log("=========================================\n");

    try {
        await initializeDatabase();
    } catch (err) {
        console.error("Failed to initialize database tables:", err);
        return;
    }

    const files = fs.readdirSync(CATALOG_DIR).filter(file => !file.startsWith('.'));

    if (files.length === 0) {
        console.log(`No files found!`);
        console.log(`1. Move your .pdf or .jpg files into into the folder: ${CATALOG_DIR}`);
        console.log(`2. Run 'node import_catalog.js' again.`);
        return;
    }

    const vehicleId = await getOrCreateDefaultVehicle();

    for (const file of files) {
        await processFile(path.join(CATALOG_DIR, file), vehicleId);
    }
}

startImport();
