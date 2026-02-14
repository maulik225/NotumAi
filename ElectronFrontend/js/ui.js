import { state, addCategory, removeCategory } from './state.js';
import { showCustomConfirm } from './modal_logic.js';

export function updateCategoryList() {
    const list = document.getElementById("classList");
    list.innerHTML = "";

    if (!state.categories || state.categories.length === 0) {
        list.innerHTML = `<div style="padding:10px; text-align:center; color:#666; font-size:12px;">No categories. <br> Add one below.</div>`;
        return;
    }

    state.categories.forEach((c, index) => {
        const btn = document.createElement("button");
        btn.className = "class-btn" + (state.activeClass && state.activeClass.name === c.name ? " active" : "");
        const shortcut = index < 9 ? `<span style="font-size:10px; opacity:0.6; margin-left:4px;">[${index + 1}]</span>` : "";

        // Creating internal structure
        const colorSpan = document.createElement("span");
        colorSpan.className = "class-color";
        colorSpan.style.backgroundColor = c.color;

        const nameSpan = document.createElement("span");
        nameSpan.style.flex = "1";
        nameSpan.style.textAlign = "left";
        nameSpan.innerHTML = `${c.name} ${shortcut}`;

        const deleteSpan = document.createElement("span");
        deleteSpan.className = "remove-class-btn";
        deleteSpan.title = "Delete Category";
        deleteSpan.innerHTML = "&times;";

        deleteSpan.onclick = async (e) => {
            e.stopPropagation();
            if (await showCustomConfirm(`Remove category "${c.name}"?`, "Delete Category", "warning")) {
                removeCategory(index);
                // removeCategory inside state.js calls saveSession, so we just need to re-render
                updateCategoryList();
            }
        };

        btn.appendChild(colorSpan);
        btn.appendChild(nameSpan);
        btn.appendChild(deleteSpan);

        btn.onclick = () => {
            state.activeClass = c;
            updateCategoryList();
        };

        list.appendChild(btn);
    });
}

export function updateFileList(loadFileCallback) {
    const list = document.getElementById("fileList");
    list.innerHTML = "";

    // Virtual rendering for performance if list is long (simplified here)
    state.images.forEach((name, i) => {
        const annotationCount = state.annotations[name]?.length || 0;
        const isDone = annotationCount > 0;

        const div = document.createElement("div");
        div.className = `file-item ${i === state.lastIndex ? 'active' : ''}`;
        div.innerHTML = `
            <span class="file-name">${name}</span>
            <div style="display: flex; align-items: center; gap: 6px;">
                ${annotationCount > 0 ? `<span class="annotation-badge">${annotationCount}</span>` : ''}
                ${isDone ? '<div class="status-dot done"></div>' : '<div class="status-dot"></div>'}
            </div>
        `;
        div.onclick = () => loadFileCallback(i);
        list.appendChild(div);
    });

    const doneCount = state.images.filter(n => state.annotations[n]?.length > 0).length;
    const percent = Math.round((doneCount / state.images.length) * 100) || 0;

    document.getElementById("progressFill").style.width = percent + "%";
    document.getElementById("progressText").innerText = `${doneCount} / ${state.images.length} (${percent}%)`;
}

export function updateLayerList(deleteLayerCallback) {
    const list = document.getElementById("layerList");
    const name = state.images[state.lastIndex];
    if (!name || !state.annotations[name]) {
        list.innerHTML = "<div style='color:#666; font-style:italic; padding:10px;'>No objects yet</div>";
        document.getElementById("info-count").innerText = "0";
        return;
    }

    // Update Info Panel Count
    document.getElementById("info-count").innerText = state.annotations[name].length;

    list.innerHTML = state.annotations[name].map((obj, i) => `
        <div class="layer-item">
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="class-color" style="background:${obj.color}; width:10px; height:10px; border-radius:50%;"></span>
                <span>${obj.className}</span>
            </div>
            <span class="delete-btn" data-idx="${i}">×</span>
        </div>
    `).join("");

    list.querySelectorAll(".delete-btn").forEach(btn => {
        btn.onclick = () => deleteLayerCallback(parseInt(btn.dataset.idx));
    });
}

export function showToast(msg, type = 'success') {
    const t = document.getElementById("toast");
    t.innerText = msg;
    t.style.background = type === 'error' ? 'var(--danger)' : 'var(--success)';
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2000);
}

export function setLoading(isLoading) {
    document.getElementById("loading-overlay").style.display = isLoading ? "flex" : "none";
}
