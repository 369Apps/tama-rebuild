/* TAMA site content loader.
   Reads the News and Clinic tabs from a published Google Sheet and
   renders them into the homepage. Events now come from the member
   backend (assets/js/tickets.js), not the sheet. The sheet ID is set
   once during setup. If anything fails (no sheet configured, network
   error, bad data), the built-in HTML is left exactly as is. */

const SHEET_ID = "";

(function () {
  if (!SHEET_ID) return;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cellValue(cell) {
    if (!cell || cell.v == null) return "";
    if (typeof cell.v === "object") return cell.f != null ? String(cell.f) : "";
    return String(cell.v);
  }

  function gvizUrl(tab) {
    return "https://docs.google.com/spreadsheets/d/" + SHEET_ID +
      "/gviz/tq?tqx=out:json&sheet=" + encodeURIComponent(tab);
  }

  function parseGviz(text) {
    var start = text.indexOf("{");
    var end = text.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error("bad response");
    var data = JSON.parse(text.slice(start, end + 1));
    var cols = (data.table.cols || []).map(function (c) {
      return String(c.label || "").trim().toLowerCase();
    });
    return (data.table.rows || []).map(function (r) {
      var obj = {};
      (r.c || []).forEach(function (cell, i) {
        var key = cols[i];
        if (key) obj[key] = cellValue(cell);
      });
      return obj;
    });
  }

  function loadTab(tab) {
    return fetch(gvizUrl(tab)).then(function (res) {
      if (!res.ok) throw new Error("fetch failed");
      return res.text();
    }).then(parseGviz);
  }

  function eventRow(e) {
    var meta = [e.date, e.time].filter(Boolean).join(", ");
    if (e.venue) meta += (meta ? ". " : "") + e.venue;
    if (e.description) meta += (meta ? ". " : "") + e.description;
    var html = '<article class="event-row">';
    if (e.banner_url) {
      html += '<img class="event-thumb" loading="lazy" src="' + esc(e.banner_url) +
        '" alt="' + esc(e.name) + ' banner">';
    } else {
      html += '<div class="event-date"><span class="dow">Date</span><span class="tbd">' +
        esc(e.date || "TBD") + "</span></div>";
    }
    html += '<div class="event-info"><h3>' + esc(e.name || "TAMA event") + "</h3>";
    if (meta) html += '<p class="event-meta">' + esc(meta) + "</p>";
    html += "</div>";
    if (e.register_url) {
      html += '<a class="btn btn-gold btn-sm" href="' + esc(e.register_url) +
        '" target="_blank" rel="noopener">Register</a>';
    } else {
      html += '<a class="btn btn-gold btn-sm" href="#">Register</a>';
    }
    return html + "</article>";
  }

  function renderEvents(rows) {
    var list = document.querySelector("#upcoming-events .event-list");
    if (!list) return;
    var visible = rows.filter(function (e) {
      return e.name && String(e.status || "").toLowerCase() !== "hidden";
    });
    if (!visible.length) return;
    list.innerHTML = visible.map(eventRow).join("");
    var flag = document.querySelector("#upcoming-events .flag");
    if (flag) flag.style.display = "none";
  }

  function renderNews(rows) {
    var ul = document.getElementById("latest-news");
    if (!ul) return;
    var items = rows.filter(function (n) { return n.text; });
    if (!items.length) return;
    ul.innerHTML = items.map(function (n) {
      var label = n.date ? "<strong>" + esc(n.date) + ":</strong> " : "";
      return "<li>" + label + esc(n.text) + "</li>";
    }).join("");
  }

  function renderClinic(rows) {
    var block = document.getElementById("clinic-block");
    if (!block || !rows.length) return;
    var c = rows[0];
    var html = "";
    if (c.description) html += '<p class="body-copy">' + esc(c.description) + "</p>";
    if (c.schedule) html += '<p class="event-meta">' + esc(c.schedule) + "</p>";
    if (c.register_url) {
      html += '<div class="btn-row" style="margin-top:18px">' +
        '<a class="btn btn-gold btn-sm" href="' + esc(c.register_url) +
        '" target="_blank" rel="noopener">Clinic registration</a></div>';
    }
    if (!html) return;
    block.innerHTML = html;
    if (c.title) {
      var head = block.parentElement.querySelector(".news-head h2");
      if (head) head.textContent = c.title;
    }
  }

  Promise.all([
    loadTab("News").catch(function () { return null; }),
    loadTab("Clinic").catch(function () { return null; })
  ]).then(function (results) {
    if (results[0]) renderNews(results[0]);
    if (results[1]) renderClinic(results[1]);
  }).catch(function () { /* leave built-in HTML */ });
})();
