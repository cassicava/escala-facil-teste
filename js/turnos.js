/**************************************
 * 🕒 Turnos
 **************************************/

let editingTurnoId = null;
let lastAddedTurnoId = null; // Para animar a nova linha

// --- Cache de Elementos DOM ---
const turnoNomeInput = $("#turnoNome");
const turnoInicioInput = $("#turnoInicio");
const turnoFimInput = $("#turnoFim");
const turnoAlmocoInput = $("#turnoAlmoco");
const turnoCorHiddenInput = $("#turnoCorHidden");
const turnoCargaSpan = $("#turnoCarga");
const turnoViraDiaIndicator = $("#turnoViraDia");
const descansoToggleButtons = $$('#descansoToggleGroup .toggle-btn');
const descansoHorasInput = $("#turnoDescansoHoras");
const descansoHiddenInput = $("#descansoObrigatorioHidden");
const btnSalvarTurno = $("#btnSalvarTurno");
const btnCancelarEdTurno = $("#btnCancelarEdTurno");
const filtroTurnosInput = $("#filtroTurnos");
const tblTurnosBody = $("#tblTurnos tbody");

const PALETA_CORES = [
    '#e2e8f0', '#fecaca', '#fed7aa', '#fef08a', '#d9f99d', '#bfdbfe', '#a5b4fc', '#f5d0fe',
    '#cbd5e1', '#fca5a5', '#fbbf24', '#facc15', '#a3e635', '#93c5fd', '#818cf8', '#e879f9',
    '#94a3b8', '#f87171', '#f97316', '#eab308', '#84cc16', '#60a5fa', '#6366f1', '#d946ef'
];

function setTurnoFormDirty(isDirty) {
    dirtyForms.turnos = isDirty;
}

// LÓGICA ATUALIZADA
descansoToggleButtons.forEach(button => {
    button.onclick = () => {
        descansoToggleButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        const valor = button.dataset.value;
        descansoHiddenInput.value = valor;

        if (valor === 'sim') {
            descansoHorasInput.disabled = false;
        } else {
            descansoHorasInput.disabled = true;
            descansoHorasInput.value = '';
            validateInput(descansoHorasInput, true); // Remove classe de erro
        }
        setTurnoFormDirty(true);
    };
});

turnoNomeInput.addEventListener("input", (e) => {
  const input = e.target;
  if (input.value.length > 0) {
    input.value = input.value.charAt(0).toUpperCase() + input.value.slice(1);
  }
  if (input.value.trim() === '') {
      input.classList.add('invalid');
  } else {
      input.classList.remove('invalid');
  }
  setTurnoFormDirty(true);
});

[turnoInicioInput, turnoFimInput, turnoAlmocoInput, descansoHorasInput].forEach(input => {
    input.addEventListener("input", () => {
        updateTurnoCargaPreview();
        if (input === descansoHorasInput) validateInput(descansoHorasInput);
        setTurnoFormDirty(true);
    });
});

function validateInput(inputElement, forceValid = false) {
    if (forceValid || inputElement.value.trim() !== '') {
        inputElement.classList.remove('invalid');
    } else {
        inputElement.classList.add('invalid');
    }
}

filtroTurnosInput.addEventListener("input", () => {
    renderTurnos(); // A própria função de render agora pega o filtro
});

function renderCorPalette() {
    const container = $("#turnoCorPalette");
    container.innerHTML = '';
    PALETA_CORES.forEach(cor => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = cor;
        swatch.dataset.cor = cor;
        swatch.onclick = () => {
            selectCor(cor);
            setTurnoFormDirty(true);
        };
        container.appendChild(swatch);
    });
}

function selectCor(cor) {
    turnoCorHiddenInput.value = cor;
    $$('#turnoCorPalette .color-swatch').forEach(sw => {
        sw.classList.toggle('selected', sw.dataset.cor === cor);
    });
}

function updateTurnoCargaPreview(){
  const i = turnoInicioInput.value;
  const f = turnoFimInput.value;
  const a = Number(turnoAlmocoInput.value || 0);

  if (i && f) {
    turnoCargaSpan.textContent = `Carga: ${minutesToHHMM(calcCarga(i, f, a))}`;
    turnoCargaSpan.classList.add("highlight");
    const isOvernight = f < i;
    turnoViraDiaIndicator.classList.toggle('hidden', !isOvernight);
  } else {
    turnoCargaSpan.textContent = "Carga: 00:00";
    turnoCargaSpan.classList.remove("highlight");
    turnoViraDiaIndicator.classList.add('hidden');
  }
}

function renderTurnos(){
  const { turnos } = store.getState();
  const filtro = filtroTurnosInput.value.toLowerCase();
  
  tblTurnosBody.innerHTML="";
  
  const turnosFiltrados = turnos.filter(t => t.nome.toLowerCase().includes(filtro));
  const turnosOrdenados = [...turnosFiltrados].sort((a, b) => a.nome.localeCompare(b.nome));

  if (turnosOrdenados.length === 0 && filtro.length === 0) {
      tblTurnosBody.innerHTML = `<tr><td colspan="8">
          <div class="empty-state">
              <div class="empty-state-icon">🕒</div>
              <h3>Nenhum Turno Cadastrado</h3>
              <p>Comece a adicionar turnos para poder associá-los aos cargos.</p>
          </div>
      </td></tr>`;
      return;
  }

  turnosOrdenados.forEach(t=>{
    const tr=document.createElement("tr");
    tr.dataset.turnoId = t.id; // Adiciona ID para encontrar a linha
    const descansoTxt = t.descansoObrigatorioHoras ? `${t.descansoObrigatorioHoras}h` : 'NT';
    const overnightIndicator = t.fim < t.inicio ? ' 🌙' : '';
    tr.innerHTML=`
      <td><span class="color-dot" style="background-color: ${t.cor || '#e2e8f0'}"></span></td>
      <td>${t.nome}</td><td>${t.inicio}</td><td>${t.fim}${overnightIndicator}</td>
      <td>${t.almocoMin} min</td><td>${minutesToHHMM(t.cargaMin)}</td>
      <td>${descansoTxt}</td>
      <td>
        <button class="secondary" data-edit="${t.id}">✏️ Editar</button>
        <button class="danger" data-del="${t.id}">🔥 Excluir</button>
      </td>`;
    tblTurnosBody.appendChild(tr);
  });

  if (lastAddedTurnoId) {
    const novaLinha = tblTurnosBody.querySelector(`tr[data-turno-id="${lastAddedTurnoId}"]`);
    if (novaLinha) {
      novaLinha.classList.add('new-item');
    }
    lastAddedTurnoId = null; // Reseta a variável
  }

  $$(`#tblTurnos [data-edit]`).forEach(b=> b.onclick=()=>editTurnoInForm(b.dataset.edit));
  $$(`#tblTurnos [data-del]`).forEach(b=> b.onclick=()=>deleteTurno(b.dataset.del));
}

function validateTurnoForm() {
    let isValid = true;
    const nome = turnoNomeInput.value.trim();
    const inicio = turnoInicioInput.value;
    const fim = turnoFimInput.value;
    const descansoObrigatorio = descansoHiddenInput.value === 'sim';
    const descansoHoras = descansoHorasInput.value;

    if (!nome) {
        turnoNomeInput.classList.add('invalid');
        isValid = false;
    }
    if (!inicio) {
        turnoInicioInput.classList.add('invalid');
        isValid = false;
    }
    if (!fim) {
        turnoFimInput.classList.add('invalid');
        isValid = false;
    }
    if (descansoObrigatorio && !descansoHoras) {
        descansoHorasInput.classList.add('invalid');
        isValid = false;
    }

    return isValid;
}

async function saveTurnoFromForm() {
  if (!validateTurnoForm()) {
    showToast("Preencha todos os campos obrigatórios.");
    return;
  }

  const { turnos } = store.getState();
  const nome = turnoNomeInput.value.trim();
  
  if (turnos.some(t => t.nome.toLowerCase() === nome.toLowerCase() && t.id !== editingTurnoId)) {
      return showToast("Já existe um turno com esse nome.");
  }
  
  const inicio = turnoInicioInput.value;
  const fim = turnoFimInput.value;

  if (fim < inicio) {
      const confirmado = await showConfirm({
          title: "Confirmar Turno Noturno?",
          message: "O horário de término é anterior ao de início. Isso significa que o turno termina no dia seguinte. Deseja continuar?",
          confirmText: "Sim, continuar",
          cancelText: "Não, corrigir"
      });
      if (!confirmado) {
          return;
      }
  }

  const almocoMin = Number(turnoAlmocoInput.value || 0);
  const descansoObrigatorio = descansoHiddenInput.value === 'sim';

  const dadosTurno = {
      id: editingTurnoId || uid(),
      nome, 
      cor: turnoCorHiddenInput.value, 
      inicio, 
      fim, 
      almocoMin, 
      descansoObrigatorioHoras: descansoObrigatorio ? Number(descansoHorasInput.value || 0) : null,
      cargaMin: calcCarga(inicio, fim, almocoMin)
  };
  
  if (!editingTurnoId) {
      lastAddedTurnoId = dadosTurno.id;
  }

  store.dispatch('SAVE_TURNO', dadosTurno);
  
  cancelEditTurno();
  showToast("Turno salvo com sucesso!");
}

function editTurnoInForm(id) {
  const { turnos } = store.getState();
  const turno = turnos.find(t => t.id === id);
  if (!turno) return;

  editingTurnoId = id;
  turnoNomeInput.value = turno.nome;
  selectCor(turno.cor || PALETA_CORES[0]);
  turnoInicioInput.value = turno.inicio;
  turnoFimInput.value = turno.fim;
  turnoAlmocoInput.value = turno.almocoMin || "";
  
  if(turno.descansoObrigatorioHoras) {
      $(`#descansoToggleGroup .toggle-btn[data-value="sim"]`).click();
      descansoHorasInput.value = turno.descansoObrigatorioHoras;
  } else {
      $(`#descansoToggleGroup .toggle-btn[data-value="nao"]`).click();
      descansoHorasInput.value = '';
  }

  updateTurnoCargaPreview();

  btnSalvarTurno.textContent = "💾 Salvar Alterações";
  btnCancelarEdTurno.classList.remove("hidden");
  setTurnoFormDirty(false); // Reset dirty state on edit start
  window.scrollTo(0, 0);
}

function cancelEditTurno() {
  editingTurnoId = null;
  turnoNomeInput.value = "";
  turnoNomeInput.classList.remove('invalid');
  selectCor(PALETA_CORES[0]);
  turnoInicioInput.value = "";
  turnoInicioInput.classList.remove('invalid');
  turnoFimInput.value = "";
  turnoFimInput.classList.remove('invalid');
  turnoAlmocoInput.value = "";
  
  $(`#descansoToggleGroup .toggle-btn[data-value="nao"]`).click();
  descansoHorasInput.value = '';
  descansoHorasInput.classList.remove('invalid');
  descansoHorasInput.disabled = true;

  updateTurnoCargaPreview();

  btnSalvarTurno.textContent = "💾 Salvar Turno";
  btnSalvarTurno.disabled = false;
  btnCancelarEdTurno.classList.add("hidden");
  setTurnoFormDirty(false);
}

async function deleteTurno(id) {
  const confirmado = await showConfirm({
      title: "Confirmar Exclusão?",
      message: "Atenção: esta ação é permanente e não pode ser desfeita. Excluir este item pode afetar outras partes do sistema. Deseja continuar?"
  });

  if (confirmado) {
    store.dispatch('DELETE_TURNO', id);
    showToast("Turno excluído com sucesso.");
  }
}

btnSalvarTurno.onclick = saveTurnoFromForm;
btnCancelarEdTurno.onclick = cancelEditTurno;
$("#btnLimparTurno").onclick = cancelEditTurno;

renderCorPalette();
selectCor(PALETA_CORES[0]);