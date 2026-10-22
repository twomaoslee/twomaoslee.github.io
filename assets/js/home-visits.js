(async function () {
  const box = document.getElementById("home-visits");
  if (!box || box.dataset.started || location.origin !== "https://zimin.li") return;
  if (!["/", "/zh/", "/en/"].includes(location.pathname)) return;
  box.dataset.started = "true";
  box.hidden = false;
  const count = box.querySelector("[data-visit-count]");
  const status = box.querySelector("[data-visit-status]");
  const key = "zimin:homepage:views:vercount:v1";
  const valid = value => Number.isSafeInteger(value) && value >= 0;
  let cached = null;
  try {
    const value = JSON.parse(localStorage.getItem(key));
    if (valid(value)) cached = value;
  } catch (_) {}
  const display = value => {
    count.textContent = value.toLocaleString(document.documentElement.lang || "en");
  };
  if (cached !== null) {
    display(cached);
    box.title = box.dataset.cached;
  }
  const unavailable = () => {
    box.dataset.state = cached === null ? "unavailable" : "cached";
    box.title = cached === null ? box.dataset.unavailable : box.dataset.cached;
    if (cached === null) count.parentElement.textContent = box.dataset.unavailable;
    status.textContent = box.title;
  };
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
    unavailable();
  }, 5000);
  try {
    const response = await fetch("https://events.vercount.one/api/v2/log", {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: box.dataset.url, isNewUv: false }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Visit counter unavailable");
    const data = await response.json();
    const views = data && data.data && data.data.page_pv;
    if (!data || data.status !== "success" || !valid(views)) {
      throw new Error("Invalid visit count");
    }
    if (timedOut) return;
    display(views);
    box.dataset.state = "ready";
    box.title = "";
    status.textContent = "";
    try { localStorage.setItem(key, JSON.stringify(views)); } catch (_) {}
  } catch (_) {
    unavailable();
  } finally {
    clearTimeout(timer);
  }
})();
