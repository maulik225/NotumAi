
let modalResolve = null;

export function closeCustomModal() {
    document.getElementById("customModalOverlay").style.display = "none";
    if (modalResolve) modalResolve(false);
    modalResolve = null;
}

export function confirmCustomModal() {
    document.getElementById("customModalOverlay").style.display = "none";
    if (modalResolve) modalResolve(true);
    modalResolve = null;
}

// Make them global so HTML buttons can call them
window.closeCustomModal = closeCustomModal;
window.confirmCustomModal = confirmCustomModal;

export function showCustomAlert(message, title = "Alert", type = "info") {
    return new Promise(resolve => {
        const overlay = document.getElementById("customModalOverlay");
        const titleEl = document.getElementById("customModalTitle");
        const bodyEl = document.getElementById("customModalBody");
        const iconEl = document.getElementById("customModalIcon");
        const actionsEl = document.getElementById("customModalActions");

        titleEl.innerText = title;
        bodyEl.innerText = message;

        // Icon
        iconEl.className = `modal-icon ${type}`;
        let iconName = "info";
        if (type === 'warning') iconName = "warning";
        if (type === 'error') iconName = "error";
        if (type === 'success') iconName = "check_circle";
        iconEl.innerHTML = `<span class="material-symbols-outlined">${iconName}</span>`;

        // Actions: Only OK button for Alert
        actionsEl.innerHTML = `
            <button class="modal-btn modal-btn-confirm" onclick="confirmCustomModal()">OK</button>
        `;

        modalResolve = resolve;
        overlay.style.display = "flex";
    });
}

export function showCustomConfirm(message, title = "Confirm", type = "warning") {
    return new Promise(resolve => {
        const overlay = document.getElementById("customModalOverlay");
        const titleEl = document.getElementById("customModalTitle");
        const bodyEl = document.getElementById("customModalBody");
        const iconEl = document.getElementById("customModalIcon");
        const actionsEl = document.getElementById("customModalActions");

        titleEl.innerText = title;
        bodyEl.innerText = message;

        iconEl.className = `modal-icon ${type}`;
        let iconName = "help";
        if (type === 'warning') iconName = "warning";
        if (type === 'error') iconName = "error"; // Use error only if explicitly requested
        iconEl.innerHTML = `<span class="material-symbols-outlined">${iconName}</span>`;

        // Actions: Cancel & Confirm
        actionsEl.innerHTML = `
            <button class="modal-btn modal-btn-cancel" onclick="closeCustomModal()">Cancel</button>
            <button class="modal-btn modal-btn-confirm" onclick="confirmCustomModal()">Confirm</button>
        `;

        modalResolve = resolve;
        overlay.style.display = "flex";
    });
}
