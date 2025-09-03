// === CONFIGURACIÓN ===
const CHEF_PIN = "12345"; // Clave para cocineros
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

// ✅ CORREGIDA: Número de semana según ISO 8601
function getWeekNumber(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const target = new Date(date);
  const dayDiff = (date.getDay() + 6) % 7; // Lunes = 0
  target.setDate(date.getDate() - dayDiff + 3); // Jueves de esa semana
  const jan4 = new Date(target.getFullYear(), 0, 4);
  const days = (target - jan4) / 86400000;
  return Math.ceil((days + jan4.getDay() + 1) / 7);
}

// ✅ CORREGIDA: parseWeekInput – Calcula el lunes de la semana ISO correcta
function parseWeekInput(weekStr) {
  const [yearStr, weekStrNum] = weekStr.split("-W");
  const year = parseInt(yearStr, 10);
  const weekNum = parseInt(weekStrNum, 10);

  // El 4 de enero siempre está en la semana 1 (por ISO)
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay(); // 0 = domingo

  // Calcular el primer jueves del año
  const firstThursday = new Date(jan4);
  firstThursday.setDate(jan4.getDate() + (4 - dayOfWeek + 7) % 7);

  // Calcular el jueves de la semana deseada
  const targetThursday = new Date(firstThursday);
  targetThursday.setDate(firstThursday.getDate() + (weekNum - 1) * 7);

  // El lunes es 3 días antes del jueves
  const monday = new Date(targetThursday);
  monday.setDate(targetThursday.getDate() - 3);

  return monday;
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
    residents[lastName] = true;
    localStorage.setItem(USERS_KEY, JSON.stringify(residents));
  }
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
  const sections = [
    "home-screen",
    "residente-modal",
    "cocinero-modal",
    "residente-app",
    "cocinero-app"
  ];
  sections.forEach(sec => {
    const el = document.getElementById(sec);
    if (el) el.style.display = "none";
  });

  const el = document.getElementById(id);
  if (el) {
    el.style.display = id.includes("modal") ? "flex" : "block";
  }
}

// === RESIDENTE: INGRESO POR APELLIDO ===
function initResidenteModal() {
  const modal = document.getElementById("residente-modal");
  const input = document.getElementById("resident-lastname");
  const errorEl = document.getElementById("resident-error");
  const appContainer = document.getElementById("residente-app");
  const userDisplay = document.getElementById("current-user");

  showSection("residente-modal");
  input.focus();
  errorEl.style.display = "none";

  document.getElementById("submit-residente").onclick = () => {
    const lastName = input.value.trim();

    if (!lastName) {
      errorEl.style.display = "block";
      return;
    }

    errorEl.style.display = "none";
    registerResident(lastName);

    userDisplay.textContent = lastName;
    appContainer.style.display = "block";
    modal.style.display = "none";

    loadMealsGrid(lastName);
    setupReminders(lastName);
  };

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") document.getElementById("submit-residente").click();
  });
}

function loadMealsGrid(user) {
  const weekInput = document.getElementById("week");
  const grid = document.getElementById("meals-grid");

  // ✅ Semana actual correcta (ISO)
  const today = new Date();
  const year = today.getFullYear();
  const weekNum = getWeekNumber(today);
  const defaultWeek = `${year}-W${weekNum.toString().padStart(2, '0')}`;
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

// === COCINERO: INGRESO CON CLAVE 12345 ===
function initCocineroModal() {
  const modal = document.getElementById("cocinero-modal");
  const pinInput = document.getElementById("chef-pin");
  const errorEl = document.getElementById("chef-error");
  const appContainer = document.getElementById("cocinero-app");

  showSection("cocinero-modal");
  pinInput.focus();
  errorEl.style.display = "none";

  document.getElementById("submit-chef").onclick = () => {
    if (pinInput.value === CHEF_PIN) {
      errorEl.style.display = "none";
      appContainer.style.display = "block";
      modal.style.display = "none";
      showSummary();
      setupReports();
    } else {
      errorEl.style.display = "block";
      pinInput.value = "";
      pinInput.focus();
    }
  };

  pinInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") document.getElementById("submit-chef").click();
  });
}

function showSummary() {
  const summaryContainer = document.getElementById("summary-container");
  const mealsData = JSON.parse(localStorage.getItem(MEALS_KEY)) || {};
  const tbody = document.getElementById("summary-body");
  tbody.innerHTML = "";

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1);
  const dates = getWeekDates(weekStart);

  let totalBreakfast = 0, totalLunch = 0, totalDinner = 0;

  dates.forEach(date => {
    const dateStr = formatDate(date);
    const row = document.createElement("tr");
    const dayCell = document.createElement("td");
    dayCell.textContent = formatDay(date);
    row.appendChild(dayCell);

    ["breakfast", "lunch", "dinner"].forEach(meal => {
      const cell = document.createElement("td");
      const ul = document.createElement("ul");
      const people = [];

      Object.keys(mealsData).forEach(username => {
        const userMeals = mealsData[username];
        if (userMeals[dateStr] && userMeals[dateStr][meal]) {
          const li = document.createElement("li");
          li.textContent = username;
          ul.appendChild(li);
          people.push(username);
        }
      });

      if (ul.children.length === 0) {
        const li = document.createElement("li");
        li.textContent = "–";
        li.style.color = "#999";
        ul.appendChild(li);
      }

      const countP = document.createElement("p");
      countP.style.fontSize = "0.85rem";
      countP.style.marginTop = "0.3rem";
      countP.style.color = "#555";
      countP.textContent = `(${people.length})`;

      if (meal === "breakfast") totalBreakfast += people.length;
      if (meal === "lunch") totalLunch += people.length;
      if (meal === "dinner") totalDinner += people.length;

      cell.appendChild(ul);
      cell.appendChild(countP);
      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });

  // Fila de totales
  const totalRow = document.createElement("tr");
  totalRow.style.fontWeight = "bold";
  totalRow.style.backgroundColor = "#f1faee";
  const totalCell = document.createElement("td");
  totalCell.textContent = "Total";
  totalRow.appendChild(totalCell);
  [totalBreakfast, totalLunch, totalDinner].forEach(total => {
    const cell = document.createElement("td");
    cell.textContent = `${total}`;
    totalRow.appendChild(cell);
  });
  tbody.appendChild(totalRow);

  summaryContainer.style.display = "block";
}

function setupReports() {
  const reportsContainer = document.getElementById("reports-container");

  document.getElementById("btn-weekly").onclick = () => {
    reportsContainer.innerHTML = "";
    const mealsData = JSON.parse(localStorage.getItem(MEALS_KEY)) || {};
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    const dates = getWeekDates(weekStart);

    let html = "<h3>📅 Reporte Semanal (total por día)</h3><ul>";
    dates.forEach(date => {
      const dateStr = formatDate(date);
      let breakfast = 0, lunch = 0, dinner = 0;

      Object.values(mealsData).forEach(userMeals => {
        if (userMeals[dateStr]?.breakfast) breakfast++;
        if (userMeals[dateStr]?.lunch) lunch++;
        if (userMeals[dateStr]?.dinner) dinner++;
      });

      html += `<li><strong>${formatDay(date)}:</strong> ${breakfast} desayunos, ${lunch} comidas, ${dinner} cenas</li>`;
    });
    html += "</ul>";
    reportsContainer.innerHTML = html;
  };

  document.getElementById("btn-monthly").onclick = () => {
    reportsContainer.innerHTML = "";
    const mealsData = JSON.parse(localStorage.getItem(MEALS_KEY)) || {};
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const summary = {};
    for (let day = 1; day <= 31; day++) {
      const date = new Date(year, month, day);
      if (date.getMonth() !== month) break;

      const dateStr = formatDate(date);
      const weekNum = getWeekNumber(date);
      const key = `Semana ${weekNum}`;
      if (!summary[key]) summary[key] = { breakfast: 0, lunch: 0, dinner: 0 };

      Object.values(mealsData).forEach(userMeals => {
        if (userMeals[dateStr]?.breakfast) summary[key].breakfast++;
        if (userMeals[dateStr]?.lunch) summary[key].lunch++;
        if (userMeals[dateStr]?.dinner) summary[key].dinner++;
      });
    }

    let html = "<h3>📅 Reporte Mensual (acumulado por semana)</h3><ul>";
    Object.keys(summary).forEach(week => {
      const s = summary[week];
      html += `<li><strong>${week}:</strong> ${s.breakfast} desayunos, ${s.lunch} comidas, ${s.dinner} cenas</li>`;
    });
    html += "</ul>";
    reportsContainer.innerHTML = html;
  };
}

// === INICIALIZACIÓN ===
document.addEventListener("DOMContentLoaded", () => {
  // Mostrar pantalla inicial
  showSection("home-screen");

  // Botones de inicio
  document.getElementById("btn-residente").onclick = initResidenteModal;
  document.getElementById("btn-cocinero").onclick = initCocineroModal;

  // Cerrar sesión
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    showSection("home-screen");
  });

  document.getElementById("logout-btn-cocinero")?.addEventListener("click", () => {
    showSection("home-screen");
  });
});