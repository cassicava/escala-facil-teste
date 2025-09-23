/**************************************
 * ⚙️ Configurações
 **************************************/

/**
 * Carrega as configurações salvas no formulário.
 */
function loadConfigForm() {
    const { config } = store.getState();
    $("#configNome").value = config.nome || '';

    const theme = config.theme || 'light';
    $$('#themeToggleGroup .toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === theme);
    });
}

/**
 * Salva as configurações do formulário no localStorage.
 */
function saveConfig() {
    const { config } = store.getState();
    const newConfig = {
        ...config,
        nome: $("#configNome").value.trim()
    };
    
    store.dispatch('SAVE_CONFIG', newConfig);
    showToast("Preferências salvas com sucesso!");
}

$("#btnSalvarConfig").onclick = saveConfig;

// --- LÓGICA DO SELETOR DE TEMA ---
const themeToggleButtons = $$('#themeToggleGroup .toggle-btn');

themeToggleButtons.forEach(button => {
    button.onclick = () => {
        const selectedTheme = button.dataset.value;
        const { config } = store.getState();
        
        // 1. Aplica o tema visualmente na hora
        applyTheme(selectedTheme);
        
        // 2. Atualiza o visual do próprio botão
        themeToggleButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // 3. Atualiza o estado da configuração (será salvo ao clicar no botão 'Salvar')
        store.dispatch('SAVE_CONFIG', { ...config, theme: selectedTheme });
    };
});