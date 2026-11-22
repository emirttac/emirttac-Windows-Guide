(function () {
  var root = document.documentElement;
  var themeBtn = document.getElementById("theme-toggle");
  var savedTheme;
  try {
    savedTheme = localStorage.getItem("guide-theme");
  } catch (error) {
    console.warn("Tema tercihi okunamadı:", error);
  }
  if (savedTheme === "light" || savedTheme === "dark") {
    root.setAttribute("data-theme", savedTheme);
  }

  function updateThemeLabel() {
    var isLight = root.getAttribute("data-theme") === "light";
    themeBtn.textContent = isLight ? "Koyu tema" : "Açık tema";
  }
  if (themeBtn) {
    updateThemeLabel();
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("guide-theme", next);
      } catch (error) {
        console.warn("Tema tercihi kaydedilemedi:", error);
      }
      updateThemeLabel();
    });
  }

  var header = document.querySelector(".header-right");
  if (header) {
    var github = document.createElement("a");
    github.className = "github-link";
    github.href = "https://github.com/emirttac/emirttac-Windows-Guide";
    github.textContent = "GitHub ↗";
    header.insertBefore(github, header.firstChild);
  }

  var menuBtn = document.getElementById("menu-toggle");
  var sidebar = document.getElementById("sidebar");
  if (menuBtn && sidebar) {
    menuBtn.setAttribute("aria-controls", "sidebar");
    menuBtn.setAttribute("aria-expanded", "false");
    function setMenu(open) {
      sidebar.classList.toggle("open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
    }
    menuBtn.addEventListener("click", function () {
      setMenu(!sidebar.classList.contains("open"));
    });
    document.addEventListener("click", function (event) {
      if (sidebar.classList.contains("open") && !sidebar.contains(event.target) && !menuBtn.contains(event.target)) setMenu(false);
    });
    sidebar.addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && sidebar.classList.contains("open")) {
        setMenu(false);
        menuBtn.focus();
      }
    });
  }

  var content = document.querySelector(".content");
  var headings = document.querySelectorAll(".content-inner h2, .content-inner h3");
  if (content && headings.length) {
    var toc = document.createElement("nav");
    toc.className = "page-toc";
    toc.setAttribute("aria-label", "Bu sayfada");
    var title = document.createElement("p");
    title.className = "toc-title";
    title.textContent = "Bu sayfada";
    toc.appendChild(title);
    var list = document.createElement("ul");
    list.className = "toc-list";
    headings.forEach(function (heading, index) {
      if (!heading.id) heading.id = "bolum-" + (heading.textContent.match(/^\d+(?:\.\d+)?/) || [index + 1])[0].replace(".", "-");
      var item = document.createElement("li");
      if (heading.tagName === "H3") item.className = "toc-sub";
      var link = document.createElement("a");
      link.href = "#" + heading.id;
      link.textContent = heading.textContent;
      item.appendChild(link);
      list.appendChild(item);
    });
    toc.appendChild(list);
    content.appendChild(toc);

    function updateCurrentHeading() {
      var current = 0;
      headings.forEach(function (heading, index) {
        if (heading.getBoundingClientRect().top <= 110) current = index;
      });
      list.querySelectorAll("a").forEach(function (link, index) {
        link.classList.toggle("current", index === current);
      });
    }
    window.addEventListener("scroll", updateCurrentHeading, { passive: true });
    updateCurrentHeading();
  }

  document.querySelectorAll("pre").forEach(function (pre) {
    var code = pre.querySelector("code");
    if (!code || !navigator.clipboard) return;
    var btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.type = "button";
    btn.textContent = "Kopyala";
    btn.addEventListener("click", function () {
      navigator.clipboard.writeText(code.textContent).then(function () {
        btn.textContent = "Kopyalandı";
        setTimeout(function () { btn.textContent = "Kopyala"; }, 1500);
      }).catch(function (error) {
        console.error("Kod kopyalanamadı:", error);
        btn.textContent = "Kopyalanamadı";
      });
    });
    pre.appendChild(btn);
  });
})();
