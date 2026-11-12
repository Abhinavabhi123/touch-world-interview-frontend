# TouchWorld Frontend

Angular 22 Agile Kanban Board & Capacity Planning Application.

---

## 📦 Prerequisites

Make sure you have the following installed:
- **Node.js**: `v18.x` or higher (recommended: Node `v20+` or `v22+`)
- **npm**: `v9.x` or higher

---

## 🚀 Setup & Running the Application

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm start
```
> Alternatively, you can run `npx ng serve` or `ng serve`.

### 3. Open in Browser
Navigate to **`http://localhost:4200/`**.
The app will automatically redirect to `/login` if you are not signed in.

---

## 🔑 Default Login Credentials

Use the following test credentials to sign in to the Admin Dashboard:

- **Email**: `admin@test.com`
- **Password**: `Admin@123`

---

## 🌐 Environment Configuration

The backend API URL is configured in `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  authUrl: 'http://localhost:3000/api/admin/login'
};
```

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm start` | Starts the local dev server on `http://localhost:4200/` |
| `npm run build` | Compiles the production build into the `dist/` directory |
| `npm test` | Runs unit tests using the Vitest test runner |
| `npm run watch` | Builds in development mode with continuous file watching |
