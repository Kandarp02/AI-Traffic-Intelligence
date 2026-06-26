import streamlit as st
import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO
import time

# Page config
st.set_page_config(
    page_title="AI Traffic Intelligence",
    page_icon="🚦",
    layout="wide"
)

st.title("🚦 AI Traffic Intelligence System")
st.markdown("Real-time traffic detection using YOLOv8")

# Sidebar
st.sidebar.header("Configuration")
confidence_threshold = st.sidebar.slider("Confidence Threshold", 0.0, 1.0, 0.40, 0.05)
model_path = st.sidebar.text_input("Model Path", "yolov8n.pt")

# Load model
@st.cache_resource
def load_model(model_path):
    try:
        return YOLO(model_path)
    except Exception as e:
        st.error(f"Failed to load model: {e}")
        return None

model = load_model(model_path)

if model is None:
    st.error("Model not loaded. Please check the model path.")
    st.stop()

# Video upload
st.header("Video Input")
video_file = st.file_uploader("Upload traffic video", type=['mp4', 'avi', 'mov'])

if video_file is None:
    st.info("Please upload a video file to start detection")
    st.stop()

# Save uploaded video temporarily
temp_video = f"temp_{video_file.name}"
with open(temp_video, "wb") as f:
    f.write(video_file.getbuffer())

# Video processing
st.header("Detection Results")

# Create video capture
cap = cv2.VideoCapture(temp_video)

if not cap.isOpened():
    st.error("Could not open video file")
    st.stop()

# Get video properties
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
fps = cap.get(cv2.CAP_PROP_FPS)
duration = total_frames / fps

st.info(f"Video: {total_frames} frames, {fps:.2f} FPS, {duration:.2f} seconds")

# Process video
frame_placeholder = st.empty()
stats_placeholder = st.empty()

vehicle_classes = {
    0: "Person", 1: "Bicycle", 2: "Car", 3: "Motorcycle",
    5: "Bus", 7: "Truck"
}

frame_count = 0
total_vehicles = 0
vehicle_counts = {v: 0 for v in vehicle_classes.values()}

# Process button
if st.button("Start Detection"):
    progress_bar = st.progress(0)
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        # Run detection
        results = model(frame, conf=confidence_threshold, verbose=False)
        
        # Count vehicles
        frame_vehicles = 0
        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    if cls_id in vehicle_classes:
                        vehicle_name = vehicle_classes[cls_id]
                        vehicle_counts[vehicle_name] += 1
                        frame_vehicles += 1
                        
                        # Draw bounding box
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
        
        total_vehicles += frame_vehicles
        frame_count += 1
        
        # Convert BGR to RGB for display
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Display frame
        frame_placeholder.image(frame_rgb, channels="RGB", use_column_width=True)
        
        # Update stats
        stats_text = f"""
        **Detection Statistics:**
        - Frames processed: {frame_count}/{total_frames}
        - Total vehicles detected: {total_vehicles}
        - Vehicles per frame: {frame_vehicles}
        
        **Vehicle Types:**
        """
        for vtype, count in vehicle_counts.items():
            if count > 0:
                stats_text += f"- {vtype}: {count}\n"
        
        stats_placeholder.markdown(stats_text)
        
        # Update progress
        progress = frame_count / total_frames
        progress_bar.progress(progress)
        
        # Control speed
        time.sleep(0.05)
        
        # Stop after 100 frames for demo
        if frame_count >= 100:
            st.warning("Demo mode: Stopped after 100 frames")
            break
    
    cap.release()
    st.success(f"Detection complete! Total vehicles: {total_vehicles}")

# Cleanup
if Path(temp_video).exists():
    Path(temp_video).unlink()
