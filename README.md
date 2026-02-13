# Internal Admin

Internal admin web application for managing meeting schedules, Google Calendar sync, drink orders, and account/room administration.

## Features

- **Dashboard** — User profile, password change, theme switching (light / dark / pink)
- **Meetings** — View meeting schedules with two-way Google Calendar sync
- **Drink orders** — Place and track drink orders
- **Account management** (admin) — User account administration
- **Room management** (admin) — Create, edit, and delete meeting rooms

## Tech stack

| Layer | Stack |
|-------|-------|
| Backend | FastAPI, SQLAlchemy, PostgreSQL, Alembic, Google OAuth / Calendar API |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Auth | Google OAuth 2.0, session cookies |

## Project structure

```
├── backend/          # FastAPI app
│   ├── app/
│   │   ├── core/      # Config, security
│   │   ├── db/        # DB connection
│   │   ├── models/    # SQLAlchemy models
│   │   ├── routers/   # API routers
│   │   ├── schemas/   # Pydantic schemas
│   │   └── services/  # Business logic, Google Calendar integration
│   ├── alembic/       # DB migrations
│   ├── scripts/       # Seed, sync, and utility scripts
│   └── tests/
└── frontend/         # React SPA
    └── src/
        ├── components/
        ├── pages/
        ├── lib/       # API client
        └── types/
```

## Local setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Environment variables**

```bash
cp .env.example .env
# Edit .env with your DB and Google OAuth credentials
```

| Variable | Description |
|----------|-------------|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection settings |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client credentials |
| `GOOGLE_REDIRECT_URI` | OAuth redirect URI (backend) |
| `FRONTEND_REDIRECT_URI` | Frontend URL after login (e.g. `http://localhost:5173`) |
| `GOOGLE_SYNC_INTERVAL_SECONDS` | Google Calendar sync interval in seconds (default 300) |
| `OAUTHLIB_INSECURE_TRANSPORT` | Set to `1` for local HTTP testing (omit in production) |

**Run**

```bash
uvicorn app.main:app --reload
```

API: `http://localhost:8000` (default)

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173` (default). Configure API base URL in `frontend/src/lib/api.ts` if needed.

### 3. DB migrations (Backend)

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
```

## Tests (Backend)

```bash
cd backend
source .venv/bin/activate
pytest
```

## Other

- **Docker**: Build backend image with `backend/Dockerfile`
- **Lambda**: Serverless deployment via `backend/app/lambda.py` and Mangum

