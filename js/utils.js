/**************************************
 * 🛠️ Utilidades / Persistência
 **************************************/

const DIAS_SEMANA = [
    { id: 'dom', nome: 'Domingo', abrev: 'D' }, 
    { id: 'seg', nome: 'Segunda', abrev: 'S' },
    { id: 'ter', nome: 'Terça', abrev: 'T' }, 
    { id: 'qua', nome: 'Quarta', abrev: 'Q' },
    { id: 'qui', nome: 'Quinta', abrev: 'Q' }, 
    { id: 'sex', nome: 'Sexta', abrev: 'S' },
    { id: 'sab', nome: 'Sábado', abrev: 'S' }
];

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2,10);

function saveJSON(key, data){ localStorage.setItem(key, JSON.stringify(data)); }
function loadJSON(key, fallback){ 
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } 
  catch { return fallback; }
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
    // Copia a data para não modificar a original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Define para o dia da semana mais próximo de quinta-feira
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // Pega o início do ano
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calcula o número da semana
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
        $("#modalMessage").textContent = message;
        $("#modalConfirm").textContent = confirmText;
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