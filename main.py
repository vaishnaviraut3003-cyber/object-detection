from flask import Flask, render_template, Response, jsonify
import cv2
import time
from ultralytics import YOLO

app = Flask(__name__)

# Load YOLOv8s
model = YOLO("yolov8s.pt")

camera = cv2.VideoCapture(0)

# Detection information
detection_data = {
    "status": "Active",
    "object_count": 0,
    "objects": [],
    "fps": 0
}

running = True
previous_time = time.time()


def generate_frames():
    global detection_data
    global previous_time

    while True:

        if not running:
            time.sleep(0.1)
            continue

        success, frame = camera.read()

        if not success:
            break

        # YOLO detection
        results = model(frame, conf=0.5, verbose=False)

        result = results[0]

        # Get detected objects
        objects = []

        if result.boxes is not None:
            for box in result.boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                object_name = model.names[class_id]
                objects.append({
                    "name": object_name,
                    "confidence": round(confidence * 100, 1)
                })

        # Calculate FPS
        current_time = time.time()
        fps = 1 / (current_time - previous_time)
        previous_time = current_time

        # Update detection data
        detection_data = {
            "status": "Active",
            "object_count": len(objects),
            "objects": objects,
            "fps": round(fps, 1)
        }

        # Draw bounding boxes
        annotated_frame = result.plot()

        # Encode frame
        success, buffer = cv2.imencode(".jpg", annotated_frame)

        if not success:
            continue

        frame_bytes = buffer.tobytes()

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + frame_bytes
            + b"\r\n"
        )


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/video_feed")
def video_feed():
    return Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


@app.route("/stats")
def stats():
    return jsonify(detection_data)


@app.route("/start")
def start_detection():
    global running
    running = True

    detection_data["status"] = "Active"

    return jsonify({"status": "Active"})


@app.route("/stop")
def stop_detection():
    global running
    running = False

    detection_data["status"] = "Stopped"
    detection_data["object_count"] = 0
    detection_data["objects"] = []

    return jsonify({"status": "Stopped"})


if __name__ == "__main__":
    app.run(debug=True)