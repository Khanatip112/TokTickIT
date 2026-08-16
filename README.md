# TokTickIT - IT Service Desk (Lab 1 Starter)

TokTickIT is an IT service desk web application for Account and Access, Hardware, Software, and Network requests. Lab 1 establishes a full-stack vertical slice proving that React, Express, Prisma ORM, and PostgreSQL work seamlessly as an integrated system.

## 🛠️ Technology Stack

- **Frontend**: React + TypeScript + Vite + Bootstrap 5
- **Backend**: Node.js + Express + TypeScript (`tsx`)
- **Database & ORM**: PostgreSQL + Prisma ORM
- **Testing**: Vitest & Supertest

---

## 📁 Repository Structure

```
toktickit/
├── client/                 # React + TypeScript + Vite + Bootstrap frontend
│   ├── src/                # Application source code
│   └── tests/              # Frontend Vitest UI tests
│       └── lab-01/
├── server/                 # Express + Node.js + TypeScript backend
│   ├── prisma/             # Prisma schema & seed scripts
│   ├── src/                # Backend API source code
│   └── tests/              # Backend Supertest API tests
│       └── lab-01/
├── docs/                   # Course lab documentation & review records
│   └── lab-01/
├── .gitignore              # Git ignore configuration
└── README.md               # Project documentation and setup guide
```

---

## 🚀 Setup & Installation Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: Running instance on `localhost:5432`

---

### Step 1: Install Dependencies

1. **Install Frontend Dependencies:**
   ```bash
   cd client
   npm install
   ```

2. **Install Backend Dependencies:**
   ```bash
   cd server
   npm install
   ```

---

### Step 2: Environment Setup

1. **Frontend Environment:**
   Copy `client/.env.example` to `client/.env`:
   ```bash
   cp client/.env.example client/.env
   ```
   *Default:* `VITE_API_URL="http://localhost:3000"`

2. **Backend Environment:**
   Copy `server/.env.example` to `server/.env`:
   ```bash
   cp server/.env.example server/.env
   ```
   *Default:* `DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=public"`

---

### Step 3: Database Initialization & Migration

1. Ensure your PostgreSQL database server is running and accessible using the credentials in `server/.env`.
2. Run database migration and seed default categories:
   ```bash
   cd server
   npx prisma migrate dev
   npx prisma db seed
   ```

---

### Step 4: Running the Application

1. **Start the Express API Backend (Port 3000):**
   ```bash
   cd server
   npm run dev
   ```

2. **Start the React Frontend Dev Server:**
   ```bash
   cd client
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 🧪 Running Automated Tests

### Server API Tests (Supertest)
```bash
cd server
npm test
```

### Client UI Tests (Vitest)
```bash
cd client
npm test
```