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

function validateInput(inputElement, forceValid = false) {
    const isValid = forceValid || inputElement.value.trim() !== '';
    inputElement.classList.toggle('invalid', !isValid);
    return isValid;
}

function parseTimeToMinutes(t){ if(!t) return 0; const [h,m]=t.split(":").map(Number); return h*60+m; }
function minutesToHHMM(min){ const h=String(Math.floor(min/60)).padStart(2,"0"); const m=String(min%60).padStart(2,"0"); return `${h}:${m}`; }
function calcCarga(inicio, fim, almocoMin) {
  const inicioMin = parseTimeToMinutes(inicio);
  const fimMin = parseTimeToMinutes(fim);
  let duracaoMin = fimMin - inicioMin;
  if (duracaoMin < 0) {
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


// --- FUNÇÃO CORRIGIDA ---
function showConfirm({ title, message, confirmText = "Confirmar", cancelText = "Cancelar" }) {
    return new Promise((resolve) => {
        const backdrop = $("#modalBackdrop");
        const modalConfirmBtn = $("#modalConfirm");
        const modalCancelBtn = $("#modalCancel");

        $("#modalTitle").textContent = title;
        $("#modalMessage").innerHTML = `<p>${message}</p>`;
        modalConfirmBtn.textContent = confirmText;
        modalCancelBtn.textContent = cancelText;
        
        modalConfirmBtn.style.display = 'inline-flex';
        modalCancelBtn.style.display = 'inline-flex';

        backdrop.classList.remove("hidden");

        const cleanup = () => {
            modalConfirmBtn.removeEventListener('click', confirmHandler);
            modalCancelBtn.removeEventListener('click', cancelHandler);
            $("#modalMessage").innerHTML = '';
        };

        const confirmHandler = () => {
            backdrop.classList.add("hidden");
            resolve(true);
            cleanup(); // A chamada para cleanup() foi adicionada aqui
        };

        const cancelHandler = () => {
            backdrop.classList.add("hidden");
            resolve(false);
            cleanup(); // E aqui também, garantindo a limpeza
        };
        
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
        
        const confirmHandler = () => {
            resolve(true);
            cleanupAndClose();
        };
        const cancelHandler = () => {
            resolve(false);
            cleanupAndClose();
        };
        
        const cleanupAndClose = () => {
            promptInput.removeEventListener('input', inputHandler);
            modalConfirmBtn.removeEventListener('click', confirmHandler);
            modalCancelBtn.removeEventListener('click', cancelHandler);
            modalConfirmBtn.disabled = false;
            $("#modalMessage").innerHTML = '';
            backdrop.classList.add("hidden");
        };

        modalConfirmBtn.addEventListener('click', confirmHandler);
        modalCancelBtn.addEventListener('click', cancelHandler);
    });
}


async function handleDeleteItem({ id, itemName, dispatchAction }) {
    const confirmado = await showConfirm({
        title: `Confirmar Exclusão de ${itemName}?`,
        message: "Atenção: esta ação é permanente e não pode ser desfeita. Excluir este item pode afetar outras partes do sistema. Deseja continuar?"
    });

    if (confirmado) {
        store.dispatch(dispatchAction, id);
        showToast(`${itemName} excluído com sucesso.`);
    }
}