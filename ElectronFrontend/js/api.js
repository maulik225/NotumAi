const API_URL = "http://127.0.0.1:8009";

export async function checkStatus() {
    try {
        const res = await fetch(`${API_URL}/status`);
        return await res.json();
    } catch {
        return { status: "OFFLINE" };
    }
}

// --- PROJECT MANAGEMENT ---

export async function getProjects() {
    try {
        const res = await fetch(`${API_URL}/projects`);
        if (!res.ok) {
            const txt = await res.text();
            return { error: `Server Error: ${res.status} ${txt}` };
        }
        return await res.json();
    } catch (e) {
        console.error("Error fetching projects:", e);
        return { error: "Network Error: Is backend running?" };
    }
}

export async function createProject(name, folderPath) {
    try {
        console.log("Creating project:", name, folderPath);
        const res = await fetch(`${API_URL}/projects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, path: folderPath })
        });
        if (!res.ok) {
            const txt = await res.text();
            console.error("Server Error:", txt);
            return { error: `Server Error: ${res.status} ${txt}` };
        }
        return await res.json();
    } catch (e) {
        console.error("Network Error in createProject:", e);
        return { error: `Network Error: ${e.message}` };
    }
}

export async function deleteProject(projectId) {
    try {
        console.log("Deleting project:", projectId);
        // Ensure projectId is a number or string
        const res = await fetch(`${API_URL}/projects/${projectId}`, {
            method: "DELETE",
        });
        if (!res.ok) {
            const txt = await res.text();
            console.error("Server Error:", txt);
            return { error: `Server Error: ${res.status} ${txt}` };
        }
        return await res.json();
    } catch (e) {
        console.error("Network Error in deleteProject:", e);
        return { error: `Network Error: ${e.message}` };
    }
}

export async function getProjectState(projectId) {
    try {
        const res = await fetch(`${API_URL}/projects/${projectId}/state`);
        if (!res.ok) return {};
        return await res.json();
    } catch (e) {
        console.error("Error fetching project state:", e);
        return {};
    }
}

export async function saveProjectState(projectId, stateData) {
    try {
        await fetch(`${API_URL}/projects/${projectId}/save_state`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stateData)
        });
    } catch (e) {
        console.error("Error saving project state:", e);
    }
}

// --- ANNOTATIONS ---

export async function loadAnnotationFromDB(projectId, imageName) {
    try {
        const res = await fetch(`${API_URL}/load_annotation?project_id=${projectId}&image_name=${encodeURIComponent(imageName)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.annotations || [];
    } catch (e) {
        console.error("Error loading annotation:", e);
        return [];
    }
}

export async function saveAnnotationToDB(projectId, imageName, annotations) {
    try {
        await fetch(`${API_URL}/save_annotation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                project_id: projectId,
                image_name: imageName,
                annotations: annotations
            })
        });
    } catch (e) {
        console.error("Error saving annotation:", e);
    }
}

// --- IMAGING ---
export async function loadImageToBackend(fileOrPath) {
    try {
        // Use the new path-based endpoint with embedding caching
        if (typeof fileOrPath === 'string') {
            // Path-based loading (faster with cache)
            const res = await fetch(`${API_URL}/load_image_path`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: fileOrPath })
            });
            const data = await res.json();
            if (data.error) {
                console.error("Backend Image Load Error:", data.error);
                return false;
            }

            if (data.cached) {
                console.log("🚀 Image loaded from cache!");
            } else {
                console.log("📦 Image encoded and cached");
            }
            return true;
        } else if (fileOrPath instanceof File) {
            // Fallback to FormData upload
            const fd = new FormData();
            fd.append("file", fileOrPath);
            await fetch(`${API_URL}/load_image`, { method: "POST", body: fd });
            return true;
        }
        return false;
    } catch (e) {
        console.error("Load Image Error:", e);
        return false;
    }
}

// --- PROJECT STATS ---
export async function getProjectStats(projectId) {
    try {
        const res = await fetch(`${API_URL}/projects/${projectId}/stats`);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error("Error fetching project stats:", e);
        return null;
    }
}

export async function segmentPoints(points, imageName) {
    try {
        const res = await fetch(`${API_URL}/segment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ points, image_name: imageName })
        });
        if (!res.ok) {
            console.error("Segment failed:", res.statusText);
            return { error: "Backend Error: " + res.statusText };
        }
        return await res.json();
    } catch (e) {
        console.error("Segment Network Error:", e);
        return { error: "Network Error: Is backend running?" };
    }
}

// --- EXPORT ---
export async function exportProjectData(projectId, format, outputDir) {
    try {
        const res = await fetch(`${API_URL}/export`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                project_id: projectId,
                format: format,
                output_dir: outputDir
            })
        });
        if (!res.ok) {
            return { error: `Export Failed: ${res.statusText}` };
        }
        return await res.json();
    } catch (e) {
        return { error: "Export Network Error" };
    }
}
