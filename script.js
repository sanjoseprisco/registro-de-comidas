// === CONFIGURACIÓN ===
const CHEF_PIN = "1234"; // Clave para cocineros
const USERS_KEY = "registeredResidents"; // Guarda apellidos de residentes
const MEALS_KEY = "mealsByUser"; // Comidas por usuario

// === FUNCIONES DE APOYO ===
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function formatDay(date) {
  return date.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).replace(/^\w/, c => c.toUpperCase());
}

function getWeekDates(weekStart) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function parseWeekInput(weekStr) {
  const [yearStr, weekStrNum] = weekStr.split("-W");
  const year = parseInt(yearStr, 10);
  const weekNum = parseInt(weekStrNum, 10);

  const firstDayOfYear = new Date(year, 0, 1);
  const dayOfWeek = firstDayOfYear.getDay();
  const firstThursday = new Date(year, 0, 1 + (4 - dayOfWeek + 7) % 7);
  const startDate = new Date(firstThursday);
  startDate.setDate(firstThursday.getDate() - 3);
  const targetDate = new Date(startDate);
  targetDate.setDate(targetDate.getDate() + (weekNum - 1) * 7);
  return targetDate;
}

function getWeekNumber(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return Math.ceil((firstThursday - target.valueOf()) / 604800000) + 1;
}

// === GESTIÓN DE RESIDENTES (solo apellidos) ===
function getResidents() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch (e) {
    console.error("Error leyendo residentes:", e);
    return {};
  }
}

function registerResident(lastName) {
  const residents = getResidents();
  if (!residents[lastName]) {
    residents[lastName] = true; // Solo registra que existe
    localStorage.setItem(USERS_KEY, JSON.stringify(residents));
  }
}

function isValidResident(lastName) {
  const residents = getResidents();
  return !!residents[lastName];
}

// === GESTIÓN DE COMIDAS ===
function getUserMeals(user) {
  try {
    const allMeals = JSON.parse(localStorage.getItem(MEALS_KEY)) || {};
    return allMeals[user] || {};
  } catch (e) {
    console.error("Error leyendo comidas:", e);
    return {};
  }
}

function saveUserMeals(user, meals) {
  try {
    const allMeals = JSON.parse(localStorage.getItem(MEALS_KEY)) || {};
    allMeals[user] = meals;
    localStorage.setItem(MEALS_KEY, JSON.stringify(allMeals));
  } catch (e) {
    console.error("Error guardando comidas:", e);
  }
}

// === NAVEGACIÓN ENTRE PANTALLAS ===
function showSection(id) {
  document.getElementById("home-screen").style.display = "none";
  document.getElementById("auth-modal").style.display = "none";
  document.getElementById("residente-app").style.display = "none";
  document.getElementById("cocinero-app").style.display = "none";

  if (id === "auth-modal") {
    document.getElementById("auth-modal").style.display = "flex";
  } else {
    document.getElementById(id).style.display = "block";
  }
}

// === RESIDENTE: SOLO APELLIDO (sin clave) ===
function initResidenteAuth() {
  const modal = document.getElementById("auth-modal");
  const nameInput = document.getElementById("user-name");
  const pinInput = document.getElementById("user-pin");
  const errorEl = document.getElementById("auth-error");
  const appContainer = document.getElementById("residente-app");
  const userDisplay = document.getElementById("current-user");

  // ✅ Mostrar solo apellido
  pinInput.parentElement.style.display = "none"; // Ocultar campo de clave
  document.getElementById("submit-auth").textContent = "Entrar";

  showSection("auth-modal");
  nameInput.focus();

  document.getElementById("submit-auth").addEventListener("click", () => {
    const lastName = nameInput.value.trim();

    if (!lastName) {
      errorEl.textContent = "❌ Por favor, introduce tu apellido.";
      errorEl.style.display = "block";
      return;
    }

    // ✅ Registrar automáticamente si es nuevo
    registerResident(lastName);

    userDisplay.textContent = lastName;
    appContainer.style.display = "block";
    modal.style.display = "none";

    loadMealsGrid(lastName);
    setupReminders(lastName);
  });

  nameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") document.getElementById("submit-auth").click();
  });
}

function loadMealsGrid(user) {
  const weekInput = document.getElementById("week");
  const grid = document.getElementById("meals-grid");

  const today = new Date();
  const defaultWeek = today.toISOString().slice(0, 10).replace(/-/g, "").slice(0, 4) + "-W" + getWeekNumber(today);
  weekInput.value = defaultWeek;

  const weekLabel = document.createElement("p");
  weekLabel.id = "week-label";
  weekLabel.style.textAlign = "center";
  weekLabel.style.color = "#666";
  weekLabel.style.fontSize = "0.9rem";
  weekLabel.style.marginTop = "0.5rem";
  if (!document.getElementById("week-label")) {
    document.querySelector(".week-selector").appendChild(weekLabel);
  }

  const render = () => {
    const weekDate = parseWeekInput(weekInput.value);
    const dates = getWeekDates(weekDate);
    const stored = getUserMeals(user);

    const firstDay = formatDay(dates[0]);
    const lastDay = formatDay(dates[6]);
    document.getElementById("week-label").textContent = `Semana: ${firstDay} al ${lastDay}`;

    grid.innerHTML = "";
    dates.forEach(date => {
      const dateStr = formatDate(date);
      const dayBox = document.createElement("div");
      dayBox.className = "meal-day";

      const dayTitle = document.createElement("h3");
      dayTitle.textContent = formatDay(date);
      dayBox.appendChild(dayTitle);

      const options = document.createElement("div");
      options.className = "meal-options";

      ["breakfast", "lunch", "dinner"].forEach(meal => {
        const label = {
          breakfast: "Desayuno (8:00)",
          lunch: "Comida (14:15)",
          dinner: "Cena (21:00)"
        }[meal];

        const wrapper = document.createElement("div");
        wrapper.className = "meal-option";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.dataset.date = dateStr;
        input.dataset.meal = meal;
        if (stored[dateStr] && stored[dateStr][meal]) input.checked = true;

        input.addEventListener("change", () => {
          const meals = getUserMeals(user);
          if (!meals[dateStr]) meals[dateStr] = {};
          meals[dateStr][meal] = input.checked;
          saveUserMeals(user, meals);
          updateMealsSummary(user, dates, meals);
        });

        const labelEl = document.createElement("label");
        labelEl.textContent = label;

        wrapper.appendChild(input);
        wrapper.appendChild(labelEl);
        options.appendChild(wrapper);
      });

      dayBox.appendChild(options);
      grid.appendChild(dayBox);
    });

    updateMealsSummary(user, dates, stored);
  };

  weekInput.addEventListener("change", render);
  render();
}

function updateMealsSummary(user, dates, stored) {
  let breakfasts = 0, lunches = 0, dinners = 0;
  dates.forEach(date => {
    const dateStr = formatDate(date);
    if (stored[dateStr]?.breakfast) breakfasts++;
    if (stored[dateStr]?.lunch) lunches++;
    if (stored[dateStr]?.dinner) dinners++;
  });

  const container = document.getElementById("meals-summary-container");
  container.innerHTML = `
    <div class="meals-summary">
      Has registrado esta semana:
      <strong>${breakfasts}</strong> desayunos,
      <strong>${lunches}</strong> comidas,
      <strong>${dinners}</strong> cenas.
    </div>
  `;
}

function setupReminders(user) {
  setInterval(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);
    const stored = getUserMeals(user);
    const hasReg = stored[tomorrowStr] && (stored[tomorrowStr].breakfast || stored[tomorrowStr].lunch || stored[tomorrowStr].dinner);
    if (!hasReg) {
      alert(`🔔 ¡Hola! Recuerda registrar si vas a desayunar, comer o cenar mañana.`);
    }
  }, 6 * 60 * 60 * 1000);
}

// === COCINERO: ACCESO CON CLAVE 1234 ===
function initCocinero() {
  const pinInput = document.getElementById("chef-pin");
  const errorEl = document.getElementById("pin-error");
  const summaryContainer = document.getElementById("summary-container");
  const reportsContainer = document.getElementById("reports-container");

  document.getElementById("submit-pin").addEventListener("click", () => {
    if (pinInput.value === CHE