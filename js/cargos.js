/**************************************
 * 🏢 Cargos
 **************************************/
let CARGOS = loadJSON(KEYS.cargos, []);
let editingCargoId = null;
let lastAddedCargoId = null;

const DIAS_SEMANA_CARGO = [
    { id: 'dom', nome: 'Domingo', abrev: 'D' }, { id: 'seg', nome: 'Segunda', abrev: 'S' },
    { id: 'ter', nome: 'Terça', abrev: 'T' }, { id: 'qua', nome: 'Quarta', abrev: 'Q' },
    { id: 'qui', nome: 'Quinta', abrev: 'Q' }, { id: 'sex', nome: 'Sexta', abrev: 'S' },
    { id: 'sab', nome: 'Sábado', abrev: 'S' }
];

// --- LÓGICA DO FORMULÁRIO ---

$("#cargoNome").addEventListener("input", (e) => {
  const input = e.target;
  if (input.value.length > 0) {
    input.value = input.value.charAt(0).toUpperCase() + input.value.slice(1);
  }
  validateInput(input, input.value.trim() !== '');
});

$("#filtroCargos").addEventListener("input", (e) => {
    renderCargos(e.target.value);
});

function renderTurnosSelects(){
  const container = $("#cargoTurnosContainer");
  $$("#cargoTurnosContainer > *:not(legend)").forEach(el => el.remove());

  if (TURNOS.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.innerHTML = `Nenhum turno cadastrado. <a href="#" onclick="go('turnos')">Cadastre um turno primeiro</a>.`;
    container.appendChild(p);
    return;
  }
  
  const turnosOrdenados = [...TURNOS].sort((a, b) => a.nome.localeCompare(b.nome));

  turnosOrdenados.forEach(t => {
    const lbl = document.createElement("label");
    lbl.className = "check-inline";
    lbl.innerHTML = `
        <input type="checkbox" name="cargoTurno" value="${t.id}">
        <span class="color-dot" style="background-color: ${t.cor || '#e2e8f0'}"></span>
        ${t.nome} (${t.inicio}-${t.fim})
    `;
    container.appendChild(lbl);
  });
}

function renderDiasSemanaCargo() {
    const container = $("#cargoDiasContainer");
    container.innerHTML = '';
    DIAS_SEMANA_CARGO.forEach(d => {
        const lbl = document.createElement("label");
        lbl.className = "dia-label";
        lbl.title = d.nome;
        lbl.innerHTML = `
            <input type="checkbox" name="cargoDias" value="${d.id}" class="dia-checkbox">
            <span class="dia-abrev">${d.abrev}</span>
        `;
        container.appendChild(lbl);
        lbl.querySelector('input').addEventListener('change', updateCargoRegrasExplicacao);
    });
}

$$('#cargoHorarioToggle .toggle-btn').forEach(button => {
    button.onclick = () => {
        $$('#cargoHorarioToggle .toggle-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        const tipo = button.dataset.value;
        $("#cargoIs24h").value = tipo;
        $("#cargoHorarioInputs").classList.toggle('hidden', tipo === '24h');
        updateCargoRegrasExplicacao();
    };
});

function updateCargoRegrasExplicacao() {
    const dias = $$('input[name="cargoDias"]:checked').map(chk => DIAS_SEMANA_CARGO.find(d => d.id === chk.value)?.nome || '');
    const is24h = $("#cargoIs24h").value === '24h';
    const inicio = $("#cargoInicio").value;
    const fim = $("#cargoFim").value;
    const explicacaoEl = $("#cargoRegrasExplicacao");

    let texto = "Este cargo operará ";
    if (dias.length === 0) {
        explicacaoEl.innerHTML = "Defina os dias e a faixa de horário em que este cargo precisa de cobertura. Isso ajudará o gerador de escala a entender a demanda.";
        return;
    }
    texto += dias.length === 7 ? "todos os dias" : `às ${dias.join(", ")}`;
    texto += is24h ? ", 24 horas por dia." : (inicio && fim ? `, das ${inicio} às ${fim}.` : ".");
    explicacaoEl.innerHTML = texto;
}

// --- RENDERIZAÇÃO DA TABELA ---

function renderCargos(filtro = ''){
  const tbody = $("#tblCargos tbody");
  tbody.innerHTML = "";
  const filtroLower = filtro.toLowerCase();
  const cargosFiltrados = CARGOS.filter(c => c.nome.toLowerCase().includes(filtroLower));
  const cargosOrdenados = [...cargosFiltrados].sort((a, b) => a.nome.localeCompare(b.nome));

  if (cargosOrdenados.length === 0 && filtro.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">
        <div class="empty-state"><div class="empty-state-icon">🏢</div>
            <h3>Nenhum Cargo Cadastrado</h3>
            <p>Crie cargos e associe turnos a eles para poder cadastrar funcionários.</p>
        </div></td></tr>`;
    return;
  }

  const turnosMap = Object.fromEntries(TURNOS.map(t => [t.id, t]));

  cargosOrdenados.forEach(c => {
    const numFuncionarios = FUNCS.filter(f => f.cargoId === c.id).length;
    const nomesTurnos = (c.turnosIds || []).map(id => turnosMap[id]?.nome || "—").join(", ");
    
    let funcionamento = 'Não definido';
    if (c.regras && c.regras.dias.length > 0) {
        const dias = c.regras.dias.map(d => DIAS_SEMANA_CARGO.find(dia => dia.id === d)?.abrev).join(', ');
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
            <button class="secondary" data-edit="${c.id}">Editar</button>
            <button class="danger" data-del="${c.id}">Excluir</button>
        </td>`;
    tbody.appendChild(tr);
  });

  if (lastAddedCargoId) {
    tbody.querySelector(`tr[data-cargo-id="${lastAddedCargoId}"]`)?.classList.add('new-item');
    lastAddedCargoId = null;
  }

  $$(`#tblCargos [data-edit]`).forEach(b => b.onclick = () => editCargoInForm(b.dataset.edit));
  $$(`#tblCargos [data-del]`).forEach(b => b.onclick = () => deleteCargo(b.dataset.del));
}

// --- AÇÕES PRINCIPAIS ---

function saveCargoFromForm() {
  const nome = $("#cargoNome").value.trim();
  const turnosIds = $$('input[name="cargoTurno"]:checked').map(chk => chk.value);
  
  if (!nome || turnosIds.length === 0) {
    showToast("O nome do cargo e pelo menos um turno são obrigatórios.");
    if (!nome) $("#cargoNome").classList.add('invalid');
    return;
  }
  
  if (CARGOS.some(c => c.nome.toLowerCase() === nome.toLowerCase() && c.id !== editingCargoId)) {
      return showToast("Já existe um cargo com este nome.");
  }
  
  const cargoData = {
      id: editingCargoId || uid(),
      nome,
      turnosIds,
      regras: {
          dias: $$('input[name="cargoDias"]:checked').map(chk => chk.value),
          is24h: $("#cargoIs24h").value === '24h',
          inicio: $("#cargoInicio").value,
          fim: $("#cargoFim").value,
      }
  };

  if (editingCargoId) {
      const index = CARGOS.findIndex(c => c.id === editingCargoId);
      if (index > -1) {
          CARGOS[index] = cargoData;
          FUNCS.forEach(func => {
              if (func.cargoId === editingCargoId) {
                  for (const turnoId in func.disponibilidade) {
                      if (!turnosIds.includes(turnoId)) {
                          delete func.disponibilidade[turnoId];
                      }
                  }
              }
          });
          saveJSON(KEYS.funcs, FUNCS);
      }
  } else {
      CARGOS.push(cargoData);
      lastAddedCargoId = cargoData.id;
  }

  saveJSON(KEYS.cargos, CARGOS);
  renderCargos();
  renderFuncs();
  renderFuncCargoSelect();
  renderEscCargoSelect();
  cancelEditCargo();
  showToast("Cargo salvo com sucesso!");
}

function editCargoInForm(id) {
  const cargo = CARGOS.find(c => c.id === id);
  if (!cargo) return;

  cancelEditCargo();
  editingCargoId = id;
  
  $("#cargoNome").value = cargo.nome;
  $$('input[name="cargoTurno"]').forEach(chk => chk.checked = (cargo.turnosIds || []).includes(chk.value));

  if (cargo.regras) {
      $$('input[name="cargoDias"]').forEach(chk => chk.checked = cargo.regras.dias.includes(chk.value));
      const tipoHorario = cargo.regras.is24h ? '24h' : 'parcial';
      $(`#cargoHorarioToggle .toggle-btn[data-value="${tipoHorario}"]`).click();
      $("#cargoInicio").value = cargo.regras.inicio || '';
      $("#cargoFim").value = cargo.regras.fim || '';
  }

  updateCargoRegrasExplicacao();
  $("#btnSalvarCargo").textContent = "Salvar Alterações";
  $("#btnCancelarEdCargo").classList.remove("hidden");
  window.scrollTo(0, 0);
}

function cancelEditCargo() {
  editingCargoId = null;
  $("#cargoNome").value = "";
  $("#cargoNome").classList.remove('invalid');
  $$('input[name="cargoTurno"]').forEach(chk => chk.checked = false);
  
  $$('input[name="cargoDias"]').forEach(chk => chk.checked = false);
  $(`#cargoHorarioToggle .toggle-btn[data-value="parcial"]`).click();
  $("#cargoInicio").value = "";
  $("#cargoFim").value = "";
  updateCargoRegrasExplicacao();

  $("#btnSalvarCargo").textContent = "Salvar Cargo";
  $("#btnCancelarEdCargo").classList.add("hidden");
}

async function deleteCargo(id) {
  const confirmado = await showConfirm({
    title: "Confirmar Exclusão?",
    message: "Atenção: esta ação é permanente. Excluir este item pode afetar outras partes do sistema. Deseja continuar?"
  });

  if (confirmado) {
    CARGOS = CARGOS.filter(c => c.id !== id);
    saveJSON(KEYS.cargos, CARGOS);
    
    FUNCS.forEach(f => { if (f.cargoId === id) f.cargoId = null; });
    saveJSON(KEYS.funcs, FUNCS);

    renderCargos();
    renderFuncs();
    renderFuncCargoSelect();
    renderEscCargoSelect();
    showToast("Cargo excluído com sucesso.");
  }
}

// --- INICIALIZAÇÃO E EVENTOS ---
$("#btnSalvarCargo").onclick = saveCargoFromForm;
$("#btnCancelarEdCargo").onclick = cancelEditCargo;
$("#btnLimparCargo").onclick = cancelEditCargo;
['#cargoInicio', '#cargoFim'].forEach(sel => $(sel).addEventListener('input', updateCargoRegrasExplicacao));

renderDiasSemanaCargo();