// ===============================
// Utility Functions
// ===============================

// Format number as 4-digit padded (e.g. 0001, 0002, ...)
function formatNumber(num) {
    return num.toString().padStart(4, "0");
}

// Get and increment counters for invoice/quote numbers
function getNextNumber(type) {
    let key = `${type}Counter`;
    let current = localStorage.getItem(key);

    if (!current) {
        current = 1; // start from 1
    } else {
        current = parseInt(current) + 1;
    }

    localStorage.setItem(key, current);
    return formatNumber(current);
}

// ===============================
// Payslip Functions
// ===============================
function calculatePayslip(payslip) {
  let gross = 0;

  // Calculate all rows with hours * rate
  const rows = payslip.querySelectorAll("tr");
  rows.forEach(row => {
    const hoursInput = row.querySelector(".hours");
    const rateInput = row.querySelector(".rate");
    const amountCell = row.querySelector(".amount");

    if (hoursInput && rateInput && amountCell) {
      const hours = parseFloat(hoursInput.value) || 0;
      const rate = parseFloat(rateInput.value) || 0;
      const total = hours * rate;
      amountCell.textContent = total.toFixed(2);
      gross += total;
    }
  });

  // Add Bonus
  const bonusInput = payslip.querySelector(".bonus");
  const bonusCell = payslip.querySelector(".bonus-amount");
  if (bonusInput && bonusCell) {
    const bonus = parseFloat(bonusInput.value) || 0;
    bonusCell.textContent = bonus.toFixed(2);
    gross += bonus;
  }

  // Update Gross Earnings
  const grossCell = payslip.querySelector(".gross");
  if (grossCell) grossCell.textContent = gross.toFixed(2);

  // Calculate Deductions
  let deductions = 0;
  payslip.querySelectorAll(".deduction").forEach(input => {
    deductions += parseFloat(input.value) || 0;
  });
  const deductionsCell = payslip.querySelector(".deductions-total");
  if (deductionsCell) deductionsCell.textContent = deductions.toFixed(2);

  // Net Pay = Gross - Deductions
  const netPayCell = payslip.querySelector(".net-pay");
  if (netPayCell) netPayCell.textContent = (gross - deductions).toFixed(2);
}

// Apply auto-calculation to ALL payslips
document.addEventListener("input", () => {
  document.querySelectorAll(".payslip").forEach(payslip => calculatePayslip(payslip));
});

// ===============================
// Shared Kenimay Script
// ===============================
const pad3 = (n) => String(n).padStart(3, "0"); // Invoices -> INV#001
const pad4 = (n) => String(n).padStart(4, "0"); // Quotes -> QUO#0001
const todayISO = () => new Date().toISOString().slice(0, 10);
const load = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// Counters
let invoiceCounter = parseInt(localStorage.getItem("invoiceCounter") || "1", 10);
let quoteCounter   = parseInt(localStorage.getItem("quoteCounter") || "1", 10);

const nextInvoiceNo = () => `INV#${pad3(invoiceCounter)}`;
const nextQuoteNo   = () => `QUO#${pad4(quoteCounter)}`;

// ===============================
// PDF Export Utility
// ===============================
function downloadPDF(title, itemsTableId, summary = {}) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(title, 20, 20);

  // Add summary if provided
  let y = 30;
  for (const key in summary) {
    doc.setFontSize(12);
    doc.text(`${key}: ${summary[key]}`, 20, y);
    y += 10;
  }

  // Add table content
  const table = document.getElementById(itemsTableId);
  if (table) {
    doc.autoTable({ html: `#${itemsTableId}`, startY: y });
  }

  const filename = summary.Number || title.replace(/\s+/g, "_");
  doc.save(`${filename}.pdf`);
}

// ===============================
// INVOICES
// ===============================
function initInvoicePage() {
  const no = document.getElementById("invoiceNo");
  const date = document.getElementById("invoiceDate");
  const tbody = document.querySelector("#invoiceItems tbody");

  if (!no || !date || !tbody) return; // not on invoice page

  no.value = nextInvoiceNo();
  if (!date.value) date.value = todayISO();

  if (!tbody.children.length) addInvoiceItem();
  updateInvoiceSummary();
  loadInvoiceHistory();
}

function addInvoiceItem() {
  const tbody = document.querySelector("#invoiceItems tbody");
  if (!tbody) return;
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td contenteditable="true" oninput="updateInvoiceTotal(this)">1</td>
    <td contenteditable="true">Description</td>
    <td contenteditable="true" oninput="updateInvoiceTotal(this)">0</td>
    <td class="total">0.00</td>
  `;
  tbody.appendChild(tr);
  updateInvoiceSummary();
}

function updateInvoiceTotal(cell) {
  const row = cell.parentElement;
  const qty = parseFloat(row.children[0].innerText) || 0;
  const price = parseFloat(row.children[2].innerText) || 0;
  row.querySelector(".total").innerText = (qty * price).toFixed(2);
  updateInvoiceSummary();
}

function updateInvoiceSummary() {
  const totals = [...document.querySelectorAll("#invoiceItems .total")];
  if (!totals.length) return;
  const sum = totals.reduce((s, td) => s + (parseFloat(td.innerText) || 0), 0);
  const vat = 0;
  const total = sum;

  const subEl = document.getElementById("invoiceSubtotal");
  const vatEl = document.getElementById("invoiceVat");
  const totEl = document.getElementById("invoiceTotal");
  if (subEl) subEl.innerText = sum.toFixed(2);
  if (vatEl) vatEl.innerText = vat.toFixed(2);
  if (totEl) totEl.innerText = total.toFixed(2);
}

function saveInvoice() {
  const noEl   = document.getElementById("invoiceNo");
  const dateEl = document.getElementById("invoiceDate");
  const poEl   = document.getElementById("poNo");
  const refEl  = document.getElementById("invRefNo");
  const subEl  = document.getElementById("invoiceSubtotal");
  const vatEl  = document.getElementById("invoiceVat");
  const totEl  = document.getElementById("invoiceTotal");

  if (!noEl) return;

  const invoice = {
    number: noEl.value,
    date: dateEl?.value || todayISO(),
    po: poEl?.value || "",
    ref: refEl?.value || "",
    subtotal: subEl?.innerText || "0.00",
    vat: vatEl?.innerText || "0.00",
    total: totEl?.innerText || "0.00",
  };

  const list = load("invoices", []);
  list.push(invoice);
  save("invoices", list);

  invoiceCounter++;
  localStorage.setItem("invoiceCounter", String(invoiceCounter));
  noEl.value = nextInvoiceNo();

  if (poEl) poEl.value = "";
  if (refEl) refEl.value = "";
  const tbody = document.querySelector("#invoiceItems tbody");
  if (tbody) tbody.innerHTML = "";
  addInvoiceItem();
  updateInvoiceSummary();
  loadInvoiceHistory();
  alert(`Invoice ${invoice.number} saved`);
}

function loadInvoiceHistory() {
  const container = document.getElementById("historyList");
  if (!container) return;
  const list = load("invoices", []);
  container.innerHTML = list.length
    ? ""
    : "<p>No saved invoices yet.</p>";

  list.forEach((inv) => {
    const card = document.createElement("div");
    card.className = "invoice-card";
    card.innerHTML = `
      <h3>${inv.number}</h3>
      <p><strong>Date:</strong> ${inv.date}</p>
      <p><strong>PO:</strong> ${inv.po}</p>
      <p><strong>Ref:</strong> ${inv.ref}</p>
      <p><strong>Total:</strong> R${inv.total}</p>
      <button onclick='viewInvoice(${JSON.stringify(inv)})'>View Details</button>
      <button onclick='downloadPDF("Invoice", "invoiceItems", {
        "Number": "${inv.number}",
        "Date": "${inv.date}",
        "PO": "${inv.po}",
        "Ref": "${inv.ref}",
        "Subtotal": "R${inv.subtotal}",
        "VAT": "R${inv.vat}",
        "Total": "R${inv.total}"
      })'>Download PDF</button>
    `;
    container.appendChild(card);
  });
}

function viewInvoice(inv) {
  alert(
    `${inv.number}\nDate: ${inv.date}\nPO: ${inv.po}\nRef: ${inv.ref}\n` +
    `Subtotal: R${inv.subtotal}\nVAT: R${inv.vat}\nTotal: R${inv.total}`
  );
}

// ===============================
// QUOTES
// ===============================
function initQuotePage() {
  const no = document.getElementById("quoteNo");
  const date = document.getElementById("quoteDate");
  const tbody = document.querySelector("#quoteItems tbody");

  if (!no || !date || !tbody) return;

  no.value = nextQuoteNo();
  if (!date.value) date.value = todayISO();

  if (!tbody.children.length) addQuoteItem();
  updateQuoteSummary();
  loadQuoteHistory();
}

function addQuoteItem() {
  const tbody = document.querySelector("#quoteItems tbody");
  if (!tbody) return;
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td contenteditable="true" oninput="updateQuoteTotal(this)">1</td>
    <td contenteditable="true">Description</td>
    <td contenteditable="true" oninput="updateQuoteTotal(this)">0</td>
    <td class="total">0.00</td>
  `;
  tbody.appendChild(tr);
  updateQuoteSummary();
}

function updateQuoteTotal(cell) {
  const row = cell.parentElement;
  const qty = parseFloat(row.children[0].innerText) || 0;
  const price = parseFloat(row.children[2].innerText) || 0;
  row.querySelector(".total").innerText = (qty * price).toFixed(2);
  updateQuoteSummary();
}

function updateQuoteSummary() {
  const totals = [...document.querySelectorAll("#quoteItems .total")];
  if (!totals.length) return;
  const sum = totals.reduce((s, td) => s + (parseFloat(td.innerText) || 0), 0);
  const vat = 0;
  const total = sum;

  const subEl = document.getElementById("quoteSubtotal");
  const vatEl = document.getElementById("quoteVat");
  const totEl = document.getElementById("quoteTotal");
  if (subEl) subEl.innerText = sum.toFixed(2);
  if (vatEl) vatEl.innerText = vat.toFixed(2);
  if (totEl) totEl.innerText = total.toFixed(2);
}

function saveQuote() {
  const noEl   = document.getElementById("quoteNo");
  const dateEl = document.getElementById("quoteDate");
  const custEl = document.getElementById("customerName");
  const contEl = document.getElementById("contactPerson");
  const refEl  = document.getElementById("refNo");
  const subEl  = document.getElementById("quoteSubtotal");
  const vatEl  = document.getElementById("quoteVat");
  const totEl  = document.getElementById("quoteTotal");

  if (!noEl) return;

  const quote = {
    number: noEl.value,
    date: dateEl?.value || todayISO(),
    customer: custEl?.value || "",
    contact: contEl?.value || "",
    ref: refEl?.value || "",
    subtotal: subEl?.innerText || "0.00",
    vat: vatEl?.innerText || "0.00",
    total: totEl?.innerText || "0.00",
  };

  const list = load("quotes", []);
  list.push(quote);
  save("quotes", list);

  quoteCounter++;
  localStorage.setItem("quoteCounter", String(quoteCounter));
  noEl.value = nextQuoteNo();

  if (custEl) custEl.value = "";
  if (contEl) contEl.value = "";
  if (refEl) refEl.value = "";
  const tbody = document.querySelector("#quoteItems tbody");
  if (tbody) tbody.innerHTML = "";
  addQuoteItem();
  updateQuoteSummary();
  loadQuoteHistory();
  alert(`Quote ${quote.number} saved`);
}

function loadQuoteHistory() {
  const container = document.getElementById("quoteHistoryList");
  if (!container) return;
  const list = load("quotes", []);
  container.innerHTML = list.length
    ? ""
    : "<p>No saved quotations yet.</p>";

  list.forEach((q) => {
    const card = document.createElement("div");
    card.className = "invoice-card";
    card.innerHTML = `
      <h3>${q.number}</h3>
      <p><strong>Date:</strong> ${q.date}</p>
      <p><strong>Customer:</strong> ${q.customer}</p>
      <p><strong>Contact:</strong> ${q.contact}</p>
      <p><strong>Total:</strong> R${q.total}</p>
      <button onclick='viewQuote(${JSON.stringify(q)})'> View Details</button>
      <button onclick='downloadPDF("Quote", "quoteItems", {
        "Number": "${q.number}",
        "Date": "${q.date}",
        "Customer": "${q.customer}",
        "Contact": "${q.contact}",
        "Ref": "${q.ref}",
        "Subtotal": "R${q.subtotal}",
        "VAT": "R${q.vat}",
        "Total": "R${q.total}"
      })'> Download PDF</button>
    `;
    container.appendChild(card);
  });
}

function viewQuote(q) {
  alert(
    `${q.number}\nDate: ${q.date}\nCustomer: ${q.customer}\nContact: ${q.contact}\n` +
    `Ref: ${q.ref}\nSubtotal: R${q.subtotal}\nVAT: R${q.vat}\nTotal: R${q.total}`
  );
}

// ===============================
// Expose for inline handlers
// ===============================
window.addInvoiceItem     = addInvoiceItem;
window.updateInvoiceTotal = updateInvoiceTotal;
window.saveInvoice        = saveInvoice;

window.addQuoteItem       = addQuoteItem;
window.updateQuoteTotal   = updateQuoteTotal;
window.saveQuote          = saveQuote;
window.downloadPDF        = downloadPDF;

// ===============================
// Boot
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  initInvoicePage();
  initQuotePage();
});
