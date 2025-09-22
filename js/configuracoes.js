/**************************************
 * ⚙️ Configurações
 **************************************/
let CONFIG = loadJSON(KEYS.config, { nome: '', theme: 'light' });

/**
 * Carrega as configurações salvas no formulário.
 */
function loadConfigForm() {
    $("#configNome").value = CONFIG.nome || '';

    // Carrega o estado do seletor de tema
    const theme = CONFIG.theme || 'light';
    $$('#themeToggleGroup .toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === theme);
    });
}

/**
 * Salva as configurações do formulário no localStorage.
 */
function saveConfig() {
    // O nome já é pego do campo de input
    CONFIG.nome = $("#configNome").value.trim();
    // O tema já foi salvo no objeto CONFIG pelo clique do botão
    
    saveJSON(KEYS.config, CONFIG);
    updateWelcomeMessage(); // Atualiza a mensagem na Home
    showToast("Preferências salvas com sucesso!");
}

$("#btnSalvarConfig").onclick = saveConfig;

// --- LÓGICA DO SELETOR DE TEMA ---
const themeToggleButtons = $$('#themeToggleGroup .toggle-btn');

themeToggleButtons.forEach(button => {
    button.onclick = () => {
        const selectedTheme = button.dataset.value;
        
        // 1. Atualiza o objeto de configuração
        CONFIG.theme = selectedTheme;
        
        // 2. Aplica o tema visualmente na hora
        applyTheme(selectedTheme);
        
        // 3. Atualiza o visual do próprio botão
        themeToggleButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // O salvamento no localStorage ocorrerá ao clicar no botão "Salvar"
    };
});