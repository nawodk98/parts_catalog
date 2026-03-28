# Parts Catalog - Premium Automotive Parts Finder

A modern, high-performance web application for searching and managing automotive parts. This application features a dual-mode search interface, dynamic vehicle filtering, and an admin dashboard for data management.

## Features

- **Dual Search Modes**:
  - **Search by Part Number**: Quick lookup using the part number.
  - **Search by Vehicle**: Advanced filtering through Brand → Model → Submodel → Part.
- **Dynamic Vehicle Filtering**: Real-time population of model and submodel dropdowns based on vehicle selection.
- **Premium UI/UX**:
  - Modern "Glassmorphism" design with blur effects.
  - Smooth transitions and micro-interactions.
  - Responsive layout for desktop and mobile devices.
- **Admin Dashboard**:
  - Dedicated interface for adding new vehicles and parts.
  - Secure data management.

## Tech Stack

- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Dependencies**:
  - `cors`: Cross-Origin Resource Sharing
  - `sqlite3`: SQLite database driver
  - `tesseract.js`: OCR for text extraction (future use)
  - `pdf-parse`: PDF document parsing

## Installation

1.  **Clone the repository** (or download the source code).

2.  **Install dependencies**:
    ```bash
    cd parts_catalog
    npm install
    ```

## Usage

### Running the Server

Start the backend server using the following command:

```bash
node server.js
```

The server will start on `http://localhost:3000`.

### Accessing the Application

- **User Interface**: Open `http://localhost:3000` in your web browser.
- **Admin Dashboard**: Open `http://localhost:3000/admin.html` in your web browser.

## Project Structure

```
parts_catalog/
├── index.html              # Main user interface
├── admin.html              # Admin dashboard
├── server.js               # Express.js server
├── style.css               # Global styles
├── script.js               # Frontend logic
├── parts.sqlite            # Database file (auto-generated)
└── package.json            # Project dependencies
```

## Development

### Adding Data

**Add a Vehicle**:
Use the Admin Dashboard to add new vehicle entries.

**Add a Part**:
Use the Admin Dashboard to add new parts, linking them to specific vehicles.

### Importing Catalogs (WIP)

The system is prepared for batch importing PDF catalogs. Use the `import_catalog.js` script to process PDF files and populate the database.

```bash
node import_catalog.js
```

## License

[MIT License](LICENSE)
