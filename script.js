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
  return appState.months[monthIndex];
}

function getMonthDistance(startMonthIndex, targetMonthIndex) {
  return (targetMonthIndex - startMonthIndex + 12) % 12;
}

function getExpenseOccurrence(expense, monthIndex = appState.activeMonthIndex) {
  if (expense.isFixed) {
    return {
      isVisible: true,
      label: "Fixo mensal"
    };
  }

  const distance = getMonthDistance(expense.startMonthIndex, monthIndex);

  if (distance < expense.installmentCount) {
    return {
      isVisible: true,
      label: expense.installmentCount > 1
        ? `Parcela ${distance + 1}/${expense.installmentCount}`
        : "Gasto avulso"
    };
  }

  return {
    isVisible: false,
    label: ""
  };
}

function getVisibleExpensesForCard(cardId, monthIndex = appState.activeMonthIndex) {
  return appState.expenses
    .filter((expense) => expense.cardId === cardId)
    .map((expense) => ({
      expense,
      occurrence: getExpenseOccurrence(expense, monthIndex)
    }))
    .filter(({ occurrence }) => occurrence.isVisible);
}

function getCardTotal(cardId, monthIndex = appState.activeMonthIndex) {
  return getVisibleExpensesForCard(cardId, monthIndex).reduce(
    (sum, { expense }) => sum + parseCurrencyInput(expense.value),
    0
  );
}

function updateSummary() {
  const monthData = getMonthData();
  const totalIncome = parseCurrencyInput(monthData.salary) + parseCurrencyInput(monthData.benefits);
  const totalExpenses = appState.cards.reduce((sum, card) => sum + getCardTotal(card.id), 0);
  const balance = totalIncome - totalExpenses;

  incomeTotal.textContent = formatCurrency(totalIncome);
  expenseTotal.textContent = formatCurrency(totalExpenses);
  balanceTotal.textContent = formatCurrency(balance);
}

function updateRenderedCardTotals() {
  document.querySelectorAll(".finance-card").forEach((cardElement) => {
    const cardId = cardElement.dataset.cardId;
    const totalInput = cardElement.querySelector(".card-total-input");

    if (totalInput) {
      totalInput.value = formatCurrency(getCardTotal(cardId));
    }
  });

  updateSummary();
}

function renderMonthFields() {
  const monthData = getMonthData();
  salaryInput.value = monthData.salary;
  benefitsInput.value = monthData.benefits;
  monthNote.value = monthData.note;
}

function renderMonthTabs() {
  monthTabs.innerHTML = "";

  MONTH_NAMES.forEach((monthName, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `month-tab${index === appState.activeMonthIndex ? " active" : ""}`;
    button.textContent = monthName;
    button.addEventListener("click", () => {
      appState.activeMonthIndex = index;
      renderAll();
      saveAppState();
    });

    monthTabs.appendChild(button);
  });
}

function updateCard(cardId, updates) {
  const card = appState.cards.find((item) => item.id === cardId);

  if (!card) {
    return;
  }

  Object.assign(card, updates);
}

function updateExpense(expenseId, updates) {
  const expense = appState.expenses.find((item) => item.id === expenseId);

  if (!expense) {
    return null;
  }

  Object.assign(expense, updates);

  if (expense.isFixed) {
    expense.installmentCount = 1;
  } else {
    expense.installmentCount = clampInstallments(expense.installmentCount);
  }

  return expense;
}

function removeExpense(expenseId) {
  appState.expenses = appState.expenses.filter((expense) => expense.id !== expenseId);
}

function removeCard(cardId) {
  appState.cards = appState.cards.filter((card) => card.id !== cardId);
  appState.expenses = appState.expenses.filter((expense) => expense.cardId !== cardId);
}

function addExpenseRow(cardElement, expenseData, occurrence) {
  const rowFragment = expenseRowTemplate.content.cloneNode(true);
  const row = rowFragment.querySelector(".expense-row");
  const descriptionInput = row.querySelector(".expense-description");
  const valueInput = row.querySelector(".expense-value");
  const installmentsInput = row.querySelector(".expense-installments");
  const fixedInput = row.querySelector(".expense-fixed");
  const removeButton = row.querySelector(".remove-expense-button");
  const badge = row.querySelector(".expense-badge");

  descriptionInput.value = expenseData.description;
  valueInput.value = expenseData.value;
  installmentsInput.value = expenseData.installmentCount;
  installmentsInput.disabled = expenseData.isFixed;
  fixedInput.checked = expenseData.isFixed;
  badge.textContent = occurrence.label;

  descriptionInput.addEventListener("input", (event) => {
    updateExpense(expenseData.id, { description: event.target.value });
    saveAppState();
  });

  valueInput.addEventListener("input", (event) => {
    updateExpense(expenseData.id, { value: event.target.value });
    updateRenderedCardTotals();
    saveAppState();
  });

  installmentsInput.addEventListener("change", (event) => {
    updateExpense(expenseData.id, {
      installmentCount: clampInstallments(event.target.value),
      isFixed: false
    });
    renderAll();
    saveAppState();
  });

  fixedInput.addEventListener("change", (event) => {
    updateExpense(expenseData.id, {
      isFixed: event.target.checked,
      installmentCount: event.target.checked ? 1 : expenseData.installmentCount
    });
    renderAll();
    saveAppState();
  });

  removeButton.addEventListener("click", () => {
    removeExpense(expenseData.id);
    renderAll();
    saveAppState();
  });

  cardElement.querySelector(".expenses-list").appendChild(row);
}

function wireCard(cardElement, cardData) {
  const nameInput = cardElement.querySelector(".card-name-input");
  const colorInput = cardElement.querySelector(".card-color-input");
  const addExpenseButton = cardElement.querySelector(".add-expense-button");
  const menuButton = cardElement.querySelector(".card-menu-button");
  const menuPanel = cardElement.querySelector(".card-menu-panel");
  const deleteCardButton = cardElement.querySelector(".card-delete-button");

  nameInput.addEventListener("input", (event) => {
    updateCard(cardData.id, { name: event.target.value });
    saveAppState();
  });

  colorInput.addEventListener("input", (event) => {
    updateCard(cardData.id, { color: event.target.value });
    cardElement.style.setProperty("--card-color", event.target.value);
    saveAppState();
  });

  addExpenseButton.addEventListener("click", () => {
    appState.expenses.push(createExpenseData(cardData.id, appState.activeMonthIndex));
    renderAll();
    saveAppState();
  });

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isHidden = menuPanel.hasAttribute("hidden");

    document.querySelectorAll(".card-menu-panel").forEach((panel) => {
      panel.setAttribute("hidden", "");
    });

    if (isHidden) {
      menuPanel.removeAttribute("hidden");
    }
  });

  deleteCardButton.addEventListener("click", () => {
    removeCard(cardData.id);
    renderAll();
    saveAppState();
  });
}

function renderCards() {
  cardsContainer.innerHTML = "";

  appState.cards.forEach((cardData) => {
    const cardFragment = cardTemplate.content.cloneNode(true);
    const cardElement = cardFragment.querySelector(".finance-card");
    const nameInput = cardElement.querySelector(".card-name-input");
    const colorInput = cardElement.querySelector(".card-color-input");
    const totalInput = cardElement.querySelector(".card-total-input");
    const expensesList = cardElement.querySelector(".expenses-list");
    const visibleExpenses = getVisibleExpensesForCard(cardData.id);

    cardElement.dataset.cardId = cardData.id;
    cardElement.style.setProperty("--card-color", cardData.color);
    nameInput.value = cardData.name;
    colorInput.value = cardData.color;
    totalInput.value = formatCurrency(getCardTotal(cardData.id));

    wireCard(cardElement, cardData);

    if (visibleExpenses.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "empty-expenses-message";
      emptyMessage.textContent = "Nenhum gasto aparece neste mes ainda. Use Adicionar gasto para lancar um novo item.";
      expensesList.appendChild(emptyMessage);
    } else {
      visibleExpenses.forEach(({ expense, occurrence }) => {
        addExpenseRow(cardElement, expense, occurrence);
      });
    }

    cardsContainer.appendChild(cardElement);
  });
}

function renderAll() {
  renderMonthTabs();
  renderMonthFields();
  renderCards();
  updateSummary();
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(appState, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "controle-financeiro-backup.json";
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);
}

function importBackup(file) {
  if (!file) {
    return;
  }

  file.text()
    .then((content) => {
      appState = normalizeState(JSON.parse(content));
      renderAll();
      saveAppState();
      importBackupInput.value = "";
    })
    .catch((error) => {
      console.error("Falha ao importar backup:", error);
      window.alert("Nao foi possivel importar este backup. Verifique se o arquivo JSON esta valido.");
      importBackupInput.value = "";
    });
}

salaryInput.addEventListener("input", (event) => {
  getMonthData().salary = event.target.value;
  updateSummary();
  saveAppState();
});

benefitsInput.addEventListener("input", (event) => {
  getMonthData().benefits = event.target.value;
  updateSummary();
  saveAppState();
});

monthNote.addEventListener("input", (event) => {
  getMonthData().note = event.target.value;
  saveAppState();
});

addCardButton.addEventListener("click", () => {
  const nextColor = CARD_COLORS[appState.cards.length % CARD_COLORS.length];
  const cardData = createCardData(`Cartao ${appState.cards.length + 1}`, nextColor);

  appState.cards.push(cardData);
  appState.expenses.push(...createBlankExpenses(cardData.id, appState.activeMonthIndex));
  renderAll();
  saveAppState();
});

exportBackupButton.addEventListener("click", exportBackup);
importBackupButton.addEventListener("click", () => importBackupInput.click());
importBackupInput.addEventListener("change", (event) => {
  importBackup(event.target.files[0]);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".card-menu")) {
    document.querySelectorAll(".card-menu-panel").forEach((panel) => {
      panel.setAttribute("hidden", "");
    });
  }
});

loadAppState();
renderAll();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    let isRefreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (isRefreshing) {
        return;
      }

      isRefreshing = true;
      window.location.reload();
    });

    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js?v=14", {
        updateViaCache: "none"
      });

      registration.update();
    } catch (error) {
      console.error("Falha ao registrar o service worker:", error);
    }
  });
}
