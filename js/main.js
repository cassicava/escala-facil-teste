/**************************************
 * 🚀 Inicialização e Navegação
 **************************************/

function updateWelcomeMessage() {
    const welcomeEl = $("#welcomeTitle");
    if (!welcomeEl) return;

    const nome = CONFIG.nome;
    if (nome && nome.trim() !== '') {
        welcomeEl.textContent = `Olá, ${nome}!`;
    } else {
        welcomeEl.textContent = `Bem-vindo ao Gestor de Escalas!`;
    }
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
}

function go(page) {
    const currentPage = $('.page.active');
    if (currentPage) {
        switch (currentPage.id) {
            case 'page-turnos':
                cancelEditTurno();
                break;
            case 'page-cargos':
                cancelEditCargo();
                break;
            case 'page-funcionarios':
                cancelEditFunc();
                break;
        }
    }

    window.scrollTo(0, 0);
    $$(".page").forEach(p => p.classList.toggle("active", p.id === `page-${page}`));
    $$(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.page === page));
}

$$(".tab-btn").forEach(b => b.onclick = () => go(b.dataset.page));
$$(".home-card").forEach(c => c.onclick = () => go(c.dataset.goto));

function init() {
  applyTheme(CONFIG.theme || 'light');
  
  // Renderizações principais
  renderTurnos();
  renderCargos();
  renderFuncs();
  
  // Renderizações de selects e listas secundárias
  renderTurnosSelects();
  renderFuncCargoSelect();
  renderEscalasList();
  renderEscCargoSelect();
  
  loadConfigForm();
  updateWelcomeMessage();

  go("home");
}

document.addEventListener("DOMContentLoaded", init);