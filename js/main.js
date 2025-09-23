/**************************************
 * 🚀 Inicialização e Navegação
 **************************************/

function updateWelcomeMessage() {
    const welcomeEl = $("#welcomeTitle");
    if (!welcomeEl) return;

    const { config } = store.getState();
    const nome = config.nome;
    if (nome && nome.trim() !== '') {
        welcomeEl.textContent = `Olá, ${nome}!`;
    } else {
        welcomeEl.textContent = `Bem-vindo ao Gestor de Escalas!`;
    }
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
}

async function go(page) {
    const currentPage = $('.page.active');
    
    if (currentPage && currentPage.id === 'page-gerar-escala' && geradorState.cargoId && page !== 'gerar-escala') {
        const confirmado = await showConfirm({
            title: "Sair da Geração de Escala?",
            message: "Você tem certeza que deseja sair? Todos os dados não salvos nesta tela serão perdidos.",
            confirmText: "Sim, Sair",
            cancelText: "Não, Ficar"
        });
        if (!confirmado) {
            return;
        }
    }

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
            case 'page-gerar-escala':
                resetGeradorEscala();
                break;
        }
    }
    
    window.scrollTo(0, 0);
    $$(".page").forEach(p => p.classList.toggle("active", p.id === `page-${page}`));
    $$(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.page === page));
}

// Função central de renderização que é chamada sempre que o estado muda
function renderAll() {
    console.log("Estado atualizado. Re-renderizando componentes...");
    const state = store.getState();
    
    // Renderiza as tabelas
    renderTurnos();
    renderCargos();
    renderFuncs();
    renderEscalasList();
    
    // Renderiza os selects e componentes que dependem de outros dados
    renderTurnosSelects();
    renderFuncCargoSelect();
    renderEscCargoSelect();
    
    // Atualiza outras partes da UI
    loadConfigForm();
    updateWelcomeMessage();
}


function init() {
  // Carrega os dados do localStorage para o store
  store.dispatch('LOAD_STATE');
  
  // 'Inscreve' a função renderAll para ser chamada sempre que o estado mudar
  store.subscribe(renderAll);
  
  // Aplica o tema inicial
  const { config } = store.getState();
  applyTheme(config.theme || 'light');
  
  // Renderiza tudo pela primeira vez
  renderAll();

  // Define a página inicial
  go("home");
}

$$(".tab-btn").forEach(b => b.onclick = () => go(b.dataset.page));
$$(".home-card").forEach(c => c.onclick = () => go(c.dataset.goto));

document.addEventListener("DOMContentLoaded", init);