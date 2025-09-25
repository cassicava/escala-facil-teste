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

// --- ADIÇÃO ---
// Função de validação de input centralizada.
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

function showConfirm({ title, message, confirmText = "Confirmar", cancelText = "Cancelar" }) {
    return new Promise((resolve) => {
        const backdrop = $("#modalBackdrop");
        $("#modalTitle").textContent = title;
        $("#modalMessage").innerHTML = `<p>${message}</p>`; // Garante que a mensagem seja um parágrafo
        $("#modalConfirm").textContent = confirmText;
        $("#modalCancel").textContent = cancelText;
        
        $("#modalConfirm").style.display = 'inline-flex';
        $("#modalCancel").textContent = cancelText;

        backdrop.classList.remove("hidden");

        const confirmHandler = () => {
            backdrop.classList.add("hidden");
            resolve(true);
            cleanup();
        };

        const cancelHandler = () => {
            backdrop.classList.add("hidden");
            resolve(false);
            cleanup();
        };

        const cleanup = () => {
            $("#modalConfirm").removeEventListener('click', confirmHandler);
            $("#modalCancel").removeEventListener('click', cancelHandler);
        };

        $("#modalConfirm").addEventListener('click', confirmHandler);
        $("#modalCancel").addEventListener('click', cancelHandler);
    });
}

/**
 * NOVO MODAL: Exibe um modal com um título, conteúdo HTML e apenas um botão de fechar.
 * @param {object} options
 * @param {string} options.title - O título do modal.
 * @param {string} options.contentHTML - O conteúdo em HTML para exibir no corpo do modal.
 */
function showInfoModal({ title, contentHTML }) {
    const backdrop = $("#modalBackdrop");
    $("#modalTitle").textContent = title;
    $("#modalMessage").innerHTML = contentHTML; // Usa innerHTML para renderizar o texto formatado

    // Esconde o botão de confirmar e ajusta o botão de cancelar para ser "Fechar"
    $("#modalConfirm").style.display = 'none';
    $("#modalCancel").textContent = "Fechar";

    backdrop.classList.remove("hidden");

    const closeHandler = () => {
        backdrop.classList.add("hidden");
        $("#modalCancel").removeEventListener('click', closeHandler);
         // Restaura a visibilidade do botão de confirmar para o showConfirm funcionar
        $("#modalConfirm").style.display = 'inline-flex';
    };

    $("#modalCancel").addEventListener('click', closeHandler);
}

// --- ADIÇÃO ---
/**
 * Função genérica para lidar com a exclusão de itens (Turno, Cargo, Funcionário).
 * Exibe um modal de confirmação e, se confirmado, despacha a ação para o store.
 * @param {object} params
 * @param {string} params.id - O ID do item a ser excluído.
 * @param {string} params.itemName - O nome do tipo de item (ex: 'Turno', 'Cargo').
 * @param {string} params.dispatchAction - O nome da ação a ser despachada no store (ex: 'DELETE_TURNO').
 */
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