# Payroll Voice Project

This project contains a **Vite + React frontend** (deployable to Firebase) and a **Google Cloud Function backend** (Node.js 20) to extract natural language date ranges securely using OpenAI.

## 🚀 Quick Start (Local Development)

```bash
# 1. Start Cloud Function
cd cloud_function
echo "OPENAI_API_KEY=sk-your-key" > .env
npm start

# 2. Start Frontend (new terminal)
cd frontend
npm run dev

# 3. Visit http://localhost:5001
```

---

## 🧩 Structure

```
payroll-voice/
├── frontend/             # React (Vite) app
├── cloud_function/       # Google Cloud Function for OpenAI requests
└── terraform/            # Terraform deployment config for Cloud Function
```

---

## 🚀 Frontend (Vite + React)

### Setup
```bash
cd frontend
npm install
```

### Run locally
```bash
npm run dev
```

### Build for production
```bash
npm run build
```

### Deploy to Firebase
```bash
firebase init hosting
firebase deploy
```
- Use `frontend/dist` as the hosting directory.
- `robots.txt` prevents indexing by search engines.

### Environment variable
Create a `.env` file:
```
VITE_API_URL=https://REGION-PROJECT.cloudfunctions.net/extractDates
```

---

## ☁️ Cloud Function (Backend)

### Description
- Written in Node.js 20
- Handles POST requests from the frontend
- Uses your OpenAI API key stored as an environment variable
- CORS restricted to your Firebase domain

### Local Development Setup

#### Prerequisites
- Node.js 20+
- OpenAI API key
- Google Cloud Functions Framework

#### 1. Install Dependencies
```bash
cd cloud_function
npm install
```

#### 2. Set Up Environment Variables

**Option A: Create a `.env` file (Recommended)**
```bash
# Create .env file in cloud_function directory
echo "OPENAI_API_KEY=sk-your-actual-openai-key-here" > .env
```

**Option B: Export environment variable**
```bash
export OPENAI_API_KEY="sk-your-actual-openai-key-here"
```

#### 3. Start the Cloud Functions Locally

**Option A: Run both functions simultaneously (Recommended)**
```bash
npm run dev:all
```
This starts both `extractDates` on port 8080 and `crud` on port 8081.

**Option B: Run them separately**

Terminal 1 - Extract Dates Function:
```bash
npm start
# or
npm run dev
```
Function available at `http://localhost:8080`

Terminal 2 - CRUD Function:
```bash
npm run start:crud
# or
npm run dev:crud
```
Function available at `http://localhost:8081`

#### 4. Test the Function

**Using curl:**
```bash
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5001" \
  -d '{"spokenText":"run payroll from October 1st to 15th"}'
```

**Using the test script:**
```bash
# Edit test_function.sh and add your OpenAI API key
./test_function.sh
```

#### 5. Run Frontend + Backend Together

**Option A: Using dev:all (Recommended)**

Terminal 1 - Start Both Cloud Functions:
```bash
cd cloud_function
npm run dev:all
```

Terminal 2 - Start Frontend:
```bash
cd frontend
npm run dev
```

Visit `http://localhost:5001` to test the full application locally.

**Option B: Run Functions Separately**

Terminal 1 - Extract Dates Function:
```bash
cd cloud_function
npm start  # Runs on port 8080
```

Terminal 2 - CRUD Function:
```bash
cd cloud_function
npm run start:crud  # Runs on port 8081
```

Terminal 3 - Start Frontend:
```bash
cd frontend
npm run dev
```

Visit `http://localhost:5001` to test the full application locally.

#### 6. Environment Configuration

The Cloud Functions automatically handle different environments:

- **Local Development**: Uses environment variables from `.env` file
  - `OPENAI_API_KEY` - Your OpenAI API key
  - `CRUD_ENDPOINT_URL` - Your Google Apps Script CRUD endpoint URL (optional for local dev)
  - `ALLOWED_ORIGINS` - Comma-separated list of allowed origins (optional)

- **Production**: 
  - `OPENAI_API_KEY` - Uses mounted secret volume at `/etc/secrets/openai-api-key`
  - `CRUD_ENDPOINT_URL` - Provided via Terraform variables

**Example .env file for local development:**
```bash
echo "OPENAI_API_KEY=sk-your-key" > cloud_function/.env
echo "CRUD_ENDPOINT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec" >> cloud_function/.env
echo "ALLOWED_ORIGINS=http://localhost:5001,http://localhost:3000" >> cloud_function/.env
```

#### 7. CORS Configuration

The function supports multiple origins for local development:
- `http://localhost:5001` (default frontend port)
- `http://localhost:3000` (alternative port)
- Production domains (configured in `allowedOrigins` array)

#### 8. Debugging Tips

- Check function logs in the terminal where you ran `npm start`
- Use browser dev tools to inspect network requests
- Test CORS by checking the `Origin` header in requests
- Verify environment variables are loaded: `console.log(process.env.OPENAI_API_KEY)`

---

## 🌍 Terraform (Deployment)

### Files
- `main.tf` — defines Cloud Function, bucket, and environment
- `variables.tf` — defines variables (`project_id`, `region`, `openai_api_key`)
- `outputs.tf` — prints the Cloud Function URL

### Deploy
```bash
cd terraform
terraform init
terraform apply -var="project_id=YOUR_PROJECT_ID" -var="openai_api_key=sk-..." -auto-approve
```

### Update Cloud Function Source
```bash
cd cloud_function
zip -r ../terraform/function_source/extractDates.zip .
```

---

## 🔐 Security Notes
- The backend checks `req.headers.origin` and only allows requests from your Firebase domain.
- The OpenAI API key stays server-side.
- Add an optional secret header for extra protection if needed.

---

## 🧭 Summary of Commands

### Frontend
```
npm install
npm run build
firebase deploy
```

### Backend
```
npm install
zip -r ../terraform/function_source/extractDates.zip .
terraform apply
```

---

## 💡 Tips
- Adjust `Access-Control-Allow-Origin` in `index.js` with your Firebase domain (e.g., `https://yourproject.web.app`).
- Consider adding `functions:deploy` to CI/CD later.
- Extend the frontend to include speech recognition using the Web Speech API.
