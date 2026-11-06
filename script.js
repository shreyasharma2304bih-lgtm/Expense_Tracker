const STORAGE_KEY = "daybook.mock-expenses-inr.v1";
const BUDGET_KEY = "daybook.mock-budget.v1";
const CATEGORIES = ["Food", "Groceries", "Transport", "Bills", "Shopping", "Health", "Other"];
const CATEGORY_ICONS = {
	Food: "☕",
	Groceries: "🥑",
	Transport: "🚆",
	Bills: "⌂",
	Shopping: "◈",
	Health: "+",
	Other: "•",
};

const elements = {
	month: document.querySelector("#month-picker"),
	total: document.querySelector("#spent-this-month"),
	count: document.querySelector("#expense-count"),
	rows: document.querySelector("#transaction-rows"),
	empty: document.querySelector("#empty-state"),
	emptyTitle: document.querySelector("#empty-title"),
	emptyMessage: document.querySelector("#empty-message"),
	transactionCount: document.querySelector("#transaction-count"),
	search: document.querySelector("#transaction-search"),
	filter: document.querySelector("#category-filter"),
	categoryInput: document.querySelector("#expense-category"),
	dialog: document.querySelector("#expense-dialog"),
	form: document.querySelector("#expense-form"),
	date: document.querySelector("#expense-date"),
	toast: document.querySelector("#toast"),
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
let expenses = [];
let toastTimer;

function localDateString(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function monthKey(dateString) {
	return dateString.slice(0, 7);
}

function parseLocalDate(dateString) {
	const [year, month, day] = dateString.split("-").map(Number);
	return new Date(year, month - 1, day);
}

function formatDate(dateString) {
	return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parseLocalDate(dateString));
}

function createDemoExpenses() {
	const today = new Date();
	const sampleExpenses = [
		["Coffee & a pastry", 180, "Food", 0, "Morning stop"],
		["Weekly groceries", 1240, "Groceries", 1, "Market"],
		["Metro card", 80, "Transport", 2, "Commute"],
		["Phone bill", 799, "Bills", 4, "Monthly plan"],
		["Pharmacy", 345.5, "Health", 5, ""],
	];

	return sampleExpenses.map(([name, amount, category, daysAgo, note], index) => {
		const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
		return {
			id: `demo-${index + 1}`,
			name,
			amount,
			category,
			date: localDateString(date),
			note,
		};
	});
}

function readExpenses() {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === null) return null;
		const parsed = JSON.parse(saved);
		if (!Array.isArray(parsed)) return null;
		return parsed.filter((expense) =>
			expense && typeof expense.id === "string" && typeof expense.name === "string" &&
			Number.isFinite(Number(expense.amount)) && Number(expense.amount) > 0 &&
			CATEGORIES.includes(expense.category) && /^\d{4}-\d{2}-\d{2}$/.test(expense.date),
		);
	} catch {
		return null;
	}
}

function saveExpenses(items) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
		return true;
	} catch {
		showToast("Could not save data in this browser.");
		return false;
	}
}

const fakeApi = {
	async getExpenses() {
		await new Promise((resolve) => setTimeout(resolve, 180));
		const saved = readExpenses();
		if (saved !== null) return saved;
		const demoData = createDemoExpenses();
		saveExpenses(demoData);
		return demoData;
	},

	async createExpense(expense) {
		await new Promise((resolve) => setTimeout(resolve, 120));
		const updated = [{ ...expense, id: `expense-${Date.now()}-${Math.random().toString(16).slice(2, 8)}` }, ...expenses];
		if (!saveExpenses(updated)) throw new Error("Unable to save expense");
		return updated[0];
	},

	async deleteExpense(id) {
		await new Promise((resolve) => setTimeout(resolve, 100));
		const updated = expenses.filter((expense) => expense.id !== id);
		if (!saveExpenses(updated)) throw new Error("Unable to delete expense");
		return updated;
	},
};

function populateCategories() {
	for (const category of CATEGORIES) {
		const formOption = document.createElement("option");
		formOption.value = category;
		formOption.textContent = category;
		elements.categoryInput.append(formOption);

		const filterOption = document.createElement("option");
		filterOption.value = category;
		filterOption.textContent = category;
		elements.filter.append(filterOption);
	}
}

function populateMonths() {
	const current = new Date();
	const monthKeys = new Set(expenses.map((expense) => monthKey(expense.date)));
	for (let offset = 0; offset < 6; offset += 1) {
		const date = new Date(current.getFullYear(), current.getMonth() - offset, 1);
		monthKeys.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
	}

	const selected = elements.month.value || monthKey(localDateString());
	elements.month.replaceChildren();
	for (const key of [...monthKeys].sort().reverse()) {
		const [year, month] = key.split("-").map(Number);
		const option = document.createElement("option");
		option.value = key;
		option.textContent = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
		elements.month.append(option);
	}
	elements.month.value = monthKeys.has(selected) ? selected : monthKey(localDateString());
}

function createCell(className, text) {
	const cell = document.createElement("td");
	if (className) cell.className = className;
	cell.textContent = text;
	return cell;
}

function renderRows(monthExpenses) {
	const query = elements.search.value.trim().toLowerCase();
	const category = elements.filter.value;
	const filtered = monthExpenses
		.filter((expense) => category === "all" || expense.category === category)
		.filter((expense) => `${expense.name} ${expense.note || ""} ${expense.category}`.toLowerCase().includes(query))
		.sort((first, second) => second.date.localeCompare(first.date));

	elements.rows.replaceChildren();	
	for (const expense of filtered) {
		const row = document.createElement("tr");
		const nameCell = document.createElement("td");
		const transaction = document.createElement("div");
		transaction.className = "transaction-cell";
		const icon = document.createElement("span");
		icon.className = "transaction-icon";
		icon.setAttribute("aria-hidden", "true");
		icon.textContent = CATEGORY_ICONS[expense.category] || CATEGORY_ICONS.Other;
		const name = document.createElement("span");
		name.className = "transaction-name";
		name.textContent = expense.name;
		transaction.append(icon, name);
		nameCell.append(transaction);
		row.append(nameCell);

		const categoryCell = document.createElement("td");
		const categoryLabel = document.createElement("span");
		categoryLabel.className = "category-pill";
		const categoryDot = document.createElement("i");
		categoryDot.setAttribute("aria-hidden", "true");
		categoryLabel.append(categoryDot, document.createTextNode(expense.category));
		categoryCell.append(categoryLabel);
		row.append(categoryCell, createCell("", formatDate(expense.date)), createCell("amount-cell", money.format(Number(expense.amount))));

		const actionCell = document.createElement("td");
		actionCell.className = "action-cell";
		const deleteButton = document.createElement("button");
		deleteButton.className = "delete-button";
		deleteButton.type = "button";
		deleteButton.dataset.deleteId = expense.id;
		deleteButton.setAttribute("aria-label", `Delete ${expense.name}`);
		deleteButton.title = "Delete expense";
		deleteButton.textContent = "×";
		actionCell.append(deleteButton);
		row.append(actionCell);
		elements.rows.append(row);
	}

	const isFiltered = Boolean(query) || category !== "all";
	elements.empty.hidden = filtered.length > 0;
	elements.emptyTitle.textContent = isFiltered ? "No matching expenses." : "No expenses yet.";
	elements.emptyMessage.textContent = isFiltered ? "Try a different search or category." : "Add an expense to start tracking this month.";
	document.querySelector("#empty-add-button").hidden = isFiltered;
	elements.transactionCount.textContent = `Showing ${filtered.length} of ${monthExpenses.length} expenses`;
	document.querySelector("#clear-filters").hidden = !isFiltered;
}

function render() {
	const selectedMonth = elements.month.value || monthKey(localDateString());
	const monthExpenses = expenses.filter((expense) => monthKey(expense.date) === selectedMonth);
	const total = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
	elements.total.textContent = money.format(total);
	elements.count.textContent = String(monthExpenses.length);
	renderRows(monthExpenses);
}

function showToast(message) {
	elements.toast.textContent = message;
	elements.toast.classList.add("is-visible");
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function openExpenseDialog() {
	elements.date.value = localDateString();
	elements.dialog.showModal();
	document.querySelector("#expense-name").focus();
}

function csvCell(value) {
	const safeValue = /^[=+@\-]/.test(String(value)) ? `'${value}` : value;
	return `"${String(safeValue).replaceAll('"', '""')}"`;
}

populateCategories();
document.querySelector("#open-expense-dialog").addEventListener("click", openExpenseDialog);
document.querySelector("#empty-add-button").addEventListener("click", openExpenseDialog);
document.querySelector("#close-expense-dialog").addEventListener("click", () => elements.dialog.close());
document.querySelector("#cancel-expense").addEventListener("click", () => elements.dialog.close());
document.querySelector("#clear-filters").addEventListener("click", () => {
	elements.search.value = "";
	elements.filter.value = "all";
	render();
});
elements.month.addEventListener("change", render);
elements.search.addEventListener("input", render);
elements.filter.addEventListener("change", render);

elements.form.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!elements.form.reportValidity()) return;
	const formData = new FormData(elements.form);
	const expense = {
		name: String(formData.get("name")).trim(),
		amount: Number(formData.get("amount")),
		category: String(formData.get("category")),
		date: String(formData.get("date")),
		note: String(formData.get("note")).trim(),
	};
	if (!expense.name || !Number.isFinite(expense.amount) || expense.amount <= 0) return;

	try {
		expenses = [await fakeApi.createExpense(expense), ...expenses];
		populateMonths();
		elements.month.value = monthKey(expense.date);
		elements.form.reset();
		elements.dialog.close();
		render();
		showToast("Expense added.");
	} catch {
		showToast("Could not save this expense.");
	}
});

elements.rows.addEventListener("click", async (event) => {
	const button = event.target.closest("[data-delete-id]");
	if (!button) return;
	const expense = expenses.find((item) => item.id === button.dataset.deleteId);
	if (!expense || !window.confirm(`Delete “${expense.name}”?`)) return;
	try {
		expenses = await fakeApi.deleteExpense(expense.id);
		populateMonths();
		render();
		showToast("Expense deleted.");
	} catch {
		showToast("Could not delete this expense.");
	}
});

document.querySelector("#export-csv").addEventListener("click", () => {
	const rows = [["Name", "Amount", "Category", "Date", "Note"], ...expenses.map((expense) => [expense.name, expense.amount, expense.category, expense.date, expense.note || ""])];
	const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
	const link = document.createElement("a");
	link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
	link.download = "expenses.csv";
	link.click();
	URL.revokeObjectURL(link.href);
});

fakeApi.getExpenses().then((items) => {
	expenses = items;
	populateMonths();
	render();
}).catch(() => {
	showToast("Could not load demo expenses.");
});
