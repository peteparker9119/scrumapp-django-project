# ScrumFlow — Django Edition

A full-stack agile project management platform built for the EMIS team, powered by **Django 5.2** + **React 18 (Vite)**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 5.2, Django REST Framework, djangorestframework-simplejwt |
| Frontend | React 18, Vite, Axios, React Router v6, Chart.js, React Toastify |
| Database | MySQL 8 (`scrum_app`) |
| Auth | JWT (access + refresh tokens), bcrypt password hashing |

---

## Features

- **EMIS Hierarchy Login** — roles auto-derived from employee level (L0=Admin, L1=Product Manager, L2=Scrum Master, Lead=Scrum Master)
- **Multi-role support** — users can hold more than one role (e.g. Scrum Master + Product Manager)
- **Projects** — create and manage scrum projects
- **Sprint Planning** — plan sprints with capacity management per team member
- **Backlog Management** — prioritized backlog with drag-and-drop reordering
- **Bug Tracking** — full bug lifecycle with severity, priority, SLA and environment tracking
- **Retrospectives** — 3-column retro board (Went Well / Improvement / Action Items) with voting and publish flow
- **Velocity & Reports** — sprint velocity charts, bug trends, team stats

---

## Project Structure

```
scrumflow-django/
├── backend/                  # Django 5.2 API
│   ├── config/               # Settings, URLs, WSGI
│   ├── api/
│   │   ├── models.py         # Unmanaged models (existing MySQL tables)
│   │   ├── authentication.py # JWT + bcrypt + EMIS role derivation
│   │   ├── views/
│   │   │   ├── auth.py       # Login, Register, Me, ChangePassword
│   │   │   ├── projects.py
│   │   │   ├── sprints.py
│   │   │   ├── backlog.py
│   │   │   ├── bugs.py
│   │   │   ├── retro.py
│   │   │   └── reports.py
│   │   └── urls.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/                 # React 18 + Vite
    ├── src/
    │   ├── pages/            # All page components
    │   ├── components/       # Layout, shared components
    │   ├── context/          # AuthContext, ProjectContext
    │   └── services/api.js   # Axios API client
    └── vite.config.js
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- MySQL 8 with a `scrum_app` database

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # fill in your DB credentials
python manage.py migrate
python manage.py runserver 8001
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev                 # runs on http://localhost:5174
```

### Default Login

Use any EMIS employee email with password `password`.

| Email | Role |
|-------|------|
| `varun@tnschools.gov.in` | Admin (L0) |
| `jones.praveen@tnschools.gov.in` | Product Manager (L1) |
| `vaseekaran@tnschools.gov.in` | Scrum Master (L2) |
| `peter.s@tnschools.gov.in` | Scrum Master + Product Manager |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login/` | Login with email + password |
| POST | `/api/auth/register/` | Register new user |
| GET | `/api/auth/me/` | Get current user profile |
| GET | `/api/projects/` | List all projects |
| GET/POST | `/api/sprints/` | List / create sprints |
| GET/POST | `/api/backlog/` | List / create backlog items |
| GET/POST | `/api/bugs/` | List / create bugs |
| POST | `/api/retrospectives/` | Get or create retrospective |
| GET | `/api/reports/velocity/` | Sprint velocity data |
| GET | `/api/health/` | Health check |

---

## Environment Variables

```env
SECRET_KEY=your-secret-key
DEBUG=True
DB_NAME=scrum_app
DB_USER=root
DB_PASSWORD=
DB_HOST=localhost
DB_PORT=3306
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
CORS_ALLOWED_ORIGINS=http://localhost:5174
```

---

## License

MIT
