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

// ✅ CORREGIDA: parseWeekInput – Cálculo correcto de fechas (ISO 8601)
function parseWeekInput(weekStr) {
  const [yearStr, weekStrNum] = weekStr.split("-W");
  const year = parseInt(yearStr, 10);
  const weekNum = parseInt(weekStrNum, 10);

  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay();
  const thuOfWeek1 = new Date(jan4);
  thuOfWeek1.setDate(jan4.getDate() + (4 - dayOfWeek + 7) % 7);

  const thuOfTargetWeek = new Date(thuOfWeek1);
  thuOfTargetWeek.setDate(thuOfWeek1.getDate() + (weekNum - 1) * 7);

  const monday = new Date(thuOfTargetWeek);
  monday.setDate(thuOfTargetWeek.getDate() - 3);

  return monday;
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

// === GESTIÓN DE RESIDENTES