// === CONFIGURACIÓN ===
const CHEF_PIN = "12345";
const USERS_KEY = "registeredResidents"; // Aún usamos localStorage para residentes (solo nombres)
const FIREBASE_URL = "https://TU-PROYECTO-default-rtdb.europe-west1.firebasedatabase.app/meals.json";

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

function getWeekDates(sunday) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

// === Obtiene el domingo de esta semana ===
function getCurrentWeekSunday() {
  const today = new Date();
  const day = today.getDay(); // 0 = domingo
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day);
  return sunday;
}

// === Obtiene el domingo de la próxima semana ===
function getNextWeekSunday() {
  const sunday = getCurrentWeekSunday();
  const nextSunday = new Date(sunday);
  nextSunday.setDate(sunday.getDate() + 7);
  return nextSunday;
}

// === GESTIÓN DE RESIDENTES (localStorage, solo apellidos) ===
function getResidents() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch (e) {
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

// === GESTIÓN DE COMIDAS: Firebase (lectura/escritura) ===

// Leer todas las comidas
async function getAllMeals() {
  try {
    const response = await fetch(FIREBASE_URL);
    return (await response.json()) || {};
  } catch (e) {
    console.error("Error leyendo comidas:", e);
    return {};
  }
}

// Guardar todas las comidas
async function saveAllMeals(mealsData) {
  try {
    await fetch(FIREBASE_URL, {
      method: "PUT",
      body: JSON.stringify(mealsData),
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (e) {
    console.error("Error guardando comidas:", e);
  }
}

// Obtener comidas de un usuario
async function getUserMeals(user) {
  const allMeals = await getAllMeals();
  return allMeals[user] || {};
}

// Guardar comidas de un usuario
async function saveUserMeals(user, meals) {
  const allMeals = await getAllMeals();
  allMeals[user] = meals;
  await saveAllMeals(allMeals);
}

// === NAVEGACIÓN ===
function showSection(id) {
  const sections = ["home-screen", "residente-modal", "cocinero-modal", "residente-app", "cocinero-app"];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  document.getElementById(id).style.display = id.includes("modal") ? "flex" : "block";
}

// === RESIDENTE: MODAL ===
function initResidenteModal() {
  const modal = document.getElementById("residente-modal");
  const input = document.getElementById("resident-lastname");
  const errorEl = document.getElementById("resident-error");
  const appContainer = document.getElementById("residente-app");
  const userDisplay = document.getElementById("current-user");

  showSection("residente-modal");
  input.focus();
  errorEl.style.display = "none";

  document.getElementById("submit-residente").onclick = async () => {
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
    await setupWeekButtons(lastName);
  };

  input.addEventListener("keypress", e => {
    if (e.key === "Enter") document.getElementById("submit-residente").click();
  });
}

// === Configuración de botones de semana para residentes ===
async function setupWeekButtons(user) {
  const weekLabel = document.getElementById("week-label");
  const grid = document.getElementById("meals-grid");
  const currentBtn = document.getElementById("btn-current-week");
  const nextBtn = document.getElementById("btn-next-week");

  const renderWeek = async (sunday) => {
    const dates = getWeekDates(sunday);
    const stored = await getUserMeals(user);

    const firstDay = formatDay(dates[0]);
    const lastDay = formatDay(dates[6]);
    weekLabel.textContent = `Semana: ${firstDay} al ${lastDay}`;

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

        input.addEventListener("change", async () => {
          const meals = await getUserMeals(user);
          if (!meals[dateStr]) meals[dateStr] = {};
          meals[dateStr][meal] = input.checked;
          await saveUserMeals(user, meals);
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

  currentBtn.onclick = () => renderWeek(getCurrentWeekSunday());
  nextBtn.onclick = () => renderWeek(getNextWeekSunday());

  // Por defecto: semana siguiente
  renderWeek(getNextWeekSunday());
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
  setInterval(async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);
    const stored = await getUserMeals(user);
    const hasReg = stored[tomorrowStr] && (stored[tomorrowStr].breakfast || stored[tomorrowStr].lunch || stored[tomorrowStr].dinner);
    if (!hasReg) {
      alert(`🔔 ¡Hola! Recuerda registrar si vas a desayunar, comer o cenar mañana.`);
    }
  }, 6 * 60 * 60 * 1000);
}

// === COCINERO: INGRESO Y PANEL ===
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
      setupCookWeekButtons();
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

// === Configuración de botones de semana para cocineros ===
async function setupCookWeekButtons() {
  const weekLabel = document.getElementById("cook-week-label");
  const summaryContainer = document.getElementById("summary-container");
  const currentBtn = document.getElementById("btn-cook-current-week");
  const nextBtn = document.getElementById("btn-cook-next-week");

  const showSummaryForWeek = async (sunday) => {
    const dates = getWeekDates(sunday);
    const mealsData = await getAllMeals();

    const firstDay = formatDay(dates[0]);
    const lastDay = formatDay(dates[6]);
    weekLabel.textContent = `Semana: ${firstDay} al ${lastDay}`;

    const tbody = document.getElementById("summary-body");
    tbody.innerHTML = "";

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
  };

  currentBtn.onclick = () => showSummaryForWeek(getCurrentWeekSunday());
  nextBtn.onclick = () => showSummaryForWeek(getNextWeekSunday());

  // Por defecto: semana actual
  showSummaryForWeek(getCurrentWeekSunday());
}

// === Reportes para cocineros ===
function setupReports() {
  const reportsContainer = document.getElementById("reports-container");

  document.getElementById("btn-weekly").onclick = async () => {
    reportsContainer.innerHTML = "";
    const mealsData = await getAllMeals();
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
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

  document.getElementById("btn-monthly").onclick = async () => {
    reportsContainer.innerHTML = "";
    const mealsData = await getAllMeals();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const summary = {};
    for (let day = 1; day <= 31; day++) {
      const date = new Date(year, month, day);
      if (date.getMonth() !== month) break;

      const dateStr = formatDate(date);
      const weekNum = Math.floor((date.getDate() - 1 + new Date(year, month, 1).getDay()) / 7) + 1;
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

// === Cargar y convertir README.md a HTML ===
async function loadReadme() {
  const readmeContent = document.getElementById("readme-content");
  const modal = document.getElementById("readme-modal");

  try {
    const response = await fetch('README.md');
    if (!response.ok) throw new Error('No se pudo cargar el archivo');

    let text = await response.text();

    // Reemplazar encabezados
    text = text.replace(/^#\s+(.+)$/gm, '<h2>$1</h2>');
    text = text.replace(/^##\s+(.+)$/gm, '<h3>$1</h3>');
    text = text.replace(/^###\s+(.+)$/gm, '<h4>$1</h4>');

    // Reemplazar listas
    text = text.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>[\s\S]*?)(?=(<h2>|<h3>|$))/g, '<ul>$1</ul>');
    
    // Reemplazar negritas
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Reemplazar saltos de línea
    text = text.replace(/\n{2,}/g, '</p><p>');
    text = text.replace(/\n/g, '<br>');
    text = text.replace(/<br><\/p>/g, '</p>');
    text = text.replace(/<p><\/p>/g, '');

    if (!text.startsWith('<p>') && !text.startsWith('<h') && !text.startsWith('<ul>')) {
      text = `<p>${text}</p>`;
    }

    readmeContent.innerHTML = text;
  } catch (e) {
    readmeContent.innerHTML = `
      <p style="color: #e74c3c;">
        ❌ No se pudo cargar el archivo README.md.<br>
        Asegúrate de que existe en la misma carpeta.
      </p>
    `;
    console.error("Error al cargar README.md:", e);
  }

  modal.style.display = "flex";
}

// === INICIALIZACIÓN ===
document.addEventListener("DOMContentLoaded", () => {
  showSection("home-screen");

  document.getElementById("btn-residente").onclick = initResidenteModal;
  document.getElementById("btn-cocinero").onclick = initCocineroModal;
  document.getElementById("btn-readme").onclick = loadReadme;

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    showSection("home-screen");
  });

  document.getElementById("logout-btn-cocinero")?.addEventListener("click", () => {
    showSection("home-screen");
  });
});