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
    const currentPageId = currentPageEl ? currentPageEl.id.replace('page-', '') : null;
    
    // Se a navegação for para a mesma página, não faz nada
    if (currentPageId === page) return;

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

    if (currentPageId === 'gerar-escala' && geradorState.cargoId) {
        const confirmado = await showConfirm({
            title: "Sair da Geração de Escala?",
            message: "Você tem certeza que deseja sair? O progresso da escala atual será perdido.",
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

    // Verificação de segurança para o gerador de escala
    // Se o cargo selecionado no gerador foi excluído, reseta o assistente para evitar erros.
    if (geradorState.cargoId && !cargos.some(c => c.id === geradorState.cargoId)) {
        console.warn("Cargo selecionado no gerador não existe mais. Resetando o assistente.");
        resetGeradorEscala();
        if ($("#page-gerar-escala").classList.contains('active')) {
            showToast("O cargo selecionado foi excluído. Por favor, comece novamente.");
        }
    }

    // Renderiza as listas principais
    renderTurnos();
    renderCargos();
    renderFuncs();
    renderEscalasList();

    // Renderiza componentes <select> e listas dinâmicas em outros formulários
    renderTurnosSelects(); // Na pág. de Cargos
    renderFuncCargoSelect(); // Na pág. de Funcionários
    renderEscCargoSelect(); // Na pág. de Gerar Escala (BUG FIX)

    // Atualiza outras partes da UI
    loadConfigForm();
    updateWelcomeMessage();
}


function initMainApp() {
    console.log("Iniciando aplicação principal...");
    store.subscribe(renderAll);

    const { config } = store.getState();
    applyTheme(config.theme || 'light');

    renderAll();
    go("home"); // Inicia na página home

    $$(".tab-btn").forEach(b => b.onclick = () => go(b.dataset.page));
    $$(".home-card").forEach(c => c.onclick = (e) => {
        e.preventDefault();
        go(c.dataset.goto)
    });
}


function init() {
    store.dispatch('LOAD_STATE');
    const onboardingComplete = localStorage.getItem('ge_onboarding_complete') === 'true';

    if (!onboardingComplete) {
        initWelcomeScreen();
    } else {
        // Esconde o overlay de boas-vindas para evitar flash de conteúdo
        if(welcomeOverlay) welcomeOverlay.style.display = 'none';
        initMainApp();
    }
}


document.addEventListener("DOMContentLoaded", init);