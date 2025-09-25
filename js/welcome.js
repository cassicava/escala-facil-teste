/**************************************
 * ✨ Lógica da Tela de Boas-Vindas
 **************************************/

// --- Cache de Elementos DOM ---
const welcomeOverlay = $("#welcome-overlay");
const welcomeSteps = $$(".welcome-step");
const progressDots = $$(".progress-dot");
const nomeInput = $("#welcome-nome-input");
const themeButtons = $$(".welcome-theme-btn");
const termsCheckbox = $("#welcome-terms-checkbox");
const termsLink = $("#welcome-terms-link");
const personalizacaoNextBtn = $("#welcome-personalizacao-next");
const finishBtn = $("#welcome-finish-btn");

// --- Estado do Onboarding ---
let onboardingState = {
    currentStep: 1,
    nome: '',
    theme: 'light',
};

// --- Funções de Controle ---

function saveOnboardingProgress() {
    localStorage.setItem('ge_onboarding_progress', JSON.stringify(onboardingState));
}

function loadOnboardingProgress() {
    const savedState = loadJSON('ge_onboarding_progress', null);
    if (savedState) {
        onboardingState = savedState;
        nomeInput.value = onboardingState.nome;
        handleThemeSelection(onboardingState.theme);
    }
}

function showStep(stepNumber, direction = 'forward') {
    const currentStepEl = $(`.welcome-step.active`);
    const nextStepEl = $(`#welcome-step-${stepNumber}`);
    const animOutClass = direction === 'forward' ? 'anim-slide-out-left' : 'anim-slide-out-right';
    const animInClass = direction === 'forward' ? 'anim-slide-in-right' : 'anim-slide-in-left';

    if (currentStepEl) {
        currentStepEl.classList.add(animOutClass);
        setTimeout(() => {
            currentStepEl.classList.remove('active', animOutClass);
            currentStepEl.style.position = '';
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
        btn.classList.toggle('selected', btn.dataset.theme === theme);
    });
}

function finishOnboarding() {
    const nome = nomeInput.value.trim();
    if (!nome) {
        showToast("Por favor, digite seu nome para continuar.");
        showStep(2, 'backward');
        nomeInput.focus();
        return;
    }

    onboardingState.nome = nome;
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
    showStep(onboardingState.currentStep || 1);

    // --- Event Listeners ---
    $("#welcome-start-btn").onclick = () => showStep(2, 'forward');
    personalizacaoNextBtn.onclick = () => {
        const nome = nomeInput.value.trim();
        if (!nome) {
            nomeInput.focus();
            showToast("Por favor, digite seu nome para continuar.");
            return;
        }
        onboardingState.nome = nome;
        showStep(3, 'forward');
    };
    $("#welcome-proposta-next").onclick = () => showStep(4, 'forward');
    finishBtn.onclick = finishOnboarding;
    
    $$('.welcome-btn-back').forEach(btn => {
        btn.onclick = () => showStep(parseInt(btn.dataset.toStep), 'backward');
    });

    termsLink.onclick = (e) => {
        e.preventDefault();
        exibirTermosDeUso();
    };

    themeButtons.forEach(btn => {
        btn.onclick = () => {
            handleThemeSelection(btn.dataset.theme);
            saveOnboardingProgress();
        };
    });
    
    nomeInput.oninput = () => {
        const nomeValido = nomeInput.value.trim() !== '';
        personalizacaoNextBtn.disabled = !nomeValido;
        onboardingState.nome = nomeInput.value;
        saveOnboardingProgress();
    };

    termsCheckbox.onchange = () => {
        finishBtn.disabled = !termsCheckbox.checked;
    };

    finishBtn.disabled = !termsCheckbox.checked;
    personalizacaoNextBtn.disabled = nomeInput.value.trim() === '';
}