# PrimeX POS Electron Setup Guide

## Installation (Development)

### Prerequisites
- Node.js 16+ installed
- Python 3.8+ with Django backend running
- npm or pnpm package manager

### Step 1: Install Electron Dependencies

From the `frontend` directory, run:

```bash
npm install
```

This will install Electron, electron-builder, and other required dependencies.

### Step 2: Run in Development Mode

Start the Electron app with live reloading:

```bash
npm run electron-dev
```

This command will:
1. Start the Next.js dev server on `http://localhost:3000`
2. Wait for it to be ready
3. Launch Electron with dev tools enabled
4. Backend will start automatically if you have Python set up

## Building for Distribution

### Step 1: Create Production Build

```bash
npm run electron-build
```

This will:
1. Build the Next.js app for export
2. Create a Windows NSIS installer
3. Generate `.exe` file in `dist/` folder

The installer file will be: `dist/PrimeX POS 1.0.0.exe`

### Step 2: Configuration Before Building

Edit `electron/main.js` to point to your production backend:

```javascript
const startUrl = isDev
  ? 'http://localhost:3000'
  : `file://${path.join(__dirname, '../out/index.html')}`
```

### Step 3: Distribute

Users can download the `.exe` installer and run it:
1. Download `PrimeX POS 1.0.0.exe`
2. Double-click to install
3. Creates Start Menu shortcut
4. Creates Desktop shortcut
5. App ready to use - No dependencies needed!

## Environment Variables

### Development
- Backend URL: `http://localhost:8000`
- Frontend: `http://localhost:3000`

### Production
- Backend URL: Point to your deployed backend
- Edit `electron/main.js` or use env variables

## Troubleshooting

### Backend won't start
- Ensure Python is in PATH
- Check Django is installed: `pip install -r requirements.txt`
- Run backend separately: `python manage.py runserver`

### Electron won't connect to backend
- Check backend is running on `http://localhost:8000`
- Check firewall not blocking port 8000
- Verify API endpoints in `lib/api.ts`

### Build fails
- Clear node_modules: `rm -r node_modules && npm install`
- Clear Next.js cache: `rm -r .next out`
- Run: `npm run electron-build` again

## File Structure

```
frontend/
├── electron/
│   ├── main.js          # Electron main process
│   └── preload.js       # Preload script (security)
├── public/
│   └── electron.js      # Electron entry point
├── app/                 # Next.js app
├── components/          # React components
├── package.json         # Updated with Electron config
└── next.config.js       # Updated for export mode
```

## Advanced Configuration

### Change App Name
Edit `package.json` in `build.productName`

### Change Installer Icon
Add icon: `assets/icon.ico` (256x256 or larger)

### Auto-updates
Install `electron-updater` for auto-updates support

### Custom Backend Port
Edit `electron/main.js` line with `manage.py runserver`

## Production Deployment

1. Build on release machine: `npm run electron-build`
2. Sign executable (optional but recommended)
3. Host `.exe` on download server
4. Users download and install

## Native Platform (macOS/Linux)

For macOS:
```bash
npm install electron-builder-mac
npm run dist
```

For Linux:
```bash
npm install electron-builder-linux
npm run dist
```

Update `package.json` build configuration for target platform.
