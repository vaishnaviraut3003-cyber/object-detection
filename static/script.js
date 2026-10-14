const objectCount = document.getElementById("objectCount");
const detectionStatus = document.getElementById("detectionStatus");
const fps = document.getElementById("fps");
const objectsList = document.getElementById("objectsList");
const topStatus = document.getElementById("topStatus");
const connectionMessage = document.getElementById("connectionMessage");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const videoFeed = document.getElementById("videoFeed");
let stateChangeInProgress = false;

function renderObjects(objects) {
    if (!objects.length) {
        const emptyState = document.createElement("div");
        emptyState.className = "empty-state";
        emptyState.textContent = "No objects detected.";
        objectsList.replaceChildren(emptyState);
        return;
    }

    const items = objects.map((object) => {
        const item = document.createElement("div");
        item.className = "object-item";

        const header = document.createElement("div");
        header.className = "object-top";

        const name = document.createElement("span");
        name.className = "object-name";
        name.textContent = object.name;

        const confidence = document.createElement("span");
        confidence.className = "confidence";
        confidence.textContent = `${object.confidence}%`;

        const progress = document.createElement("div");
        progress.className = "progress";

        const progressBar = document.createElement("div");
        progressBar.className = "progress-bar";
        progressBar.style.width = `${object.confidence}%`;

        header.append(name, confidence);
        progress.append(progressBar);
        item.append(header, progress);
        return item;
    });

    objectsList.replaceChildren(...items);
}

async function updateStats() {
    try {
        const response = await fetch("/stats");
        if (!response.ok) {
            throw new Error(`Backend returned HTTP ${response.status}.`);
        }

        const data = await response.json();
        const objects = Array.isArray(data.objects) ? data.objects : [];
        const isActive = data.status === "Active";

        objectCount.textContent = String(data.object_count ?? objects.length);
        detectionStatus.textContent = data.status || "Unknown";
        topStatus.textContent = isActive ? "System Active" : "System Stopped";
        fps.textContent = String(data.fps ?? 0);
        startButton.disabled = isActive || stateChangeInProgress;
        stopButton.disabled = !isActive || stateChangeInProgress;
        connectionMessage.textContent = "";

        renderObjects(objects.map((object) => {
            const confidence = Number(object.confidence);
            return {
                name: String(object.name || "Object"),
                confidence: Number.isFinite(confidence)
                    ? Math.min(100, Math.max(0, confidence))
                    : 0
            };
        }));
    } catch (error) {
        console.error("Could not retrieve detection data:", error);
        topStatus.textContent = "Backend unavailable";
        connectionMessage.textContent =
            "Could not retrieve detection data. Check that the Flask backend is running.";
    }
}

async function setDetectionState(action) {
    if (stateChangeInProgress) return;

    stateChangeInProgress = true;
    startButton.disabled = true;
    stopButton.disabled = true;
    connectionMessage.textContent =
        action === "start" ? "Starting detection…" : "Stopping detection…";

    let actionError = null;

    try {
        const response = await fetch(`/${action}`);
        if (!response.ok) {
            throw new Error(`Backend returned HTTP ${response.status}.`);
        }

        const data = await response.json();
        if (data.status !== (action === "start" ? "Active" : "Stopped")) {
            throw new Error("The backend did not confirm the requested state.");
        }
    } catch (error) {
        console.error(`Could not ${action} detection:`, error);
        actionError =
            `Could not ${action} detection. Check that the Flask backend is running.`;
    } finally {
        stateChangeInProgress = false;
    }

    await updateStats();
    if (actionError) {
        connectionMessage.textContent = actionError;
    }
}

startButton.addEventListener("click", () => setDetectionState("start"));
stopButton.addEventListener("click", () => setDetectionState("stop"));

videoFeed.addEventListener("error", () => {
    connectionMessage.textContent =
        "Could not load the camera feed. Check that a camera is connected and available.";
});

updateStats();
setInterval(updateStats, 500);
