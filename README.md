# NotumAi - Professional AI Annotation Tool

**NotumAi** is a professional-grade image annotation tool designed to streamline the creation of high-quality computer vision datasets. Built with a modern **Electron** frontend and a powerful **Python (FastAPI)** backend, it integrates the state-of-the-art **Segment Anything Model 2 (SAM 2)** to provide AI-assisted annotation capabilities.

## 🚀 Project Motive

Creating accurate segmentation masks and bounding boxes for computer vision training data is often a tedious and time-consuming process. NotumAi aims to solve this by:
*   **Leveraging AI**: Using SAM 2 to automatically generate precise polygon masks from simple point clicks.
*   **Providing a Modern UI**: A sleek, dark-themed interface built with web technologies for cross-platform compatibility.
*   **Ensuring Data Privacy**: All processing happens locally on your machine. No images are sent to the cloud.

## ✨ Features

*   **AI-Assisted Segmentation**: Click on an object, and SAM 2 instantly generates a polygon mask.
*   **Project Management**: Organize your datasets into projects with persistent state.
*   **Multi-Class Support**: Define and manage custom classes for your annotations.
*   **Export Options**: Export annotations in standard formats like COCO, YOLO, and Pascal VOC.
*   **Local Processing**: Full privacy and control over your data.

## 🏗️ Project Flow & Architecture

The application consists of two main components:

1.  **Frontend (ElectronClient)**:
    *   Responsibilities: User Interface, Image Visualization, Interaction Handling (Clicks, Keybinds), Project Management UI.
    *   Tech Stack: Electron, HTML5, CSS3, JavaScript (Vanilla).
    *   Communication: Sends HTTP requests to the Python backend.

2.  **Backend (PythonServer)**:
    *   Responsibilities: API Handling, Running the SAM 2 Model, Database Management, File I/O.
    *   Tech Stack: Python, FastAPI, Uvicorn, PyTorch, OpenCV, SQLite.
    *   AI Model: Segment Anything Model 2 (SAM 2.1).

**Workflow**:
1.  User starts the Python Backend (loads the AI model).
2.  User starts the Electron Frontend.
3.  User creates a project and imports images.
4.  User clicks on an image -> Frontend sends coordinates to Backend.
5.  Backend (SAM 2) infers the mask -> Returns polygon points to Frontend.
6.  Frontend displays the result -> User can accept/edit/reject.

## 📦 Installation

### Prerequisites
*   **Node.js** (v16 or higher)
*   **Python** (v3.10 or higher)
*   **CUDA-capable GPU** (Recommended for real-time AI performance, though CPU is supported)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/notum-ai.git
cd notum-ai
```

### 2. Backend Setup (PythonServer)

Navigate to the server directory:
```bash
cd PythonServer
```

Create a virtual environment (recommended):
```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:
```bash
pip install -r requirements.txt
```
*Note: This will install the local copy of `segment-anything-2` in editable mode.*

**Download Model Checkpoints**:
1.  Download the `sam2.1_hiera_small.pt` model checkpoint from the [SAM 2 repository](https://github.com/facebookresearch/segment-anything-2).
2.  Place it in `PythonServer/checkpoints/sam2.1_hiera_small.pt`.
    *   *Note: Ensure the folder `checkpoints` exists.*

### 3. Frontend Setup (ElectronFrontend)

Open a new terminal and navigate to the frontend directory:
```bash
cd ../ElectronFrontend
```

Install Node.js dependencies:
```bash
npm install
```

## 🖥️ Usage

You need to run both the backend and the frontend.

**Step 1: Start the Backend**
In your Python terminal (with venv activated):
```bash
cd PythonServer
python main.py
```
*You should see "Uvicorn running on http://127.0.0.1:8009"* and "SAM2 Model loaded successfully".

**Step 2: Start the Frontend**
In your Node.js terminal:
```bash
cd ElectronFrontend
npm start
```
The application window should open.

## 🤝 Contributing

Contributions are welcome! Please read the [CONTRIBUTING.md](CONTRIBUTING.md) file for details on our code of conduct, and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💖 Acknowledgments

*   [Meta AI (FAIR)](https://ai.meta.com/research/) for the Segment Anything Model 2.
*   [FastAPI](https://fastapi.tiangolo.com/) for the high-performance backend.
*   [Electron](https://www.electronjs.org/) for the cross-platform desktop framework.
