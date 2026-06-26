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

**Recommended Solutions for Python Backend:**
1. **Google Cloud Run** - Scalable container deployment with GPU support
2. **AWS EC2** - Full control over resources
3. **DigitalOcean Droplets** - Affordable VPS with good performance
4. **Railway.app** - Paid tier supports ML workloads

## Current Deployment Architecture

For this project, the recommended architecture is:

```
Frontend (Vercel)
    ↓
Node.js Backend (Render - Static Mode Only)
```

**Note:** The AI mode with YOLOv8 processing is not available in this deployment configuration due to resource constraints.

## Frontend Configuration Update

After deploying the Node.js backend to Render, update the frontend to connect to it:

1. Find the Socket.IO connection in your React app
2. Update the URL from `localhost:5000` to your Render URL
3. Example: `https://traffic-node-backend.onrender.com`

## Environment Variables Summary

**Node.js Backend (Render):**
- `NODE_ENV`: `production`
- `NODE_API_PORT`: `5000`
- `DEFAULT_MODE`: `STATIC` (AI mode requires Python backend)
- `STATIC_CYCLE_TIME`: `30`
- `YELLOW_TIME`: `3`
- `PORT`: `5000`

## Next Steps

1. ✅ Deploy frontend to Vercel
2. ✅ Deploy Node.js backend to Render (static mode)
3. Update frontend Socket.IO connection URL
4. Test the deployed application
5. For AI mode: Deploy Python backend to a cloud provider with ML support

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
