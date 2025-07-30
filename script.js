// === CONFIGURACIÓN ===
const CHEF_PIN = "cocinero";
const USERS_KEY = "registeredUsers";
const MEALS_KEY = "mealsByUser";

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

// === GESTIÓN DE USUARIOS ===
function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch (e) {
    console.error("Error leyendo usuarios:", e);
    return {};
  }
}

function saveUser(name, pin) {
  const users = getUsers();
  users[name] = pin;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getUserMeals(user) {
  try {
    const allMeals = JSON.parse(localStorage.getItem(MEALS_KEY)) || {};
    return allMeals[user] || {};
  } catch (e) {
    console.error("Error leyendo comidas de usuario:", e);
    return {};
  }
}

function saveUserMeals(user, meals) {
  try {
    const allMeals = JSON.parse(localStorage.getItem(MEALS_KEY)) || {};
    allMeals[user] = meals;
    localStorage.setItem(MEALS_KEY, JSON.stringify(allMeals));
    console.log("✅ Comidas guardadas:", meals);
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

// === RESIDENTE: AUTENTICACIÓN Y SELECCIÓN ===
function initResidenteAuth() {
  const modal = document.getElementById("auth-modal");
  const nameInput = document.getElementById("user-name");
  const pinInput = document.getElementById("user-pin");
  const errorEl = document.getElementById("auth-error");

  showSection("auth-modal");
  nameInput.focus();

  document.getElementById("submit-auth").addEventListener("click", () => {
    const name = nameInput.value.trim();
    const pin = pinInput.value;

    if (!name || !pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
      errorEl.textContent = "❌ Usa 4 dígitos.";
      errorEl.style.display = "block";
      return;
    }

    const users = getUsers();

    if (users[name]) {
      if (users[name] === pin) {
        document.getElementById("current-user").textContent = name;
        document.getElementById("residente-app").style.display = "block";
        modal.style.display = "none";
        loadMealsGrid(name);
        setupReminders(name);
      } else {
        errorEl.textContent = "❌ Clave incorrecta.";
        errorEl.style.display = "block";
      }
    } else {
      saveUser(name, pin);
      document.getElementById("current-user").textContent = name;
      document.getElementById("residente-app").style.display = "block";
      modal.style.display = "none";
      loadMealsGrid(name);
      setupReminders(name);
    }
  });

  pinInput.addEventListener("keypress", (e) => {
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

// === COCINERO: ACCESO Y REPORTES ===
function initCocinero() {
  const pinInput = document.getElementById("chef-pin");
  const errorEl = document.getElementById("pin-error");
  const summaryContainer = document.getElementById("summary-container");
  const reportsContainer = document.getElementById("reports-container");

  document.getElementById("submit-pin").addEventListener("click", () => {
    if (pinInput.value === CHEF_PIN) {
      showSummary();
    } else {
      errorEl.style.display = "block";
      pinInput.value = "";
      pinInput.focus();
    }
  });

  pinInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") document.getElementById("submit-pin").click();
  });

  function showSummary() {
    errorEl.parentElement.style.display = "none";
    pinInput.parentElement.style.display = "none";
    document.getElementById("submit-pin").style.display = "none";
    summaryContainer.style.display = "block";
    reportsContainer.innerHTML = ""; // Limpiar reportes

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
  }

  // ✅ Reporte Semanal (número de personas por día)
  document.getElementById("btn-weekly").addEventListener("click", () => {
    reportsContainer.innerHTML = "";
    const mealsData = JSON.parse(localStorage.getItem(MEALS_KEY)) || {};
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    const dates = getWeekDates(weekStart);

    let html = "<h3>📅 Reporte Semanal (total de personas por día)</h3><ul>";
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
  });

  // ✅ Reporte Mensual (acumulado por semana)
  document.getElementById("btn-monthly").addEventListener("click", () => {
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
  });
}

// === CERRAR SESIÓN Y INICIALIZACIÓN ===
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn").addEventListener("click", () => {
    showSection("home-screen");
  });

  document.getElementById("logout-btn-cocinero").addEventListener("click", () => {
    showSection("home-screen");
  });

  document.getElementById("btn-residente").addEventListener("click", () => {
    showSection("auth-modal");
    initResidenteAuth();
  });

  document.getElementById("btn-cocinero").addEventListener("click", () => {
    showSection("cocinero-app");
    document.getElementById("chef-pin").focus();
    initCocinero();
  });
});