# 🎨 Whiteboard

A modular, high-performance collaborative whiteboard application built with **Vite**, **Vanilla JS**, **Vanilla CSS**, and **Socket.io**. It supports rich vector tools, keyboard shortcuts, zoom/pan navigation, smart region clipping, and real-time collaboration with synchronized undo/redo histories and remote cursors.

---

## 🚀 Getting Started

Follow these steps to set up and run the whiteboard application on your local machine.

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (version 16 or higher is recommended).

### 2. Installation
Install dependencies for both the frontend and backend:

```bash
# Install root (frontend + development) dependencies
npm install

# Install backend dependencies
cd be
npm install
cd ..
```

---

## 🛠️ Running the Application

You can run the application in either development or production mode.

### A. Development Mode (Recommended for Development)
Runs the Vite frontend development server (with hot module replacement) and the collaborative backend server concurrently.

```bash
npm run dev
```

* **Frontend Dev Server**: Runs on [http://localhost:5173](http://localhost:5173) (automatically opens in browser)
* **Backend Socket Server**: Runs on `http://localhost:3001`
* *Note: The frontend will automatically detect the dev server port and connect its Socket.io client to port `3001`.*

### B. Production Mode
Builds the optimized frontend production assets to the `dist/` folder and starts the Express server, which hosts both the static frontend and the Socket.io collaboration backend on a single port.

```bash
npm start
```

* **Application Address**: Runs on [http://localhost:3001](http://localhost:3001)

---

## 👥 Real-Time Collaboration

Connect with other users on your local network:
1. Start the application in **Production Mode** (`npm start`). The console will print your local network IP (e.g., `http://192.168.1.X:3001`).
2. Open the page in your browser.
3. Click the **Collaborate** button in the toolbar.
4. Enter your name and create or join a room.
5. Share the generated room link (or room ID) with teammates on the same network.
6. **Synchronized features**:
   * Shared drawing, selection, and deletion.
   * Real-time cursor tracking with names and colors.
   * Laser pointer paths with automatic fading.
   * Synchronized undo/redo histories for all participants.

---

## 🎨 Features & Tools

* **Rich Vector Tools**: Pencil, Straight Line, Arrow, Rectangle, Diamond, Circle, Text, Eraser, and Fading Laser pointer.
* **Style Configurations**: Customize stroke & fill colors, stroke width, roughness, and opacity.
* **Typography**: Live-previewing font family and size selectors for text.
* **Canvas Control**: Scroll to Zoom, `Alt` + Drag to Pan.
* **Undo & Redo**: Full workspace element timeline synchronization.
* **✂️ Clip & Share**: Drag to select any canvas region, preview it, copy it directly to your clipboard, or download it as a PNG.

---

## ⌨️ Keyboard Shortcuts

| Key | Action / Tool |
|-----|---------------|
| `V` | Select / Transform Tool |
| `P` | Pencil Tool |
| `L` | Line Tool |
| `A` | Arrow Tool |
| `R` | Rectangle Tool |
| `D` | Diamond Tool |
| `C` | Circle Tool |
| `T` | Text Tool |
| `E` | Eraser Tool |
| `Z` | Laser Pointer Tool |
| `Ctrl` + `Z` | Undo last action |
| `Ctrl` + `Y` | Redo action |
| `Delete` / `Backspace` | Delete selected elements |
| `Alt` + `Drag` | Pan the canvas |
| `Scroll` | Zoom in / out |
