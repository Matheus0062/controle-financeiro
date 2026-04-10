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
const STORAGE_KEY = "controle-financeiro-pessoal-v1";

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

function readAppState() {
  return {
    salary: salaryInput.value,
    benefits: benefitsInput.value,
    note: monthNote.value,
    cards: [...document.querySelectorAll(".finance-card")].map((card) => ({
      name: card.querySelector(".card-name-input").value,
      color: card.querySelector(".card-color-input").value,
      expenses: [...card.querySelectorAll(".expense-row")].map((row) => ({
        description: row.querySelector(".expense-description").value,
        value: row.querySelector(".expense-value").value
      }))
    }))
  };
}

function saveAppState() {
  const state = readAppState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadAppState() {
  const savedState = localStorage.getItem(STORAGE_KEY);

  if (!savedState) {
    return false;
  }

  try {
    const state = JSON.parse(savedState);
    salaryInput.value = state.salary || "";
    benefitsInput.value = state.benefits || "";
    monthNote.value = state.note || "Previsao de saldo para o mes de Maio";
    cardsContainer.innerHTML = "";

    if (Array.isArray(state.cards) && state.cards.length > 0) {
      state.cards.forEach((cardData, index) => {
        createCard(
          cardData.name || `Cartao ${index + 1}`,
          cardData.color || "#1f8a70",
          Array.isArray(cardData.expenses) ? cardData.expenses : []
        );
      });
    } else {
      createDefaultCards();
    }

    updateSummary();
    return true;
  } catch (error) {
    console.error("Falha ao carregar os dados salvos:", error);
    return false;
  }
}

function updateSummary() {
  const totalIncome = parseCurrencyInput(salaryInput.value) + parseCurrencyInput(benefitsInput.value);
  const cardTotals = [...document.querySelectorAll(".finance-card")].map((card) =>
    parseCurrencyInput(card.dataset.total || "0")
  );
  const totalExpenses = cardTotals.reduce((sum, value) => sum + value, 0);
  const balance = totalIncome - totalExpenses;

  incomeTotal.textContent = formatCurrency(totalIncome);
  expenseTotal.textContent = formatCurrency(totalExpenses);
  balanceTotal.textContent = formatCurrency(balance);
}

function updateCardTotal(card) {
  const expenseInputs = [...card.querySelectorAll(".expense-value")];
  const total = expenseInputs.reduce((sum, input) => sum + parseCurrencyInput(input.value), 0);

  card.dataset.total = String(total);
  card.querySelector(".card-total-value").textContent = formatCurrency(total);
  card.querySelector(".card-total-input").value = formatCurrency(total);

  updateSummary();
  saveAppState();
}

function addExpenseRow(card, expense = { description: "", value: "" }) {
  const rowFragment = expenseRowTemplate.content.cloneNode(true);
  const row = rowFragment.querySelector(".expense-row");
  const descriptionInput = row.querySelector(".expense-description");
  const valueInput = row.querySelector(".expense-value");
  const removeButton = row.querySelector(".remove-expense-button");

  descriptionInput.value = expense.description;
  valueInput.value = expense.value;

  descriptionInput.addEventListener("input", saveAppState);
  valueInput.addEventListener("input", () => updateCardTotal(card));
  removeButton.addEventListener("click", () => {
    row.remove();
    updateCardTotal(card);
  });

  card.querySelector(".expenses-list").appendChild(row);
}

function wireCard(card) {
  const colorInput = card.querySelector(".card-color-input");
  const addExpenseButton = card.querySelector(".add-expense-button");
  const nameInput = card.querySelector(".card-name-input");

  colorInput.addEventListener("input", (event) => {
    card.style.setProperty("--card-color", event.target.value);
    saveAppState();
  });

  addExpenseButton.addEventListener("click", () => {
    addExpenseRow(card);
    saveAppState();
  });

  nameInput.addEventListener("input", saveAppState);

  card.style.setProperty("--card-color", colorInput.value);
  updateCardTotal(card);
}

function createCard(cardName, color, expenses = []) {
  const cardFragment = cardTemplate.content.cloneNode(true);
  const card = cardFragment.querySelector(".finance-card");
  const nameInput = card.querySelector(".card-name-input");
  const colorInput = card.querySelector(".card-color-input");

  nameInput.value = cardName;
  colorInput.value = color;

  cardsContainer.appendChild(card);
  wireCard(card);

  if (expenses.length > 0) {
    card.querySelector(".expenses-list").innerHTML = "";
    expenses.forEach((expense) => addExpenseRow(card, expense));
  } else {
    addExpenseRow(card);
    addExpenseRow(card);
  }

  updateCardTotal(card);
}

function createDefaultCards() {
  createCard("Cartao Principal", "#1f8a70");
  createCard("Cartao Reserva", "#f97316");
}

addCardButton.addEventListener("click", () => {
  const palette = ["#1f8a70", "#3b82f6", "#f97316", "#e11d48", "#8b5cf6", "#0f766e"];
  const nextColor = palette[document.querySelectorAll(".finance-card").length % palette.length];
  createCard(`Cartao ${document.querySelectorAll(".finance-card").length + 1}`, nextColor);
  saveAppState();
});

salaryInput.addEventListener("input", () => {
  updateSummary();
  saveAppState();
});

benefitsInput.addEventListener("input", () => {
  updateSummary();
  saveAppState();
});

monthNote.addEventListener("input", saveAppState);

if (!loadAppState()) {
  createDefaultCards();
  updateSummary();
  saveAppState();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Falha ao registrar o service worker:", error);
    });
  });
}
