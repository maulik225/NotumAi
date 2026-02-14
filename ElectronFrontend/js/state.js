import { saveProjectState, loadAnnotationFromDB, saveAnnotationToDB, getProjectState } from './api.js';

export const state = {
    currentProjectId: null,
    currentProjectName: "Untitled",
    images: [],
    lastIndex: 0,
    annotations: {},
    imagePaths: {},
    categories: [],
    activeClass: null,
    currentTool: 'sam' // 'sam', 'bbox', 'polygon'
};

// --- SESSION MANAGEMENT ---

export async function loadProjectSession(project) {
    state.currentProjectId = project.id;
    state.currentProjectName = project.name;

    // Reset State
    state.images = [];
    state.lastIndex = 0;
    state.annotations = {};
    state.imagePaths = {};

    // Load from Backend
    const savedState = await getProjectState(project.id);

    // Apply saved state
    // Apply saved state
    if (savedState.categories) {
        state.categories = savedState.categories;
    } else {
        // No saved state = New Project (Empty)
        state.categories = [];
    }

    // Set active class if available
    state.activeClass = state.categories.length > 0 ? state.categories[0] : null;

    if (savedState.lastIndex !== undefined) state.lastIndex = savedState.lastIndex;
    if (savedState.imagePaths) {
        state.imagePaths = savedState.imagePaths;
        // Restore images list from paths keys
        state.images = Object.keys(state.imagePaths);
    }

    return state;
}

export async function saveSession() {
    if (!state.currentProjectId) return;

    await saveProjectState(state.currentProjectId, {
        lastIndex: state.lastIndex,
        categories: state.categories,
        imagePaths: state.imagePaths
    });
}

// --- ANNOTATIONS ---

export async function loadAnnotationsForImage(imageName) {
    if (!state.annotations[imageName]) {
        const data = await loadAnnotationFromDB(state.currentProjectId, imageName);
        state.annotations[imageName] = data;
    }
    return state.annotations[imageName];
}

export async function saveCurrentAnnotations(imageName, data) {
    state.annotations[imageName] = data;
    await saveAnnotationToDB(state.currentProjectId, imageName, data);
}

// --- CATEGORIES ---

export function addCategory(name) {
    const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    const newCat = { name, color };
    state.categories.push(newCat);
    state.activeClass = newCat;
    saveSession();
    return newCat;
}

export function removeCategory(index) {
    if (state.categories.length <= 1) return;
    state.categories.splice(index, 1);
    state.activeClass = state.categories[0];
    saveSession();
}
