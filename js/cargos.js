/**************************************
 * 🏢 Cargos
 **************************************/

let editingCargoId = null;
let lastAddedCargoId = null;

// --- Cache de Elementos DOM ---
const cargoNomeInput = $("#cargoNome");
const filtroCargosInput = $("#filtroCargos");
const cargoTurnosContainer = $("#cargoTurnosContainer");
const cargoDiasContainer = $("#cargoDiasContainer");
const cargoIs24hInput = $("#cargoIs24h");
const cargoHorarioInputsContainer = $("#cargoHorarioInputs");
const cargoInicioInput = $("#cargoInicio");
const cargoFimInput = $("#cargoFim");
const cargoRegrasExplicacaoEl = $("#cargoRegrasExplicacao");
const btnSalvarCargo = $("#btnSalvarCargo");
const btnCancelarEdCargo = $("#btnCancelarEdCargo");
const tblCargosBody = $("#tblCargos tbody");

function setCargoFormDirty(isDirty) {
    dirtyForms.cargos = isDirty;
}

// --- LÓGICA DO FORMULÁRIO ---

cargoNomeInput.addEventListener("input", (e) => {
  const input = e.target;
  if (input.value.length > 0) {
    input.value = input.value.charAt(0).toUpperCase() + input.value.slice(1);
  }
  validateInput(input, input.value.trim() !== '');
  setCargoFormDirty(true);
});

filtroCargosInput.addEventListener("input", () => {
    renderCargos();
});

function renderTurnosSelects(){
  const { turnos } = store.getState();
  cargoTurnosContainer.innerHTML = '';

  if (turnos.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.innerHTML = `Nenhum turno cadastrado. <a href="#" onclick="go('turnos')">Cadastre um turno primeiro</a>.`;
    cargoTurnosContainer.appendChild(p);
    return;
  }
  
  const turnosOrdenados = [...turnos].sort((a, b) => a.nome.localeCompare(b.nome));

  turnosOrdenados.forEach(t => {
    const lbl = document.createElement("label");
    lbl.className = "check-inline";
    lbl.innerHTML = `
        <input type="checkbox" name="cargoTurno" value="${t.id}">
        <span class="color-dot" style="background-color: ${t.cor || '#e2e8f0'}"></span>
        ${t.nome} (${t.inicio}-${t.fim})
    `;
    lbl.addEventListener('change', () => setCargoFormDirty(true));
    cargoTurnosContainer.appendChild(lbl);
  });
}

function renderDiasSemanaCargo() {
    cargoDiasContainer.innerHTML = '';
    DIAS_SEMANA.forEach(d => {
        const lbl = document.createElement("label");
        lbl.className = "dia-label";
        lbl.title = d.nome;
        lbl.innerHTML = `
            <input type="checkbox" name="cargoDias" value="${d.id}" class="dia-checkbox">
            <span class="dia-abrev">${d.abrev}</span>
        `;
        container = cargoDiasContainer;
        container.appendChild(lbl);
        lbl.querySelector('input').addEventListener('change', () => {
            updateCargoRegrasExplicacao();
            setCargoFormDirty(true);
        });
    });
}

$$('#cargoHorarioToggle .toggle-btn').forEach(button => {
    button.onclick = () => {
        $$('#cargoHorarioToggle .toggle-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        const tipo = button.dataset.value;
        cargoIs24hInput.value = tipo;
        cargoHorarioInputsContainer.classList.toggle('hidden', tipo === '24h');
        updateCargoRegrasExplicacao();
        setCargoFormDirty(true);
    };
});

function updateCargoRegrasExplicacao() {
    const dias = $$('input[name="cargoDias"]:checked').map(chk => DIAS_SEMANA.find(d => d.id === chk.value)?.nome || '');
    const is24h = cargoIs24hInput.value === '24h';
    const inicio = cargoInicioInput.value;
    const fim = cargoFimInput.value;

    let texto = "Este cargo operará ";
    if (dias.length === 0) {
        cargoRegrasExplicacaoEl.innerHTML = "Defina os dias e a faixa de horário em que este cargo precisa de cobertura. Isso ajudará o gerador de escala a entender a demanda.";
        return;
    }
    texto += dias.length === 7 ? "todos os dias" : `às ${dias.join(", ")}`;
    texto += is24h ? ", 24 horas por dia." : (inicio && fim ? `, das ${inicio} às ${fim}.` : ".");
    cargoRegrasExplicacaoEl.innerHTML = texto;
}

// --- RENDERIZAÇÃO DA TABELA ---

function renderCargos(){
  const { cargos, funcionarios, turnos } = store.getState();
  const filtro = filtroCargosInput.value.toLowerCase();
  
  tblCargosBody.innerHTML = "";
  
  const cargosFiltrados = cargos.filter(c => c.nome.toLowerCase().includes(filtro));
  const cargosOrdenados = [...cargosFiltrados].sort((a, b) => a.nome.localeCompare(b.nome));

  if (cargosOrdenados.length === 0 && filtro.length === 0) {
    tblCargosBody.innerHTML = `<tr><td colspan="4">
        <div class="empty-state"><div class="empty-state-icon">🏢</div>
            <h3>Nenhum Cargo Cadastrado</h3>
            <p>Crie cargos e associe turnos a eles para poder cadastrar funcionários.</p>
        </div></td></tr>`;
    return;
  }

  const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));

  cargosOrdenados.forEach(c => {
    const numFuncionarios = funcionarios.filter(f => f.cargoId === c.id).length;
    const nomesTurnos = (c.turnosIds || []).map(id => turnosMap[id]?.nome || "—").join(", ");
    
    let funcionamento = 'Não definido';
    if (c.regras && c.regras.dias.length > 0) {
        const dias = c.regras.dias.map(d => DIAS_SEMANA.find(dia => dia.id === d)?.abrev).join(', ');
        const horario = c.regras.is24h ? '24h' : `${c.regras.inicio}-${c.regras.fim}`;
        funcionamento = `${dias} (${horario})`;
    }

    const tr = document.createElement("tr");
    tr.dataset.cargoId = c.id;
    tr.innerHTML = `
        <td>${c.nome} <span class="muted">(${numFuncionarios})</span></td>
        <td>${nomesTurnos}</td>
        <td>${funcionamento}</td>
        <td>
            <button class="secondary" data-edit="${c.id}">✏️ Editar</button>
            <button class="danger" data-del="${c.id}">🔥 Excluir</button>
        </td>`;
    tblCargosBody.appendChild(tr);
  });

  if (lastAddedCargoId) {
    tblCargosBody.querySelector(`tr[data-cargo-id="${lastAddedCargoId}"]`)?.classList.add('new-item');
    lastAddedCargoId = null;
  }

  $$(`#tblCargos [data-edit]`).forEach(b => b.onclick = () => editCargoInForm(b.dataset.edit));
  $$(`#tblCargos [data-del]`).forEach(b => b.onclick = () => deleteCargo(b.dataset.del));
}

// --- AÇÕES PRINCIPAIS ---

function saveCargoFromForm() {
  const nome = cargoNomeInput.value.trim();
  const turnosIds = $$('input[name="cargoTurno"]:checked').map(chk => chk.value);
  
  if (!nome || turnosIds.length === 0) {
    showToast("O nome do cargo e pelo menos um turno são obrigatórios.");
    if (!nome) cargoNomeInput.classList.add('invalid');
    return;
  }
  
  const { cargos } = store.getState();
  if (cargos.some(c => c.nome.toLowerCase() === nome.toLowerCase() && c.id !== editingCargoId)) {
      return showToast("Já existe um cargo com este nome.");
  }
  
  const cargoData = {
      id: editingCargoId || uid(),
      nome,
      turnosIds,
      regras: {
          dias: $$('input[name="cargoDias"]:checked').map(chk => chk.value),
          is24h: cargoIs24hInput.value === '24h',
          inicio: cargoInicioInput.value,
          fim: cargoFimInput.value,
      }
  };
  
  if (!editingCargoId) {
    lastAddedCargoId = cargoData.id;
  }

  store.dispatch('SAVE_CARGO', cargoData);
  
  cancelEditCargo();
  showToast("Cargo salvo com sucesso!");
}

function editCargoInForm(id) {
  const { cargos } = store.getState();
  const cargo = cargos.find(c => c.id === id);
  if (!cargo) return;

  cancelEditCargo();
  editingCargoId = id;
  
  cargoNomeInput.value = cargo.nome;
  $$('input[name="cargoTurno"]').forEach(chk => chk.checked = (cargo.turnosIds || []).includes(chk.value));

  if (cargo.regras) {
      $$('input[name="cargoDias"]').forEach(chk => chk.checked = cargo.regras.dias.includes(chk.value));
      const tipoHorario = cargo.regras.is24h ? '24h' : 'parcial';
      $(`#cargoHorarioToggle .toggle-btn[data-value="${tipoHorario}"]`).click();
      cargoInicioInput.value = cargo.regras.inicio || '';
      cargoFimInput.value = cargo.regras.fim || '';
  }

  updateCargoRegrasExplicacao();
  btnSalvarCargo.textContent = "💾 Salvar Alterações";
  btnCancelarEdCargo.classList.remove("hidden");
  setCargoFormDirty(false); // Reset dirty state on edit
  window.scrollTo(0, 0);
}

function cancelEditCargo() {
  editingCargoId = null;
  cargoNomeInput.value = "";
  cargoNomeInput.classList.remove('invalid');
  $$('input[name="cargoTurno"]').forEach(chk => chk.checked = false);
  
  $$('input[name="cargoDias"]').forEach(chk => chk.checked = false);
  $(`#cargoHorarioToggle .toggle-btn[data-value="parcial"]`).click();
  cargoInicioInput.value = "";
  cargoFimInput.value = "";
  updateCargoRegrasExplicacao();

  btnSalvarCargo.textContent = "💾 Salvar Cargo";
  btnCancelarEdCargo.classList.add("hidden");
  setCargoFormDirty(false);
}

async function deleteCargo(id) {
  const confirmado = await showConfirm({
    title: "Confirmar Exclusão?",
    message: "Atenção: esta ação é permanente. Excluir este item pode afetar outras partes do sistema. Deseja continuar?"
  });

  if (confirmado) {
    store.dispatch('DELETE_CARGO', id);
    showToast("Cargo excluído com sucesso.");
  }
}

// --- INICIALIZAÇÃO E EVENTOS ---
btnSalvarCargo.onclick = saveCargoFromForm;
btnCancelarEdCargo.onclick = cancelEditCargo;
$("#btnLimparCargo").onclick = cancelEditCargo;

const cargoHorarioInputs = [cargoInicioInput, cargoFimInput];
cargoHorarioInputs.forEach(sel => sel.addEventListener('input', () => {
    updateCargoRegrasExplicacao();
    setCargoFormDirty(true);
}));

renderDiasSemanaCargo();