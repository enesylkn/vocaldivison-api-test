const BASE_URL = "https://biego-vocal-division.hf.space";

const removeBtn = document.getElementById("removeFileBtn");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const formatSelect = document.getElementById("formatSelect");
const fileInput = document.getElementById("audioFile");
const processBtn = document.getElementById("processBtn");

const optionButtons = document.querySelectorAll(".option");
const vocalsBtn = document.getElementById("downloadVocals");
const instrumentalBtn = document.getElementById("downloadInstrumental");
const resultsBox = document.querySelector(".results");

let selectedFile = null;
let evtSource = null;
let dragCounter = 0;

/* ---------- INITIAL STATE ---------- */
[vocalsBtn, instrumentalBtn].forEach(btn => {
  btn.hidden = true;
  btn.disabled = true;
});

removeBtn.hidden = true;

/* ---------- RESULT ALIGN FIX ---------- */
function updateResultsLayout() {
  const visibleButtons = [vocalsBtn, instrumentalBtn].filter(
    btn => !btn.hidden
  );

  if (visibleButtons.length === 1) {
    resultsBox.classList.add("single");
  } else {
    resultsBox.classList.remove("single");
  }
}

/* ---------- STEM SELECTION ---------- */
function updateStemSelection() {
  const vocalsActive = document
    .querySelector('.option[data-stem="vocals"]')
    .classList.contains("active");

  const instrumentalActive = document
    .querySelector('.option[data-stem="instrumental"]')
    .classList.contains("active");

  vocalsBtn.hidden = !vocalsActive;
  instrumentalBtn.hidden = !instrumentalActive;

  resultsBox.classList.remove("single", "double");

  if (vocalsActive && instrumentalActive) {
    resultsBox.classList.add("double");
  } else if (vocalsActive || instrumentalActive) {
    resultsBox.classList.add("single");
  }
}

optionButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    btn.classList.toggle("active");
    updateStemSelection();
  });
});

/* ---------- FILE SELECT ---------- */
fileInput.addEventListener("change", e => {
  selectedFile = e.target.files[0];
  if (!selectedFile) return;

  removeBtn.hidden = false;
  processBtn.disabled = false;
  processBtn.classList.add("enabled");
  processBtn.innerText = `Process file: ${selectedFile.name}`;
});

/* ---------- PROCESS ---------- */
processBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  if (evtSource) evtSource.close();

  progressBar.style.width = "0%";
  progressText.innerText = "Processing has started...";

  [vocalsBtn, instrumentalBtn].forEach(btn => {
    btn.disabled = true;
    btn.classList.remove("active");
  });

  processBtn.innerText = "Processing...";
  processBtn.disabled = true;
  processBtn.classList.remove("enabled");

  const formData = new FormData();
  formData.append("audio", selectedFile);

  try {
    const response = await fetch(`${BASE_URL}/separate`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) throw new Error("Backend error");

    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    evtSource = new EventSource(`${BASE_URL}/progress`);

    evtSource.onmessage = e => {
      const percent = Number(e.data);
      progressBar.style.width = percent + "%";
      progressText.innerText = `Processing: ${percent}%`;

      if (percent >= 100) {
        evtSource.close();

        progressText.innerText = "Processing completed.";
        processBtn.innerText = "Completed";

        if (!vocalsBtn.hidden) {
          vocalsBtn.disabled = false;
          vocalsBtn.classList.add("active");
          vocalsBtn.onclick = () => downloadFile(result.vocals);
        }

        if (!instrumentalBtn.hidden) {
          instrumentalBtn.disabled = false;
          instrumentalBtn.classList.add("active");
          instrumentalBtn.onclick = () => downloadFile(result.instrumental);
        }

        updateResultsLayout();
      }
    };
  } catch (err) {
    console.error(err);
    progressText.innerText = "An error occurred.";
    processBtn.innerText = "Retry";
    processBtn.disabled = false;
    processBtn.classList.add("enabled");
  }
});

/* ---------- DOWNLOAD ---------- */
function downloadFile(path) {
  const format = formatSelect.value;
  window.open(`${BASE_URL}${path}?format=${format}`, "_blank");
}

/* ---------- DRAG & DROP ---------- */
["dragenter", "dragover", "dragleave", "drop"].forEach(evt =>
  document.addEventListener(evt, e => e.preventDefault())
);

document.addEventListener("dragenter", () => {
  dragCounter++;
  document.body.classList.add("drag-active");
});

document.addEventListener("dragleave", () => {
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    document.body.classList.remove("drag-active");
  }
});

document.addEventListener("drop", e => {
  dragCounter = 0;
  document.body.classList.remove("drag-active");

  const files = e.dataTransfer.files;
  if (!files.length) return;

  selectedFile = files[0];
  fileInput.files = files;

  removeBtn.hidden = false;
  processBtn.disabled = false;
  processBtn.classList.add("enabled");
  processBtn.innerText = `Process file: ${selectedFile.name}`;
});

/* ---------- REMOVE FILE ---------- */
removeBtn.addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";

  processBtn.disabled = true;
  processBtn.classList.remove("enabled");
  processBtn.innerText = "Process";

  progressBar.style.width = "0%";
  progressText.innerText = "Waiting...";

  [vocalsBtn, instrumentalBtn].forEach(btn => {
    btn.hidden = true;
    btn.disabled = true;
    btn.classList.remove("active");
    btn.onclick = null;
  });

  resultsBox.classList.remove("single");
  removeBtn.hidden = true;

  if (evtSource) evtSource.close();
});

/* ---------- LOGO EFFECT ---------- */
const logo = document.getElementById("logo");
const letters = logo.querySelectorAll("span");

logo.addEventListener("mousemove", e => {
  letters.forEach(letter => {
    const r = letter.getBoundingClientRect();
    letter.classList.toggle(
      "hovered",
      e.clientX > r.left &&
      e.clientX < r.right &&
      e.clientY > r.top &&
      e.clientY < r.bottom
    );
  });
});

logo.addEventListener("mouseleave", () => {
  letters.forEach(l => l.classList.remove("hovered"));
});


const cursorGlow = document.getElementById("cursor-glow");

document.addEventListener("mousemove", e => {
  cursorGlow.style.left = e.clientX + "px";
  cursorGlow.style.top = e.clientY + "px";
});

let glowX = 0;
let glowY = 0;

document.addEventListener("mousemove", e => {
  glowX = e.clientX;
  glowY = e.clientY;
});

function animateGlow() {
  cursorGlow.style.left = glowX + "px";
  cursorGlow.style.top = glowY + "px";
  requestAnimationFrame(animateGlow);
}

animateGlow();

const container = document.querySelector(".container");

/* container içine girince glow kapansın */
container.addEventListener("mouseenter", () => {
  cursorGlow.style.opacity = "0";
});

/* container dışına çıkınca glow geri gelsin */
container.addEventListener("mouseleave", () => {
  cursorGlow.style.opacity = "1";
});