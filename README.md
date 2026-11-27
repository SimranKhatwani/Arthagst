# ArthaGST — Enterprise GST Billing, Inventory & ERP Platform

| Service | Platform | Deployed URL |
| :--- | :--- | :--- |
| **Frontend Web App** | Vercel | [https://arthagst.vercel.app](https://arthagst.vercel.app) |
| **Backend API Service** | Render | [https://arthagst-1.onrender.com](https://arthagst-1.onrender.com) |
| **API Health Check** | Render | [https://arthagst-1.onrender.com/api/health](https://arthagst-1.onrender.com/api/health) |

---

## 🚀 Live Demo & Access

- **Public Web Application:** [https://arthagst.vercel.app](https://arthagst.vercel.app)
- **Super Admin Console:** [https://arthagst.vercel.app/sd](https://arthagst.vercel.app/sd)
- **REST API Endpoint:** `https://arthagst-1.onrender.com/api`

### Default Credentials

| Portal | Email | Password | Tenant Code |
| :--- | :--- | :--- | :--- |
| **Super Admin Console (/sd)** | `superadmin@artha.com` | `Superadmin@12345` | *(none)* |
| **Organization Admin** | `admin@artha.com` | `Admin@12345` | `ARTHA` |

---

## 🛠️ Project Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS (Hosted on Vercel: `arthagst.vercel.app`)
- **Backend**: Node.js, Express.js REST API, Mongoose ORM, MongoDB Atlas Replica Set (Hosted on Render: `arthagst-1.onrender.com`)
- **Key Modules**: GST Invoicing (B2B, B2C), Multi-Warehouse Godown Inventory, Parties & CRM, Quotations, POS Billing, Reports & Audit Logs

---

## 💻 Local Development

### 1. Backend Server
```bash
cd Backend
npm install
npm start
# Runs locally on http://localhost:5000
```

### 2. Frontend Application
```bash
cd Frontend
npm install
npm run dev
# Runs locally on http://localhost:3000
```
