(function () {
  async function copyUrl(url) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(url);
        return;
      } catch (_) {
        // Some browsers block Clipboard API access but allow user-triggered copy.
      }
    }
    const field = document.createElement("textarea");
    field.value = url;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(field);
    field.select();
    try {
      if (!document.execCommand("copy")) throw new Error("Copy failed");
    } finally {
      field.remove();
    }
  }

  document.querySelectorAll("[data-copy-url]").forEach(function (button) {
    button.hidden = false;
    const label = button.querySelector("span");
    const icon = button.querySelector("i");
    let reset;
    button.addEventListener("click", async function () {
      clearTimeout(reset);
      button.disabled = true;
      try {
        await copyUrl(button.dataset.copyUrl);
        label.textContent = button.dataset.copySuccess;
        icon.className = "fas fa-check";
      } catch (_) {
        label.textContent = button.dataset.copyFailure;
        icon.className = "fas fa-exclamation-circle";
      } finally {
        button.disabled = false;
        button.focus({ preventScroll: true });
        reset = setTimeout(function () {
          label.textContent = button.dataset.copyLabel;
          icon.className = "fas fa-link";
        }, 2500);
      }
    });
  });
})();
