import { state, loadProjectSession, saveSession, loadAnnotationsForImage, saveCurrentAnnotations, addCategory } from './state.js';
import { loadImageToBackend, segmentPoints, getProjects, createProject, deleteProject, getProjectStats, exportProjectData } from './api.js';
import { canvas, container, setInternalImage, redraw, getImgCoordinates, currentImg, setTempPolygon, setDragBox, setMousePreview, setCrosshairPos, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, zoomIn, zoomOut, resetView } from './canvas.js';
import { updateCategoryList, updateFileList, updateLayerList, showToast, setLoading } from './ui.js';
import { showCustomAlert, showCustomConfirm } from './modal_logic.js';

// ... (previous imports and vars)

// --- EXPORT LOGIC ---
window.openExportPage = async () => {
    // 1. Hide Workspace, Show Export Page
    document.getElementById("workspace").style.display = "none";
    document.getElementById("export-page").style.display = "block";

    // 2. Load Stats
    const stats = await getProjectStats(state.currentProjectId);
    if (stats) {
        document.getElementById("expTotalImages").innerText = stats.total_images || 0;
        document.getElementById("expAnnotated").innerText = stats.annotated_count || 0;
        document.getElementById("expClasses").innerText = Object.keys(stats.class_distribution || {}).length;
    }
};

window.closeExportPage = () => {
    document.getElementById("export-page").style.display = "none";
    document.getElementById("workspace").style.display = "flex";

    // Trigger resize to fix canvas layout
    window.dispatchEvent(new Event('resize'));
};

window.triggerExport = async (format) => {
    // 1. Ask for output folder (Using Electron dialog via our hacky input or IPC)
    // For now, let's just ask for a path string or default to project folder/export
    // Ideally we use IPC. Let's try to reuse the pickProjectFolder approach but for saving?
    // Actually, backend can just save to 'export/format_timestamp' in project dir.

    if (!(await showCustomConfirm(`Export data in ${format.toUpperCase()} format?`, "Export Dataset", "info"))) return;

    setLoading(true);
    const res = await exportProjectData(state.currentProjectId, format, null); // null = default path
    setLoading(false);

    if (res && res.error) {
        await showCustomAlert(res.error, "Export Failed", "error");
    } else if (res && res.path) {
        await showCustomAlert(`Export Successful!\nSaved to: ${res.path}`, "Export Complete", "success");
    } else {
        await showCustomAlert("Export finished.", "Export Complete", "success");
    }
};

// ... (rest of main.js)

let currentPoints = [];
let tempPolygon = null;
let rawFiles = [];
let pendingFolderPath = "";

// Tool State
let isDraggingBox = false;
let startBoxPoint = null;

window.setTool = (toolName) => {
    state.currentTool = toolName;

    // UI Update
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('tool-' + toolName);
    if (btn) btn.classList.add('active');

    // Reset State
    currentPoints = [];
    tempPolygon = null;
    isDraggingBox = false;
    startBoxPoint = null;

    // Cursor handling
    if (['sam', 'bbox', 'polygon'].includes(toolName)) {
        canvas.classList.add('cursor-none'); // Hide system cursor
    } else {
        canvas.classList.remove('cursor-none');
        setCrosshairPos(null); // Clear crosshair if switching to select/pan
    }

    setTempPolygon(null);
    setDragBox(null);
    setMousePreview(null);
    redraw();

    showToast(`Tool: ${toolName.toUpperCase()}`);
};

// ... (Existing Initialization code is fine, skipping lines 9-324) ...
// Actually I need to be careful with ReplaceFileContent.
// The user asked to replace `container.onmouseup` and logic. So I will target that block.

// --- CANVAS INTERACTION ---

container.onmousedown = (e) => {
    if (handleCanvasMouseDown(e)) return;
    if (e.button !== 0 || !currentImg) return;

    const p = getImgCoordinates(e);

    if (state.currentTool === 'bbox') {
        isDraggingBox = true;
        startBoxPoint = p;
        setDragBox({ x: p.x, y: p.y, w: 0, h: 0 });
    }
};

container.onmousemove = (e) => {
    if (handleCanvasMouseMove(e)) return;

    // Update Crosshair (Raw Canvas Coords)
    if (['sam', 'bbox', 'polygon'].includes(state.currentTool)) {
        const rect = canvas.getBoundingClientRect();
        setCrosshairPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    } else {
        setCrosshairPos(null);
    }

    // Tool Previews
    if (!currentImg) return;
    const p = getImgCoordinates(e);

    if (state.currentTool === 'bbox' && isDraggingBox) {
        const w = p.x - startBoxPoint.x;
        const h = p.y - startBoxPoint.y;
        setDragBox({ x: startBoxPoint.x, y: startBoxPoint.y, w, h });
    } else if (state.currentTool === 'polygon') {
        setMousePreview(p);
    }
};

container.onmouseleave = () => {
    setCrosshairPos(null);
};

container.onmouseup = async (e) => {
    const wasBusy = handleCanvasMouseUp(e);
    if (wasBusy) return;

    if (e.button !== 0 || !currentImg) return;
    const p = getImgCoordinates(e);

    // SAM TOOL
    if (state.currentTool === 'sam') {
        currentPoints.push(p);
        await updateSegmentation();
    }
    // BBOX TOOL
    else if (state.currentTool === 'bbox') {
        if (isDraggingBox) {
            isDraggingBox = false;
            const w = p.x - startBoxPoint.x;
            const h = p.y - startBoxPoint.y;

            // Create Box Polygon (TopLeft, TopRight, BottomRight, BottomLeft)
            if (Math.abs(w) > 5 && Math.abs(h) > 5) {
                const x1 = startBoxPoint.x;
                const y1 = startBoxPoint.y;
                const x2 = p.x;
                const y2 = p.y;

                // Ensure consistent winding order if needed, but for drawing it doesn't matter
                // Just 4 corners
                // Use min/max to ensure rectangle
                const minX = Math.min(x1, x2);
                const minY = Math.min(y1, y2);
                const maxX = Math.max(x1, x2);
                const maxY = Math.max(y1, y2);

                const poly = [
                    { x: minX, y: minY },
                    { x: maxX, y: minY },
                    { x: maxX, y: maxY },
                    { x: minX, y: maxY }
                ];

                tempPolygon = poly;
                setTempPolygon(poly);
            }
            setDragBox(null);
        }
    }
    // POLYGON TOOL
    else if (state.currentTool === 'polygon') {
        currentPoints.push(p);
        // Live update the temp polygon
        tempPolygon = [...currentPoints];
        setTempPolygon(tempPolygon);
    }
};

async function updateSegmentation() {
    // If no points left, clear temp polygon
    if (currentPoints.length === 0) {
        tempPolygon = null;
        setTempPolygon(null);
        redraw(null, []);
        return;
    }

    setLoading(true);
    const data = await segmentPoints(currentPoints, state.images[state.lastIndex]);
    setLoading(false);

    if (data && data.error) {
        showToast(data.error, "error");
        return;
    }

    if (data && data.polygon) {
        tempPolygon = data.polygon;
        setTempPolygon(tempPolygon, data.score);
    }
    redraw(tempPolygon, currentPoints);
}

// --- INITIALIZATION ---
// Define these immediately to avoid ReferenceError in HTML
window.showNewProjectModal = () => {
    document.getElementById("newProjectModal").style.display = "flex";
};

window.closeModal = () => {
    document.getElementById("newProjectModal").style.display = "none";
};

window.pickProjectFolder = async () => {
    try {
        const { ipcRenderer } = window.require('electron');
        const path = await ipcRenderer.invoke('dialog:openDirectory');
        if (path) {
            pendingFolderPath = path.replace(/\\/g, "/");
            document.getElementById("newProjPath").value = pendingFolderPath;
        }
    } catch (e) {
        console.warn("Native dialog failed, using fallback input", e);
        document.getElementById("folderPicker").click();
    }
};

window.onload = async () => {
    // Add listener for manual path entry
    document.getElementById("newProjPath").addEventListener("input", (e) => {
        pendingFolderPath = e.target.value.trim().replace(/\\/g, "/");
    });

    await loadHome();


    // Auto-redraw loop for animations
    setInterval(() => {
        if (tempPolygon) redraw(tempPolygon, currentPoints);
    }, 50);
};

// --- HOME PAGE LOGIC ---

// --- HOME PAGE LOGIC ---

async function loadHome() {
    const projects = await getProjects();
    const grid = document.getElementById("projectGrid");

    if (!projects || (projects.length === 0 && projects.error)) {
        grid.innerHTML = `<div style='color:red;'>${projects && projects.error ? projects.error : "Backend Offline"}</div>`;
        return;
    }

    // Update Stats
    document.getElementById("stat-total-projects").innerText = projects.length;

    grid.innerHTML = projects.map(p => {
        const safeName = p.name.replace(/'/g, "\\'");
        const safePath = p.path ? p.path.replace(/\\/g, "\\\\") : "";

        let dateStr = "Unknown Date";
        if (p.created_at) {
            try {
                // Handle SQLite timestamp format or ISO
                const validDate = !isNaN(new Date(p.created_at).getTime()) ? new Date(p.created_at) : new Date();
                dateStr = validDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            } catch (e) { }
        }

        return `
        <div class="project-card" onclick="openProject(${p.id}, '${safeName}', '${safePath}')">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <div class="project-name" style="margin:0; font-size:16px;">${p.name}</div>
                <div style="display:flex; gap: 8px; align-items: center;">
                    <div style="font-size:10px; padding:2px 6px; background:rgba(255,255,255,0.1); border-radius:4px; color:#aaa;">
                        CV Project
                    </div>
                    <button class="btn-icon-danger" onclick="confirmDeleteProject(event, ${p.id}, '${safeName}')" title="Delete Project">
                        <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
                    </button>
                </div>
            </div>
            
            <div class="project-path" style="margin-bottom:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${p.path}">
                📂 ${p.path}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.05); padding-top:10px; margin-top:auto;">
                <div style="font-size:11px; color:#666;">
                    Created: ${dateStr}
                </div>
                <div style="font-size:16px; color:var(--text-muted);">
                    ➔
                </div>
            </div>
        </div>
    `}).join("");
}

window.confirmDeleteProject = async (e, id, name) => {
    e.stopPropagation(); // Prevent opening project

    if (await showCustomConfirm(`Are you sure you want to delete project "${name}"?`, "Delete Project", "warning")) {
        const res = await deleteProject(id);
        if (res && !res.error) {
            showToast("Project deleted");
            await loadHome(); // Reload list
        } else {
            await showCustomAlert("Failed to delete project: " + (res.error || "Unknown error"), "Error", "error");
        }
    }
};

// --- NAVIGATION ---
window.showPage = (pageName) => {
    // 1. Update Menu State
    const items = document.querySelectorAll('.nav-item');
    items.forEach(item => {
        item.classList.remove('active');
        if (pageName === 'dashboard' && item.innerText.includes('Dashboard')) item.classList.add('active');
        if (pageName === 'help' && item.innerText.includes('Help')) item.classList.add('active');
    });

    // 2. Toggle Views
    const dashboard = document.getElementById("view-dashboard");
    const help = document.getElementById("view-help");

    if (pageName === 'dashboard') {
        dashboard.style.display = "block";
        help.style.display = "none";
    } else {
        dashboard.style.display = "none";
        help.style.display = "block";
    }
};

window.createNewProject = async () => {
    const name = document.getElementById("newProjName").value;
    if (!name) {
        await showCustomAlert("Please enter a Project Name.", "Missing Information", "warning");
        return;
    }
    if (!pendingFolderPath) {
        await showCustomAlert("Please select a folder first.", "Missing Information", "warning");
        return;
    }

    const proj = await createProject(name, pendingFolderPath);
    if (proj && !proj.error) {
        window.closeModal();
        openProject(proj.id, proj.name, proj.path);
    } else {
        await showCustomAlert("Failed to create project: " + (proj && proj.error ? proj.error : "Unknown Error"), "Creation Failed", "error");
        console.error("Create Project Failed:", proj);
    }
};

window.openProject = async (id, name, path) => {
    // Switch UI
    document.getElementById("home-page").style.display = "none";
    document.getElementById("workspace").style.display = "flex";
    document.getElementById("workspaceTitle").innerText = name.toUpperCase();

    // Load Session
    await loadProjectSession({ id, name });

    // Force a resize check after layout switch
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 100);

    updateCategoryList();

    if (state.images.length > 0) {
        updateFileList(loadInternalImage);
        // Load last image
        loadInternalImage(state.lastIndex);
    } else if (path) {
        // New project or empty state: Scan the folder
        await scanProjectFolder(path);
    } else {
        showToast("Please click 'Open Images' to link files", "info");
    }
};

// --- FILE HANDLING ---

async function scanProjectFolder(folderPath) {
    if (!folderPath) return;

    // Use Node.js fs to scan directory (Electron only)
    try {
        const fs = window.require('fs');
        const pathModule = window.require('path');

        console.log("Scanning:", folderPath);
        const files = fs.readdirSync(folderPath);

        const validExtensions = ['.jpg', '.jpeg', '.png', '.bmp', '.webp'];

        state.imagePaths = {};
        state.images = [];

        files.forEach(file => {
            const ext = pathModule.extname(file).toLowerCase();
            if (validExtensions.includes(ext)) {
                // Ensure we use forward slashes for consistency
                const fullPath = pathModule.join(folderPath, file).replace(/\\/g, '/');
                state.imagePaths[file] = fullPath;
                state.images.push(file);
            }
        });

        if (state.images.length > 0) {
            state.lastIndex = 0;
            // Save this initial state to DB
            await saveSession();

            updateFileList(loadInternalImage);
            loadInternalImage(0);
        } else {
            showToast("No images found in selected folder", "warning");
        }

    } catch (e) {
        console.error("Error scanning folder:", e);
        showToast("Error scanning folder: " + e.message, "error");
    }
}


async function loadInternalImage(index) {
    if (index < 0 || index >= state.images.length) return;

    const fileName = state.images[index];
    let src = "";
    let filePath = "";

    // 1. Check if we have a direct file object (Unlikely after reload)
    const fileObj = rawFiles.find(f => f.name === fileName);

    if (fileObj) {
        src = URL.createObjectURL(fileObj);
        filePath = fileObj.path;
    }
    // 2. Check saved path
    else if (state.imagePaths && state.imagePaths[fileName]) {
        filePath = state.imagePaths[fileName];
        src = `file://${filePath}`;
    } else {
        showToast(`File ${fileName} missing.`, "error");
        return;
    }

    state.lastIndex = index;
    currentPoints = [];
    tempPolygon = null;

    const img = new Image();
    img.src = src;
    img.onload = async () => {
        setInternalImage(img);
        document.getElementById("currentFileName").innerText = fileName;

        await loadAnnotationsForImage(fileName);
        updateCategoryList();
        updateFileList(loadInternalImage);
        updateLayerList(deleteLayer);

        // Force redraw to show loaded annotations immediately
        // Wait one frame to ensure setInternalImage has finished layout calculations
        await new Promise(resolve => requestAnimationFrame(resolve));
        redraw();

        // Sync
        const loaded = await loadImageToBackend(filePath);
        if (!loaded) {
            showToast("AI Backend Error: Image not loaded", "warning");
        }
    };
    saveSession();
}

window.pickFolder = () => {
    document.getElementById("folderPicker").click();
};

document.getElementById("folderPicker").onchange = async (e) => {
    const allFiles = Array.from(e.target.files);
    if (allFiles.length === 0) return;

    // Handle "New Project" Flow where we just want the path
    if (document.getElementById("newProjectModal").style.display === "flex") {
        // e.target.files[0].path works in Electron.
        const firstFile = allFiles[0];
        if (firstFile.path) {
            pendingFolderPath = firstFile.path.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
            document.getElementById("newProjPath").value = pendingFolderPath;
        } else {
            showCustomAlert("Could not determine folder path. Are you running in Electron?", "System Error", "error");
        }
        return;
    }

    // Normal "Open Images" Flow - Filter for images
    const files = allFiles.filter(f => f.type.startsWith("image/"));
    if (files.length === 0) {
        showToast("No images found in folder", "error");
        return;
    }

    rawFiles = files;
    state.imagePaths = {};
    files.forEach(f => {
        if (f.path) state.imagePaths[f.name] = f.path.replace(/\\/g, "/");
    });

    state.images = files.map(f => f.name);
    state.lastIndex = 0;

    await saveSession();
    updateFileList(loadInternalImage);
    loadInternalImage(state.lastIndex);
};

// --- INTERACTION ---
window.addNewCategory = async () => {
    try {
        const input = document.getElementById("newClassName");
        const name = input.value.trim();
        if (name) {
            console.log("Adding category:", name);
            addCategory(name);
            input.value = "";
            updateCategoryList();
        } else {
            console.warn("Input is empty");
        }
    } catch (e) {
        console.error("Error adding category:", e);
        await showCustomAlert("Error adding category: " + e.message, "Error", "error");
    }
};

window.nextImage = () => loadInternalImage(state.lastIndex + 1);
window.prevImage = () => loadInternalImage(state.lastIndex - 1);

async function saveCurrentMask() {
    if (!tempPolygon) return;

    const name = state.images[state.lastIndex];

    // Ensure array exists
    if (!state.annotations[name]) {
        state.annotations[name] = [];
    }

    state.annotations[name].push({
        points: tempPolygon,
        className: state.activeClass.name,
        color: state.activeClass.color
    });

    await saveCurrentAnnotations(name, state.annotations[name]);

    // Reset inputs, but NOT the image
    currentPoints = [];
    tempPolygon = null;

    // Redraw everything including the new annotation
    redraw(null, []);

    updateLayerList(deleteLayer);
    updateFileList(loadInternalImage); // Update completion status
    showToast("Annotation Saved");

    // Only auto-advance if checked
    if (document.getElementById("autoNext").checked) {
        setTimeout(window.nextImage, 200);
    }
}
window.saveCurrentMask = saveCurrentMask;

// Zoom
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetView = resetView;

// Clear Tool State
window.clearCurrent = () => {
    setTempPolygon(null);
    setDragBox(null);
    setMousePreview(null);
    currentPoints = [];
    tempPolygon = null; // CRITICAL: Clear local var so interval loop doesn't redraw it
    redraw(null, []);
    showToast("Cancelled");
};

async function deleteLayer(idx) {
    const name = state.images[state.lastIndex];
    state.annotations[name].splice(idx, 1);
    await saveCurrentAnnotations(name, state.annotations[name]);

    updateLayerList(deleteLayer);
    redraw(tempPolygon, currentPoints);
    updateFileList(loadInternalImage);
}
window.deleteLayer = deleteLayer;



// Keyboard Shortcuts
window.onkeydown = e => {
    // Ignore if typing in an input
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    if (e.key === "Enter") window.saveCurrentMask();
    if (e.key === "Escape") window.clearCurrent();
    if (e.key === "ArrowRight") window.nextImage();
    if (e.key === "ArrowLeft") window.prevImage();

    // Undo (Ctrl+Z) or Backspace
    if ((e.ctrlKey && e.key === 'z') || e.key === 'Backspace') {
        e.preventDefault();
        if (currentPoints.length > 0) {
            // 1. Undo last point of current polygon
            currentPoints.pop();
            updateSegmentation(); // Recalculate
            showToast("Removed last point");
        } else if (e.ctrlKey && e.key === 'z') {
            // 2. Undo last completed annotation (Only on Ctrl+Z to avoid accidental deletes)
            const name = state.images[state.lastIndex];
            if (state.annotations[name] && state.annotations[name].length > 0) {
                // Remove last item
                state.annotations[name].pop();
                saveCurrentAnnotations(name, state.annotations[name]);

                updateLayerList(deleteLayer);
                redraw(null, []);
                showToast("Undo: Annotation removed");
            }
        }
    }

    // Number keys 1-9 for categories
    if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        if (state.categories && state.categories[idx]) {
            state.activeClass = state.categories[idx];
            updateCategoryList();
            showToast(`Selected: ${state.activeClass.name}`);
        }
    }
};
