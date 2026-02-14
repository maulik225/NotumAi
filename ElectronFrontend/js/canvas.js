import { state } from './state.js';
import { segmentPoints } from './api.js';

export const canvas = document.getElementById("canvas");
export const ctx = canvas.getContext("2d");
export const container = document.getElementById("canvas-container");

let scale = 0.1;
let originX = 0;
let originY = 0;
let isPanning = false;
let isDraggingPoint = false;
let draggedPointIdx = -1;
let startX, startY;
export let currentImg = null;

// Exported to allow main.js to update it
export let tempPolygon = null;
export function setTempPolygon(poly, score) {
    tempPolygon = poly;
    if (score !== undefined) {
        document.getElementById("info-score").innerText = (score * 100).toFixed(1) + "%";
    }
    redraw();
}

export function setInternalImage(img) {
    currentImg = img;

    // Use requestAnimationFrame to ensure layout is complete
    requestAnimationFrame(() => {
        // Get fresh container dimensions
        let cw = container.clientWidth || container.offsetWidth;
        let ch = container.clientHeight || container.offsetHeight;

        // Fallback if container is still 0 (e.g. hidden), force a check
        if (!cw || !ch) {
            console.warn("Container size 0, forcing layout calc");
            const rect = container.getBoundingClientRect();
            cw = rect.width || 800;
            ch = rect.height || 600;
        }

        console.log("Setting Image:", img.width, "x", img.height);
        console.log("Container:", cw, "x", ch);

        // Update canvas size
        canvas.width = cw;
        canvas.height = ch;

        // Calculate scale to fit image with padding
        const padding = 40;
        const availableW = cw - padding;
        const availableH = ch - padding;

        scale = Math.min(availableW / img.width, availableH / img.height);
        if (scale <= 0) scale = 0.1; // Safety

        // Center the image
        originX = (cw - img.width * scale) / 2;
        originY = (ch - img.height * scale) / 2;

        console.log("Calculated Scale:", scale, "Origin:", originX, originY);

        // Reset state
        tempPolygon = null;

        // Update Info Panel
        document.getElementById("info-dims").innerText = `${img.width} x ${img.height}`;
        document.getElementById("info-count").innerText = state.annotations[state.images[state.lastIndex]]?.length || 0;
        document.getElementById("info-score").innerText = "-";

        redraw();
    });
}

export function redraw(polyOverride = null, currentPoints = []) {
    // Allows passing poly from main.js or using local state
    const polyToDraw = polyOverride || tempPolygon;
    tempPolygon = polyToDraw; // Sync

    // 1. Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    // 2. Draw Image
    if (!currentImg) return;
    ctx.setTransform(scale, 0, 0, scale, originX, originY);
    ctx.drawImage(currentImg, 0, 0);

    // 3. Draw Existing Annotations
    const name = state.images[state.lastIndex];
    if (state.annotations[name]) {
        state.annotations[name].forEach(obj => {
            // Use globalAlpha for transparency so it works with HSL and Hex
            drawShape(obj.points, obj.color, obj.color, 2, 0.25);
        });
    }

    // 4. Draw Temp Polygon (AI Result)
    if (tempPolygon) {
        const pulse = 0.4 + Math.sin(Date.now() / 200) * 0.1;
        const activeColor = state.activeClass ? state.activeClass.color : "#007acc";
        drawShape(tempPolygon, activeColor, activeColor, 2.5, pulse);

        // Draw Handles
        ctx.fillStyle = "#fff";
        tempPolygon.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3 / scale, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // 5. Draw SAM Control Points
    currentPoints.forEach(p => {
        ctx.fillStyle = "white";
        ctx.strokeStyle = "springgreen";
        ctx.lineWidth = 1 / scale;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 / scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    });

    // 6. Draw Drag Box (BBox Tool)
    if (dragBox) {
        ctx.strokeStyle = state.activeClass ? state.activeClass.color : "#00ff00";
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([5 / scale, 3 / scale]);
        ctx.strokeRect(dragBox.x, dragBox.y, dragBox.w, dragBox.h);
        ctx.setLineDash([]);
    }

    // 7. Draw Polygon Preview Line (Polygon Tool)
    if (currentPoints.length > 0 && mousePosStr) {
        const lastP = currentPoints[currentPoints.length - 1];
        ctx.beginPath();
        ctx.moveTo(lastP.x, lastP.y);
        ctx.lineTo(mousePosStr.x, mousePosStr.y);
        ctx.strokeStyle = state.activeClass ? state.activeClass.color : "cyan";
        ctx.lineWidth = 1.5 / scale;
        ctx.setLineDash([4 / scale, 4 / scale]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // 8. Full Screen Crosshair
    if (crosshairPos) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to Identity for UI overlay

        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"; // Bright white/gray
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]); // Dashed Line

        // Horizontal
        ctx.moveTo(0, crosshairPos.y);
        ctx.lineTo(canvas.width, crosshairPos.y);

        // Vertical
        ctx.moveTo(crosshairPos.x, 0);
        ctx.lineTo(crosshairPos.x, canvas.height);

        ctx.stroke();
        ctx.setLineDash([]); // Reset
        ctx.restore();
    }
}

export let dragBox = null;
export let mousePosStr = null; // Mouse position for previews
export let crosshairPos = null; // Raw canvas coordinates

export function setDragBox(box) { dragBox = box; redraw(); }
export function setMousePreview(pos) { mousePosStr = pos; redraw(); }
export function setCrosshairPos(pos) { crosshairPos = pos; redraw(); }

function drawGrid() {
    const size = 50 * scale;
    ctx.beginPath();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    // Don't draw infinite grid, just canvas area
    for (let x = originX % size; x < canvas.width; x += size) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for (let y = originY % size; y < canvas.height; y += size) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();
}

function drawShape(poly, fill, stroke, weight, fillOpacity = 1.0) {
    if (!poly || poly.length === 0) return;

    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    poly.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();

    ctx.save();
    ctx.fillStyle = fill;
    ctx.globalAlpha = fillOpacity;
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = stroke;
    ctx.lineWidth = weight / scale;
    ctx.stroke();
}

// EVENTS (Refactored for Main.js control)

function distToSegmentSquared(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
}

let ignoreUp = false;

export function handleCanvasMouseDown(e) {
    // Middle Mouse (1) OR Alt+Left OR Right Mouse (2) -> PAN
    if (e.button === 1 || e.altKey || e.button === 2) {
        isPanning = true;
        startX = e.clientX - originX;
        startY = e.clientY - originY;
        e.preventDefault();
        return true; // Handled
    }

    // Left Click -> Check for Vertex Dragging FIRST
    if (e.button === 0 && tempPolygon) {
        const mouseP = getImgCoordinates(e);
        const threshold = 10 / scale; // 10px visual radius
        const thresholdSq = threshold * threshold;

        // 1. Check Vertices (Drag or Delete)
        const closestIdx = tempPolygon.findIndex(p => {
            const dx = p.x - mouseP.x;
            const dy = p.y - mouseP.y;
            return (dx * dx + dy * dy) < thresholdSq;
        });

        if (closestIdx !== -1) {
            // Ctrl + Click to Delete
            if (e.ctrlKey) {
                if (tempPolygon.length > 3) {
                    tempPolygon.splice(closestIdx, 1);
                    // Force redraw
                    redraw();
                    ignoreUp = true;
                    return true;
                }
            }

            isDraggingPoint = true;
            draggedPointIdx = closestIdx;
            return true; // Handled
        }

        // 2. Check Edges (Insert Point)
        const lineThreshold = 6 / scale;
        const lineThresholdSq = lineThreshold * lineThreshold;

        for (let i = 0; i < tempPolygon.length; i++) {
            const p1 = tempPolygon[i];
            const p2 = tempPolygon[(i + 1) % tempPolygon.length];

            if (distToSegmentSquared(mouseP, p1, p2) < lineThresholdSq) {
                // Insert new point
                const newIdx = i + 1;
                tempPolygon.splice(newIdx, 0, { x: mouseP.x, y: mouseP.y });

                // Grab it immediately
                isDraggingPoint = true;
                draggedPointIdx = newIdx;
                redraw();
                return true;
            }
        }
    }
    return false; // Not handled (let main.js handle tool start)
}

export function handleCanvasMouseMove(e) {
    if (isPanning) {
        originX = e.clientX - startX;
        originY = e.clientY - startY;
        redraw();
        return true;
    } else if (isDraggingPoint && tempPolygon) {
        // Drag vertex
        const p = getImgCoordinates(e);
        tempPolygon[draggedPointIdx] = p;
        redraw();
        return true;
    }
    return false;
}

export function handleCanvasMouseUp(e) {
    if (ignoreUp) {
        ignoreUp = false;
        return true;
    }
    const wasBusy = isPanning || isDraggingPoint;
    isPanning = false;
    isDraggingPoint = false;
    draggedPointIdx = -1;
    return wasBusy;
}

container.onwheel = e => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const scroll = e.deltaY < 0 ? 1 : -1;
    const zoomFactor = Math.exp(scroll * zoomIntensity);

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    originX = mouseX - (mouseX - originX) * zoomFactor;
    originY = mouseY - (mouseY - originY) * zoomFactor;
    scale *= zoomFactor;

    redraw();
};

// Zoom Controls
export function zoomIn() {
    scale *= 1.2;
    redraw();
}

export function zoomOut() {
    scale /= 1.2;
    redraw();
}

export function resetView() {
    if (!currentImg) return;
    setInternalImage(currentImg);
}

// Prevent Context Menu on Right Click
canvas.oncontextmenu = (e) => {
    e.preventDefault();
    return false;
};


export function getImgCoordinates(e) {
    const rect = canvas.getBoundingClientRect(); // Use canvas rect for precision
    const x = Math.round((e.clientX - rect.left - originX) / scale);
    const y = Math.round((e.clientY - rect.top - originY) / scale);

    // Update Cursor Info
    document.getElementById("info-cursor").innerText = `${x}, ${y}`;

    return { x, y };
}

new ResizeObserver(() => {
    // Only re-center if we have an image
    if (currentImg && container.clientWidth && container.clientHeight) {
        // Prevent infinite loops on small layout shifts (e.g. 4px descender issue)
        if (Math.abs(container.clientWidth - canvas.width) < 10 &&
            Math.abs(container.clientHeight - canvas.height) < 10) return;

        console.log("Resize detected, re-centering image...");
        setInternalImage(currentImg);
    }
}).observe(container);
