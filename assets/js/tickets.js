/* TAMA member tickets. Talks to the tama-members Cloudflare Worker.
 * If the worker is unreachable, the built-in page content stays as is. */
const WORKER_URL = "https://tama-members.news-ce2.workers.dev";
window.TAMA_WORKER_URL = WORKER_URL;
window.TAMA_WORKER_READY = !WORKER_URL.includes("WORKERS_SUBDOMAIN");

function dollars(cents) {
  return "$" + (cents / 100).toFixed(cents % 100 ? 2 : 0);
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function api(path, opts) {
  const res = await fetch(WORKER_URL + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  return res.json();
}

async function currentMember() {
  try {
    const me = await api("/api/me");
    return me.ok ? me : null;
  } catch {
    return null;
  }
}

/* Swap the Member Login nav link to My Account when logged in. */
async function paintAuthLinks() {
  const me = await currentMember();
  if (!me) return;
  document.querySelectorAll('a[href="login.html"]').forEach((a) => {
    a.textContent = "My Account";
    a.href = "account.html";
  });
}

/* Render live ticketed events from the worker into #api-events.
 * Built-in rows with a matching data-event-id are replaced so nothing doubles.
 * On any failure the built-in HTML is left untouched. */
async function paintTicketedEvents() {
  const mount = document.getElementById("api-events");
  if (!mount) return;
  let data;
  try {
    data = await api("/api/events");
  } catch {
    return;
  }
  if (!data.ok || !data.events.length) return;
  const isMember = !!data.member;
  mount.innerHTML = "";
  for (const ev of data.events) {
    // Remove the built-in row for this event so it is not shown twice.
    document.querySelectorAll(`[data-event-id="${ev.id}"]`).forEach((el) => {
      if (!mount.contains(el)) el.remove();
    });
    const price = ev.price_cents;
    const saving = ev.public_price_cents - ev.member_price_cents;
    const priceLabel = price === 0 ? "Free" : dollars(price);
    let priceHtml;
    if (isMember) {
      priceHtml = `<div class="ticket-line">Member price ${priceLabel}` +
        (saving > 0 ? ` <span class="save">You save ${dollars(saving)}</span>` : "") + `</div>`;
    } else {
      priceHtml = `<div class="ticket-line">${priceLabel}</div>` +
        (saving > 0 && ev.public_price_cents > 0
          ? `<div class="ticket-nudge">Members save ${dollars(saving)}. <a href="login.html">Log in</a>.</div>`
          : "");
    }
    const row = document.createElement("article");
    row.className = "event-row";
    row.setAttribute("data-event-id", esc(ev.id));
    const banner = ev.banner_url
      ? `<img class="event-thumb" loading="lazy" src="${esc(ev.banner_url)}" alt="${esc(ev.name)} banner">`
      : `<div class="event-date"><span class="dow">TAMA</span><span class="tbd">Event</span></div>`;
    const meta = [ev.date, ev.time, ev.venue].map(esc).filter(Boolean).join(". ");
    const desc = ev.description ? (meta ? "<br>" : "") + esc(ev.description) : "";
    row.innerHTML =
      banner +
      `<div class="event-info"><h3>${esc(ev.name)}</h3>` +
      `<p class="event-meta">${meta}${desc}</p>` +
      priceHtml + `</div>` +
      `<button class="btn btn-gold btn-sm buy-btn" data-buy="${esc(ev.id)}">${price === 0 ? "Register free" : "Buy tickets"}</button>`;
    mount.appendChild(row);
  }
  mount.querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => buyTickets(btn));
  });
}

async function buyTickets(btn) {
  const eventId = btn.getAttribute("data-buy");
  const original = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>Working...';
  const note = (msg, isErr) => {
    btn.disabled = false;
    btn.textContent = original;
    let n = btn.parentElement.querySelector(".ticket-nudge.buy-note");
    if (!n) {
      n = document.createElement("div");
      n.className = "ticket-nudge buy-note";
      btn.parentElement.appendChild(n);
    }
    n.textContent = msg;
    if (isErr) n.style.color = "#9B1C1C";
  };
  try {
    const res = await api("/api/tickets/checkout", {
      method: "POST",
      body: JSON.stringify({ event_id: eventId, qty: 1 }),
    });
    if (res.ok && res.url) {
      window.location.href = res.url;
      return;
    }
    if (res.ok && res.free) {
      const codes = (res.codes || []).join(", ");
      note(`You are registered. ${codes ? "Ticket codes: " + codes + ". " : ""}Check your email for details.`);
      return;
    }
    note(res.error || "Something went wrong. Please try again.", true);
  } catch {
    note("Could not reach the ticket server. Please try again.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!window.TAMA_WORKER_READY) return; // not configured yet
  paintAuthLinks();
  paintTicketedEvents();
});
