// ---- Launch date -------------------------------------------------------
// Fixed moment in time: 13 October 2026, 00:00 South African Standard Time (UTC+2).
// Change this one line to move the launch.
const LAUNCH_DATE = new Date("2026-10-13T00:00:00+02:00").getTime();

const els = {
  days: document.getElementById("days"),
  hours: document.getElementById("hours"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
};
const pad = (n) => String(n).padStart(2, "0");

let firstRender = true;
// Update a number and give it a small drop-in animation when it changes
// (skipped on the very first render so the opening sequence stays clean).
function setVal(el, val) {
  if (el.textContent === val) return;
  el.textContent = val;
  if (firstRender) return;
  el.classList.remove("tick");
  void el.offsetWidth; // restart the animation
  el.classList.add("tick");
}

function tick() {
  // Always recalculate from the real clock, so the display never drifts,
  // even if the tab was in the background or the device slept.
  const remaining = Math.max(0, LAUNCH_DATE - Date.now());

  const totalSeconds = Math.floor(remaining / 1000);
  setVal(els.days, pad(Math.floor(totalSeconds / 86400)));
  setVal(els.hours, pad(Math.floor((totalSeconds % 86400) / 3600)));
  setVal(els.minutes, pad(Math.floor((totalSeconds % 3600) / 60)));
  setVal(els.seconds, pad(totalSeconds % 60));
  firstRender = false;

  if (remaining === 0) {
    document.getElementById("liveMsg").hidden = false;
    return; // stop ticking
  }
  // Schedule the next update just after the next whole-second boundary.
  setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
}
tick();

// ---- Footer year -------------------------------------------------------
document.getElementById("year").textContent = new Date().getFullYear();

// ---- Notify form -------------------------------------------------------
// Opens the visitor's own email app with a ready-written message to the
// church. Nothing is sent until they press Send in their mailbox.
const CHURCH_EMAIL = "Fhgm_1@yahoo.com";

document.getElementById("notifyForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const name = data.get("name").trim();
  const email = data.get("email").trim();
  const interest = data.get("interest");

  const subject = "Notify me at launch: For His Grace Ministries";
  const body =
    "Hello For His Grace Ministries,\n\n" +
    "Please notify me when the website launches.\n\n" +
    "Name: " + name + "\n" +
    "Email: " + email + "\n" +
    "Primary ministry interest: " + interest + "\n";

  window.location.href =
    "mailto:" + CHURCH_EMAIL +
    "?subject=" + encodeURIComponent(subject) +
    "&body=" + encodeURIComponent(body);

  document.getElementById("formMsg").textContent =
    "Your email app should now open. Press Send there to finish. If nothing opens, email us at " + CHURCH_EMAIL + ".";
});

// ---- Scroll reveal -----------------------------------------------------
// Sections fade and rise into place as they scroll into view.
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) return; // content stays visible

  // [selector, stagger in ms between siblings]
  const groups = [
    [".hero-more > *", 150],
    [".signup > .card", 140],
    [".pillars-head", 0],
    [".grid > .card", 130],
    [".schedule", 0],
    [".foot-grid > div", 110],
  ];

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add("in");
      io.unobserve(el);
      // Once revealed, hand the element back to its normal hover styles.
      const done = (e) => {
        if (e.propertyName !== "opacity") return;
        el.removeEventListener("transitionend", done);
        el.classList.remove("reveal", "in");
        el.style.transitionDelay = "";
      };
      el.addEventListener("transitionend", done);
    });
  }, { threshold: 0.05, rootMargin: "0px" });

  groups.forEach(([sel, step]) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      // Anything already on screen at load waits for the opening sequence.
      const onScreen = el.getBoundingClientRect().top < window.innerHeight;
      el.style.transitionDelay = (i * step + (onScreen ? 500 : 0)) + "ms";
      el.classList.add("reveal");
      io.observe(el);
    });
  });
})();
