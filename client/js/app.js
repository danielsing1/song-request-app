/* ═══════════════════════════════════════════════════════
   GigRequest — Song list & request logic
   ═══════════════════════════════════════════════════════ */

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let allSongs = [];
let currentSort = "title";
let selectedSong = null;

// ─── Fetch songs ─────────────────────────────────────────
async function loadSongs() {
  try {
    const res = await fetch("/api/songs");
    allSongs = await res.json();
    render();
  } catch (err) {
    console.error("Failed to load songs:", err);
    $("#songList").innerHTML =
      '<p style="color:var(--text-dim);text-align:center;padding:40px">Failed to load songs. Please refresh.</p>';
  }
}

// ─── Render ──────────────────────────────────────────────
function render() {
  const query = ($("#search").value || "").toLowerCase().trim();

  let filtered = allSongs;
  if (query) {
    filtered = allSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.artist.toLowerCase().includes(query)
    );
  }

  // Sort
  filtered.sort((a, b) => {
    const fieldA = a[currentSort].toLowerCase();
    const fieldB = b[currentSort].toLowerCase();
    return fieldA.localeCompare(fieldB);
  });

  // Count
  $("#songCount").textContent = query
    ? `${filtered.length} of ${allSongs.length} songs`
    : `${allSongs.length} songs`;

  // Build HTML
  if (filtered.length === 0) {
    $("#songList").innerHTML =
      '<p style="color:var(--text-dim);text-align:center;padding:40px">No songs match your search.</p>';
    return;
  }

  const html = filtered
    .map(
      (s) => `
    <div class="song-item" data-id="${s.id}">
      <div class="song-info">
        <div class="song-title">${esc(s.title)}</div>
        <div class="song-artist">${esc(s.artist)}</div>
      </div>
      <button class="btn-request" data-id="${s.id}" data-title="${esc(s.title)}" data-artist="${esc(s.artist)}">
        Request
      </button>
    </div>`
    )
    .join("");

  $("#songList").innerHTML = html;
}

// ─── Search ──────────────────────────────────────────────
$("#search").addEventListener("input", render);

// ─── Sort buttons ────────────────────────────────────────
$$(".sort-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".sort-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentSort = btn.dataset.sort;
    render();
  });
});

// ─── Request modal ───────────────────────────────────────
const modal = $("#modal");
const nameInput = $("#nameInput");

// Remember name from localStorage
const savedName = localStorage.getItem("gigrequest_name") || "";
nameInput.value = savedName;

// Open modal on Request button click (event delegation)
$("#songList").addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-request");
  if (!btn) return;

  selectedSong = {
    id: Number(btn.dataset.id),
    title: btn.dataset.title,
    artist: btn.dataset.artist,
  };

  $("#modalSong").textContent = `${selectedSong.title} — ${selectedSong.artist}`;
  modal.classList.add("open");

  // Auto-focus name if empty, otherwise focus submit
  setTimeout(() => {
    if (!nameInput.value.trim()) nameInput.focus();
    else $("#btnSubmit").focus();
  }, 300);
});

// Close modal
function closeModal() {
  modal.classList.remove("open");
  selectedSong = null;
}

$("#btnCancel").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// Submit request
$("#btnSubmit").addEventListener("click", submitRequest);
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitRequest();
});

async function submitRequest() {
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    nameInput.style.borderColor = "var(--red)";
    setTimeout(() => (nameInput.style.borderColor = ""), 1500);
    return;
  }
  if (!selectedSong) return;

  const btn = $("#btnSubmit");
  btn.disabled = true;
  btn.textContent = "Sending…";

  try {
    const res = await fetch("/api/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId: selectedSong.id, requester: name }),
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Something went wrong.", true);
    } else {
      localStorage.setItem("gigrequest_name", name);
      showToast(`"${selectedSong.title}" added to the queue!`);

      // Flash the button green in the list
      const listBtn = document.querySelector(`.btn-request[data-id="${selectedSong.id}"]`);
      if (listBtn) {
        listBtn.textContent = "Sent ✓";
        listBtn.classList.add("sent");
        setTimeout(() => {
          listBtn.textContent = "Request";
          listBtn.classList.remove("sent");
        }, 3000);
      }
    }
  } catch (err) {
    showToast("Network error — please try again.", true);
  }

  btn.disabled = false;
  btn.textContent = "Send Request";
  closeModal();
}

// ─── Toast ───────────────────────────────────────────────
function showToast(msg, isError = false) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.className = "toast show" + (isError ? " error" : "");
  setTimeout(() => (toast.className = "toast"), 3000);
}

// ─── Escape HTML ─────────────────────────────────────────
function esc(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ─── Init ────────────────────────────────────────────────
loadSongs();
