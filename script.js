const cardsContainer = document.getElementById("cardsContainer");
const addCardButton = document.getElementById("addCardButton");
const cardTemplate = document.getElementById("cardTemplate");
const expenseRowTemplate = document.getElementById("expenseRowTemplate");
const salaryInput = document.getElementById("salaryInput");
const benefitsInput = document.getElementById("benefitsInput");
const incomeTotal = document.getElementById("incomeTotal");
const expenseTotal = document.getElementById("expenseTotal");
const balanceTotal = document.getElementById("balanceTotal");
const monthNote = document.getElementById("monthNote");
const monthTabs = document.getElementById("monthTabs");
const exportBackupButton = document.getElementById("exportBackupButton");
const importBackupButton = document.getElementById("importBackupButton");
const importBackupInput = document.getElementById("importBackupInput");

const STORAGE_KEY = "controle-financeiro-pessoal-v1";
const APP_VERSION = 2;
const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];
const CARD_COLORS = ["#1f8a70", "#3b82f6", "#f97316", "#e11d48", "#8b5cf6", "#0f766e"];

let appState = null;

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value || 0);
}

function parseCurrencyInput(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function clampMonthIndex(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return ((parsed % 12) + 12) % 12;
}

function clampInstallments(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.min(12, parsed));
}

function normalizeInputValue(value, fallback = "") {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

function getDefaultNote(monthIndex) {
  return `Previsao de saldo para o mes de ${MONTH_NAMES[monthIndex]}`;
}

function createMonthData(monthIndex, source = {}) {
  return {
    salary: normalizeInputValue(source.salary),
    benefits: normalizeInputValue(source.benefits),
    note: normalizeInputValue(source.note, getDefaultNote(monthIndex))
  };
}

function createCardData(name, color, id = createId("card")) {
  return {
    id,
    name: typeof name === "string" ? name : "",
    color
  };
}

function createExpenseData(cardId, startMonthIndex, source = {}) {
  const isFixed = Boolean(source.isFixed);

  return {
    id: source.id || createId("expense"),
    cardId,
    description: normalizeInputValue(source.description),
    value: normalizeInputValue(source.value),
    installmentCount: isFixed ? 1 : clampInstallments(source.installmentCount || 1),
    isFixed,
    startMonthIndex: clampMonthIndex(
      typeof source.startMonthIndex === "number" ? source.startMonthIndex : startMonthIndex
    )
  };
}

function createBlankExpenses(cardId, monthIndex, count = 2) {
  return Array.from({ length: count }, () => createExpenseData(cardId, monthIndex));
}

function createDefaultState() {
  const currentMonthIndex = new Date().getMonth();
  const defaultCards = [
    createCardData("Cartao Principal", "#1f8a70"),
    createCardData("Cartao Reserva", "#f97316")
  ];

  return {
    version: APP_VERSION,
    activeMonthIndex: currentMonthIndex,
    months: MONTH_NAMES.map((_, index) => createMonthData(index)),
    cards: defaultCards,
    expenses: defaultCards.flatMap((card) => createBlankExpenses(card.id, currentMonthIndex))
  };
}

function normalizeCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return [];
  }

  return cards.map((card, index) =>
    createCardData(
      card.name || `Cartao ${index + 1}`,
      card.color || CARD_COLORS[index % CARD_COLORS.length],
      card.id || createId("card")
    )
  );
}

function normalizeExpenses(expenses, cardIds, activeMonthIndex) {
  if (!Array.isArray(expenses)) {
    return [];
  }

  return expenses
    .filter((expense) => cardIds.has(expense.cardId))
    .map((expense) => createExpenseData(expense.cardId, activeMonthIndex, expense));
}

function migrateLegacyState(state) {
  const currentMonthIndex = new Date().getMonth();
  const months = MONTH_NAMES.map((_, index) => createMonthData(index));
  months[currentMonthIndex] = createMonthData(currentMonthIndex, {
    salary: normalizeInputValue(state.salary),
    benefits: normalizeInputValue(state.benefits),
    note: normalizeInputValue(state.note, getDefaultNote(currentMonthIndex))
  });

  const cards = normalizeCards(state.cards);
  const expenses = [];

  state.cards.forEach((card, index) => {
    const normalizedCard = cards[index];
    const sourceExpenses = Array.isArray(card.expenses) && card.expenses.length > 0
      ? card.expenses
      : [{}, {}];

    sourceExpenses.forEach((expense) => {
      expenses.push(
        createExpenseData(normalizedCard.id, currentMonthIndex, {
          description: normalizeInputValue(expense.description),
          value: normalizeInputValue(expense.value)
        })
      );
    });
  });

  if (cards.length === 0) {
    return createDefaultState();
  }

  return {
    version: APP_VERSION,
    activeMonthIndex: currentMonthIndex,
    months,
    cards,
    expenses
  };
}

function normalizeState(source) {
  if (!source || typeof source !== "object") {
    return createDefaultState();
  }

  if (Array.isArray(source.months) && Array.isArray(source.cards) && Array.isArray(source.expenses)) {
    const cards = normalizeCards(source.cards);
    const activeMonthIndex = clampMonthIndex(source.activeMonthIndex ?? new Date().getMonth());
    const months = MONTH_NAMES.map((_, index) => createMonthData(index, source.months[index]));
    const cardIds = new Set(cards.map((card) => card.id));
    const expenses = normalizeExpenses(source.expenses, cardIds, activeMonthIndex);

    return {
      version: APP_VERSION,
      activeMonthIndex,
      months,
      cards: cards.length > 0 ? cards : createDefaultState().cards,
      expenses
    };
  }

  if (Array.isArray(source.cards)) {
    return migrateLegacyState(source);
  }

  return createDefaultState();
}

function saveAppState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function loadAppState() {
  const rawState = localStorage.getItem(STORAGE_KEY);

  if (!rawState) {
    appState = createDefaultState();
    saveAppState();
    return;
  }

  try {
    appState = normalizeState(JSON.parse(rawState));
    saveAppState();
  } catch (error) {
    console.error("Falha ao carregar os dados salvos:", error);
    appState = createDefaultState();
    saveAppState();
  }
}

function getMonthData(monthIndex = appState.activeMonthIndex) {
  return appState.m
