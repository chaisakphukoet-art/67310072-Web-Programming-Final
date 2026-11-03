# TechNova IT Store - Web Programming Final Project

**Course:** 29038764 Web Programming with Framework Technology (Semester 1/2569)  
**Institution:** Burapha University (BUU)  
**Student ID:** 67310072  

---

## 📌 Project Overview
TechNova IT Store is a full-stack e-commerce web application developed for an enterprise and high-performance computing hardware provider. The platform delivers modern Single-Page Application (SPA) architecture, secure role-based access control (RBAC), and verified real-world email OTP confirmation.

---

## 🚀 Key Features

### 1. Authentication & Security
- User registration with real email verification (Google SMTP Relay OTP).
- Secure JWT (JSON Web Token) authentication.
- Role-Based Access Control (`Admin` vs `Member`).

### 2. E-Commerce Flow (Member)
- Interactive IT Hardware Catalog with Real-Time Live Search.
- Category filtering (Laptops, PC Hardware, Monitors, Gaming Peripherals).
- Comprehensive Hardware Technical Specifications Modal.
- Shopping Cart Drawer with real-time price calculation.
- Streamlined Checkout Form with shipping address and payment method selection.
- My Orders history tracking with live order status (`Pending`, `Processing`, `Shipped`, `Delivered`).

### 3. Inventory & Operations (Admin)
- Product Inventory Management (Full CRUD: Create, Read, Update, Delete).
- Sales & Operational Analytics Dashboard.
- Live Order Status Dispatch Updater.
- Automated Low Stock Alert indicator (threshold <= 5 units).

---

## 🛠️ Tech Stack
- **Backend:** Python 3.12+, Django 5.x, Django REST Framework (DRF), SimpleJWT
- **Frontend:** HTML5, CSS3, JavaScript (ES6+), Bootstrap 5.3, Bootstrap Icons
- **Database:** SQLite 3 (pre-seeded with hardware inventory)
- **Email Service:** Google SMTP Relay (TLS 587)

---

## 💻 Installation & Local Run

### Quick Start (Windows)
Double-click `run_server.bat` in the project root to start the server automatically at `http://127.0.0.1:8000/`.

### Manual Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/chaisakphukoet-art/67310072-Web-Programming-Final.git
   cd 67310072-Web-Programming-Final
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the development server:
   ```bash
   python manage.py runserver 127.0.0.1:8000
   ```
4. Open your browser and navigate to:
   ```
   http://127.0.0.1:8000/
   ```

---

## 🔑 Test Accounts

| Role | Username | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `adminpassword123` | Full Inventory CRUD & Analytics Dashboard |
| **Member** | `Chai` | `userpassword123` | Catalog, Cart, Checkout, My Orders |

---

## 📷 Screenshots
All 14 comprehensive function screenshots are available in the [`screenshots/`](./screenshots) directory.
