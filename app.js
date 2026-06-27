/* ============================================================
   SubTracker — app.js
   Handles: add / delete subscriptions, localStorage persistence,
   monthly total calculation, and rendering.
   No frameworks — plain, readable JavaScript.
   ============================================================ */

(function () {
  "use strict";

  /* ----- Constants ----- */
  var STORAGE_KEY = "subtracker.subscriptions.v1";

  // Maps a category to its CSS color variable name.
  var CATEGORY_COLORS = {
    Entertainment: "var(--cat-Entertainment)",
    Work: "var(--cat-Work)",
    Health: "var(--cat-Health)",
    Music: "var(--cat-Music)",
    Education: "var(--cat-Education)",
    Shopping: "var(--cat-Shopping)",
    Other: "var(--cat-Other)",
  };

  /* ----- Element references ----- */
  var form = document.getElementById("subForm");
  var formError = document.getElementById("formError");
  var subList = document.getElementById("subList");
  var emptyState = document.getElementById("emptyState");
  var totalAmountEl = document.getElementById("totalAmount");
  var subCountEl = document.getElementById("subCount");
  var billingDateInput = document.getElementById("billingDate");

  /* ----- State ----- */
  var subscriptions = loadSubscriptions();

  /* ============================================================
     Storage helpers
     ============================================================ */
  function loadSubscriptions() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("Could not read saved subscriptions:", err);
      return [];
    }
  }

  function saveSubscriptions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
    } catch (err) {
      console.error("Could not save subscriptions:", err);
    }
  }

  /* ============================================================
     Money helpers
     ============================================================ */

  // Normalises any billing cycle into a comparable MONTHLY amount,
  // so totals are fair across weekly / monthly / yearly plans.
  function toMonthly(amount, cycle) {
    switch (cycle) {
      case "yearly":
        return amount / 12;
      case "weekly":
        return (amount * 52) / 12;
      case "monthly":
      default:
        return amount;
    }
  }

  function formatMoney(value) {
    return "$" + value.toFixed(2);
  }

  function calcTotalMonthly() {
    return subscriptions.reduce(function (sum, sub) {
      return sum + toMonthly(sub.amount, sub.cycle);
    }, 0);
  }

  /* ============================================================
     Date helper
     ============================================================ */
  function formatDate(isoString) {
    if (!isoString) return "—";
    var d = new Date(isoString + "T00:00:00");
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  /* ============================================================
     Rendering
     ============================================================ */
  function render() {
    // Update summary
    totalAmountEl.textContent = formatMoney(calcTotalMonthly());
    var count = subscriptions.length;
    subCountEl.textContent =
      count + (count === 1 ? " active subscription" : " active subscriptions");

    // Toggle empty state
    if (count === 0) {
      emptyState.classList.remove("hidden");
    } else {
      emptyState.classList.add("hidden");
    }

    // Rebuild list
    subList.innerHTML = "";
    subscriptions.forEach(function (sub) {
      subList.appendChild(buildCard(sub));
    });
  }

  function buildCard(sub) {
    var color = CATEGORY_COLORS[sub.category] || CATEGORY_COLORS.Other;

    var li = document.createElement("li");
    li.className = "sub-item";
    li.style.borderLeftColor = color;

    // Icon (first letter of the name)
    var icon = document.createElement("div");
    icon.className = "sub-item__icon";
    icon.style.background = color;
    icon.textContent = (sub.name.charAt(0) || "?").toUpperCase();

    // Body: name + category badge + billing date
    var body = document.createElement("div");
    body.className = "sub-item__body";

    var name = document.createElement("div");
    name.className = "sub-item__name";
    name.textContent = sub.name;

    var meta = document.createElement("div");
    meta.className = "sub-item__meta";

    var badge = document.createElement("span");
    badge.className = "badge";
    badge.style.background = color;
    badge.textContent = sub.category;

    var dateText = document.createElement("span");
    dateText.textContent = "Next: " + formatDate(sub.billingDate);

    meta.appendChild(badge);
    meta.appendChild(dateText);
    body.appendChild(name);
    body.appendChild(meta);

    // Right side: amount + cycle + delete
    var right = document.createElement("div");
    right.className = "sub-item__right";

    var amount = document.createElement("div");
    amount.className = "sub-item__amount";
    amount.textContent = formatMoney(sub.amount);

    var cycle = document.createElement("div");
    cycle.className = "sub-item__cycle";
    cycle.textContent = "/ " + sub.cycle;

    var del = document.createElement("button");
    del.className = "btn-delete";
    del.type = "button";
    del.setAttribute("aria-label", "Delete " + sub.name);
    del.textContent = "🗑";
    del.addEventListener("click", function () {
      deleteSubscription(sub.id);
    });

    right.appendChild(amount);
    right.appendChild(cycle);
    right.appendChild(del);

    li.appendChild(icon);
    li.appendChild(body);
    li.appendChild(right);
    return li;
  }

  /* ============================================================
     Actions
     ============================================================ */
  function addSubscription(data) {
    subscriptions.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: data.name,
      amount: data.amount,
      cycle: data.cycle,
      billingDate: data.billingDate,
      category: data.category,
    });
    saveSubscriptions();
    render();
  }

  function deleteSubscription(id) {
    var sub = subscriptions.find(function (s) {
      return s.id === id;
    });
    var label = sub ? sub.name : "this subscription";
    if (!window.confirm("Delete " + label + "?")) return;

    subscriptions = subscriptions.filter(function (s) {
      return s.id !== id;
    });
    saveSubscriptions();
    render();
  }

  /* ============================================================
     Form handling + validation
     ============================================================ */
  function handleSubmit(event) {
    event.preventDefault();
    formError.textContent = "";

    var name = form.name.value.trim();
    var amount = parseFloat(form.amount.value);
    var cycle = form.cycle.value;
    var billingDate = form.billingDate.value;
    var category = form.category.value;

    if (!name) {
      return showError("Please enter a subscription name.");
    }
    if (isNaN(amount) || amount < 0) {
      return showError("Please enter a valid amount (0 or more).");
    }
    if (!billingDate) {
      return showError("Please pick the next billing date.");
    }

    addSubscription({
      name: name,
      amount: amount,
      cycle: cycle,
      billingDate: billingDate,
      category: category,
    });

    form.reset();
    setDefaultDate();
    form.name.focus();
  }

  function showError(message) {
    formError.textContent = message;
  }

  // Pre-fill the date field with today for convenience.
  function setDefaultDate() {
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, "0");
    var dd = String(today.getDate()).padStart(2, "0");
    billingDateInput.value = yyyy + "-" + mm + "-" + dd;
  }

  /* ============================================================
     Service worker registration (offline support)
     ============================================================ */
  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function (err) {
          console.warn("Service worker registration failed:", err);
        });
      });
    }
  }

  /* ============================================================
     Init
     ============================================================ */
  form.addEventListener("submit", handleSubmit);
  setDefaultDate();
  render();
  registerServiceWorker();
})();
