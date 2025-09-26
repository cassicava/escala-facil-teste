/**************************************
 * ✨ Lógica da Tela de Boas-Vindas
 **************************************/

// --- Cache de Elementos DOM ---
const welcomeOverlay = $("#welcome-overlay");
const nomeInput = $("#welcome-nome-input");
const themeToggle = $("#welcomeThemeToggle");
const themeButtons = $$(".toggle-btn", themeToggle);
const termsCheckbox = $("#welcome-terms-checkbox");
const termsLink = $("#welcome-terms-link");
// NOVO: Cache do link da política de privacidade
const privacyLink = $("#welcome-privacy-link");
const personalizacaoNextBtn = $("#welcome-personalizacao-next");
const finishBtn = $("#welcome-finish-btn");

// --- Estado do Onboarding ---
let onboardingState = {
    currentStep: 1,
    nome: '',
    theme: 'light',
};

// --- Funções de Validação e Controle ---
function validateWelcomeStep2() {
    const nomeValido = nomeInput.value.trim() !== '';
    const temaSelecionado = onboardingState.theme !== null;
    personalizacaoNextBtn.disabled = !(nomeValido && temaSelecionado);
}

function saveOnboardingProgress() {
    localStorage.setItem('ge_onboarding_progress', JSON.stringify(onboardingState));
}

function loadOnboardingProgress() {
    const savedState = loadJSON('ge_onboarding_progress', onboardingState);
    if (savedState) {
        onboardingState = savedState;
        nomeInput.value = onboardingState.nome;
        if (onboardingState.theme) {
            handleThemeSelection(onboardingState.theme);
        }
    }
}

function showStep(stepNumber, direction = 'forward') {
    const welcomeSteps = $$(".welcome-step");
    const progressDots = $$(".progress-dot");
    const currentStepEl = $(`.welcome-step.active`);
    const nextStepEl = $(`#welcome-step-${stepNumber}`);
    const animOutClass = direction === 'forward' ? 'anim-slide-out-left' : 'anim-slide-out-right';
    const animInClass = direction === 'forward' ? 'anim-slide-in-right' : 'anim-slide-in-left';

    if (currentStepEl) {
        currentStepEl.classList.add(animOutClass);
        setTimeout(() => {
            currentStepEl.classList.remove('active', animOutClass);
        }, 400);
    }

    if (nextStepEl) {
        nextStepEl.classList.remove('anim-slide-in-right', 'anim-slide-in-left');
        nextStepEl.classList.add('active', animInClass);
    }

    progressDots.forEach(dot => {
        dot.classList.toggle('active', dot.dataset.step == stepNumber);
    });

    onboardingState.currentStep = stepNumber;
    saveOnboardingProgress();

    setTimeout(() => {
        const firstInput = $('input:not([type=checkbox]), button.welcome-btn-primary', nextStepEl);
        if(firstInput) firstInput.focus();
    }, 400);
}

function handleThemeSelection(theme) {
    onboardingState.theme = theme;
    applyTheme(theme);
    themeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === theme);
    });
    validateWelcomeStep2();
}

function finishOnboarding() {
    if (personalizacaoNextBtn.disabled) {
        showToast("Por favor, preencha seu nome para continuar.");
        showStep(2, 'backward');
        nomeInput.focus();
        return;
    }

    onboardingState.nome = nomeInput.value.trim();
    const initialConfig = { nome: onboardingState.nome, theme: onboardingState.theme };
    store.dispatch('SAVE_CONFIG', initialConfig);

    localStorage.setItem('ge_onboarding_complete', 'true');
    localStorage.removeItem('ge_onboarding_progress');
    
    welcomeOverlay.classList.remove('visible');
    initMainApp();
}

function initWelcomeScreen() {
    loadOnboardingProgress();
    welcomeOverlay.classList.add('visible');
    
    themeButtons.forEach(btn => btn.classList.remove('active'));
    if(onboardingState.theme) {
        $(`.toggle-btn[data-value="${onboardingState.theme}"]`, themeToggle)?.classList.add('active');
    }

    showStep(onboardingState.currentStep || 1);

    // --- Event Listeners ---
    $("#welcome-start-btn").onclick = () => showStep(2, 'forward');
    personalizacaoNextBtn.onclick = () => showStep(3, 'forward');
    $("#welcome-proposta-next").onclick = () => showStep(4, 'forward');
    finishBtn.onclick = finishOnboarding;
    
    $$('.welcome-btn-back').forEach(btn => {
        btn.onclick = () => showStep(parseInt(btn.dataset.toStep), 'backward');
    });

    termsLink.onclick = (e) => {
        e.preventDefault();
        exibirTermosDeUso();
    };

    // NOVO: Evento para o link da política de privacidade
    privacyLink.onclick = (e) => {
        e.preventDefault();
        // Chama a função que criamos no arquivo configuracoes.js
        exibirPoliticaDePrivacidade();
    };

    themeButtons.forEach(btn => {
        btn.onclick = () => {
            handleThemeSelection(btn.dataset.value);
            saveOnboardingProgress();
        };
    });
    
    nomeInput.oninput = () => {
        if (nomeInput.value.length > 0) {
            nomeInput.value = nomeInput.value.charAt(0).toUpperCase() + nomeInput.value.slice(1);
        }
        onboardingState.nome = nomeInput.value;
        validateWelcomeStep2();
        saveOnboardingProgress();
    };

    termsCheckbox.onchange = () => {
        finishBtn.disabled = !termsCheckbox.checked;
    };

    // Estado inicial dos botões
    finishBtn.disabled = !termsCheckbox.checked;
    validateWelcomeStep2();
}