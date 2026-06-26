---
title: AI Traffic Intelligence
emoji: 🚦
colorFrom: blue
colorTo: red
sdk: docker
pinned: false
license: mit
---

# AI Traffic Intelligence - Python Backend

This is the Python backend for AI traffic detection using YOLOv8.

## Deployment on Hugging Face Spaces

This Space is configured to run the YOLOv8 traffic detection system on Hugging Face's free CPU tier.

## Features
- Real-time vehicle detection using YOLOv8
- Emergency vehicle detection (ambulance, fire brigade, police)
- Multi-lane traffic analysis
- REST API for detection results

## API Endpoints
- `GET /` - Service information
- `GET /health` - Health check
- `GET /detections` - Current detection results
- `GET /stats` - Traffic statistics
- `GET /frame/{lane_id}` - Get annotated frame for a lane
- `GET /stream/{lane_id}` - MJPEG stream for a lane

## Limitations
- Free tier has CPU only (no GPU)
- Limited RAM (16GB)
- Video processing may be slower than local deployment
- Large video files may need to be optimized

## Usage
The service automatically starts processing video feeds and provides detection results via REST API.
