/* ============================================================
   Capital & Code — app.js
   One file runs both pages:
     • index.html   -> lists & filters article cards
     • article.html -> renders a single markdown article
   It decides what to do based on which elements exist.
   ============================================================ */

/* ---------- Small shared helpers ---------- */

// Format an ISO date (2026-06-22) into "Jun 22, 2026"
function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Load the master list of articles. Returns [] on failure so the
// page degrades gracefully instead of throwing.
async function loadArticleIndex() {
  try {
    const res = await fetch("articles/index.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    // Newest first, regardless of file order.
    return (data.articles || []).sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) {
    console.error("Could not load article index:", err);
    return [];
  }
}

/* ---------- UI: mobile nav + footer year (runs on every page) ---------- */
function initChrome() {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }
}

/* ============================================================
   HOMEPAGE: render cards + category filtering
   ============================================================ */
function buildCard(article) {
  const card = document.createElement("a");
  card.className = "card";
  card.href = `article.html?slug=${encodeURIComponent(article.slug)}`;
  card.dataset.category = article.category;

  card.innerHTML = `
    <div class="card-body">
      <span class="tag">${article.category}</span>
      <h3 class="card-title">${article.title}</h3>
      <p class="card-excerpt">${article.excerpt}</p>
      <p class="card-meta">
        <span>${formatDate(article.date)}</span>
        <span>·</span>
        <span>${article.readingMinutes} min read</span>
      </p>
    </div>`;
  return card;
}

function applyFilter(grid, category) {
  const cards = grid.querySelectorAll(".card");
  let shown = 0;
  cards.forEach((card) => {
    const match = category === "all" || card.dataset.category === category;
    card.style.display = match ? "" : "none";
    if (match) shown++;
  });

  // Show a friendly message if a category has no articles yet.
  let empty = grid.querySelector(".empty");
  if (shown === 0) {
    if (!empty) {
      empty = document.createElement("p");
      empty.className = "empty";
      grid.appendChild(empty);
    }
    empty.textContent = `No ${category} articles yet — check back soon.`;
  } else if (empty) {
    empty.remove();
  }
}

function setActiveFilterButton(buttons, category) {
  buttons.forEach((b) =>
    b.classList.toggle("is-active", b.dataset.filter === category)
  );
}

async function initHomepage(grid) {
  const articles = await loadArticleIndex();
  grid.innerHTML = "";

  if (articles.length === 0) {
    grid.innerHTML = `<p class="empty">No articles published yet.</p>`;
    return;
  }

  articles.forEach((a) => grid.appendChild(buildCard(a)));

  // Wire up the filter buttons.
  const buttons = document.querySelectorAll(".filter");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.filter;
      setActiveFilterButton(buttons, cat);
      applyFilter(grid, cat);
    });
  });

  // Allow deep-linking to a category via the URL hash, e.g. index.html#AI
  const hash = decodeURIComponent(location.hash.replace("#", ""));
  const valid = ["Finance", "AI", "Fintech"];
  if (valid.includes(hash)) {
    setActiveFilterButton(buttons, hash);
    applyFilter(grid, hash);
  }
}

/* ============================================================
   ARTICLE PAGE: load one markdown file and render it
   ============================================================ */
async function initArticlePage(bodyEl) {
  const slug = new URLSearchParams(location.search).get("slug");
  const titleEl = document.getElementById("article-title");

  if (!slug) {
    titleEl.textContent = "Article not found";
    bodyEl.innerHTML = `<p>No article was specified. <a href="index.html">Back to all articles</a>.</p>`;
    return;
  }

  const articles = await loadArticleIndex();
  const meta = articles.find((a) => a.slug === slug);

  if (!meta) {
    titleEl.textContent = "Article not found";
    bodyEl.innerHTML = `<p>We couldn't find that article. <a href="index.html">Back to all articles</a>.</p>`;
    return;
  }

  // Fill in the header + page metadata.
  document.title = `${meta.title} — Capital & Code`;
  const desc = document.getElementById("meta-description");
  if (desc) desc.setAttribute("content", meta.excerpt);
  document.getElementById("article-category").textContent = meta.category;
  titleEl.textContent = meta.title;
  document.getElementById("article-meta").textContent =
    `By ${meta.author} · ${formatDate(meta.date)} · ${meta.readingMinutes} min read`;

  // Fetch the markdown body and render it.
  try {
    const res = await fetch(meta.file, { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const markdown = await res.text();
    bodyEl.innerHTML = marked.parse(markdown);
  } catch (err) {
    console.error("Could not load article body:", err);
    bodyEl.innerHTML = `<p>Sorry, this article failed to load.</p>`;
  }
}

/* ============================================================
   Boot
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  initChrome();

  const grid = document.getElementById("article-grid");
  const articleBody = document.getElementById("article-body");

  if (grid) initHomepage(grid);
  else if (articleBody) initArticlePage(articleBody);
});
