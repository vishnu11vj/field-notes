// ============================================
// Field Notes — habit ledger logic
// All data lives in localStorage; nothing leaves the browser.
// ============================================

const STORAGE_KEY = "field-notes-habits";
const DAYS_IN_STRIP = 91; // 13 weeks, matches a GitHub-style strip

/** @typedef {{ id: string, name: string, createdAt: string, completions: Record<string, true> }} Habit */

/** @returns {Habit[]} */
function loadHabits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** @param {Habit[]} habits */
function saveHabits(habits) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

function todayKey() {
  return toDateKey(new Date());
}

/** @param {Date} d */
function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateKey, delta) {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

/** Current streak counting backward from today (or yesterday if today not yet done). */
function currentStreak(habit) {
  let count = 0;
  let cursor = todayKey();
  if (!habit.completions[cursor]) {
    cursor = addDays(cursor, -1);
  }
  while (habit.completions[cursor]) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** Longest streak ever recorded for this habit. */
function bestStreak(habit) {
  const dates = Object.keys(habit.completions).sort();
  if (dates.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    if (addDays(dates[i - 1], 1) === dates[i]) {
      run++;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
  }
  return best;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------- Rendering ----------

const listEl = document.getElementById("habit-list");
const emptyEl = document.getElementById("empty-state");
const statsEl = document.getElementById("stats");
const formEl = document.getElementById("new-habit-form");
const inputEl = document.getElementById("new-habit-input");
const showFormBtn = document.getElementById("show-form-btn");
const emptyAddBtn = document.getElementById("empty-add-btn");

let habits = loadHabits();

function render() {
  renderStats();
  if (habits.length === 0) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");
  listEl.innerHTML = habits.map(habitTemplate).join("");
}

function renderStats() {
  const doneToday = habits.filter((h) => h.completions[todayKey()]).length;
  const longest = habits.reduce((max, h) => Math.max(max, bestStreak(h)), 0);
  statsEl.innerHTML = `
    <span><strong>${habits.length}</strong>tended</span>
    <span><strong>${doneToday}</strong>done today</span>
    <span><strong>${longest}</strong>best streak (days)</span>
  `;
}

function leafSvg() {
  return `<svg class="leaf" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 14C4 7 9 3 19 3C19 12 15 18 8 19C6.5 19.2 5.2 18.5 4.5 17.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4 20C5 18 7 15 11 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
}

function growthStrip(habit) {
  const today = todayKey();
  let cells = "";
  for (let i = DAYS_IN_STRIP - 1; i >= 0; i--) {
    const key = addDays(today, -i);
    const done = !!habit.completions[key];
    const isToday = key === today;
    const streakLen = done ? currentStreakAt(habit, key) : 0;
    const level = !done ? 0 : streakLen >= 14 ? 3 : streakLen >= 7 ? 2 : 1;
    const classes = isToday ? "cell is-today" : "cell";
    cells += `<div class="${classes}" data-level="${level}" data-date="${key}" title="${key}${
      done ? " — done" : ""
    }"></div>`;
  }
  return `<div class="strip-wrap"><div class="strip">${cells}</div></div>`;
}

// helper: how long a streak had run as of a given completed date (for shading intensity)
function currentStreakAt(habit, dateKey) {
  if (!habit.completions[dateKey]) return 0;
  let count = 0;
  let cursor = dateKey;
  while (habit.completions[cursor]) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function habitTemplate(habit) {
  const done = !!habit.completions[todayKey()];
  return `
    <li class="habit" data-id="${habit.id}">
      <div class="habit-name-row">
        ${leafSvg()}
        <span class="habit-name">${escapeHtml(habit.name)}</span>
        <div class="streaks">
          <span><b>${currentStreak(habit)}d</b> current</span>
          <span><b>${bestStreak(habit)}d</b> best</span>
        </div>
        <div class="habit-actions">
          <button class="mark-done ${done ? "is-done" : ""}" data-action="toggle">
            ${done ? "Done today" : "Mark done"}
          </button>
          <button class="icon-btn" data-action="delete" title="Remove habit" aria-label="Remove habit">✕</button>
        </div>
      </div>
      ${growthStrip(habit)}
    </li>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Events ----------

listEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const li = btn.closest(".habit");
  const id = li.dataset.id;
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;

  if (btn.dataset.action === "toggle") {
    const key = todayKey();
    if (habit.completions[key]) {
      delete habit.completions[key];
    } else {
      habit.completions[key] = true;
    }
    saveHabits(habits);
    render();
  }

  if (btn.dataset.action === "delete") {
    if (confirm(`Remove "${habit.name}"? This can't be undone.`)) {
      habits = habits.filter((h) => h.id !== id);
      saveHabits(habits);
      render();
    }
  }
});

function revealForm() {
  formEl.classList.remove("hidden");
  inputEl.focus();
}

showFormBtn.addEventListener("click", revealForm);
emptyAddBtn.addEventListener("click", revealForm);

document.getElementById("cancel-form-btn").addEventListener("click", () => {
  inputEl.value = "";
  formEl.classList.add("hidden");
});

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = inputEl.value.trim();
  if (!name) return;
  habits.push({
    id: uid(),
    name,
    createdAt: todayKey(),
    completions: {},
  });
  saveHabits(habits);
  inputEl.value = "";
  formEl.classList.add("hidden");
  render();
});

render();
