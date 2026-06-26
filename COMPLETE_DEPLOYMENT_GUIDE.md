# Complete Deployment Guide - AI Traffic Intelligence System

This guide will walk you through deploying the entire AI Traffic Intelligence system step by step. No prior deployment experience required.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
3. [Backend Deployment (Render)]#backend-deployment-render)
4. [AI Backend Deployment (Hugging Face Spaces)](#ai-backend-deployment-hugging-face-spaces)
5. [Connecting Everything Together](#connecting-everything-together)
6. [Testing Your Deployment](#testing-your-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### What You'll Need:
- **GitHub Account** (Free) - https://github.com
- **Vercel Account** (Free) - https://vercel.com
- **Render Account** (Free) - https://render.com
- **Hugging Face Account** (Free) - https://huggingface.co
- **Your code** already pushed to GitHub (already done: https://github.com/Kandarp02/AI-Traffic-Intelligence)

### Time Required:
- Frontend deployment: 5-10 minutes
- Backend deployment: 10-15 minutes
- AI backend deployment: 15-20 minutes
- Total: ~30-45 minutes

---

## Frontend Deployment (Vercel)

### Step 1: Create Vercel Account
1. Go to https://vercel.com
2. Click "Sign Up" in the top right
3. Choose "Continue with GitHub" (recommended)
4. Authorize Vercel to access your GitHub account
5. Complete the signup process

### Step 2: Import Your Repository
1. After signing in, you'll see the Vercel dashboard
2. Click "Add New Project" button (top left)
3. You'll see a list of your GitHub repositories
4. Find "AI-Traffic-Intelligence" in the list
5. Click "Import" button next to it

### Step 3: Configure Project Settings
Vercel will automatically detect your project configuration:

**Framework Preset:** Vite (should be auto-detected)
**Root Directory:** `./` (leave as default)
**Build Command:** `cd traffic-system && npm install && npm run build` (auto-detected from vercel.json)
**Output Directory:** `traffic-system/dist` (auto-detected from vercel.json)

### Step 4: Environment Variables (Not needed for frontend)
The frontend doesn't require environment variables, so you can skip this step.

### Step 5: Deploy
1. Click the "Deploy" button at the bottom
2. Wait for the deployment to complete (1-2 minutes)
3. You'll see a progress bar with build logs
4. Once complete, you'll see a "Congratulations!" message

### Step 6: Save Your URL
1. Copy the deployment URL (e.g., `https://ai-traffic-intelligence.vercel.app`)
2. Save this URL - you'll need it later
3. Click "Visit" to see your deployed frontend

**✅ Frontend Deployment Complete!**

---

## Backend Deployment (Render)

### Step 1: Create Render Account
1. Go to https://render.com
2. Click "Sign Up" in the top right
3. Choose "Sign up with GitHub" (recommended)
4. Authorize Render to access your GitHub account
5. Complete the signup process

### Step 2: Connect Your GitHub Repository
1. After signing in, you'll see the Render dashboard
2. Click "New + " button in the top right
3. Select "Web Service" from the dropdown

### Step 3: Configure Web Service

**Repository:**
- Click "Connect" under "Connect a GitHub repository"
- Find "AI-Traffic-Intelligence" in the list
- Click "Connect"

**Basic Settings:**
- **Name:** `traffic-node-backend`
- **Region:** Leave as default (closest to you)
- **Branch:** `master` (or `main`)

**Build & Deploy:**
- **Runtime:** `Node`
- **Build Command:** `cd backend/node && npm install`
- **Start Command:** `cd backend/node && npm start`

### Step 4: Add Environment Variables
Scroll down to "Advanced" section, then "Environment Variables":

Click "Add Environment Variable" and add these one by one:

1. **Key:** `NODE_ENV`
   **Value:** `production`

2. **Key:** `NODE_API_PORT`
   **Value:** `5000`

3. **Key:** `DEFAULT_MODE`
   **Value:** `STATIC`

4. **Key:** `STATIC_CYCLE_TIME`
   **Value:** `30`

5. **Key:** `YELLOW_TIME`
   **Value:** `3`

6. **Key:** `PORT`
   **Value:** `5000`

### Step 5: Select Plan
- **Plan:** Free (selected by default)
- **Instance Type:** Free

### Step 6: Deploy
1. Click "Create Web Service" at the bottom
2. Wait for deployment to complete (3-5 minutes)
3. You'll see live logs showing the build process
4. Once complete, the status will change to "Live"

### Step 7: Save Your URL
1. Copy the service URL (e.g., `https://traffic-node-backend.onrender.com`)
2. Save this URL - you'll need it for connecting the frontend
3. Click the URL to test it (you should see a JSON response)

**✅ Backend Deployment Complete!**

---

## AI Backend Deployment (Hugging Face Spaces)

### Step 1: Create Hugging Face Account
1. Go to https://huggingface.co
2. Click "Sign Up" in the top right
3. Fill in your details (email, password, username)
4. Verify your email address
5. Complete the signup process

### Step 2: Create a New Space
1. After signing in, click your profile picture (top right)
2. Select "New Space" from the dropdown
3. You'll be taken to the Space creation page

### Step 3: Configure Space Settings

**Space Details:**
- **Owner:** Your username (auto-filled)
- **Space name:** `traffic-ai-backend` (or any name you prefer)
- **License:** MIT (recommended)
- **Make your space public:** ✅ (check this box)

**Hardware:**
- **Space SDK:** Docker
- **Hardware:** CPU Basic (Free) - This is the default free option

**Repository:**
- **Git repository:** Select "Clone an existing repository"
- **Repository:** `https://github.com/Kandarp02/AI-Traffic-Intelligence`
- **Branch:** `master` (or `main`)

### Step 4: Configure Docker Settings
Since we're using Docker, Hugging Face will look for a Dockerfile. We've provided one in the `huggingface-space/` directory.

However, we need to tell Hugging Face to use that specific directory. Add this in the "Docker settings" section:

- **Dockerfile path:** `huggingface-space/Dockerfile`
- **Build context path:** `.` (root directory)

### Step 5: Create Space
1. Click "Create Space" button
2. Hugging Face will clone your repository and start building
3. Wait for the build to complete (10-15 minutes)
4. You'll see build logs in the "Logs" tab

### Step 6: Monitor Build Process
1. Click on the "Logs" tab
2. Watch for any errors during the build
3. The build will:
   - Install system dependencies
   - Install Python packages
   - Copy your application code
   - Start the FastAPI server

### Step 7: Test Your Space
1. Once the build is complete, you'll see a "Running" status
2. Click the "Embed this Space" button to get your URL
3. Copy the Space URL (e.g., `https://your-username-traffic-ai-backend.hf.space`)
4. Save this URL - you'll need it for the Node.js backend

### Step 8: Verify API Endpoints
Test that your AI backend is working:

1. Visit: `https://your-space-url.hf.space/`
2. You should see a JSON response with service information
3. Visit: `https://your-space-url.hf.space/health`
4. You should see health status information

**✅ AI Backend Deployment Complete!**

---

## Connecting Everything Together

Now we need to connect all the services so they can communicate with each other.

### Step 1: Update Node.js Backend to Connect to AI Backend

1. Go to your Render dashboard
2. Find your `traffic-node-backend` service
3. Click on it to open the service details
4. Scroll down to "Environment Variables"
5. Click "Add Environment Variable"

Add this variable:
- **Key:** `PYTHON_API_URL`
- **Value:** Your Hugging Face Space URL (e.g., `https://your-username-traffic-ai-backend.hf.space`)

6. Change the `DEFAULT_MODE` variable:
- **Key:** `DEFAULT_MODE`
- **Value:** `AI` (change from `STATIC` to `AI`)

7. Click "Save Changes"
8. Render will automatically restart your service with the new configuration

### Step 2: Update Frontend to Connect to Node.js Backend

1. Go to your project on your computer
2. Open the file: `traffic-system/src/App.jsx` (or similar file where Socket.IO is connected)
3. Find the line that connects to Socket.IO (look for `io.connect`)
4. Change the URL from `http://localhost:5000` to your Render backend URL

Example change:
```javascript
// Before:
const socket = io.connect('http://localhost:5000');

// After:
const socket = io.connect('https://traffic-node-backend.onrender.com');
```

5. Save the file
6. Commit and push the changes to GitHub:
```bash
git add traffic-system/src/App.jsx
git commit -m "Update Socket.IO connection to production URL"
git push
```

7. Vercel will automatically redeploy with the new configuration

### Step 3: Verify Connections

**Test Node.js Backend:**
1. Visit your Render backend URL
2. Add `/status` to the URL: `https://traffic-node-backend.onrender.com/status`
3. You should see JSON with system state

**Test AI Backend:**
1. Visit your Hugging Face Space URL
2. Add `/detections` to the URL: `https://your-space-url.hf.space/detections`
3. You should see JSON with detection data

---

## Testing Your Deployment

### Step 1: Test Frontend
1. Visit your Vercel frontend URL
2. The traffic dashboard should load
3. You should see the 2x2 video grid
4. Traffic signals should be visible

### Step 2: Test Real-time Updates
1. Watch the traffic signals changing
2. In AI mode, they should change based on vehicle detection
3. In Static mode, they should change on a timer

### Step 3: Test Emergency Detection (AI Mode)
1. If you have emergency vehicle videos, the system should detect them
2. The dashboard should show emergency alerts
3. Traffic signals should prioritize emergency lanes

### Step 4: Monitor Logs
**Render Logs:**
1. Go to Render dashboard
2. Click on your backend service
3. Click "Logs" tab
4. Look for any errors or connection issues

**Hugging Face Logs:**
1. Go to your Hugging Face Space
2. Click "Logs" tab
3. Monitor for any detection or processing errors

**Vercel Logs:**
1. Go to Vercel dashboard
2. Click on your project
3. Click "Deployments" tab
4. Click on the latest deployment
5. View build and function logs

---

## Troubleshooting

### Frontend Issues

**Problem:** Frontend shows blank screen
- **Solution:** Check Vercel deployment logs for build errors
- **Solution:** Verify all dependencies are in package.json

**Problem:** Frontend can't connect to backend
- **Solution:** Verify Socket.IO URL is correct in your code
- **Solution:** Check that backend is running (visit Render dashboard)
- **Solution:** Check browser console for connection errors

### Backend Issues

**Problem:** Backend deployment fails
- **Solution:** Check Render logs for specific error messages
- **Solution:** Verify build and start commands are correct
- **Solution:** Ensure all dependencies are in package.json

**Problem:** Backend can't connect to AI backend
- **Solution:** Verify PYTHON_API_URL environment variable is correct
- **Solution:** Check that AI backend is running (visit Hugging Face Space)
- **Solution:** Check Render logs for connection errors

### AI Backend Issues

**Problem:** Hugging Face Space build fails
- **Solution:** Check Dockerfile path is correct: `huggingface-space/Dockerfile`
- **Solution:** Verify all dependencies are in requirements.txt
- **Solution:** Check build logs for specific errors

**Problem:** AI backend returns errors
- **Solution:** Check that video files are accessible
- **Solution:** Verify YOLO model file path is correct
- **Solution:** Check Hugging Face logs for processing errors

**Problem:** Detection is very slow
- **Solution:** This is normal on CPU-only free tier
- **Solution:** Consider upgrading to GPU tier for faster processing
- **Solution:** Reduce video resolution or frame rate

### General Issues

**Problem:** Services not communicating
- **Solution:** Verify all URLs are correct
- **Solution:** Check firewall/security settings
- **Solution:** Ensure all services are in "Running" state

**Problem:** High latency
- **Solution:** Choose regions closest to your users
- **Solution:** Optimize video file sizes
- **Solution:** Consider using CDN for static assets

---

## Alternative: Streamlit Deployment (Simpler)

If the full deployment seems too complex, you can deploy just the Streamlit demo:

### Streamlit Deployment Steps:

1. **Create Streamlit Account**
   - Go to https://streamlit.io
   - Click "Sign up"
   - Connect your GitHub account

2. **Deploy Your App**
   - Go to https://share.streamlit.io
   - Click "New app"
   - Select your repository: `Kandarp02/AI-Traffic-Intelligence`
   - Main file path: `streamlit-app/app.py`
   - Click "Deploy"

3. **Test Your App**
   - Wait for deployment (2-3 minutes)
   - Upload a video file
   - See real-time detection results

This is much simpler but provides a simplified interface instead of the full dashboard.

---

## Summary

You now have:
- ✅ Frontend deployed to Vercel
- ✅ Backend deployed to Render
- ✅ AI backend deployed to Hugging Face Spaces
- ✅ All services connected and working

Your AI Traffic Intelligence system is now live and accessible from anywhere in the world!

---

## Next Steps

1. **Monitor your services** regularly
2. **Set up alerts** for service failures
3. **Optimize performance** based on usage
4. **Consider upgrades** if you need more resources
5. **Add monitoring** tools like Google Analytics

---

## Cost Summary

- **Vercel:** Free (Hobby plan)
- **Render:** Free (Web Service free tier)
- **Hugging Face Spaces:** Free (CPU Basic)
- **Total Cost:** $0/month

**Note:** Free tiers have limitations. If you exceed them, you may need to upgrade to paid plans.

---

## Support

If you encounter issues:
1. Check the logs of each service
2. Refer to the troubleshooting section above
3. Check the documentation of each platform
4. Search for similar issues in community forums

---

Congratulations! 🎉
You've successfully deployed a full-stack AI application with multiple services!
