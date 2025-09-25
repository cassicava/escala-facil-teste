/**************************************
 * 🚀 Inicialização e Navegação
 **************************************/

// Objeto para controlar o estado "sujo" (dirty) dos formulários
const dirtyForms = {
    turnos: false,
    cargos: false,
    funcionarios: false,
};

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
    const currentPageEl = $('.page.active');
    // FALLBACK ADICIONADO: Garante que, se nenhuma página estiver ativa, a navegação funcione.
    if (!currentPageEl) { 
        $$(".page").forEach(p => p.classList.remove("active"));
        $(`#page-${page}`).classList.add("active");
        $$(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.page === page));
        return;
    }

    const currentPageId = currentPageEl.id.replace('page-', '');
    
    if (dirtyForms[currentPageId]) {
        const confirmado = await showConfirm({
            title: "Descartar Alterações?",
            message: "Você tem alterações não salvas nesta página. Tem certeza de que deseja sair e perdê-las?",
            confirmText: "Sim, Sair",
            cancelText: "Não, Ficar"
        });
        if (!confirmado) {
            return; 
        }
    }

    if (currentPageId === 'gerar-escala' && geradorState.cargoId && page !== 'gerar-escala') {
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

    // Limpa e reseta os formulários ao sair da página
    switch (currentPageId) {
        case 'turnos':
            cancelEditTurno();
            break;
        case 'cargos':
            cancelEditCargo();
            break;
        case 'funcionarios':
            cancelEditFunc();
            break;
        case 'gerar-escala':
            resetGeradorEscala();
            break;
    }
    
    window.scrollTo(0, 0);
    $$(".page").forEach(p => p.classList.toggle("active", p.id === `page-${page}`));
    $$(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.page === page));

    if (page === 'home') {
        updateWelcomeMessage();
    }
}

function renderAll() {
    console.log("Estado atualizado. Re-renderizando componentes...");
    
    const { cargos } = store.getState();

    // --- ADIÇÃO: Verificação de segurança para o gerador de escala ---
    // Se o cargo selecionado no gerador foi excluído, reseta o assistente para evitar erros.
    if (geradorState.cargoId && !cargos.some(c => c.id === geradorState.cargoId)) {
        console.warn("Cargo selecionado no gerador não existe mais. Resetando o assistente.");
        resetGeradorEscala();
        if ($("#page-gerar-escala").classList.contains('active')) {
            showToast("O cargo selecionado foi excluído. Por favor, comece novamente.");
        }
    }
    
    renderTurnos();
    renderCargos();
    renderFuncs();
    renderEscalasList();
    
    renderTurnosSelects();
    renderFuncCargoSelect();
    renderEscCargoSelect();
    
    loadConfigForm();
    updateWelcomeMessage();
}


function initMainApp() {
    console.log("Iniciando aplicação principal...");
    store.subscribe(renderAll);
  
    const { config } = store.getState();
    applyTheme(config.theme || 'light');
  
    renderAll();
    go("home");

    $$(".tab-btn").forEach(b => b.onclick = () => go(b.dataset.page));
    $$(".home-card").forEach(c => c.onclick = () => go(c.dataset.goto));
}


function init() {
    store.dispatch('LOAD_STATE');
    const onboardingComplete = localStorage.getItem('ge_onboarding_complete') === 'true';

    if (!onboardingComplete) {
        initWelcomeScreen();
    } else {
        initMainApp();
    }
}


document.addEventListener("DOMContentLoaded", init);