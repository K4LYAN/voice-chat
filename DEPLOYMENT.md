# Deployment Guide

This guide will help you deploy the Voice Chat application for free using **Render** (Backend) and **Vercel** (Frontend).

## Prerequisites

- [GitHub Account](https://github.com/)
- [Render Account](https://render.com/)
- [Vercel Account](https://vercel.com/)
- [Redis Cloud Account](https://redis.com/try-free/) (Free tier) - *Required because Render's free Redis is not persistent and free tier web services spin down.*

---

## Part 1: Backend Deployment (Render)

1.  **Push your code to GitHub**: Ensure this project is in a GitHub repository.

2.  **Set up Redis**:
    - Go to [Redis Cloud](https://redis.com/try-free/) and create a free account.
    - Create a new subscription (Free).
    - Create a new database.
    - Copy the **Public Endpoint** URL (e.g., `redis://default:password@redis-12345.c1.us-east1-2.gce.cloud.redislabs.com:12345`).

3.  **Deploy on Render**:
    - Log in to [Render Dashboard](https://dashboard.render.com/).
    - Click **New +** -> **Web Service**.
    - Connect your GitHub repository.
    - **Name**: `voice-chat-backend` (or similar).
    - **Language**: `Node`.
    - **Branch**: `main` (or your default branch).
    - **Root Directory**: `.` (leave empty).
    - **Build Command**: `npm install`.
    - **Start Command**: `node server.js`.
    - **Instance Type**: `Free`.
    - **Environment Variables** (Click 'Advanced' or 'Environment'):
        - Add `REDIS_URL`: Paste your Redis Cloud URL from step 2.
        - Add `NODE_VERSION`: `18.17.0` (or higher).
    - Click **Create Web Service**.

4.  **Wait for Deploy**: Even if it says "Live", it might take a minute.
5.  **Copy Backend URL**: Once deployed, copy the URL (e.g., `https://voice-chat-backend.onrender.com`). You will need this for the frontend.

---

## Part 2: Frontend Deployment (Vercel)

1.  **Log in to Vercel**: Go to [vercel.com](https://vercel.com).

2.  **Import Project**:
    - Click **Add New** -> **Project**.
    - Select your GitHub repository.

3.  **Configure Project**:
    - **Framework Preset**: Vercel should auto-detect `Vite` or `Create React App`. If not, select `Vite` (based on your `index.html` location, but since this is webpack, it might default to `Other`. Just ensure settings are correct).
    - **Root Directory**: Click `Edit` and select `client`. **This is important!**
    - **Build Command**: `npm run build` (Default).
    - **Output Directory**: `dist` (Default).
    - **Environment Variables**:
        - Key: `VITE_SERVER_URL`
        - Value: Your **Render Backend URL** (e.g., `https://voice-chat-backend.onrender.com`). *Note: No trailing slash is best.*

4.  **Deploy**: Click **Deploy**.

5.  **Success**: Vercel will build and deploy your site. You will get a production URL (e.g., `https://voice-chat-client.vercel.app`).

---

## Troubleshooting

-   **Backend connection issues**: Open the browser console (F12) on your deployed frontend. If you see connection errors, check:
    -   Did you mistakenly add a trailing slash to `VITE_SERVER_URL`?
    -   Is the Render backend "Awake"? (Free tier spins down after inactivity. It might take 50s to wake up on first load).
-   **Redis errors**: Check the Render logs. Ensure your `REDIS_URL` is correct and includes the password.
