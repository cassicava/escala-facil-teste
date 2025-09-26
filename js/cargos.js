/**************************************
 * 🏥 Cargos
 **************************************/

let editingCargoId = null;
let lastAddedCargoId = null;

// --- Cache de Elementos DOM ---
const cargoNomeInput = $("#cargoNome");
const filtroCargosInput = $("#filtroCargos");
const cargoTurnosContainer = $("#cargoTurnosContainer");
const cargoDiasContainer = $("#cargoDiasContainer");
const cargoHorarioToggle = $("#cargoHorarioToggle");
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

function validateInput(inputElement, forceValid = false) {
    const isValid = forceValid || inputElement.value.trim() !== '';
    inputElement.classList.toggle('invalid', !isValid);
    const label = inputElement.closest('label');
    if (label) {
        label.classList.toggle('invalid-label', !isValid);
    }
    return isValid;
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

function renderTurnosSelects() {
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
        const container = cargoDiasContainer;
        container.appendChild(lbl);
        lbl.querySelector('input').addEventListener('change', () => {
            updateCargoRegrasExplicacao();
            setCargoFormDirty(true);
        });
    });
}

$$('.toggle-btn', cargoHorarioToggle).forEach(button => {
    button.onclick = () => {
        $$('.toggle-btn', cargoHorarioToggle).forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        const tipo = button.dataset.value;
        cargoIs24hInput.value = tipo;

        if (tipo === '24h') {
            cargoHorarioInputsContainer.classList.add('hidden-height');
        } else {
            cargoHorarioInputsContainer.classList.remove('hidden-height');
        }

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

function renderCargos() {
    const { cargos, funcionarios, turnos } = store.getState();
    const filtro = filtroCargosInput.value.toLowerCase();

    tblCargosBody.innerHTML = "";

    const cargosFiltrados = cargos.filter(c => c.nome.toLowerCase().includes(filtro));
    const cargosOrdenados = [...cargosFiltrados].sort((a, b) => a.nome.localeCompare(b.nome));

    if (cargosOrdenados.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        if (filtro.length === 0 && cargos.length === 0) {
            cell.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏥</div>
                <h3>Nenhum Cargo Cadastrado</h3>
                <p>Crie cargos e associe turnos a eles para poder cadastrar funcionários.</p>
            </div>`;
        } else {
            cell.textContent = `Nenhum cargo encontrado com o termo "${filtro}".`;
            cell.className = 'muted center';
        }
        row.appendChild(cell);
        tblCargosBody.appendChild(row);
        return;
    }

    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));

    cargosOrdenados.forEach(c => {
        const numFuncionarios = funcionarios.filter(f => f.cargoId === c.id).length;
        const nomesTurnos = (c.turnosIds || []).map(id => turnosMap[id]?.nome || "—").join(", ") || 'Nenhum';

        let funcionamento = 'Não definido';
        if (c.regras && c.regras.dias.length > 0) {
            const dias = c.regras.dias.map(d => DIAS_SEMANA.find(dia => dia.id === d)?.abrev).join(', ') || '';
            const horario = c.regras.is24h ? '24h' : (c.regras.inicio && c.regras.fim ? `${c.regras.inicio}-${c.regras.fim}` : 'N/D');
            funcionamento = `${dias} (${horario})`;
        }

        const tr = document.createElement("tr");
        tr.dataset.cargoId = c.id;

        const tdNome = document.createElement('td');
        tdNome.textContent = c.nome;
        const spanMuted = document.createElement('span');
        spanMuted.className = 'muted';
        spanMuted.textContent = ` (${numFuncionarios})`;
        tdNome.appendChild(spanMuted);

        const tdTurnos = document.createElement('td');
        tdTurnos.textContent = nomesTurnos;

        const tdFunc = document.createElement('td');
        tdFunc.textContent = funcionamento;

        const tdAcoes = document.createElement('td');
        const btnEdit = document.createElement('button');
        btnEdit.className = 'secondary';
        btnEdit.setAttribute('aria-label', `Editar cargo ${c.nome}`);
        btnEdit.innerHTML = '✏️ Editar';
        btnEdit.onclick = () => editCargoInForm(c.id);

        const btnDel = document.createElement('button');
        btnDel.className = 'danger';
        btnDel.setAttribute('aria-label', `Excluir cargo ${c.nome}`);
        btnDel.innerHTML = '🔥 Excluir';
        btnDel.onclick = () => deleteCargo(c.id);

        tdAcoes.append(btnEdit, btnDel);
        tr.append(tdNome, tdTurnos, tdFunc, tdAcoes);
        tblCargosBody.appendChild(tr);
    });

    if (lastAddedCargoId) {
        tblCargosBody.querySelector(`tr[data-cargo-id="${lastAddedCargoId}"]`)?.classList.add('new-item');
        lastAddedCargoId = null;
    }
}


// --- AÇÕES PRINCIPAIS ---

function saveCargoFromForm() {
    const nome = cargoNomeInput.value.trim();
    const turnosIds = $$('input[name="cargoTurno"]:checked').map(chk => chk.value);

    if (!nome || turnosIds.length === 0) {
        showToast("O nome do cargo e pelo menos um turno são obrigatórios.");
        if (!nome) validateInput(cargoNomeInput);
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
        $(`.toggle-btn[data-value="${tipoHorario}"]`, cargoHorarioToggle).click();
        cargoInicioInput.value = cargo.regras.inicio || '';
        cargoFimInput.value = cargo.regras.fim || '';
    }

    updateCargoRegrasExplicacao();
    btnSalvarCargo.textContent = "💾 Salvar Alterações";
    btnCancelarEdCargo.classList.remove("hidden");
    setCargoFormDirty(false);
    window.scrollTo(0, 0);
}

function cancelEditCargo() {
    editingCargoId = null;
    cargoNomeInput.value = "";
    validateInput(cargoNomeInput, true);
    $$('input[name="cargoTurno"]').forEach(chk => chk.checked = false);

    $$('input[name="cargoDias"]').forEach(chk => chk.checked = false);
    // CORREÇÃO: Garante que o estado visual do toggle seja resetado
    $(`.toggle-btn[data-value="24h"]`, cargoHorarioToggle).click();
    cargoInicioInput.value = "";
    cargoFimInput.value = "";
    updateCargoRegrasExplicacao();

    btnSalvarCargo.textContent = "💾 Salvar Cargo";
    btnCancelarEdCargo.classList.add("hidden");
    setCargoFormDirty(false);

    cargoNomeInput.focus();
}

async function deleteCargo(id) {
    const { escalas } = store.getState();
    const escalasAfetadas = escalas.filter(e => e.cargoId === id);
    let additionalInfo = 'Os funcionários associados a ele ficarão sem cargo definido.';

    if (escalasAfetadas.length > 0) {
        additionalInfo += ` Além disso, <strong>${escalasAfetadas.length} escala(s) salva(s)</strong> associada(s) a este cargo serão <strong>excluídas permanentemente.</strong>`;
    }

    handleDeleteItem({
        id,
        itemName: 'Cargo',
        dispatchAction: 'DELETE_CARGO',
        additionalInfo
    });
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
// CORREÇÃO: Garante o estado inicial correto do toggle de horário
$(`.toggle-btn[data-value="24h"]`, cargoHorarioToggle).click();