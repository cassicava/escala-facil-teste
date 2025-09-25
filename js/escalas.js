/**************************************
 * 📅 Escalas
 **************************************/
// Este arquivo agora atua como um orquestrador
// Ele define o estado global do gerador e conecta as funções dos outros módulos.
let currentEscala = null;
let geradorState = { 
    excecoes: {},
    feriados: [],
    maxDiasConsecutivos: 6,
    minFolgasFimSemana: 2,
    otimizarFolgas: false
};

// Funções de inicialização e navegação
function resetGeradorEscala() {
    geradorState = { cargoId: null, excecoes: {}, feriados: [], maxDiasConsecutivos: 6, minFolgasFimSemana: 2, otimizarFolgas: false };
    currentEscala = null;
    $("#escalaView").classList.add('hidden');
    $("#gerador-container").classList.remove('hidden');
    $$("#gerador-container .wizard-step").forEach(step => step.classList.remove('active'));
    $("#passo1-selecao").classList.add('active');
    $("#escCargo").value = '';
    $("#escIni").value = '';
    $("#escFim").value = '';
    $('#escFim').disabled = true;
    updateEscalaResumoDias(); 
    $$('#passo1-selecao .invalid').forEach(el => el.classList.remove('invalid'));
    $("#cobertura-turnos-container").innerHTML = '';
    $("#excecoes-funcionarios-container").innerHTML = '';
    $("#minFolgasFimSemana").value = 2; 
    renderFeriadosTags();
    $('#otimizar-folgas-toggle .toggle-btn[data-value="nao"]').click();
    if ($("#feriados-fieldset")) {
        $("#feriados-fieldset").disabled = true;
    }
}

function navigateWizard(targetStep) {
    $$("#gerador-container .wizard-step").forEach(step => step.classList.remove('active'));
    $(`#${targetStep}`).classList.add('active');
}

function updateHolidaySectionState() {
    const feriadosFieldset = $("#feriados-fieldset");
    const feriadoDataInput = $('#feriado-data-input');
    const inicio = $("#escIni").value;
    const fim = $("#escFim").value;

    if (inicio && fim && fim >= inicio) {
        feriadosFieldset.disabled = false;
        feriadoDataInput.min = inicio;
        feriadoDataInput.max = fim;
    } else {
        feriadosFieldset.disabled = true;
        feriadoDataInput.min = '';
        feriadoDataInput.max = '';
    }
}

function resetHolidays() {
    geradorState.feriados = [];
    renderFeriadosTags();
    $('#feriado-data-input').value = '';
    $('#feriado-nome-input').value = '';
}

// Funções de inicialização e eventos
function setupEscalas() {
    const escIniInput = $("#escIni");
    const escFimInput = $("#escFim");
    
    escIniInput.onclick = () => escIniInput.showPicker();
    escFimInput.onclick = () => escFimInput.showPicker();
    $('#feriado-data-input').onclick = () => $('#feriado-data-input').showPicker();

    $("#btn-goto-passo2").onclick = () => handleGoToPasso2();
    $("#btn-back-passo1").onclick = () => navigateWizard('passo1-selecao');
    $("#btn-goto-passo3").onclick = () => handleGoToPasso3();
    $("#btn-back-passo2").onclick = () => navigateWizard('passo2-cobertura');
    $("#btnGerarEscala").onclick = () => gerarEscala();
    $("#btnVoltarPasso3").onclick = () => {
        $("#escalaView").classList.add('hidden');
        $("#gerador-container").classList.remove('hidden');
        navigateWizard('passo3-excecoes');
    };

    $("#escCargo").onchange = () => $("#escCargo").classList.remove('invalid');
    
    escIniInput.onchange = () => {
        escIniInput.classList.remove('invalid');
        if (escIniInput.value) {
            escFimInput.disabled = false;
            escFimInput.min = escIniInput.value;
        } else {
            escFimInput.disabled = true;
            escFimInput.value = '';
        }
        if (escFimInput.value && escFimInput.value < escIniInput.value) {
            escFimInput.value = '';
        }
        updateEscalaResumoDias();
        resetHolidays();
        updateHolidaySectionState();
    };
    escFimInput.onchange = () => {
        escFimInput.classList.remove('invalid');
        updateEscalaResumoDias();
        resetHolidays();
        updateHolidaySectionState();
    };

    $('#btn-add-feriado').onclick = () => addFeriado();
    
    $$('#feriado-trabalha-toggle .toggle-btn').forEach(button => {
        button.onclick = () => {
            $$('#feriado-trabalha-toggle .toggle-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        };
    });
    
    const feriadoDescontarToggle = $('#feriado-descontar-toggle');
    const feriadoHorasDescontoContainer = $('#feriado-horas-desconto-container');
    $$('.toggle-btn', feriadoDescontarToggle).forEach(button => {
        button.onclick = () => {
            $$('.toggle-btn', feriadoDescontarToggle).forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const show = button.dataset.value === 'sim';
            feriadoHorasDescontoContainer.style.display = show ? 'flex' : 'none';
        };
    });

    $$('#cobertura-manual-toggle .toggle-btn').forEach(button => {
        button.onclick = () => {
            $$('#cobertura-manual-toggle .toggle-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const show = button.dataset.value === 'sim';
            $('#cobertura-manual-container').classList.toggle('hidden', !show);
        };
    });

    $$('#otimizar-folgas-toggle .toggle-btn').forEach(button => {
        button.onclick = () => {
            $$('#otimizar-folgas-toggle .toggle-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            geradorState.otimizarFolgas = button.dataset.value === 'sim';
        };
    });
    
    $("#btnSalvarEscala").onclick = () => salvarEscalaAtual();
    $("#btnExcluirEscala").onclick = () => resetGeradorEscala();
    
    renderEscCargoSelect();
    updateHolidaySectionState();
}

document.addEventListener("DOMContentLoaded", setupEscalas);