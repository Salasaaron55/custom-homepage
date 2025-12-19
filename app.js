// app.js

document.addEventListener("DOMContentLoaded", () => {
  const KEY = "startpage.links.v1";

  const el = (id) => document.getElementById(id);

  // Safe UUID helper
  function uuid(){
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(16) + "-" + Math.random().toString(16).slice(2);
  }

  const grid = el("grid");
  const empty = el("empty");

  const addBtn = el("addBtn");
  const exportBtn = el("exportBtn");
  const importBtn = el("importBtn");
  const importFile = el("importFile");
  const resetBtn = el("resetBtn");

  const q = el("q");

  // Modal
  const modal = el("modal");
  const dialogTitle = el("dialogTitle");
  const closeModalBtn = el("closeModal");
  const cancelBtn = el("cancelBtn");
  const saveBtn = el("saveBtn");
  const deleteBtn = el("deleteBtn");

  const titleInput = el("title");
  const urlInput = el("url");
  const thumbFileInput = el("thumbFile");
  const previewImg = el("previewImg");
  const pFallback = el("pFallback");

  let links = loadLinks();
  let editingId = null;
  let pendingThumbDataUrl = null; // set when user uploads a file
  let dragId = null;

  function loadLinks(){
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLinks(){
    try{
      localStorage.setItem(KEY, JSON.stringify(links));
      return true;
    } catch (e){
      console.error("Save failed:", e);
      alert(
        "Couldn’t save — storage is full for this site.\n\n" +
        "Fix: use smaller thumbnails (JPG / resized) or store images another way."
      );
      return false;
    }
  }

  function normalizeUrl(url){
    let u = (url || "").trim();
    if (!u) return "";
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try { return new URL(u).toString(); } catch { return u; }
  }

  function hostname(url){
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return url.replace(/^https?:\/\//i, "").split("/")[0].replace(/^www\./, ""); }
  }

  function initialsFrom(title, url){
    const t = (title || "").trim();
    if (t) return t.slice(0,2).toUpperCase();
    const h = hostname(url || "");
    return (h || "LI").slice(0,2).toUpperCase();
  }

  function setPreview(dataUrl){
    if (dataUrl){
      previewImg.src = dataUrl;
      previewImg.hidden = false;
      pFallback.style.display = "none";
    } else {
      previewImg.removeAttribute("src");
      previewImg.hidden = true;
      pFallback.style.display = "grid";
    }
  }

  function openModal(mode, item){
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    if (mode === "add"){
      dialogTitle.textContent = "Add Link";
      editingId = null;
      deleteBtn.hidden = true;

      titleInput.value = "";
      urlInput.value = "";
      thumbFileInput.value = "";
      pendingThumbDataUrl = null;
      setPreview(null);
      titleInput.focus();
      return;
    }

    dialogTitle.textContent = "Edit Link";
    editingId = item.id;
    deleteBtn.hidden = false;

    titleInput.value = item.title || "";
    urlInput.value = item.url || "";
    thumbFileInput.value = "";
    pendingThumbDataUrl = null;
    setPreview(item.thumb || null);
    titleInput.focus();
  }

  function closeModal(){
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    editingId = null;
    pendingThumbDataUrl = null;
    thumbFileInput.value = "";
  }

  function upsertLink(){
    const title = (titleInput.value || "").trim();
    const url = normalizeUrl(urlInput.value);

    if (!url){
      urlInput.focus();
      return;
    }

    if (!editingId){
      const item = {
        id: uuid(),
        title: title || hostname(url),
        url,
        thumb: pendingThumbDataUrl || null,
        createdAt: Date.now()
      };
      links.unshift(item);
    } else {
      const idx = links.findIndex(x => x.id === editingId);
      if (idx !== -1){
        links[idx] = {
          ...links[idx],
          title: title || hostname(url),
          url,
          thumb: (pendingThumbDataUrl !== null) ? pendingThumbDataUrl : links[idx].thumb
        };
      }
    }

    if (saveLinks()){
      render();
      closeModal();
    }
  }

  function deleteLink(){
    if (!editingId) return;
    links = links.filter(x => x.id !== editingId);

    if (saveLinks()){
      render();
      closeModal();
    }
  }

  function cardTemplate(item){
    const safeTitle = item.title || hostname(item.url);
    const host = hostname(item.url);

    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = item.id;

    // Clickable area (real anchor) — reliable open
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "cardLink";
    link.setAttribute("aria-label", `Open ${safeTitle}`);

    const thumb = document.createElement("div");
    thumb.className = "thumb";

    if (item.thumb){
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.src = item.thumb;
      img.draggable = false; // prevents image drag hijacking clicks
      thumb.appendChild(img);
    } else {
      const fb = document.createElement("div");
      fb.className = "fallback";
      fb.textContent = initialsFrom(safeTitle, item.url);
      thumb.appendChild(fb);
    }

    const meta = document.createElement("div");
    meta.className = "meta";

    const left = document.createElement("div");
    left.className = "titleWrap";

    const h = document.createElement("p");
    h.className = "title";
    h.textContent = safeTitle;

    const u = document.createElement("p");
    u.className = "url";
    u.textContent = host;

    left.appendChild(h);
    left.appendChild(u);

    // Actions (NOT inside the link, so they don't navigate)
    const actions = document.createElement("div");
    actions.className = "actions";

    // Drag handle (only thing that drags)
    const grip = document.createElement("button");
    grip.className = "iconBtn dragHandle";
    grip.type = "button";
    grip.title = "Drag to reorder";
    grip.setAttribute("draggable", "true");
    grip.innerHTML = `
      <svg class="ico" viewBox="0 0 24 24" fill="none">
        <path d="M9 7h.01M9 12h.01M9 17h.01M15 7h.01M15 12h.01M15 17h.01"
          stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `;

    const editBtn = document.createElement("button");
    editBtn.className = "iconBtn";
    editBtn.type = "button";
    editBtn.title = "Edit";
    editBtn.innerHTML = `
      <svg class="ico" viewBox="0 0 24 24" fill="none">
        <path d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0 0-3L16.5 4.5a2.12 2.12 0 0 0-3 0L3 15v5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M13.5 6.5 17.5 10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openModal("edit", item);
    });

    actions.appendChild(grip);
    actions.appendChild(editBtn);

    // Build structure
    meta.appendChild(left);
    meta.appendChild(actions);

    link.appendChild(thumb);
    link.appendChild(meta);

    card.appendChild(link);

    // Drag targets: dragover/drop on card
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dragId || dragId === item.id) return;
      card.classList.add("dropHint");
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("dropHint");
    });

    card.addEventListener("drop", (e) => {
      e.preventDefault();
      card.classList.remove("dropHint");
      if (!dragId || dragId === item.id) return;
      reorder(dragId, item.id);
    });

    // Drag start/end only from the grip
    grip.addEventListener("dragstart", (e) => {
      dragId = item.id;
      card.classList.add("dragging");
      e.dataTransfer?.setData("text/plain", item.id); // Firefox
    });

    grip.addEventListener("dragend", () => {
      dragId = null;
      card.classList.remove("dragging");
      [...grid.querySelectorAll(".dropHint")].forEach(n => n.classList.remove("dropHint"));
    });

    return card;
  }

  function reorder(fromId, toId){
    const fromIdx = links.findIndex(x => x.id === fromId);
    const toIdx = links.findIndex(x => x.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = links.splice(fromIdx, 1);
    links.splice(toIdx, 0, moved);

    if (saveLinks()) render();
  }

  function render(){
    const query = (q.value || "").trim().toLowerCase();
    grid.innerHTML = "";

    const visible = links.filter(item => {
      if (!query) return true;
      const t = (item.title || "").toLowerCase();
      const u = (item.url || "").toLowerCase();
      return t.includes(query) || u.includes(query);
    });

    empty.hidden = visible.length !== 0;

    for (const item of visible){
      grid.appendChild(cardTemplate(item));
    }
  }

  // Thumbnail upload preview
  thumbFileInput.addEventListener("change", async () => {
    const file = thumbFileInput.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataURL(file);
    pendingThumbDataUrl = dataUrl;
    setPreview(dataUrl);
  });

  function fileToDataURL(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Buttons / modal wiring
  addBtn.addEventListener("click", () => openModal("add"));
  closeModalBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  saveBtn.addEventListener("click", upsertLink);
  deleteBtn.addEventListener("click", deleteLink);

  // Close modal when clicking backdrop
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== q){
      e.preventDefault();
      q.focus();
    }
    if (e.key === "Escape" && modal.classList.contains("show")){
      closeModal();
    }
  });

  q.addEventListener("input", render);

  // Export / Import / Reset
  exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ version: 1, links }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "startpage-links.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  });

  importBtn.addEventListener("click", () => importFile.click());

  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;

    try{
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.links)) throw new Error("Invalid file");

      links = data.links.map(x => ({
        id: x.id || uuid(),
        title: (x.title || "").toString(),
        url: normalizeUrl((x.url || "").toString()),
        thumb: x.thumb || null,
        createdAt: x.createdAt || Date.now()
      })).filter(x => x.url);

      if (saveLinks()) render();
    } catch {
      alert("Could not import that file. Make sure it's a JSON export from this page.");
    } finally {
      importFile.value = "";
    }
  });

  resetBtn.addEventListener("click", () => {
    if (!confirm("Clear all saved links on this browser?")) return;
    links = [];
    if (saveLinks()) render();
  });

  render();
});
