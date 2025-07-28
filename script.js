// === CONFIGURACIÓN ===
const CHEF_PIN = "cocinero";
const USERS_KEY = "registeredUsers";   // { "Nombre Apellido": "1234" }
const MEALS_KEY = "mealsByUser";      // { "Nombre Apellido": { "2025-04-07": { breakfast: true } } }

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

// ✅ Corrección: Calcula el lunes de una semana dada (ISO 8601)
function parseWeekInput(weekStr) {
  const [yearStr, weekStrNum] = weekStr.split("-W");
  const year = parseInt(yearStr, 10);
  const weekNum = parseInt(weekStrNum, 10);

  // El primer día del año
  const firstDayOfYear = new Date(year, 0, 1);

  // Día de la semana del 1 de enero (0 = domingo, 1 = lunes, ...)
  const dayOfWeek = firstDayOfYear.getDay();

  // Encontrar el primer jueves del año
  const firstThursday = new Date(year, 0, 1 + (4 - dayOfWeek + 7) % 7);

  // El lunes de la semana 1 (3 días antes del primer jueves)
  const startDate = new Date(firstThursday);
  startDate.setDate(firstThursday.getDate() - 3);

  // Calcular el lunes de la semana deseada
  const targetDate = new Date(startDate);
  targetDate.setDate(startDate.getDate() + (weekNum - 1) * 7);

  return targetDate;
}

// ✅ Corrección: Número de semana según ISO 8601
function getWeekNumber(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7; // Lunes = 0
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = Math.ceil((firstThursday - target.valueOf()) / 604800000) + 1;
  return weekNumber;
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
    console.log("✅ Comidas guardadas:", allMeals);
  } catch (e) {
    console.error("Error guardando comidas:", e);
  }
}

function getCurrentUser() {
  return localStorage.getItem("currentUser");
}

function setCurrentUser(name) {
  localStorage.setItem("currentUser", name);
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
  const appContainer = document.getElementById("residente-app");
  const userDisplay = document.getElementById("current-user");

  const currentUser = getCurrentUser();
  if (currentUser) {
    userDisplay.textContent = currentUser;
    appContainer.style.display = "block";
    modal.style.display = "none";
    loadMealsGrid();
    setupSaveButton();
    setupReminders();
    return;
  }

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
        setCurrentUser(name);
        userDisplay.textContent = name;
        appContainer.style.display = "block";
        modal.style.display = "none";
        loadMealsGrid();
        setupSaveButton();
        setupReminders();
      } else {
        errorEl.textContent = "❌ Clave incorrecta.";
        errorEl.style.display = "block";
      }
    } else {
      saveUser(name, pin);
      setCurrentUser(name);
      userDisplay.textContent = name;
      appContainer.style.display = "block";
      modal.style.display = "none";
      loadMealsGrid();
      setupSaveButton();
      setupReminders();
    }
  });

  pinInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") document.getElementById("submit-auth").click();
  });
}

function loadMealsGrid() {
  const weekInput = document.getElementById("week");
  const grid = document.getElementById("meals-grid");
  const user = getCurrentUser();

  // Fecha actual
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const defaultWeek = nextWeek.toISOString().slice(0, 10).replace(/-/g, "").slice(0, 4) + "-W" + getWeekNumber(nextWeek);
  weekInput.value = defaultWeek;

  // Elemento para mostrar el rango de fechas
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

    // ✅ Mostrar rango de fechas en el encabezado
    const firstDay = formatDay(dates[0]);
    const lastDay = formatDay(dates[6]);
    document.getElementById("week-label").textContent = `Semana: ${firstDay} al ${lastDay}`;

    // Limpiar y renderizar cuadrícula
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

        const labelEl = document.createElement("label");
        labelEl.textContent = label;

        wrapper.appendChild(input);
        wrapper.appendChild(labelEl);
        options.appendChild(wrapper);
      });

      dayBox.appendChild(options);
      grid.appendChild(dayBox);
    });
  };

  weekInput.addEventListener("change", render);
  render();
}

function setupSaveButton() {
  const saveButton = document.getElementById("save-meals");
  const grid = document.getElementById("meals-grid");
  const user = getCurrentUser();

  saveButton.addEventListener("click", () => {
    const meals = {};

    Array.from(grid.querySelectorAll(".meal-day")).forEach(dayBox => {
      const inputs = dayBox.querySelectorAll("input[type='checkbox']");
      inputs.forEach(input => {
        const dateStr = input.dataset.date;
        const meal = input.dataset.meal;
        if (!meals[dateStr]) meals[dateStr] = {};
        meals[dateStr][meal] = input.checked;
      });
    });

    saveUserMeals(user, meals);
    alert(`✅ Tus selecciones han sido guardadas correctamente.`);
  });
}

function setupReminders() {
  setInterval(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);
    const stored = getUserMeals(getCurrentUser());
    const hasReg = stored[tomorrowStr] && (stored[tomorrowStr].breakfast || stored[tomorrowStr].lunch || stored[tomorrowStr].dinner);
    if (!hasReg) {
      alert(`🔔 ¡Hola ${getCurrentUser()}! Recuerda registrar si vas a desayunar, comer o cenar mañana.`);
    }
  }, 6 * 60 * 60 * 1000);
}

// === COCINERO: ACCESO Y RESUMEN ===
function initCocinero() {
  const pinInput = document.getElementById("chef-pin");
  const errorEl = document.getElementById("pin-error");
  const summaryContainer = document.getElementById("summary-container");

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

    const mealsData = JSON.parse(localStorage.getItem(MEALS_KEY)) || {};
    const tbody = document.getElementById("summary-body");
    tbody.innerHTML = "";

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    const dates = getWeekDates(weekStart);

    dates.forEach(date => {
      const dateStr = formatDate(date);
      const row = document.createElement("tr");

      const dayCell = document.createElement("td");
      dayCell.textContent = formatDay(date);
      row.appendChild(dayCell);

      ["breakfast", "lunch", "dinner"].forEach(meal => {
        const cell = document.createElement("td");
        const ul = document.createElement("ul");

        Object.keys(mealsData).forEach(username => {
          const userMeals = mealsData[username];
          if (userMeals[dateStr] && userMeals[dateStr][meal]) {
            const li = document.createElement("li");
            li.textContent = username;
            ul.appendChild(li);
          }
        });

        if (ul.children.length === 0) {
          const li = document.createElement("li");
          li.textContent = "–";
          li.style.color = "#999";
          ul.appendChild(li);
        }

        cell.appendChild(ul);
        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });

    console.log("Datos del resumen cargados:", mealsData);
  }
}

// === INICIALIZACIÓN ===
document.addEventListener("DOMContentLoaded", () => {
  // Ocultar todo al inicio
  showSection("home-screen");

  // Botones de inicio
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