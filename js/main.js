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

/**
 * Roteador de Renderização. Chamado pelo store sempre que o estado muda.
 * Decide quais partes da UI precisam ser atualizadas com base na ação despachada.
 * @param {string} actionName - O nome da ação que causou a atualização do estado.
 */
function renderRouter(actionName) {
    console.log(`Estado atualizado via ação: ${actionName}. Re-renderizando componentes...`);

    const fullRenderActions = ['LOAD_STATE'];
    const turnoActions = ['SAVE_TURNO', 'DELETE_TURNO'];
    const cargoActions = ['SAVE_CARGO', 'DELETE_CARGO', 'DELETE_TURNO']; // Deletar turno afeta cargos
    const funcionarioActions = ['SAVE_FUNCIONARIO', 'DELETE_FUNCIONARIO', 'SAVE_CARGO', 'DELETE_CARGO']; // Alterar cargo afeta funcionários
    const escalaActions = ['SAVE_ESCALA', 'DELETE_ESCALA_SALVA', 'DELETE_CARGO', 'DELETE_FUNCIONARIO']; // Alterar cargo/func afeta escalas

    if (fullRenderActions.includes(actionName)) {
        renderTurnos();
        renderCargos();
        renderFuncs();
        renderEscalasList();
        renderTurnosSelects();
        renderFuncCargoSelect();
        renderEscCargoSelect();
        loadConfigForm();
        updateWelcomeMessage();
        return;
    }

    // Renderizações direcionadas
    if (turnoActions.includes(actionName)) {
        renderTurnos();
        renderTurnosSelects(); // Afeta o formulário de cargos
    }
    if (cargoActions.includes(actionName)) {
        renderCargos();
        renderFuncCargoSelect(); // Afeta o formulário de funcionários
        renderEscCargoSelect(); // Afeta o gerador de escala
    }
    if (funcionarioActions.includes(actionName)) {
        renderFuncs();
    }
    if (escalaActions.includes(actionName)) {
        renderEscalasList();
    }
    if (actionName === 'SAVE_CONFIG') {
        loadConfigForm();
        updateWelcomeMessage();
    }

    // Verificação de segurança para o gerador de escala (mantida)
    const { cargos } = store.getState();
    if (geradorState.cargoId && !cargos.some(c => c.id === geradorState.cargoId)) {
        console.warn("Cargo selecionado no gerador não existe mais. Resetando o assistente.");
        resetGeradorEscala();
        if ($("#page-gerar-escala").classList.contains('active')) {
            showToast("O cargo selecionado foi excluído. Por favor, comece novamente.");
        }
    }
}


function initMainApp() {
    console.log("Iniciando aplicação principal...");
    store.subscribe(renderRouter); // <-- ALTERAÇÃO: Inscreve o novo roteador

    const { config } = store.getState();
    applyTheme(config.theme || 'light');

    renderRouter('LOAD_STATE'); // <-- ALTERAÇÃO: Carga inicial com a ação explícita
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