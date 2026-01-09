# uO Hackathon 2026

Hackathon project repository for uOttawa Hackathon 2026.

This repo is set up for **fast team collaboration**, clean Git workflows, and quick demos.

---

## 🚀 Tech Stack
- **Frontend:** React + Vite
- **Version Control:** Git + GitHub
- **Backend / DB:** TBD (Firebase / API if needed)

---

## 🧑‍🤝‍🧑 Team Git Workflow (IMPORTANT)

### Branches
- **`main`** → Stable demo branch (must always run)
- **`dev`** → Main working / integration branch
- **`feature/*`** → Individual feature branches

**Rules**
- ❌ Do NOT commit directly to `main`
- ✅ All work happens on `feature/*`
- ✅ Merge features into `dev`
- ✅ Only merge `dev` → `main` when demo-ready

---

## 🛠️ First-Time Setup

### Clone the repo
```bash
git clone git@github.com:Ajay757/uO-hackathon2026.git
cd uO-hackathon2026

---

### Install Dependecies
npm install
npm run dev
App runs at localhost


# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
