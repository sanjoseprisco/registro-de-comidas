// === CONFIGURACIÓN ===
const CHEF_PIN = "12345";
const USERS_KEY = "registeredResidents";
const MEALS_KEY = "mealsByUser";

// === FUNCIONES DE APOYO ===
function formatDate(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().split("T")[0];
}

function formatDay(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  return d.toLocaleDateString("es-ES", {
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
    dates.push(new Date(d));
  }
  return dates;
}

// ✅ CORREGIDA CON UTC: Número de semana ISO
function getWeekNumber(d) {
  const date = new Date(d);
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (utcDate.getUTCDay() + 6) % 7;
  const thursday = new Date(utcDate);
  thursday.setUTCDate(utcDate.getUTCDate() - day + 3);

  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const dayOfWeek = firstThursday.getUTCDay();
  const daysToFirstThu = (4 - dayOfWeek + 7) % 7;
  firstThursday.setUTCDate(4 + daysToFirstThu);

  const diff = thursday - firstThursday;
  return Math.floor(diff / 604800000) + 1;
}

// ✅ CORREGIDA CON UTC: parseWeekInput
function parseWeekInput(weekStr) {
  const [yearStr, weekStrNum] = weekStr.split("-W");
  const year = parseInt(yearStr, 10);
  const weekNum = parseInt(weekStrNum, 10);

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay();
  const daysToFirstThursday = (4 - dayOfWeek + 7) % 7;
  const firstThursday = new Date(jan4);
  firstThursday.setUTCDate(jan4.getUTCDate() + daysToFirstThursday);

  const targetThursday = new Date(firstThursday);
  targetThursday.setUTCDate(firstThursday.getUTCDate