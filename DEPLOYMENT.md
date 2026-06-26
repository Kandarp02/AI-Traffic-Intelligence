# Deployment Guide

## Vercel Frontend Deployment

The React frontend can be deployed to Vercel. Follow these steps:

### Prerequisites
- Vercel account
- GitHub repository connected to Vercel

### Deployment Steps

1. **Push to GitHub** (already done)
   - Repository: https://github.com/Kandarp02/AI-Traffic-Intelligence

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will automatically detect the `vercel.json` configuration
   - Click "Deploy"

### Vercel Configuration
The `vercel.json` file is configured to:
- Build the React app from `traffic-system/` directory
- Output to `traffic-system/dist`
- Handle client-side routing with rewrites

## Render Backend Deployment

### Node.js Backend (Static Mode)

The Node.js backend can be deployed to Render in **STATIC mode only**. The AI mode requires Python backend integration which has resource limitations.

### Prerequisites
- Render account
- GitHub repository connected to Render

### Deployment Steps

1. **Go to Render Dashboard**
   - Visit [render.com](https://render.com)
   - Click "New +"
   - Select "Web Service"

2. **Configure Node.js Service**
   - Connect your GitHub repository
   - Name: `traffic-node-backend`
   - Runtime: Node
   - Build Command: `cd backend/node && npm install`
   - Start Command: `cd backend/node && npm start`
   - Plan: Free

3. **Environment Variables**
   - `NODE_ENV`: `production`
   - `NODE_API_PORT`: `5000`
   - `DEFAULT_MODE`: `STATIC`
   - `STATIC_CYCLE_TIME`: `30`
   - `YELLOW_TIME`: `3`
   - `PORT`: `5000`

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Copy the deployed URL (e.g., `https://traffic-node-backend.onrender.com`)

### Alternative: Using render.yaml

You can also deploy using the provided `render.yaml` file:

1. Go to Render Dashboard
2. Click "New +"
3. Select "Blueprint"
4. Connect your GitHub repository
5. Render will automatically detect `render.yaml`
6. Click "Apply"

## Backend Deployment Limitations

### Python AI Backend (YOLOv8)
**Cannot be deployed to Render free tier** due to:
- Large video files (83MB+ per video)
- Heavy ML processing requirements
- GPU/CPU resource limitations
- Memory constraints for YOLOv8 model

## Free AI/ML Deployment Options

### 1. Hugging Face Spaces (Recommended for ML)
**Pros:**
- Completely free CPU tier
- Built-in ML model support
- Easy GitHub integration
- Good for demos and prototypes
- 16GB RAM on free tier

**Cons:**
- CPU only (no GPU on free tier)
- Slower inference than GPU
- Some resource limitations

**Deployment Steps:**
1. Create a Hugging Face account at [huggingface.co](https://huggingface.co)
2. Click "Create new Space"
3. Select "Docker" as SDK
4. Connect your GitHub repository
5. Use the provided `huggingface-space/` configuration
6. The Space will automatically build and deploy

**Configuration:**
- Dockerfile included in `huggingface-space/` directory
- README.md with Space metadata
- Automatically installs dependencies and runs the FastAPI server

### 2. Streamlit Cloud (Free for Public Apps)
**Pros:**
- Free for public applications
- Built-in ML support
- Very easy deployment
- Great for interactive demos

**Cons:**
- Limited to Streamlit apps
- Resource constraints
- No custom backend support

**Deployment Steps:**
1. Create a Streamlit account at [streamlit.io](https://streamlit.io)
2. Connect your GitHub repository
3. Use the provided `streamlit-app/` configuration
4. Deploy with one click

**Configuration:**
- Streamlit app included in `streamlit-app/` directory
- Interactive UI for video upload and detection
- Simplified version of the full system

### 3. Modal (Free Credits)
**Pros:**
- Serverless functions
- GPU support available
- Pay-per-use model
- Good for sporadic ML workloads

**Cons:**
- Requires code adaptation
- Free credits limited
- Learning curve for serverless

**Deployment Steps:**
1. Create a Modal account at [modal.com](https://modal.com)
2. Install Modal CLI: `pip install modal`
3. Adapt your Python code for Modal functions
4. Deploy using Modal CLI

### 4. Beebly Cloud (Free ML Tier)
**Pros:**
- Free tier for ML workloads
- GPU support
- Container-based deployment

**Cons:**
- Newer platform
- Limited documentation
- Smaller community

**Recommended Solutions for Python Backend (Paid):**
1. **Google Cloud Run** - Scalable container deployment with GPU support
2. **AWS EC2** - Full control over resources
3. **DigitalOcean Droplets** - Affordable VPS with good performance
4. **Railway.app** - Paid tier supports ML workloads

## Current Deployment Architecture

### Option 1: Static Mode Only (Free)
```
Frontend (Vercel)
    ↓
Node.js Backend (Render - Static Mode Only)
```

### Option 2: Full AI Mode (Free)
```
Frontend (Vercel)
    ↓
Node.js Backend (Render - Static Mode)
    ↓
Python AI Backend (Hugging Face Spaces - Free CPU)
```

### Option 3: Interactive Demo (Free)
```
Streamlit App (Streamlit Cloud - Free)
    ↓
Python AI Backend (Built-in)
```

**Note:** Option 2 provides AI detection but will be slower due to CPU-only processing on Hugging Face free tier.

## Frontend Configuration Update

After deploying the Node.js backend to Render, update the frontend to connect to it:

1. Find the Socket.IO connection in your React app
2. Update the URL from `localhost:5000` to your Render URL
3. Example: `https://traffic-node-backend.onrender.com`

## Environment Variables Summary

**Node.js Backend (Render):**
- `NODE_ENV`: `production`
- `NODE_API_PORT`: `5000`
- `DEFAULT_MODE`: `STATIC` (set to `AI` if using Hugging Face backend)
- `STATIC_CYCLE_TIME`: `30`
- `YELLOW_TIME`: `3`
- `PORT`: `5000`
- `PYTHON_API_URL`: `https://your-huggingface-space.hf.space` (if using AI mode)

**Python Backend (Hugging Face Spaces):**
- `PYTHON_API_PORT`: `8000`
- `PYTHON_ENV`: `production`
- `YOLO_CONFIDENCE_THRESHOLD`: `0.40`
- `AMBULANCE_CONFIDENCE`: `0.65`

## Next Steps

### For Static Mode (Free):
1. ✅ Deploy frontend to Vercel
2. ✅ Deploy Node.js backend to Render (static mode)
3. Update frontend Socket.IO connection URL
4. Test the deployed application

### For Full AI Mode (Free):
1. ✅ Deploy frontend to Vercel
2. ✅ Deploy Node.js backend to Render
3. ✅ Deploy Python backend to Hugging Face Spaces
4. Update Node.js environment variable `PYTHON_API_URL` to Hugging Face Space URL
5. Update Node.js environment variable `DEFAULT_MODE` to `AI`
6. Update frontend Socket.IO connection URL
7. Test the deployed application

### For Interactive Demo (Free):
1. ✅ Deploy Streamlit app to Streamlit Cloud
2. Upload video files through the interface
3. Test detection interactively

## Testing the Deployment

1. Visit your Vercel frontend URL
2. The traffic dashboard should load
3. Traffic signals should operate in static mode
4. Real-time updates should work via Socket.IO

## Troubleshooting

**Frontend not connecting to backend:**
- Check that the Socket.IO URL matches your Render backend URL
- Verify the backend is running (check Render dashboard)
- Check browser console for connection errors

**Backend deployment failing:**
- Verify build and start commands in render.yaml
- Check Render logs for specific error messages
- Ensure all dependencies are in package.json
