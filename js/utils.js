/**************************************
 * 🛠️ Utilidades / Persistência
 **************************************/

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2,10);

function saveJSON(key, data){ localStorage.setItem(key, JSON.stringify(data)); }
function loadJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

// --- LOADER: Funções para controlar o indicador de carregamento ---
function showLoader(message = "Processando...") {
    const overlay = $("#loader-overlay");
    if (overlay) {
        $("#loader-overlay .loader-text").textContent = message;
        overlay.classList.remove("hidden");
    }
}

function hideLoader() {
    const overlay = $("#loader-overlay");
    if (overlay) {
        overlay.classList.add("hidden");
    }
}
// --- FIM DO LOADER ---


/**
 * Função de validação de input consolidada e melhorada.
 * Verifica se um campo (input ou select) tem valor.
 * Adiciona/remove classes 'invalid' do campo e 'invalid-label' do seu label pai.
 * @param {HTMLElement} inputElement - O elemento de input ou select a ser validado.
 * @param {boolean} [forceValid=false] - Se true, força o campo a ser considerado válido.
 * @returns {boolean} - Retorna true se o campo for válido, false caso contrário.
 */
function validateInput(inputElement, forceValid = false) {
    if (!inputElement) return true; // Se o elemento não existe, não valida.

    const isSelect = inputElement.tagName.toLowerCase() === 'select';
    const isValid = forceValid || (isSelect ? inputElement.value !== '' : inputElement.value.trim() !== '');

    inputElement.classList.toggle('invalid', !isValid);
    const label = inputElement.closest('label');
    if (label) {
        label.classList.toggle('invalid-label', !isValid);
    }
    return isValid;
}


function parseTimeToMinutes(t){ if(!t) return 0; const [h,m]=t.split(":").map(Number); return h*60+m; }
function minutesToHHMM(min){ const h=String(Math.floor(min/60)).padStart(2,"0"); const m=String(min%60).padStart(2,"0"); return `${h}:${m}`; }
function calcCarga(inicio, fim, almocoMin) {
  const inicioMin = parseTimeToMinutes(inicio);
  const fimMin = parseTimeToMinutes(fim);
  let duracaoMin = fimMin - inicioMin;
  if (duracaoMin < 0) { // Turno noturno
    const minutosEmUmDia = 24 * 60;
    duracaoMin = (minutosEmUmDia - inicioMin) + fimMin;
  }
  return duracaoMin - (almocoMin || 0);
}
function addDays(dateISO,n){ const d=new Date(dateISO); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function dateRangeInclusive(startISO,endISO){ const days=[]; let d=startISO; while(d<=endISO){ days.push(d); d=addDays(d,1); } return days; }

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

function getFimDeSemanaNoMes(mesAno) {
    const [ano, mes] = mesAno.split('-').map(Number);
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const finsDeSemana = [];
    const semanas = new Set();

    for (let dia = 1; dia <= diasNoMes; dia++) {
        const data = new Date(ano, mes - 1, dia);
        if (data.getDay() === 0 || data.getDay() === 6) { // 0 = Domingo, 6 = Sábado
            const semanaId = getWeekNumber(data);
            const fimDeSemanaId = `${mesAno}-${semanaId}`;
            if (!semanas.has(fimDeSemanaId)) {
                finsDeSemana.push({ id: fimDeSemanaId, dates: [] });
                semanas.add(fimDeSemanaId);
            }
            finsDeSemana.find(fs => fs.id === fimDeSemanaId).dates.push(data.toISOString().slice(0, 10));
        }
    }
    return finsDeSemana;
}

function showToast(message) {
    const toast = $("#toast");
    $("#toastMessage").textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => {
        toast.classList.add("hidden");
    }, 3000);
}

// --- FUNÇÃO CORRIGIDA E MELHORADA ---
function showConfirm({ title, message, confirmText = "Confirmar", cancelText = "Cancelar" }) {
    return new Promise((resolve) => {
        const backdrop = $("#modalBackdrop");
        const modalConfirmBtn = $("#modalConfirm");
        const modalCancelBtn = $("#modalCancel");

        $("#modalTitle").textContent = title;
        $("#modalMessage").innerHTML = `<p>${message}</p>`; // Usando innerHTML para permitir tags como <strong>
        modalConfirmBtn.textContent = confirmText;
        modalCancelBtn.textContent = cancelText;

        modalConfirmBtn.style.display = 'inline-flex';
        modalCancelBtn.style.display = 'inline-flex';

        backdrop.classList.remove("hidden");

        const cleanupAndResolve = (value) => {
            modalConfirmBtn.removeEventListener('click', confirmHandler);
            modalCancelBtn.removeEventListener('click', cancelHandler);
            $("#modalMessage").innerHTML = ''; // Limpa o conteúdo
            backdrop.classList.add("hidden");
            resolve(value);
        };

        const confirmHandler = () => cleanupAndResolve(true);
        const cancelHandler = () => cleanupAndResolve(false);

        // Adiciona os listeners
        modalConfirmBtn.addEventListener('click', confirmHandler);
        modalCancelBtn.addEventListener('click', cancelHandler);
    });
}


function showInfoModal({ title, contentHTML }) {
    const backdrop = $("#modalBackdrop");
    const modalCancelBtn = $("#modalCancel");

    $("#modalTitle").textContent = title;
    $("#modalMessage").innerHTML = contentHTML;

    $("#modalConfirm").style.display = 'none';
    modalCancelBtn.textContent = "Fechar";
    modalCancelBtn.style.display = 'inline-flex';


    backdrop.classList.remove("hidden");

    const closeHandler = () => {
        backdrop.classList.add("hidden");
        modalCancelBtn.removeEventListener('click', closeHandler);
        // Reseta o estado dos botões
        $("#modalConfirm").style.display = 'inline-flex';
        $("#modalMessage").innerHTML = '';
    };

    modalCancelBtn.addEventListener('click', closeHandler);
}

async function showPromptConfirm({ title, message, promptLabel, requiredWord, confirmText = "Confirmar" }) {
    return new Promise((resolve) => {
        const backdrop = $("#modalBackdrop");
        const modalConfirmBtn = $("#modalConfirm");
        const modalCancelBtn = $("#modalCancel");

        $("#modalTitle").textContent = title;
        $("#modalMessage").innerHTML = `
            <p>${message}</p>
            <div class="form-group" style="align-items: flex-start; margin-top: 16px;">
                <label for="modal-prompt-input" style="font-weight: 500;">${promptLabel}</label>
                <input type="text" id="modal-prompt-input" autocomplete="off" style="width: 100%;">
            </div>
        `;
        modalConfirmBtn.textContent = confirmText;
        modalConfirmBtn.disabled = true;
        modalCancelBtn.style.display = 'inline-flex';

        const promptInput = $("#modal-prompt-input");

        const inputHandler = () => {
            modalConfirmBtn.disabled = promptInput.value !== requiredWord;
        };

        promptInput.addEventListener('input', inputHandler);
        backdrop.classList.remove("hidden");

        const cleanupAndResolve = (value) => {
            promptInput.removeEventListener('input', inputHandler);
            modalConfirmBtn.removeEventListener('click', confirmHandler);
            modalCancelBtn.removeEventListener('click', cancelHandler);
            modalConfirmBtn.disabled = false;
            $("#modalMessage").innerHTML = '';
            backdrop.classList.add("hidden");
            resolve(value);
        };

        const confirmHandler = () => cleanupAndResolve(true);
        const cancelHandler = () => cleanupAndResolve(false);

        modalConfirmBtn.addEventListener('click', confirmHandler);
        modalCancelBtn.addEventListener('click', cancelHandler);
    });
}

// --- FUNÇÃO MELHORADA PARA EXCLUSÃO ---
async function handleDeleteItem({ id, itemName, dispatchAction, additionalInfo = '' }) {
    let message = `Atenção: esta ação é permanente e não pode ser desfeita. Excluir este ${itemName.toLowerCase()} pode afetar outras partes do sistema. ${additionalInfo} Deseja continuar?`;

    const confirmado = await showConfirm({
        title: `Confirmar Exclusão de ${itemName}?`,
        message: message
    });

    if (confirmado) {
        store.dispatch(dispatchAction, id);
        showToast(`${itemName} excluído com sucesso.`);
    }
}