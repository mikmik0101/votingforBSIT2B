/* ============================================================
   BSIT CLASS ELECTION — app.js
   Beginner-friendly, well-commented vanilla JS.
   Everything talks directly to Firestore (no backend server).
   ============================================================ */

// ---- List of officer positions (edit here if positions change) ----
const POSITIONS = [
  "President",
  "Vice President",
  "Secretary",
  "Assistant Secretary",
  "Treasurer",
  "Assistant Treasurer",
  "Auditor",
  "Public Information Officer (PIO)",
  "Business Manager",
  "Sergeant-at-Arms"
];

// ---- App state kept in memory for the current browser session ----
let currentStudent = null;      // { id: <docId>, studentId, voted }
let electionState = "loading";  // "before" | "active" | "ended"
let selectedNominees = {};      // { [position]: nomineeDocId }
let nomineesByPosition = {};    // { [position]: [ {id, name, votes} ] }
let countdownTimer = null;

// ---- DOM shortcuts ----
const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  restoreSession();
  listenToSettings();
  wireVerifyForm();
  wireSubmitVotesButton();
});

/* ============================================================
   SESSION HANDLING
   We only keep the verified student ID in sessionStorage so a
   page refresh doesn't force re-entry. This is NOT a login
   system — it just avoids re-typing the Student ID.
   ============================================================ */
function restoreSession() {
  const savedId = sessionStorage.getItem("verifiedStudentDocId");
  const savedStudentId = sessionStorage.getItem("verifiedStudentId");
  if (savedId && savedStudentId) {
    db.collection("students").doc(savedId).get().then((doc) => {
      if (doc.exists) {
        currentStudent = { id: doc.id, ...doc.data() };
        showElectionUI();
      } else {
        sessionStorage.clear();
      }
    });
  }
}

/* ============================================================
   STUDENT ID VERIFICATION
   ============================================================ */
function wireVerifyForm() {
  const form = $("verifyForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("studentIdInput");
    const rawId = input.value.trim().toUpperCase();
    const alertBox = $("verifyAlert");
    alertBox.classList.add("d-none");

    if (!rawId) return;

    // Look up the student by studentId field
    const snapshot = await db.collection("students")
      .where("studentId", "==", rawId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      showAlert(alertBox, "Invalid Student ID.", "danger");
      return;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    if (data.voted === true) {
      showAlert(alertBox, "You have already voted.", "warning");
      return;
    }

    // Success — store in memory + session, then show election UI
    currentStudent = { id: doc.id, ...data };
    sessionStorage.setItem("verifiedStudentDocId", doc.id);
    sessionStorage.setItem("verifiedStudentId", data.studentId);
    showElectionUI();
  });
}

function showAlert(box, message, type) {
  box.textContent = message;
  box.className = `alert alert-${type}`;
  box.classList.remove("d-none");
}

function showElectionUI() {
  $("verifySection").classList.add("d-none");
  $("electionSection").classList.remove("d-none");
  $("welcomeStudentId").textContent = currentStudent.studentId;
  renderPositions();
  listenToNominees();
}

/* ============================================================
   ELECTION SCHEDULE (settings/schedule document)
   ============================================================ */
function listenToSettings() {
  db.collection("settings").doc("schedule").onSnapshot((doc) => {
    if (!doc.exists) return;
    const { electionStart, electionEnd } = doc.data();
    const start = electionStart.toDate();
    const end = electionEnd.toDate();

    updateElectionState(start, end);

    // Refresh the state every second for the live countdown
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => updateElectionState(start, end), 1000);
  });
}

function updateElectionState(start, end) {
  const now = new Date();
  let newState;
  if (now < start) newState = "before";
  else if (now >= start && now <= end) newState = "active";
  else newState = "ended";

  electionState = newState;
  renderScheduleBanner(start, end, now);
  applyElectionStateToUI();
}

function renderScheduleBanner(start, end, now) {
  const banner = $("scheduleBanner");
  if (electionState === "before") {
    const diff = start - now;
    banner.className = "alert alert-info text-center fw-semibold";
    banner.textContent = `Election has not started yet. Starts in ${formatCountdown(diff)}`;
  } else if (electionState === "active") {
    const diff = end - now;
    banner.className = "alert alert-primary text-center fw-semibold";
    banner.textContent = `Voting is open! Closes in ${formatCountdown(diff)}`;
  } else {
    banner.className = "alert alert-secondary text-center fw-semibold";
    banner.textContent = "Election Closed.";
  }
}

function formatCountdown(ms) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  parts.push(`${hours.toString().padStart(2, "0")}h`);
  parts.push(`${minutes.toString().padStart(2, "0")}m`);
  parts.push(`${seconds.toString().padStart(2, "0")}s`);
  return parts.join(" ");
}

function applyElectionStateToUI() {
  const disableVotingUI = electionState !== "active";
  document.querySelectorAll(".vote-btn").forEach((btn) => {
    btn.disabled = disableVotingUI || (currentStudent && currentStudent.voted);
  });
  document.querySelectorAll(".add-nominee-btn").forEach((btn) => {
    btn.disabled = disableVotingUI;
  });
  const submitBtn = $("submitVotesBtn");
  if (submitBtn) {
    submitBtn.disabled = disableVotingUI || (currentStudent && currentStudent.voted);
  }
  const resultsSection = $("resultsSection");
  if (resultsSection) {
    resultsSection.classList.toggle("d-none", electionState !== "ended");
  }
}

/* ============================================================
   RENDER POSITION CARDS
   ============================================================ */
function renderPositions() {
  const container = $("positionsContainer");
  container.innerHTML = "";

  POSITIONS.forEach((position) => {
    const safeId = slugify(position);
    const col = document.createElement("div");
    col.className = "col-12 col-md-6 col-lg-4 mb-4";
    col.innerHTML = `
      <div class="card position-card h-100 shadow-sm">
        <div class="card-header">
          <h5 class="mb-0">${position}</h5>
        </div>
        <ul class="list-group list-group-flush nominee-list" id="nomineeList-${safeId}">
          <li class="list-group-item text-muted small">Loading nominees…</li>
        </ul>
        <div class="card-footer bg-white border-top-0">
          <button class="btn btn-outline-primary btn-sm w-100 add-nominee-btn"
                  data-position="${position}">
            + Add Nominee
          </button>
        </div>
      </div>
    `;
    container.appendChild(col);
  });

  // Wire "Add Nominee" buttons
  document.querySelectorAll(".add-nominee-btn").forEach((btn) => {
    btn.addEventListener("click", () => openAddNomineeModal(btn.dataset.position));
  });
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/* ============================================================
   REALTIME NOMINEES LISTENER
   ============================================================ */
function listenToNominees() {
  db.collection("nominees").onSnapshot((snapshot) => {
    nomineesByPosition = {};
    POSITIONS.forEach((p) => (nomineesByPosition[p] = []));

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!nomineesByPosition[data.position]) nomineesByPosition[data.position] = [];
      nomineesByPosition[data.position].push({ id: doc.id, ...data });
    });

    POSITIONS.forEach((position) => renderNomineeList(position));
    if (electionState === "ended") renderResults();
  });
}

function renderNomineeList(position) {
  const safeId = slugify(position);
  const list = $(`nomineeList-${safeId}`);
  if (!list) return;

  const nominees = nomineesByPosition[position] || [];

  if (nominees.length === 0) {
    list.innerHTML = `<li class="list-group-item text-muted small">No nominees yet. Be the first to add one!</li>`;
    return;
  }

  list.innerHTML = "";
  nominees.forEach((nominee) => {
    const isSelected = selectedNominees[position] === nominee.id;
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";
    li.innerHTML = `
      <span class="nominee-name">${escapeHtml(nominee.name)}</span>
      <button class="btn btn-sm vote-btn ${isSelected ? "btn-danger" : "btn-outline-danger"}"
              data-position="${position}" data-id="${nominee.id}">
        ❤️ ${isSelected ? "Selected" : "Vote"}
      </button>
    `;
    list.appendChild(li);
  });

  // Wire vote buttons for this position
  list.querySelectorAll(".vote-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectNominee(btn.dataset.position, btn.dataset.id));
  });

  applyElectionStateToUI();
}

function selectNominee(position, nomineeId) {
  if (electionState !== "active") return;
  if (currentStudent && currentStudent.voted) return;

  // Selecting again deselects; otherwise switch selection for that position
  selectedNominees[position] = selectedNominees[position] === nomineeId ? null : nomineeId;
  renderNomineeList(position);
}

/* ============================================================
   ADD NOMINEE — validation + Firestore save
   ============================================================ */
let addNomineeModal;

function openAddNomineeModal(position) {
  $("nomineeModalPosition").value = position;
  $("nomineeModalPositionLabel").textContent = position;
  $("nomineeNameInput").value = "";
  $("nomineeCheckMsg").textContent = "";
  $("nomineeCheckMsg").className = "form-text";
  $("saveNomineeBtn").disabled = true;

  addNomineeModal = addNomineeModal || new bootstrap.Modal($("addNomineeModal"));
  addNomineeModal.show();
}

function wireAddNomineeModal() {
  const input = $("nomineeNameInput");
  const checkMsg = $("nomineeCheckMsg");
  const saveBtn = $("saveNomineeBtn");

  let debounceTimer = null;

  input.addEventListener("input", () => {
    // Force uppercase while typing
    const cursorPos = input.selectionStart;
    input.value = input.value.toUpperCase();
    input.setSelectionRange(cursorPos, cursorPos);

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => validateNomineeInput(), 250);
  });

  saveBtn.addEventListener("click", async () => {
    const ok = await validateNomineeInput();
    if (!ok) return;

    const position = $("nomineeModalPosition").value;
    const name = normalizeNomineeName(input.value);

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    try {
      await db.collection("nominees").add({
        position,
        name,
        votes: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      addNomineeModal.hide();
    } catch (err) {
      checkMsg.textContent = "Error saving nominee. Please try again.";
      checkMsg.className = "form-text text-danger";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Nominee";
    }
  });
}

// Collapse multiple spaces, trim
function normalizeNomineeName(raw) {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

// Returns true if valid AND available (not duplicate); updates UI feedback
async function validateNomineeInput() {
  const input = $("nomineeNameInput");
  const checkMsg = $("nomineeCheckMsg");
  const saveBtn = $("saveNomineeBtn");
  const position = $("nomineeModalPosition").value;

  const name = normalizeNomineeName(input.value);

  if (!name) {
    checkMsg.textContent = "";
    saveBtn.disabled = true;
    return false;
  }

  // Format: exactly two parts, letters only, second part is 1 uppercase letter
  const parts = name.split(" ");
  const formatOk =
    parts.length === 2 &&
    /^[A-Z]+$/.test(parts[0]) &&
    /^[A-Z]$/.test(parts[1]);

  if (!formatOk) {
    checkMsg.textContent =
      "Format must be: FIRST NAME + LAST NAME INITIAL (e.g. JOHN C).";
    checkMsg.className = "form-text text-danger";
    saveBtn.disabled = true;
    return false;
  }

  // Check duplicate for this position
  const existing = (nomineesByPosition[position] || []).some(
    (n) => n.name === name
  );

  if (existing) {
    checkMsg.textContent = "This nominee has already been added for this position.";
    checkMsg.className = "form-text text-danger";
    saveBtn.disabled = true;
    return false;
  }

  checkMsg.textContent = "Nominee available.";
  checkMsg.className = "form-text text-success";
  saveBtn.disabled = false;
  return true;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================================
   SUBMIT VOTES
   ============================================================ */
function wireSubmitVotesButton() {
  wireAddNomineeModal();

  $("submitVotesBtn").addEventListener("click", () => {
    if (electionState !== "active") return;
    if (!currentStudent || currentStudent.voted) return;

    const chosenCount = Object.values(selectedNominees).filter(Boolean).length;
    if (chosenCount === 0) {
      alert("Please select at least one nominee before submitting.");
      return;
    }

    $("confirmVoteText").textContent =
      "You can only submit your votes once. Are you sure you want to continue?";
    const confirmModal = new bootstrap.Modal($("confirmVoteModal"));
    confirmModal.show();

    $("confirmSubmitBtn").onclick = async () => {
      confirmModal.hide();
      await submitVotes();
    };
  });
}

async function submitVotes() {
  const submitBtn = $("submitVotesBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  try {
    // Re-check the student hasn't already voted (defends against double
    // submission from two tabs) before writing anything.
    const studentRef = db.collection("students").doc(currentStudent.id);

    await db.runTransaction(async (tx) => {
      const studentDoc = await tx.get(studentRef);
      if (!studentDoc.exists) throw new Error("Student record not found.");
      if (studentDoc.data().voted === true) throw new Error("ALREADY_VOTED");

      // Write one vote doc + increment nominee vote count per selection
      Object.entries(selectedNominees).forEach(([position, nomineeId]) => {
        if (!nomineeId) return;
        const voteRef = db.collection("votes").doc();
        tx.set(voteRef, {
          studentId: currentStudent.studentId,
          position,
          nominee: nomineeId,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        const nomineeRef = db.collection("nominees").doc(nomineeId);
        tx.update(nomineeRef, {
          votes: firebase.firestore.FieldValue.increment(1)
        });
      });

      tx.update(studentRef, { voted: true });
    });

    currentStudent.voted = true;
    submitBtn.textContent = "Votes Submitted ✔";
    applyElectionStateToUI();
    showAlert($("voteResultAlert"), "Thank you! Your votes have been recorded.", "success");
  } catch (err) {
    if (err.message === "ALREADY_VOTED") {
      showAlert($("voteResultAlert"), "You have already voted.", "warning");
      currentStudent.voted = true;
      applyElectionStateToUI();
    } else {
      console.error(err);
      showAlert($("voteResultAlert"), "Something went wrong submitting your votes. Please try again.", "danger");
      submitBtn.disabled = false;
      submitBtn.textContent = "SUBMIT MY VOTES";
    }
  }
}

/* ============================================================
   RESULTS (shown after election ends)
   ============================================================ */
function renderResults() {
  const container = $("resultsContainer");
  if (!container) return;
  container.innerHTML = "";

  POSITIONS.forEach((position) => {
    const nominees = [...(nomineesByPosition[position] || [])];
    const totalVotes = nominees.reduce((sum, n) => sum + (n.votes || 0), 0);
    const maxVotes = nominees.reduce((max, n) => Math.max(max, n.votes || 0), 0);
    const winners = nominees.filter((n) => (n.votes || 0) === maxVotes && maxVotes > 0);
    const isTie = winners.length > 1;

    nominees.sort((a, b) => (b.votes || 0) - (a.votes || 0));

    const col = document.createElement("div");
    col.className = "col-12 col-md-6 col-lg-4 mb-4";

    const rows = nominees.length
      ? nominees.map((n) => {
          const pct = totalVotes ? ((n.votes || 0) / totalVotes * 100).toFixed(1) : "0.0";
          const isWinner = winners.some((w) => w.id === n.id) && !isTie;
          const isTiedTop = winners.some((w) => w.id === n.id) && isTie;
          return `
            <li class="list-group-item">
              <div class="d-flex justify-content-between">
                <span>${escapeHtml(n.name)}</span>
                <span>${n.votes || 0} votes (${pct}%)</span>
              </div>
              ${isWinner ? '<div class="text-success fw-bold small mt-1">🏆 WINNER</div>' : ""}
              ${isTiedTop ? '<div class="text-warning fw-bold small mt-1">Tie</div>' : ""}
            </li>
          `;
        }).join("")
      : `<li class="list-group-item text-muted small">No nominees for this position.</li>`;

    col.innerHTML = `
      <div class="card h-100 shadow-sm">
        <div class="card-header"><h5 class="mb-0">${position}</h5></div>
        <ul class="list-group list-group-flush">${rows}</ul>
      </div>
    `;
    container.appendChild(col);
  });
}
