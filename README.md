# Parts Catalog - Premium Automotive Parts Finder

A modern, high-performance web application for searching and managing automotive parts. This application features a dual-mode search interface, dynamic vehicle filtering, and an admin dashboard for data management.

## Features

- **Dual Search Modes**:
  - **Search by Part Number**: Quick lookup using the part number.
  - **Search by Vehicle**: Advanced filtering through Brand → Model → Submodel → Part.
- **Dynamic Vehicle Filtering**: Real-time population of model and submodel dropdowns based on vehicle selection.
- **Premium UI/UX**:
  - Modern "Glassmorphism" design with a premium Amethyst Violet aesthetic.
  - Smooth transitions, micro-interactions, and built-in Full-Screen Kiosk Mode.
  - Responsive layout for desktop and mobile devices.
- **Offline Mobile App**:
  - Includes a React Native Android application (`PartsMobile`).
  - One-click sync to download the server's database for 100% offline part searching in the field.
- **Admin Dashboard**:
  - Dedicated interface for adding new vehicles, parts, and managing users.
  - Secure data management and backup utilities.

## Tech Stack

- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Dependencies**:
  - `cors`: Cross-Origin Resource Sharing
  - `sqlite3`: SQLite database driver
  - `tesseract.js`: OCR for text extraction (future use)
  - `pdf-parse`: PDF document parsing

## System & Software Requirements

To run this application efficiently on your PC, please ensure your system meets the following specifications and that the necessary software is installed.

### System Requirements
- **Operating System**: Windows 10/11, macOS (Catalina or newer), or Linux.
- **RAM**: Minimum 4GB (8GB recommended if you plan on importing large PDF catalogs).
- **Storage**: At least 500MB of free disk space for the application and database files.

### Software Requirements
You must have the following core software installed on your computer to run the local backend server.

1. **Node.js (Required)**
   - **Description**: The JavaScript runtime environment needed to run the `server.js` backend API.
   - **Version**: Node.js v16.0.0 or newer.
   - **Download Link**: [Download Node.js here](https://nodejs.org/en/download/) *(Select the "LTS" - Long Term Support version for your operating system)*.
   - *Note: Installing Node.js will automatically install `npm` (Node Package Manager), which is necessary for step 2 of the installation.*

2. **Modern Web Browser (Required)**
   - **Description**: Required to access the user interface and admin dashboard.
   - **Supported Browsers**: Latest versions of Google Chrome, Mozilla Firefox, Microsoft Edge, or Safari.
   - **Download Links**:
     - [Download Google Chrome](https://www.google.com/chrome/)
     - [Download Mozilla Firefox](https://www.mozilla.org/firefox/new/)

3. **Git (Optional but Recommended)**
   - **Description**: Version control software used to clone or download the repository efficiently.
   - **Download Link**: [Download Git here](https://git-scm.com/downloads)

## Installation

1.  **Download the Source Code**:
    - If you installed Git, open your terminal/command prompt and run:
      ```bash
      git clone <repository_url>
      ```
    - Alternatively, download and extract the `.zip` file of this project folder.

2.  **Install dependencies**:
    ```bash
    cd parts_catalog
    npm install
    ```

## Usage

### Running the Server

Start the backend server by double-clicking the `start_app.bat` file, or using the command line:

```bash
node server.js
```

*(Note: On Windows, `start_app.bat` will automatically launch Microsoft Edge in Kiosk mode for a full-screen, windowless experience.)*

### Accessing the Application

- **User Interface**: Open `http://localhost:3000` (or your assigned port) in your web browser.
- **Admin Dashboard**: Open `http://localhost:3000/admin.html` in your web browser.

### 🌐 Accessing Over Local Network (Wi-Fi)

Because this application runs as a local web server, any device (phone, laptop, iPad) connected to the same Wi-Fi router can access the application.

1. Start the server on the main installed computer using `start_app.bat` (or `node server.js`).
2. Look at the black terminal window. It will automatically detect and display your network IP, e.g., `http://192.168.1.15:3000`.
3. Type that exact URL into the web browser of any other device on your network to instantly access the parts catalog remotely.

### 💾 Backup & Restore Database

Your entire database is stored seamlessly in a single file (`parts.sqlite`). You can easily transport and sync it between computers using the built-in feature.

1. **Backup**: Log into the Admin Dashboard and click the **Backup** tab. Click **Download Database** to instantly save a copy of all your parts and data directly to your computer.
2. **Restore**: Go to a different computer (or use the remote access method above). Log into that computer's Admin Dashboard, go to the **Backup** tab, and click **Select File & Restore** to cleanly overwrite its catalog with your new parts.

### 🔄 Applying System Updates

You can update the system without reinstalling Node or losing your database.
1. Download the new `update.zip` file provided by the developer.
2. Place `update.zip` inside your `parts_catalog` folder.
3. Run `apply_update.bat`.
4. The script will extract the files, install any new dependencies, and safely preserve your `parts.sqlite` database!

## Project Structure

```
parts_catalog/
├── index.html              # Main user interface
├── admin.html              # Admin dashboard
├── server.js               # Express.js server
├── style.css               # Global styles
├── script.js               # Frontend logic
├── parts.sqlite            # Database file (auto-generated)
├── apply_update.bat        # Automated patch updater
├── start_app.bat           # Server launch and Kiosk mode trigger
├── PartsMobile/            # React Native Expo Android App source code
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
