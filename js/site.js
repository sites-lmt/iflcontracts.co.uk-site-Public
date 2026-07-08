/* IFL Contracts — shared site JS (nav toggle, footer year) */
document.addEventListener('DOMContentLoaded', function () {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
  }
  const yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();
});
