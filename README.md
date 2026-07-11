# ADNOVA - Customer Persona Board Generator

ADNOVA is a premium, AI-powered marketing studio application. It ingests brand research JSON files, dynamically parses their identity and target customer profiles, and leverages Google Gemini to generate high-fidelity, agency-quality **Customer Persona Boards**.

Instead of returning flat, static AI-generated boards (which suffer from distorted, hallucinated text), ADNOVA uses a modern, modular architecture:
1. **Asset Generation Pipeline**: Google Gemini generates two separate assets:
   - **Asset 1: Customer Avatar** (transparent PNG, portrait only) using rules from `enhancement.txt`.
   - **Asset 2: Background Environment** (location-aware scenery only) using rules from `cc.txt`.
2. **HTML/CSS/Figma Renderer**: The React frontend composites the avatar and background dynamically inside a pixel-perfect `1080px` x `1350px` canvas. The UI cards (demographics, values, motivations, etc.) are styled with modern glassmorphism, outline icons, and custom CSS color tokens extracted from the brand's official color palette.
3. **High-Resolution Export**: The client uses browser-side supersampling (`html-to-image`) and Blob URL downloads to export the finalized board as a high-definition PNG.

---

## 1. Project Directory Map

```text
NEW_ADNOVA/
├── .env                       # Environment config containing GEMINI_API_KEY
├── cc.txt                     # Brand guidelines & Background prompt rules
├── enhancement.txt            # Studio photography & Avatar prompt rules
├── project_details.txt        # High-level developer details (A to Z)
├── README.md                  # [THIS FILE] Porting and setup instructions
├── [BrandName].json           # Ingestible brand research logs (e.g. Glossier, Allbirds)
│
├── backend/                   # FastAPI Web Server (Python)
│   ├── main.py                # Core backend script, routing, JSON parser, and Gemini API integration
│   ├── requirements.txt       # Python backend dependencies
│   └── generated/             # Storage for generated assets and history
│       ├── [id]_avatar.png      # Persona portrait PNG (transparent)
│       ├── [id]_background.png  # Environment scenery PNG
│       └── [id].json            # Full data structure containing JSON metadata
│
└── frontend/                  # React Application (Vite)
    ├── index.html             # Entry HTML point
    ├── package.json           # Frontend dependency declarations & scripts
    ├── vite.config.js         # Vite configuration with backend api proxy
    └── src/
        ├── main.jsx           # React app mount root
        ├── index.css          # Styled UI system & dynamic theme CSS variables
        └── App.jsx            # State management, API actions, and HTML Renderer
```

---

## 2. Setting Up on Another Computer

Follow these steps to set up and run this project on a new computer.

### Prerequisites
Make sure the new computer has the following installed:
- **Python 3.12+**: For running the FastAPI backend.
- **Node.js 20+** & **npm**: For running the Vite + React frontend.

---

### Step 1: Clone or Copy files
Copy the entire `NEW_ADNOVA` directory to the new computer.

---

### Step 2: Configure Environment Variables
Create a file named `.env` in the root folder (`NEW_ADNOVA/.env`):

```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```

> **Note on different APIs:** If you wish to use a different provider or API (e.g. OpenAI or local Ollama), you can easily modify the model call wrapper inside [backend/main.py](file:///Users/samdavi/projects/NEW_ADNOVA/backend/main.py#L938-L1031) to fetch from a different library. The code uses the official `google-genai` SDK and model identifiers `gemini-2.5-flash` (for the Creative Brief text analysis) and `gemini-3-pro-image` (for visual asset generation).

---

### Step 3: Install & Start the Backend
1. Open a terminal and navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
   - **Windows**:
     ```cmd
     python -m venv venv
     venv\Scripts\activate
     ```
3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   python3 main.py
   ```
   *The server runs locally on **`http://localhost:8000`**.*

---

### Step 4: Install & Start the Frontend
1. Open a new terminal window and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The client starts on **`http://localhost:5173`** and proxy configurations inside `vite.config.js` will route all client `/api/*` fetch queries directly to the backend FastAPI server on port 8000.*

---

## 3. How the Prompt Generation Works

### The Avatar Prompt (Asset 1)
- **Engine File**: [enhancement.txt](file:///Users/samdavi/projects/NEW_ADNOVA/enhancement.txt)
- **Goal**: Ensures that the subject generated by Gemini matches target age, gender, occupation, climate, fashion, and location-appropriate demographics.
- **Negative Constraints**: Instructs the model to generate a transparent background (or flat light grey backdrop) with absolutely zero environment, room, furniture, text, or logos.

### The Background Prompt (Asset 2)
- **Engine File**: [cc.txt](file:///Users/samdavi/projects/NEW_ADNOVA/cc.txt)
- **Goal**: Generates a location-aware environment representing where the consumer profile naturally lives, works, or shops (e.g. Bangalore tech park, Paris cafe, minimal modern home).
- **Negative Constraints**: Strictly blocks the model from rendering any human face, person, animal, text, or advertising graphics.

---

## 4. Frontend Dynamic Theme & Blob Downloads

- **Dynamic Accent Colors**: The frontend extracts brand colors directly from the uploaded research JSON:
  - `--brand-primary`: Used for bold cards, titles, and highlight borders.
  - `--brand-secondary`: Used for tags, accents, and custom bullet icons.
- **Canvas Scaling**: Resizing the browser triggers a `ResizeObserver` listener which applies a CSS transform `scale(...)` with `transform-origin: top center` to dynamically fit the board visual to any resolution.
- **Blob Exporters**: Direct base64 anchor downloads are blocked by modern browsers. The frontend automatically parses base64 assets and data URLs into a binary typed array (`Uint8Array`), wraps it in a raw binary `Blob` object, and downloads it using temporary Object URLs (`URL.createObjectURL(blob)`). This prevents file corruption and empty downloads.
