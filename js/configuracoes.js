// configuracoes.js
/**************************************
 * ⚙️ Configurações
 **************************************/

function loadConfigForm() {
    const { config } = store.getState();
    $("#configNome").value = config.nome || '';

    const theme = config.theme || 'light';
    $$('#themeToggleGroup .toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === theme);
    });
}

function saveConfig() {
    const { config } = store.getState();
    const newConfig = {
        ...config,
        nome: $("#configNome").value.trim()
    };

    store.dispatch('SAVE_CONFIG', newConfig);
    showToast("Preferências salvas com sucesso!");
}

function exibirTermosDeUso() {
    const termosDeUsoHTML = `
        <div style="font-size: 0.9rem; line-height: 1.6;">
            <p><strong>Última atualização:</strong> 25 de setembro de 2025</p>

            <h4>1. Introdução e Aceitação dos Termos</h4>
            <p>Bem-vindo(a) ao Escala Fácil ("Software"). Estes Termos de Uso ("Termos") representam um contrato legal entre você ("Usuário") e o desenvolvedor do Escala Fácil. Ao adquirir e/ou utilizar o Software, você confirma que leu, entendeu e concorda em estar vinculado a estes Termos.</p>

            <h4>2. Licença de Uso</h4>
            <p>Sujeito ao pagamento do valor aplicável, concedemos a você uma licença limitada, não exclusiva e intransferível para usar o Software para seus fins pessoais ou de negócios internos. Você concorda em não revender, redistribuir ou fazer engenharia reversa do Software.</p>

            <h4>3. Descrição do Serviço</h4>
            <p>O Escala Fácil é uma ferramenta de software que funciona inteiramente no seu navegador. Todos os dados inseridos são armazenados exclusivamente no seu dispositivo local. Nós não temos acesso, não coletamos e não armazenamos nenhuma de suas informações.</p>

            <h4>4. Responsabilidades do Usuário</h4>
            <p>Ao utilizar o Software, você concorda que é o único responsável por garantir a exatidão dos dados inseridos e por proteger e fazer cópias de segurança (backup) regulares de seus dados, pois não temos como recuperá-los em caso de perda.</p>

            <h4>5. Limitação de Responsabilidade e Isenção de Garantias</h4>
            <p>O Software é fornecido "COMO ESTÁ", sem garantias de qualquer tipo. O desenvolvedor NÃO SERÁ RESPONSÁVEL POR QUAISQUER DANOS diretos ou indiretos decorrentes do uso ou da incapacidade de usar o Software.</p>

            <h4>6. Modificações nos Termos</h4>
            <p>Reservamo-nos o direito de modificar estes Termos a qualquer momento. O uso continuado do Software após quaisquer alterações constitui sua aceitação dos novos Termos.</p>

            <h4>7. Disposições Gerais</h4>
            <p>Estes Termos serão regidos pelas leis da República Federativa do Brasil.</p>

            <h4>8. Contato</h4>
            <p>Se você tiver alguma dúvida sobre estes Termos de Uso, entre em contato conosco através do e-mail: <strong>escalafacil.contato@gmail.com</strong>.</p>
        </div>
    `;

    showInfoModal({
        title: "Termos de Uso do Escala Fácil",
        contentHTML: termosDeUsoHTML
    });
}


function initConfiguracoesPage() {
    // Eventos dos botões principais
    $("#btnSalvarConfig").onclick = saveConfig;
    $("#linkTermosDeUso").onclick = (e) => {
        e.preventDefault();
        exibirTermosDeUso();
    };

    // Eventos do seletor de tema
    const themeToggleButtons = $$('#themeToggleGroup .toggle-btn');
    themeToggleButtons.forEach(button => {
        button.onclick = () => {
            const selectedTheme = button.dataset.value;
            const { config } = store.getState();

            applyTheme(selectedTheme);
            themeToggleButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            store.dispatch('SAVE_CONFIG', { ...config, theme: selectedTheme });
        };
    });

    // Eventos das ferramentas de desenvolvedor
    const btnReiniciarOnboarding = $("#btnReiniciarOnboarding");
    const btnHardReset = $("#btnHardReset");

    if (btnReiniciarOnboarding) {
        btnReiniciarOnboarding.onclick = () => {
            localStorage.removeItem('ge_onboarding_complete');
            localStorage.removeItem('ge_onboarding_progress');
            showToast("Onboarding reiniciado. A página será recarregada.");
            setTimeout(() => location.reload(), 1500);
        };
    }

    if (btnHardReset) {
        btnHardReset.onclick = async () => {
            const confirmado = await showPromptConfirm({
                title: "APAGAR TODOS OS DADOS?",
                message: "Esta ação é IRREVERSÍVEL. Todos os turnos, cargos, funcionários e escalas salvas serão permanentemente excluídos.",
                promptLabel: `Para confirmar, digite a palavra "APAGAR" no campo abaixo:`,
                requiredWord: "APAGAR",
                confirmText: "Confirmar Exclusão"
            });

            if (confirmado) {
                Object.values(KEYS).forEach(key => localStorage.removeItem(key));
                localStorage.removeItem('ge_onboarding_complete');
                localStorage.removeItem('ge_onboarding_progress');
                showToast("Todos os dados foram apagados. A aplicação será reiniciada.");
                setTimeout(() => location.reload(), 1500);
            }
        };
    }
}

document.addEventListener('DOMContentLoaded', initConfiguracoesPage);