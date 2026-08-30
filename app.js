/* ============ FIREBASE SETUP ============ */
const firebaseConfig = {
  apiKey: "AIzaSyAHyoBlCrDQB-f47jIe9OvX1D0dEqodEn0",
  authDomain: "bubble-and-lime.firebaseapp.com",
  projectId: "bubble-and-lime",
  storageBucket: "bubble-and-lime.firebasestorage.app",
  messagingSenderId: "751615115216",
  appId: "1:751615115216:web:bf426cc0a0c280599183d5"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Keep admins logged in on this device until they explicitly log out
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

/* ============ CONSTANTS ============ */
const GLASS_PRICES = [60, 80, 100, 120];
const GLASS_LABELS = { 60: "Soda (Rs 60)", 80: "Soda (Rs 80)", 100: "Soda (Rs 100)", 120: "Chocolate Soda (Rs 120)" };
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

let currentWorkers = [];
let editingDayId = null;

/* ============ HELPERS ============ */
function money(n) {
  return "Rs " + Number(n || 0).toLocaleString("en-IN");
}
function pad(n) { return String(n).padStart(2, "0"); }
function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function getTodayId() {
  return formatDate(new Date());
}
function getMonthId(dateStr) {
  return dateStr.slice(0, 7);
}
function monthLabel(monthId) {
  const [y, m] = monthId.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}
function niceDateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}
function getWeekInfo() {
  const monday = getMondayOf(new Date());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { weekId: formatDate(monday), start: formatDate(monday), end: formatDate(sunday) };
}

/* ============ AUTH ============ */
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("appScreen").classList.remove("hidden");
    initApp();
  } else {
    document.getElementById("loginScreen").classList.remove("hidden");
    document.getElementById("appScreen").classList.add("hidden");
  }
});

document.getElementById("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errorEl = document.getElementById("loginError");
  errorEl.textContent = "";

  auth.signInWithEmailAndPassword(email, password)
    .catch(err => {
      errorEl.textContent = "Incorrect email or password.";
      console.error(err);
    });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  auth.signOut();
});

/* ============ TABS ============ */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");

    if (btn.dataset.tab === "week") loadWeekTab();
    if (btn.dataset.tab === "month") loadMonthTab();
    if (btn.dataset.tab === "history") loadHistoryTab();
  });
});

/* ============ APP INIT ============ */
function initApp() {
  listenToWorkers();
  loadTodayTab();
  loadDashboard();
}

/* ============ DASHBOARD ============ */
function loadDashboard() {
  const todayId = getTodayId();
  const { start: weekStart, end: weekEnd } = getWeekInfo();
  const monthId = getMonthId(todayId);
  const el = document.getElementById("dashboardSummary");

  Promise.all([
    db.collection("days").doc(todayId).get(),
    db.collection("days")
      .where(firebase.firestore.FieldPath.documentId(), ">=", weekStart)
      .where(firebase.firestore.FieldPath.documentId(), "<=", weekEnd)
      .get(),
    db.collection("days")
      .where(firebase.firestore.FieldPath.documentId(), ">=", monthId + "-01")
      .where(firebase.firestore.FieldPath.documentId(), "<=", monthId + "-31")
      .get()
  ]).then(([todayDoc, weekSnap, monthSnap]) => {
    const todaySales = todayDoc.exists ? todayDoc.data().totalSales : 0;
    let weekSales = 0;
    weekSnap.forEach(d => weekSales += d.data().totalSales);
    let monthNet = 0;
    monthSnap.forEach(d => monthNet += d.data().dailyNet);

    el.innerHTML = `
      <div class="summary-row"><span>Today's Sales</span><span>${todayDoc.exists ? money(todaySales) : "Not logged yet"}</span></div>
      <div class="summary-row"><span>This Week's Sales</span><span>${money(weekSales)}</span></div>
      <div class="summary-row total"><span>This Month's Running Net</span><span>${money(monthNet)}</span></div>
    `;
  });
}

/* ============ WORKERS ============ */
function listenToWorkers() {
  db.collection("workers").orderBy("createdAt", "asc").onSnapshot(snap => {
    currentWorkers = [];
    snap.forEach(doc => currentWorkers.push({ id: doc.id, ...doc.data() }));
    renderWorkerList();
    renderWorkerPayList();
  });
}

function renderWorkerList() {
  const el = document.getElementById("workerList");
  if (currentWorkers.length === 0) {
    el.innerHTML = `<p class="muted">No workers added yet.</p>`;
    return;
  }
  el.innerHTML = currentWorkers.map(w => `
    <div class="worker-row">
      <span class="name">${w.name}</span>
      <span class="wage">${money(w.wage)}/day</span>
      <button onclick="removeWorker('${w.id}')">Remove</button>
    </div>
  `).join("");
}

document.getElementById("addWorkerBtn").addEventListener("click", () => {
  const nameEl = document.getElementById("newWorkerName");
  const wageEl = document.getElementById("newWorkerWage");
  const name = nameEl.value.trim();
  const wage = parseFloat(wageEl.value);

  if (!name || !wage || wage <= 0) {
    alert("Please enter a valid name and wage.");
    return;
  }

  db.collection("workers").add({
    name, wage,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    nameEl.value = "";
    wageEl.value = "";
  });
});

function removeWorker(id) {
  if (confirm("Remove this worker?")) {
    db.collection("workers").doc(id).delete();
  }
}

/* ============ TODAY TAB ============ */
function renderWorkerPayList() {
  const el = document.getElementById("workerPayList");
  if (currentWorkers.length === 0) {
    el.innerHTML = `<p class="muted">Add workers in the "Workers" tab first.</p>`;
    return;
  }
  el.innerHTML = currentWorkers.map(w => `
    <div class="worker-row">
      <span class="name">${w.name}</span>
      <span class="wage">${money(w.wage)}</span>
    </div>
  `).join("");
}

function loadTodayTab() {
  const todayId = getTodayId();
  editingDayId = null;
  document.getElementById("todayLoading").classList.remove("hidden");
  document.getElementById("todayForm").classList.add("hidden");
  document.getElementById("todayDone").classList.add("hidden");

  db.collection("days").doc(todayId).get().then(doc => {
    document.getElementById("todayLoading").classList.add("hidden");
    if (doc.exists) {
      showTodayDone(doc.data());
    } else {
      showTodayForm(todayId, null);
    }
  });
}

function showTodayForm(todayId, existingData) {
  document.getElementById("todayForm").classList.remove("hidden");
  document.getElementById("todayDone").classList.add("hidden");
  document.getElementById("todayDateLabel").textContent = niceDateLabel(todayId);

  const glassEl = document.getElementById("glassInputs");
  glassEl.innerHTML = GLASS_PRICES.map(price => {
    const prefill = existingData ? (existingData.glassCounts[price] || 0) : 0;
    return `
      <div class="glass-item">
        <div class="price">${GLASS_LABELS[price]}</div>
        <input type="number" min="0" value="${prefill}" data-price="${price}" class="glassCountInput" />
      </div>
    `;
  }).join("");

  document.getElementById("submitDayBtn").onclick = () => submitDay(todayId);
}

document.getElementById("editTodayBtn").addEventListener("click", () => {
  const todayId = getTodayId();
  editingDayId = todayId;
  db.collection("days").doc(todayId).get().then(doc => {
    if (doc.exists) showTodayForm(todayId, doc.data());
  });
});

function submitDay(todayId) {
  const counts = {};
  let totalSales = 0;
  document.querySelectorAll(".glassCountInput").forEach(input => {
    const price = parseInt(input.dataset.price);
    const count = parseInt(input.value) || 0;
    counts[price] = count;
    totalSales += price * count;
  });

  const totalWages = currentWorkers.reduce((sum, w) => sum + w.wage, 0);
  const dailyNet = totalSales - totalWages;

  const dayData = {
    glassCounts: counts,
    totalSales,
    workerPayments: currentWorkers.map(w => ({ name: w.name, wage: w.wage })),
    totalWages,
    dailyNet,
    enteredBy: auth.currentUser.email,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (editingDayId) {
    dayData.editedBy = auth.currentUser.email;
    dayData.editedAt = firebase.firestore.FieldValue.serverTimestamp();
  }

  db.collection("days").doc(todayId).set(dayData, { merge: false }).then(() => {
    editingDayId = null;
    showTodayDone(dayData);
    loadDashboard();
  }).catch(err => {
    alert("Something went wrong saving today's entry. Please try again.");
    console.error(err);
  });
}

function showTodayDone(data) {
  document.getElementById("todayDone").classList.remove("hidden");
  document.getElementById("todayForm").classList.add("hidden");
  const meta = data.editedBy ? `Last edited by ${data.editedBy}` : `Logged by ${data.enteredBy || "—"}`;
  document.getElementById("todayDoneMeta").textContent = meta;

  document.getElementById("todaySummary").innerHTML = `
    <div class="summary-row"><span>Total Sales</span><span>${money(data.totalSales)}</span></div>
    <div class="summary-row"><span>Worker Wages</span><span class="neg">- ${money(data.totalWages)}</span></div>
    <div class="summary-row total"><span>Net (before week/month expenses)</span><span>${money(data.dailyNet)}</span></div>
    <div class="summary-row"><span>Each Owner's Share Today (50/50)</span><span>${money(data.dailyNet / 2)}</span></div>
  `;
}

/* ============ WEEK TAB ============ */
function loadWeekTab() {
  const { weekId, start, end } = getWeekInfo();
  document.getElementById("weekTitle").textContent = `Week of ${niceDateLabel(start)}`;

  db.collection("weeks").doc(weekId).get().then(weekDoc => {
    if (weekDoc.exists) {
      document.getElementById("weekExpenseForm").classList.add("hidden");
      document.getElementById("weekDone").classList.remove("hidden");
      const d = weekDoc.data();
      document.getElementById("weekDoneTitle").textContent = `Week of ${niceDateLabel(start)} — Logged`;
      document.getElementById("weekSummary").innerHTML = `
        <div class="summary-row"><span>Water</span><span>${money(d.expenses.water)}</span></div>
        <div class="summary-row"><span>Sugar</span><span>${money(d.expenses.sugar)}</span></div>
        <div class="summary-row"><span>Ingredients</span><span>${money(d.expenses.ingredients)}</span></div>
        <div class="summary-row"><span>Glasses &amp; Straws</span><span>${money(d.expenses.glassesStraws)}</span></div>
        <div class="summary-row total"><span>Total This Week</span><span>${money(d.totalExpenses)}</span></div>
      `;
      return;
    }

    document.getElementById("weekExpenseForm").classList.remove("hidden");
    document.getElementById("weekDone").classList.add("hidden");

    db.collection("days")
      .where(firebase.firestore.FieldPath.documentId(), ">=", start)
      .where(firebase.firestore.FieldPath.documentId(), "<=", end)
      .get()
      .then(snap => {
        let weekSales = 0, daysLogged = 0;
        snap.forEach(doc => { weekSales += doc.data().totalSales; daysLogged++; });
        document.getElementById("weekRunning").innerHTML = `
          <div class="summary-row"><span>Days Logged</span><span>${daysLogged}</span></div>
          <div class="summary-row total"><span>Sales This Week So Far</span><span>${money(weekSales)}</span></div>
        `;
      });

    document.getElementById("closeWeekBtn").onclick = () => saveWeek(weekId);
  });
}

function saveWeek(weekId) {
  const expenses = {
    water: parseFloat(document.getElementById("expWater").value) || 0,
    sugar: parseFloat(document.getElementById("expSugar").value) || 0,
    ingredients: parseFloat(document.getElementById("expIngredients").value) || 0,
    glassesStraws: parseFloat(document.getElementById("expGlassesStraws").value) || 0
  };
  const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);

  db.collection("weeks").doc(weekId).set({
    expenses, totalExpenses,
    closedBy: auth.currentUser.email,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => loadWeekTab());
}

/* ============ MONTH TAB ============ */
function loadMonthTab() {
  const monthId = getMonthId(getTodayId());
  document.getElementById("monthTitle").textContent = monthLabel(monthId);

  db.collection("months").doc(monthId).get().then(monthDoc => {
    if (monthDoc.exists) {
      document.getElementById("monthExpenseForm").classList.add("hidden");
      document.getElementById("monthRunning").innerHTML = `<p class="muted">This month is already closed out. See History for details.</p>`;
      return;
    }

    document.getElementById("monthExpenseForm").classList.remove("hidden");
    document.getElementById("monthDone").classList.add("hidden");

    Promise.all([
      db.collection("days")
        .where(firebase.firestore.FieldPath.documentId(), ">=", monthId + "-01")
        .where(firebase.firestore.FieldPath.documentId(), "<=", monthId + "-31")
        .get(),
      db.collection("weeks")
        .where(firebase.firestore.FieldPath.documentId(), ">=", monthId + "-01")
        .where(firebase.firestore.FieldPath.documentId(), "<=", monthId + "-31")
        .get()
    ]).then(([daysSnap, weeksSnap]) => {
      let runningNet = 0, daysLogged = 0;
      daysSnap.forEach(doc => { runningNet += doc.data().dailyNet; daysLogged++; });

      let weeksTotal = 0, weeksLogged = 0;
      weeksSnap.forEach(doc => { weeksTotal += doc.data().totalExpenses; weeksLogged++; });

      const netAfterWeekly = runningNet - weeksTotal;

      document.getElementById("monthRunning").innerHTML = `
        <div class="summary-row"><span>Days Logged</span><span>${daysLogged}</span></div>
        <div class="summary-row"><span>Sales Net (before expenses)</span><span>${money(runningNet)}</span></div>
        <div class="summary-row"><span>Weekly Purchases Logged</span><span>${weeksLogged} week(s), ${money(weeksTotal)}</span></div>
        <div class="summary-row total"><span>Running Total So Far</span><span>${money(netAfterWeekly)}</span></div>
      `;

      document.getElementById("closeMonthBtn").onclick = () => closeMonth(monthId, netAfterWeekly);
    });
  });
}

function closeMonth(monthId, netAfterWeekly) {
  const expenses = {
    electricity: parseFloat(document.getElementById("expElectricity").value) || 0,
    wifi: parseFloat(document.getElementById("expWifi").value) || 0,
    milk: parseFloat(document.getElementById("expMilk").value) || 0
  };
  const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
  const monthlyProfit = netAfterWeekly - totalExpenses;
  const perOwner = monthlyProfit / 2;

  const monthData = {
    expenses, totalExpenses,
    grossNet: netAfterWeekly,
    monthlyProfit,
    perOwner,
    closedBy: auth.currentUser.email,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (!confirm("Close out this month? This can't be undone.")) return;

  db.collection("months").doc(monthId).set(monthData).then(() => {
    loadMonthTab();
  });
}

/* ============ HISTORY TAB ============ */
function loadHistoryTab() {
  loadCurrentMonthLive();
  loadClosedMonthsList();
  document.getElementById("historySearchResult").classList.add("hidden");
}

function loadCurrentMonthLive() {
  const monthId = getMonthId(getTodayId());
  document.getElementById("currentMonthLiveTitle").textContent = `${monthLabel(monthId)} (In Progress)`;

  db.collection("days")
    .where(firebase.firestore.FieldPath.documentId(), ">=", monthId + "-01")
    .where(firebase.firestore.FieldPath.documentId(), "<=", monthId + "-31")
    .orderBy(firebase.firestore.FieldPath.documentId(), "desc")
    .get()
    .then(snap => {
      const el = document.getElementById("currentMonthLiveList");
      if (snap.empty) {
        el.innerHTML = `<p class="muted">No days logged yet this month.</p>`;
        return;
      }
      el.innerHTML = snap.docs.map(doc => {
        const dd = doc.data();
        const cls = dd.dailyNet >= 0 ? "pos" : "neg";
        return `
          <div class="worker-row">
            <span class="name">${niceDateLabel(doc.id)}</span>
            <span class="${cls}">${money(dd.dailyNet)}</span>
            <button onclick="deleteDayEntry('${doc.id}')">Delete</button>
          </div>
        `;
      }).join("");
    });
}

function deleteDayEntry(dayId) {
  if (!confirm(`Delete the entry for ${niceDateLabel(dayId)}? This can't be undone.`)) return;
  db.collection("days").doc(dayId).delete().then(() => {
    loadCurrentMonthLive();
    loadDashboard();
    if (dayId === getTodayId()) loadTodayTab();
  });
}

document.getElementById("historySearchBtn").addEventListener("click", () => {
  const dateVal = document.getElementById("historySearchDate").value;
  const resultEl = document.getElementById("historySearchResult");
  if (!dateVal) return;

  db.collection("days").doc(dateVal).get().then(doc => {
    resultEl.classList.remove("hidden");
    if (!doc.exists) {
      resultEl.innerHTML = `<p class="muted">No entry found for ${niceDateLabel(dateVal)}.</p>`;
      return;
    }
    const dd = doc.data();
    resultEl.innerHTML = `
      <div class="summary-row"><span>${niceDateLabel(dateVal)}</span><span></span></div>
      <div class="summary-row"><span>Total Sales</span><span>${money(dd.totalSales)}</span></div>
      <div class="summary-row"><span>Worker Wages</span><span class="neg">- ${money(dd.totalWages)}</span></div>
      <div class="summary-row total"><span>Net</span><span>${money(dd.dailyNet)}</span></div>
    `;
  });
});

function loadClosedMonthsList() {
  db.collection("months").orderBy(firebase.firestore.FieldPath.documentId(), "desc").get().then(snap => {
    const el = document.getElementById("historyMonthList");
    document.getElementById("historyDetail").classList.add("hidden");
    if (snap.empty) {
      el.innerHTML = `<p class="muted">No closed months yet.</p>`;
      return;
    }
    el.innerHTML = snap.docs.map(doc => {
      const d = doc.data();
      const result = d.monthlyProfit >= 0 ? "pos" : "neg";
      return `
        <div class="worker-row" style="cursor:pointer" onclick="showMonthDetail('${doc.id}')">
          <span class="name">${monthLabel(doc.id)}</span>
          <span class="${result}">${money(d.monthlyProfit)}</span>
        </div>
      `;
    }).join("");
  });
}

function showMonthDetail(monthId) {
  db.collection("months").doc(monthId).get().then(doc => {
    const d = doc.data();
    const result = d.monthlyProfit >= 0 ? "Profit" : (d.monthlyProfit < 0 ? "Loss" : "Broke Even");
    const el = document.getElementById("historyDetail");
    el.classList.remove("hidden");
    document.getElementById("historyDetailTitle").textContent = monthLabel(monthId);
    document.getElementById("historyMonthSummary").innerHTML = `
      <div class="summary-row"><span>Sales Net (before expenses)</span><span>${money(d.grossNet)}</span></div>
      <div class="summary-row"><span>Electricity</span><span>${money(d.expenses.electricity)}</span></div>
      <div class="summary-row"><span>Wi-Fi</span><span>${money(d.expenses.wifi)}</span></div>
      <div class="summary-row"><span>Milk</span><span>${money(d.expenses.milk)}</span></div>
      <div class="summary-row total"><span>Month Result: ${result}</span><span>${money(d.monthlyProfit)}</span></div>
      <div class="summary-row"><span>Each Owner Gets</span><span>${money(d.perOwner)}</span></div>
    `;

    db.collection("days")
      .where(firebase.firestore.FieldPath.documentId(), ">=", monthId + "-01")
      .where(firebase.firestore.FieldPath.documentId(), "<=", monthId + "-31")
      .orderBy(firebase.firestore.FieldPath.documentId(), "asc")
      .get()
      .then(daysSnap => {
        const dayListEl = document.getElementById("historyDayList");
        if (daysSnap.empty) {
          dayListEl.innerHTML = `<p class="muted">No days logged.</p>`;
          return;
        }
        dayListEl.innerHTML = daysSnap.docs.map(dayDoc => {
          const dd = dayDoc.data();
          const cls = dd.dailyNet >= 0 ? "pos" : "neg";
          return `
            <div class="worker-row">
              <span class="name">${niceDateLabel(dayDoc.id)}</span>
              <span class="${cls}">${money(dd.dailyNet)}</span>
            </div>
          `;
        }).join("");
      });
  });
}