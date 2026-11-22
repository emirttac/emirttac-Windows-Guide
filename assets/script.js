(function () {
  var root = document.documentElement;
  var savedTheme = localStorage.getItem("guide-theme");
  if (savedTheme === "dark" || savedTheme === "light") {
    root.setAttribute("data-theme", savedTheme);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    root.setAttribute("data-theme", "dark");
  }

  var themeBtn = document.getElementById("theme-toggle");
  function updateThemeLabel() {
    if (!themeBtn) return;
    var isDark = root.getAttribute("data-theme") === "dark";
    themeBtn.textContent = isDark ? "Açık Tema" : "Koyu Tema";
  }
  updateThemeLabel();

  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("guide-theme", next);
      updateThemeLabel();
    });
  }

  var menuBtn = document.getElementById("menu-toggle");
  var sidebar = document.getElementById("sidebar");
  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", function () {
      sidebar.classList.toggle("open");
    });

    sidebar.addEventListener("click", function (e) {
      if (e.target.tagName === "A" && window.innerWidth <= 860) {
        sidebar.classList.remove("open");
      }
    });
  }

  document.querySelectorAll("pre").forEach(function (pre) {
    var btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.type = "button";
    btn.textContent = "Kopyala";
    btn.addEventListener("click", function () {
      var code = pre.querySelector("code");
      var text = code ? code.innerText : pre.innerText;
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = "Kopyalandı";
        setTimeout(function () {
          btn.textContent = "Kopyala";
        }, 1500);
      });
    });
    pre.appendChild(btn);
  });
})();
