(function () {
  var root = document.documentElement;
  var isEnglish = root.lang === "en";
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
    var label = isEnglish ? (isLight ? "Switch to dark theme" : "Switch to light theme") : (isLight ? "Koyu temaya geç" : "Açık temaya geç");
    themeBtn.setAttribute("aria-label", label);
    themeBtn.title = label;
    themeBtn.innerHTML = isLight
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
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
    github.setAttribute("aria-label", isEnglish ? "GitHub repository" : "GitHub deposu");
    github.title = isEnglish ? "GitHub repository" : "GitHub deposu";
    github.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.81 1.3 3.49.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.6-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.3c0 .32.22.69.83.58A12 12 0 0 0 12 .5Z"/></svg>';
    header.insertBefore(github, header.firstChild);
  }

  var pageLinks = document.querySelectorAll(".nav-list > li > a.nav-link");
  if (header && pageLinks.length && typeof HTMLDialogElement !== "undefined") {
    var labels = isEnglish ? {
      search: "Search", placeholder: "Search the guide...", shortcut: "Keyboard shortcut: Ctrl+K",
      loading: "Loading search index...", prompt: "Type to search the guide.",
      empty: "No results found.", error: "Search could not load the guide. Close and reopen to retry.",
      count: "results", shown: "Showing the first 30 results.", close: "Close search"
    } : {
      search: "Ara", placeholder: "Rehberde ara...", shortcut: "Klavye kısayolu: Ctrl+K",
      loading: "Arama dizini yükleniyor...", prompt: "Rehberde aramak için yazın.",
      empty: "Sonuç bulunamadı.", error: "Rehber yüklenemedi. Yeniden denemek için aramayı kapatıp açın.",
      count: "sonuç", shown: "İlk 30 sonuç gösteriliyor.", close: "Aramayı kapat"
    };
    var searchButton = document.createElement("button");
    searchButton.type = "button";
    searchButton.className = "search-trigger";
    searchButton.setAttribute("aria-label", labels.search + " — " + labels.shortcut);
    searchButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><span></span><kbd>Ctrl</kbd><kbd>K</kbd>';
    searchButton.querySelector("span").textContent = labels.search + "...";
    header.insertBefore(searchButton, header.firstChild);

    var dialog = document.createElement("dialog");
    dialog.className = "search-dialog";
    dialog.setAttribute("aria-label", labels.search);
    dialog.innerHTML = '<div class="search-bar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input type="search" autocomplete="off"><button type="button" class="search-close">Esc</button></div><p class="search-status" role="status" aria-live="polite"></p><div class="search-results"></div>';
    document.body.appendChild(dialog);
    var searchInput = dialog.querySelector("input");
    searchInput.placeholder = labels.placeholder;
    searchInput.setAttribute("aria-label", labels.search);
    var closeButton = dialog.querySelector(".search-close");
    closeButton.setAttribute("aria-label", labels.close);
    var status = dialog.querySelector(".search-status");
    var results = dialog.querySelector(".search-results");
    var indexPromise;
    var searchIndex;
    var loadFailed = false;

    function normalize(text) {
      return text.toLocaleLowerCase(isEnglish ? "en" : "tr").replace(/ı/g, "i");
    }

    function indexPage(link) {
      return fetch(link.href).then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status + ": " + link.href);
        return response.text();
      }).then(function (html) {
        var page = new DOMParser().parseFromString(html, "text/html");
        var body = page.querySelector(".content-inner");
        if (!body) throw new Error("Missing content: " + link.href);
        var sections = [];
        var current;
        Array.prototype.forEach.call(body.children, function (element) {
          if (/^H[123]$/.test(element.tagName)) {
            current = { title: element.textContent.trim(), page: link.textContent.trim(), url: link.href + (element.id ? "#" + encodeURIComponent(element.id) : ""), text: "" };
            sections.push(current);
          } else if (current && !element.matches(".pager, .site-footer, hr")) {
            current.text += " " + element.textContent.replace(/\s+/g, " ").trim();
          }
        });
        return sections;
      });
    }

    function highlighted(parent, text, query) {
      var index = normalize(text).indexOf(normalize(query));
      if (index < 0) {
        parent.textContent = text;
        return;
      }
      parent.appendChild(document.createTextNode(text.slice(0, index)));
      var mark = document.createElement("mark");
      mark.textContent = text.slice(index, index + query.length);
      parent.appendChild(mark);
      parent.appendChild(document.createTextNode(text.slice(index + query.length)));
    }

    function renderSearch() {
      var query = searchInput.value.trim();
      results.replaceChildren();
      if (loadFailed) {
        status.textContent = labels.error;
        return;
      }
      if (!searchIndex) {
        status.textContent = labels.loading;
        return;
      }
      if (!query) {
        status.textContent = labels.prompt;
        return;
      }
      var needle = normalize(query);
      var matches = searchIndex.filter(function (section) {
        return normalize(section.title + " " + section.text).indexOf(needle) !== -1;
      });
      matches.sort(function (a, b) {
        return Number(normalize(b.title).indexOf(needle) !== -1) - Number(normalize(a.title).indexOf(needle) !== -1);
      });
      status.textContent = matches.length ? matches.length + " " + labels.count + (matches.length > 30 ? " · " + labels.shown : "") : labels.empty;
      matches.slice(0, 30).forEach(function (section) {
        var item = document.createElement("a");
        item.className = "search-result";
        item.href = section.url;
        var page = document.createElement("span");
        page.className = "search-result-page";
        page.textContent = section.page;
        var title = document.createElement("strong");
        highlighted(title, section.title, query);
        item.appendChild(page);
        item.appendChild(title);
        var text = section.text.trim();
        if (text) {
          var match = normalize(text).indexOf(needle);
          var start = match < 0 ? 0 : Math.max(0, match - 45);
          var end = match < 0 ? 150 : Math.min(text.length, match + query.length + 100);
          var snippet = document.createElement("span");
          snippet.className = "search-result-snippet";
          highlighted(snippet, (start ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : ""), query);
          item.appendChild(snippet);
        }
        results.appendChild(item);
      });
    }

    function openSearch() {
      if (dialog.open) {
        searchInput.focus();
        return;
      }
      dialog.showModal();
      searchInput.focus();
      loadFailed = false;
      if (!indexPromise) {
        indexPromise = Promise.all(Array.prototype.map.call(pageLinks, indexPage)).then(function (pages) {
          searchIndex = [].concat.apply([], pages);
          renderSearch();
        }).catch(function (error) {
          console.error("Search index could not be loaded:", error);
          indexPromise = null;
          loadFailed = true;
          renderSearch();
        });
      }
      renderSearch();
    }
    searchButton.addEventListener("click", openSearch);
    closeButton.addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    results.addEventListener("click", function (event) {
      if (event.target.closest("a")) dialog.close();
    });
    searchInput.addEventListener("input", renderSearch);
    dialog.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && event.target === searchInput) {
        var first = results.querySelector("a");
        if (first) {
          event.preventDefault();
          first.click();
        }
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      var links = Array.prototype.slice.call(results.querySelectorAll("a"));
      if (!links.length) return;
      event.preventDefault();
      var current = links.indexOf(document.activeElement);
      var next = event.key === "ArrowDown" ? Math.min(current + 1, links.length - 1) : current <= 0 ? -1 : current - 1;
      (next < 0 ? searchInput : links[next]).focus();
    });
    document.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    });
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
    toc.setAttribute("aria-label", isEnglish ? "On this page" : "Bu sayfada");
    var title = document.createElement("p");
    title.className = "toc-title";
    title.textContent = isEnglish ? "On this page" : "Bu sayfada";
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

  var languageLink = document.querySelector(".language-link");
  if (languageLink) {
    languageLink.addEventListener("click", function () {
      if (window.location.hash && document.getElementById(decodeURIComponent(window.location.hash.slice(1)))) {
        languageLink.hash = window.location.hash;
      }
    });
  }

  document.querySelectorAll("pre").forEach(function (pre) {
    var code = pre.querySelector("code");
    if (!code || !navigator.clipboard) return;
    var btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.type = "button";
    var copyText = isEnglish ? "Copy" : "Kopyala";
    btn.textContent = copyText;
    btn.addEventListener("click", function () {
      navigator.clipboard.writeText(code.textContent).then(function () {
        btn.textContent = isEnglish ? "Copied" : "Kopyalandı";
        setTimeout(function () { btn.textContent = copyText; }, 1500);
      }).catch(function (error) {
        console.error("Kod kopyalanamadı:", error);
        btn.textContent = isEnglish ? "Copy failed" : "Kopyalanamadı";
      });
    });
    pre.appendChild(btn);
  });
})();
