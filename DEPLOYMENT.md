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

## Backend Deployment Limitations

### Node.js Backend (Socket.IO Server)
**Current Issue:** The Node.js backend uses Socket.IO for real-time WebSocket connections, which requires a persistent server. Vercel serverless functions are not suitable for this.

**Recommended Solutions:**
1. **Render.com** - Free tier available, supports WebSocket connections
2. **Railway.app** - Good for Node.js apps with WebSocket support
3. **DigitalOcean App Platform** - Scalable option
4. **AWS EC2** - Full control, but requires setup

### Python AI Backend (YOLOv8)
**Current Issue:** The Python backend uses YOLOv8 for object detection and requires:
- Persistent video processing
- GPU/CPU resources for ML inference
- Large model files (yolov8n.pt - 6.5MB)
- Video files (83MB+)

**Recommended Solutions:**
1. **Render.com** - Supports Python with resource limits
2. **Railway.app** - Good for Python ML workloads
3. **Google Cloud Run** - Scalable container deployment
4. **AWS Lambda + EFS** - For serverless ML inference (complex setup)

## Recommended Architecture for Production

For a production deployment, consider this architecture:

```
Frontend (Vercel)
    ↓
Node.js Backend (Render/Railway) - Socket.IO server
    ↓
Python AI Backend (Render/Railway) - YOLOv8 processing
```

## Temporary Solution (Demo Mode)

For demonstration purposes without full backend deployment:

1. Deploy only the frontend to Vercel
2. Use mock data in the frontend to simulate traffic detection
3. Remove real-time Socket.IO connections temporarily

## Environment Variables

When deploying backends, set these environment variables:

**Node.js Backend:**
- `DEFAULT_MODE`: AI or STATIC
- `STATIC_CYCLE_TIME`: 30 (seconds)
- `YELLOW_TIME`: 3 (seconds)
- `PYTHON_API_URL`: URL of Python backend
- `NODE_API_PORT`: 5000

**Python Backend:**
- Model paths and video sources need to be configured appropriately

## Next Steps

1. Deploy frontend to Vercel (can be done now)
2. Choose hosting provider for Node.js backend
3. Choose hosting provider for Python backend
4. Update frontend API URLs to point to deployed backends
5. Test end-to-end functionality
