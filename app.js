const fileInput = document.querySelector("#file-input");
const dropZone = document.querySelector("#drop-zone");
const imageList = document.querySelector("#image-list");
const pageCount = document.querySelector("#page-count");
const notice = document.querySelector("#notice");
const addMoreButton = document.querySelector("#add-more-button");
const clearButton = document.querySelector("#clear-button");
const viewSwitch = document.querySelector("#view-switch");
const selectionToolbar = document.querySelector("#selection-toolbar");
const selectAllButton = document.querySelector("#select-all-button");
const deselectAllButton = document.querySelector("#deselect-all-button");
const clearSelectedButton = document.querySelector("#clear-selected-button");
const downloadButton = document.querySelector("#download-button");
const paperSize = document.querySelector("#paper-size");

const images = [];
let draggedId = null;
let displayView = "icons";
let isExporting = false;
let isImporting = false;
let pdfJsPromise = null;

const pdfJsUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
const pdfWorkerUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

function isBusy() {
  return isExporting || isImporting;
}

const formatBytes = (bytes) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function showNotice(message, isError = false) {
  notice.textContent = message;
  notice.classList.toggle("error", isError);
  notice.hidden = false;
}

function clearNotice() {
  notice.hidden = true;
  notice.textContent = "";
  notice.classList.remove("error");
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function decodeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({
      id: makeId(),
      file,
      url,
      width: image.naturalWidth,
      height: image.naturalHeight,
      included: true
    });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} couldn't be opened by this browser.`));
    };
    image.src = url;
  });
}

function loadPdfJs() {
  if (window.pdfjsLib?.getDocument) return Promise.resolve(window.pdfjsLib);
  if (pdfJsPromise) return pdfJsPromise;

  pdfJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = pdfJsUrl;
    script.onload = () => {
      if (!window.pdfjsLib?.getDocument) {
        pdfJsPromise = null;
        reject(new Error("The PDF reader couldn't start. Please try again."));
        return;
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      resolve(window.pdfjsLib);
    };
    script.onerror = () => {
      pdfJsPromise = null;
      reject(new Error("The PDF reader couldn't load. Check your internet connection and try again."));
    };
    document.head.append(script);
  });
  return pdfJsPromise;
}

function canvasToJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("A PDF page couldn't be prepared."));
    }, "image/jpeg", 0.92);
  });
}

async function decodePdfPages(file, onProgress) {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  let pdfDocument;
  const pages = [];

  try {
    pdfDocument = await loadingTask.promise;
    if (!pdfDocument.numPages) throw new Error(`${file.name} doesn't contain any pages.`);

    const sourceName = file.name.replace(/\.pdf$/i, "");
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      onProgress(pageNumber, pdfDocument.numPages);
      const page = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 2400 / Math.max(baseViewport.width, baseViewport.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Your browser couldn't prepare a PDF page.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;

      const blob = await canvasToJpeg(canvas);
      canvas.width = 0;
      canvas.height = 0;
      const pageFile = new File([blob], `${sourceName} - page ${pageNumber}.jpg`, { type: "image/jpeg" });
      pages.push({
        id: makeId(),
        file: pageFile,
        url: URL.createObjectURL(blob),
        width: viewport.width,
        height: viewport.height,
        included: true
      });
    }

    return pages;
  } catch (error) {
    pages.forEach((page) => URL.revokeObjectURL(page.url));
    throw error;
  } finally {
    if (pdfDocument) await pdfDocument.destroy();
    else await loadingTask.destroy();
  }
}

function makeIcon(name) {
  const paths = {
    grip: '<path d="M7 5h.01M7 10h.01M7 15h.01M13 5h.01M13 10h.01M13 15h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    up: '<path d="m5 10 5-5 5 5M10 5v10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    down: '<path d="m5 10 5 5 5-5M10 15V5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    remove: '<path d="M4.5 6h11M7.5 6V4.5h5V6m1.5 0-.6 9h-6.8l-.6-9M8.5 8.5v4.5m3-4.5v4.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = paths[name];
  return svg;
}

function makeIconButton(icon, label, onClick, disabled = false, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `icon-button ${extraClass}`.trim();
  button.setAttribute("aria-label", label);
  button.title = label;
  button.disabled = disabled;
  button.append(makeIcon(icon));
  button.addEventListener("click", onClick);
  return button;
}

function moveImage(id, offset) {
  if (isBusy()) return;
  const index = images.findIndex((image) => image.id === id);
  const nextIndex = index + offset;
  if (index < 0 || nextIndex < 0 || nextIndex >= images.length) return;
  [images[index], images[nextIndex]] = [images[nextIndex], images[index]];
  render();
}

function removeImage(id) {
  if (isBusy()) return;
  const index = images.findIndex((image) => image.id === id);
  if (index < 0) return;
  URL.revokeObjectURL(images[index].url);
  images.splice(index, 1);
  render();
}

function setAllIncluded(included) {
  if (isBusy()) return;
  images.forEach((image) => {
    image.included = included;
  });
  render();
}

function clearIncludedFiles() {
  if (isBusy()) return;
  for (let index = images.length - 1; index >= 0; index -= 1) {
    if (!images[index].included) continue;
    URL.revokeObjectURL(images[index].url);
    images.splice(index, 1);
  }
  render();
}

function updateSelectionSummary() {
  const selectedCount = images.filter((image) => image.included).length;
  if (!images.length) {
    pageCount.textContent = "Add a few files to get started";
  } else if (!selectedCount) {
    pageCount.textContent = `0 of ${images.length} files selected · select at least one for your PDF`;
  } else {
    pageCount.textContent = `${selectedCount} of ${images.length} files selected · drag to arrange your pages`;
  }
  downloadButton.disabled = selectedCount === 0 || isBusy();
  return selectedCount;
}

function render() {
  imageList.replaceChildren();
  const hasImages = images.length > 0;
  dropZone.classList.toggle("has-files", hasImages);
  imageList.classList.toggle("icons-view", displayView === "icons");
  viewSwitch.hidden = !hasImages;
  selectionToolbar.hidden = !hasImages;
  addMoreButton.hidden = !hasImages;
  addMoreButton.disabled = isBusy();
  fileInput.disabled = isBusy();
  const selectedCount = updateSelectionSummary();
  selectAllButton.disabled = isBusy() || selectedCount === images.length;
  deselectAllButton.disabled = isBusy() || selectedCount === 0;
  clearSelectedButton.disabled = isBusy() || selectedCount === 0;
  clearButton.disabled = isBusy();
  viewSwitch.querySelectorAll(".view-option").forEach((button) => {
    const isActive = button.dataset.view === displayView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  images.forEach((image, index) => {
    const card = document.createElement("article");
    card.className = "image-card";
    card.draggable = !isBusy();
    card.dataset.id = image.id;
    card.setAttribute("aria-label", `Page ${index + 1}: ${image.file.name}`);

    const preview = document.createElement("div");
    preview.className = "file-preview";

    const includeCheckbox = document.createElement("input");
    includeCheckbox.type = "checkbox";
    includeCheckbox.className = "include-checkbox";
    includeCheckbox.checked = image.included;
    includeCheckbox.disabled = isBusy();
    includeCheckbox.setAttribute("aria-label", `Include ${image.file.name} in the final PDF`);
    includeCheckbox.addEventListener("change", () => {
      image.included = includeCheckbox.checked;
      updateSelectionSummary();
    });

    const number = document.createElement("span");
    number.className = "image-number";
    number.textContent = String(index + 1).padStart(2, "0");

    const thumbnail = document.createElement("img");
    thumbnail.className = "thumbnail";
    thumbnail.src = image.url;
    thumbnail.alt = "";

    const meta = document.createElement("div");
    meta.className = "image-meta";
    const name = document.createElement("div");
    name.className = "image-name";
    name.textContent = image.file.name;
    name.title = image.file.name;
    const details = document.createElement("div");
    details.className = "image-detail";
    details.textContent = `${image.width} × ${image.height} · ${formatBytes(image.file.size)}`;
    meta.append(name, details);

    const actions = document.createElement("div");
    actions.className = "image-actions";
    actions.append(
      makeIconButton("grip", `Drag to reorder ${image.file.name}`, () => {}, false, "drag-handle"),
      makeIconButton("up", `Move ${image.file.name} up`, () => moveImage(image.id, -1), isBusy() || index === 0),
      makeIconButton("down", `Move ${image.file.name} down`, () => moveImage(image.id, 1), isBusy() || index === images.length - 1),
      makeIconButton("remove", `Remove ${image.file.name}`, () => removeImage(image.id), isBusy(), "remove")
    );

    card.addEventListener("dragstart", (event) => {
      draggedId = image.id;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", image.id);
    });
    card.addEventListener("dragend", () => {
      draggedId = null;
      card.classList.remove("is-dragging");
      imageList.querySelectorAll(".is-over").forEach((item) => item.classList.remove("is-over"));
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      card.classList.add("is-over");
    });
    card.addEventListener("dragleave", (event) => {
      if (!card.contains(event.relatedTarget)) card.classList.remove("is-over");
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("is-over");
      const sourceId = event.dataTransfer.getData("text/plain") || draggedId;
      if (!sourceId || sourceId === image.id) return;
      const from = images.findIndex((item) => item.id === sourceId);
      const to = images.findIndex((item) => item.id === image.id);
      if (from < 0 || to < 0) return;
      const [moved] = images.splice(from, 1);
      images.splice(to, 0, moved);
      render();
    });

    preview.append(includeCheckbox, number, thumbnail);
    card.append(preview, meta, actions);
    imageList.append(card);
  });
}

viewSwitch.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button || isBusy()) return;
  displayView = button.dataset.view;
  render();
});

async function addFiles(fileList) {
  if (isBusy()) return;
  const selected = Array.from(fileList);
  if (selected.length === 0) return;
  clearNotice();

  const added = [];
  const failed = [];
  let ignored = 0;
  isImporting = true;
  showNotice("Reading your files…");
  render();

  try {
    for (const file of selected) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        try {
          const pages = await decodePdfPages(file, (page, total) => {
            showNotice(`Reading ${file.name} · page ${page} of ${total}…`);
          });
          added.push(...pages);
        } catch (error) {
          failed.push(error instanceof Error ? `${file.name}: ${error.message}` : `${file.name} couldn't be read.`);
        }
      } else if (file.type.startsWith("image/")) {
        try {
          added.push(await decodeImage(file));
        } catch (error) {
          failed.push(error instanceof Error ? error.message : `${file.name} couldn't be opened.`);
        }
      } else {
        ignored += 1;
      }
    }
    images.push(...added);
  } finally {
    isImporting = false;
    render();
  }

  const messages = [...failed];
  if (ignored) messages.push(`${ignored} ${ignored === 1 ? "file was" : "files were"} skipped because ${ignored === 1 ? "it isn't" : "they aren't"} a supported file type.`);
  if (messages.length) showNotice(messages.join(" "), true);
  else if (added.length) showNotice(`${added.length} ${added.length === 1 ? "page is" : "pages are"} ready. Drag to arrange, or use the arrow buttons.`);
}

function openPicker() {
  if (isBusy()) return;
  fileInput.click();
}

function readAsJpeg(image) {
  return new Promise((resolve, reject) => {
    const source = new Image();
    source.onload = () => {
      const maxDimension = 2400;
      const scale = Math.min(1, maxDimension / Math.max(source.naturalWidth, source.naturalHeight));
      const width = Math.max(1, Math.round(source.naturalWidth * scale));
      const height = Math.max(1, Math.round(source.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Your browser couldn't prepare a file for the PDF."));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(source, 0, 0, width, height);
      try {
        resolve({ data: canvas.toDataURL("image/jpeg", 0.92), width, height });
      } catch (error) {
        reject(error);
      }
    };
    source.onerror = () => reject(new Error(`${image.file.name} couldn't be prepared for the PDF.`));
    source.src = image.url;
  });
}

function safeFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, "");
  const safe = base.replace(/[<>:"\\|?*\u0000-\u001f]/g, "-").replace(/\//g, "-").trim();
  return `${safe || "files"}.pdf`;
}

async function createPdf() {
  const selectedImages = images.filter((image) => image.included);
  if (!selectedImages.length || isBusy()) return;
  if (!window.jspdf?.jsPDF) {
    showNotice("The PDF tool couldn't load. Check your internet connection and try again.", true);
    return;
  }

  isExporting = true;
  clearNotice();
  downloadButton.classList.add("is-working");
  downloadButton.querySelector("span").textContent = "Making your PDF…";
  render();

  try {
    const format = paperSize.value === "letter" ? "letter" : "a4";
    let pdf;
    for (let index = 0; index < selectedImages.length; index += 1) {
      const image = selectedImages[index];
      downloadButton.querySelector("span").textContent = `Adding page ${index + 1} of ${selectedImages.length}…`;
      const raster = await readAsJpeg(image);
      const landscape = raster.width > raster.height;
      if (!pdf) {
        pdf = new window.jspdf.jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format, compress: true });
      } else {
        pdf.addPage(format, landscape ? "landscape" : "portrait");
      }
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const scale = Math.min((pageWidth - margin * 2) / raster.width, (pageHeight - margin * 2) / raster.height);
      const width = raster.width * scale;
      const height = raster.height * scale;
      pdf.addImage(raster.data, "JPEG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, "FAST");
    }

    const filename = selectedImages.length === 1 ? safeFilename(selectedImages[0].file.name) : "my-files.pdf";
    pdf.save(filename);
    showNotice(`Your ${selectedImages.length}-page PDF is ready. Happy saving!`);
  } catch (error) {
    console.error("PDF creation failed:", error);
    showNotice(error instanceof Error ? `Couldn't create the PDF: ${error.message}` : "Couldn't create the PDF. Please try again with smaller files.", true);
  } finally {
    isExporting = false;
    downloadButton.classList.remove("is-working");
    downloadButton.querySelector("span").textContent = "Make my PDF";
    render();
  }
}

fileInput.addEventListener("change", async () => {
  await addFiles(fileInput.files);
  fileInput.value = "";
});
dropZone.addEventListener("click", (event) => {
  if (!isBusy() && event.target !== fileInput) openPicker();
});
dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openPicker();
  }
});
addMoreButton.addEventListener("click", openPicker);
selectAllButton.addEventListener("click", () => setAllIncluded(true));
deselectAllButton.addEventListener("click", () => setAllIncluded(false));
clearSelectedButton.addEventListener("click", clearIncludedFiles);
clearButton.addEventListener("click", () => {
  if (isBusy()) return;
  images.forEach((image) => URL.revokeObjectURL(image.url));
  images.length = 0;
  clearNotice();
  render();
});
downloadButton.addEventListener("click", createPdf);

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
}
dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));

render();
