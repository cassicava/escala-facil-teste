/**************************************
 * 👤 Funcionários
 **************************************/

let editingFuncId=null;
let lastAddedFuncId = null;
let funcDisponibilidadeTemporaria = {}; // Objeto para manipular a disponibilidade no formulário

// --- Cache de Elementos DOM (MELHORIA) ---
const funcNomeInput = $("#funcNome");
const funcDocumentoInput = $("#funcDocumento");
const funcCargoSelect = $("#funcCargo");
const funcContratoInput = $("#funcContrato");
const funcPeriodoHorasInput = $("#funcPeriodoHoras");
const funcCargaHorariaInput = $("#funcCargaHoraria");
const funcHoraExtraInput = $("#funcHoraExtra");
const funcTurnosContainer = $("#funcTurnosContainer");
const filtroFuncionariosInput = $("#filtroFuncionarios");
const tblFuncionariosBody = $("#tblFuncionarios tbody");
const btnSalvarFunc = $("#btnSalvarFunc");
const btnCancelarEdFunc = $("#btnCancelarEdFunc");
const contratoExplicacaoEl = $("#contratoExplicacao");
const contratoToggleGroup = $("#contratoToggleGroup");
const periodoHorasToggleGroup = $("#periodoHorasToggleGroup");
const horaExtraToggleGroup = $("#horaExtraToggleGroup");


const SEM_CARGO_DEFINIDO = "Sem Cargo Definido";

function setFuncFormDirty(isDirty) {
    dirtyForms.funcionarios = isDirty;
}

// --- Lógicas dos Toggles ---
$$('.toggle-btn', contratoToggleGroup).forEach(button => button.onclick = () => handleToggleClick(button, 'contrato'));
$$('.toggle-btn', periodoHorasToggleGroup).forEach(button => button.onclick = () => handleToggleClick(button, 'periodo'));
$$('.toggle-btn', horaExtraToggleGroup).forEach(button => button.onclick = () => handleToggleClick(button, 'horaExtra'));

function handleToggleClick(button, type) {
    const group = button.closest('.toggle-group');
    group.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    const value = button.dataset.value;
    if (type === 'contrato') {
        funcContratoInput.value = value;
        contratoExplicacaoEl.innerHTML = value === 'clt' 
            ? 'Funcionários <strong>CLT / Concursados</strong> seguirão rigorosamente as regras de descanso obrigatório cadastradas nos turnos.'
            : 'Funcionários <strong>Prestadores de Serviço</strong> terão as regras de descanso obrigatório ignoradas, permitindo maior flexibilidade.';
    } else if (type === 'periodo') {
        funcPeriodoHorasInput.value = value;
    } else if (type === 'horaExtra') {
        funcHoraExtraInput.value = value;
    }
    setFuncFormDirty(true);
}


// --- Lógica de Renderização e Interação da Disponibilidade ---

function renderFuncTurnosForCargo() {
    const { cargos, turnos } = store.getState();
    const cargoId = funcCargoSelect.value;
    funcTurnosContainer.innerHTML = `<div class="turno-placeholder"><p>Selecione um cargo para ver os turnos disponíveis.</p></div>`;
    const placeholder = $(".turno-placeholder", funcTurnosContainer);

    if (!cargoId) {
        placeholder.style.display = 'block';
        return;
    }
    
    const cargo = cargos.find(c => c.id === cargoId);
    if (!cargo || !cargo.turnosIds || cargo.turnosIds.length === 0) {
        placeholder.style.display = 'block';
        placeholder.querySelector('p').textContent = 'Nenhum turno associado a este cargo.';
        return;
    }

    placeholder.style.display = 'none'; 

    const turnosDoCargo = turnos.filter(t => cargo.turnosIds.includes(t.id))
                                .sort((a, b) => a.nome.localeCompare(b.nome));

    const diasParaRender = DIAS_SEMANA;

    turnosDoCargo.forEach(t => {
        const isTurnoSelecionado = !!funcDisponibilidadeTemporaria[t.id]; 
        
        const item = document.createElement('div');
        item.className = 'turno-disponibilidade-item';
        item.dataset.turnoId = t.id;
        item.classList.toggle('selecionado', isTurnoSelecionado); 

        const diasHtml = diasParaRender.map(d => {
            const isDiaSelecionado = isTurnoSelecionado && (funcDisponibilidadeTemporaria[t.id] || []).includes(d.id);
            return `
                <span class="dia-selecionavel ${isDiaSelecionado ? 'selecionado-dia' : ''}" data-dia-id="${d.id}" title="${d.nome}">
                    ${d.abrev}
                </span>
            `;
        }).join('');

        item.innerHTML = `
            <div class="turno-disponibilidade-header">
                <input type="checkbox" name="turnoPrincipal" value="${t.id}" ${isTurnoSelecionado ? 'checked' : ''}>
                <span class="color-dot" style="background-color: ${t.cor || '#e2e8f0'}"></span>
                <div class="turno-info">
                    <strong>${t.nome}</strong> (${t.inicio}-${t.fim})
                </div>
            </div>
            <div class="turno-disponibilidade-dias">
                ${diasHtml}
            </div>
        `;
        funcTurnosContainer.appendChild(item);

        const header = item.querySelector('.turno-disponibilidade-header');
        const chkPrincipal = header.querySelector('input[name="turnoPrincipal"]');
        const spansDias = $$('.dia-selecionavel', item);

        const toggleTurnoPrincipal = () => {
            const isChecked = chkPrincipal.checked;
            item.classList.toggle('selecionado', isChecked); 

            if (isChecked) {
                if (!funcDisponibilidadeTemporaria[t.id] || funcDisponibilidadeTemporaria[t.id].length === 0) {
                    funcDisponibilidadeTemporaria[t.id] = diasParaRender.map(d => d.id);
                }
                spansDias.forEach(spanDia => {
                    const diaId = spanDia.dataset.diaId;
                    spanDia.classList.toggle('selecionado-dia', (funcDisponibilidadeTemporaria[t.id] || []).includes(diaId));
                });
            } else {
                delete funcDisponibilidadeTemporaria[t.id];
                spansDias.forEach(spanDia => spanDia.classList.remove('selecionado-dia'));
            }
            setFuncFormDirty(true);
        };
        
        header.onclick = (e) => {
            if (e.target.tagName !== 'INPUT') { 
                chkPrincipal.checked = !chkPrincipal.checked;
                toggleTurnoPrincipal();
            }
        };
        chkPrincipal.onchange = toggleTurnoPrincipal;

        spansDias.forEach(spanDia => {
            spanDia.onclick = () => {
                if (chkPrincipal.checked) {
                    const diaId = spanDia.dataset.diaId;
                    let diasDoTurno = funcDisponibilidadeTemporaria[t.id] || [];
                    spanDia.classList.toggle('selecionado-dia');

                    if (spanDia.classList.contains('selecionado-dia')) {
                        if (!diasDoTurno.includes(diaId)) diasDoTurno.push(diaId);
                    } else {
                        const index = diasDoTurno.indexOf(diaId);
                        if (index > -1) diasDoTurno.splice(index, 1);
                    }
                    funcDisponibilidadeTemporaria[t.id] = diasDoTurno;
                    setFuncFormDirty(true);
                }
            };
        });
    });
}


// --- RESTANTE DO ARQUIVO JS (save, edit, delete, etc.) ---

[funcNomeInput, funcCargaHorariaInput, funcDocumentoInput].forEach(input => {
    input.addEventListener("input", (e) => {
        if (e.target === funcNomeInput && e.target.value.length > 0) {
            e.target.value = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
        }
        validateInput(e.target);
        setFuncFormDirty(true);
    });
});

funcCargoSelect.addEventListener("change", (e) => {
    validateInput(e.target);
    funcDisponibilidadeTemporaria = {};
    renderFuncTurnosForCargo();
    setFuncFormDirty(true);
});

filtroFuncionariosInput.addEventListener("input", () => { renderFuncs(); });

function renderFuncCargoSelect(){
    const { cargos } = store.getState();
    funcCargoSelect.innerHTML = "<option value=''>Selecione um cargo</option>";

    // --- MELHORIA DE UX ---
    // Se não houver cargos, exibe uma mensagem útil.
    if (cargos.length === 0) {
        const fieldset = funcCargoSelect.closest('label');
        if (fieldset) {
            let p = fieldset.querySelector('.muted-link-helper');
            if (!p) {
                p = document.createElement('p');
                p.className = 'muted-link-helper muted';
                p.style.marginTop = '8px';
                fieldset.appendChild(p);
            }
            p.innerHTML = `Nenhum cargo cadastrado. <a href="#" onclick="go('cargos')">Cadastre um cargo primeiro</a>.`;
        }
        return;
    }

    // Remove a mensagem de ajuda se ela existir e houver cargos.
    const fieldset = funcCargoSelect.closest('label');
    const p = fieldset?.querySelector('.muted-link-helper');
    if (p) p.remove();
    // --- FIM DA MELHORIA ---

    const cargosOrdenados = [...cargos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
    cargosOrdenados.forEach(c => {
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.nome;
        funcCargoSelect.appendChild(o);
    });
}


function renderFuncs(){
  const { funcionarios, cargos, turnos } = store.getState();
  const filtro = filtroFuncionariosInput.value.toLowerCase();

  tblFuncionariosBody.innerHTML = "";
  
  const funcsFiltrados = funcionarios.filter(f => f.nome.toLowerCase().includes(filtro));
  const colspan = 7;

  if (funcsFiltrados.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = colspan;
    if (funcionarios.length === 0) {
        emptyCell.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👤</div><h3>Nenhum Funcionário Cadastrado</h3><p>Comece a cadastrar funcionários para poder gerar escalas.</p></div>`;
    } else {
        emptyCell.textContent = `Nenhum funcionário encontrado com o termo "${filtro}".`;
        emptyCell.className = 'muted center';
    }
    emptyRow.appendChild(emptyCell);
    tblFuncionariosBody.appendChild(emptyRow);
    return;
  }
  
  const cargosMap = Object.fromEntries(cargos.map(c => [c.id, c.nome]));
  const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
  
  const agrupados = funcsFiltrados.reduce((acc, func) => {
      const cargoNome = cargosMap[func.cargoId] || SEM_CARGO_DEFINIDO;
      if (!acc[cargoNome]) acc[cargoNome] = [];
      acc[cargoNome].push(func);
      return acc;
  }, {});

  const cargosOrdenados = Object.keys(agrupados).sort((a,b) => a.localeCompare(b));
  
  for (const cargoNome of cargosOrdenados) {
      const funcsDoGrupo = agrupados[cargoNome].sort((a,b) => a.nome.localeCompare(b.nome));
      
      const headerRow = document.createElement('tr');
      const headerCell = document.createElement('th');
      headerCell.colSpan = colspan;
      headerCell.className = `group-header ${cargoNome === SEM_CARGO_DEFINIDO ? 'warning' : ''}`;
      headerCell.textContent = cargoNome;
      headerRow.appendChild(headerCell);
      tblFuncionariosBody.appendChild(headerRow);
      
      funcsDoGrupo.forEach(f => {
          const nomesTurnos = Object.keys(f.disponibilidade || {}).map(id => turnosMap[id]?.nome || "").join(", ") || "Nenhum";
          const cargaHoraria = f.cargaHoraria ? `${f.cargaHoraria}h ${f.periodoHoras === 'mensal' ? '/mês' : '/semana'}` : 'N/D';
          const horaExtra = f.fazHoraExtra ? 'Sim' : 'Não';
          const tipoContrato = f.tipoContrato === 'pj' ? 'Prestador' : 'CLT';
          
          const row = document.createElement('tr');
          row.dataset.funcId = f.id;

          row.innerHTML = `
            <td>${f.nome}</td>
            <td>${f.documento || '---'}</td>
            <td>${tipoContrato}</td>
            <td>${cargaHoraria}</td>
            <td>${horaExtra}</td>
            <td>${nomesTurnos}</td>
          `;

          const actionsCell = document.createElement('td');
          const editButton = document.createElement('button');
          editButton.className = 'secondary';
          editButton.innerHTML = '✏️ Editar';
          editButton.onclick = () => editFuncInForm(f.id);

          const deleteButton = document.createElement('button');
          deleteButton.className = 'danger';
          deleteButton.innerHTML = '🔥 Excluir';
          deleteButton.onclick = () => deleteFuncionario(f.id);

          actionsCell.append(editButton, deleteButton);
          row.appendChild(actionsCell);

          tblFuncionariosBody.appendChild(row);
      });
  }

  if (lastAddedFuncId) {
    tblFuncionariosBody.querySelector(`tr[data-func-id="${lastAddedFuncId}"]`)?.classList.add('new-item');
    lastAddedFuncId = null;
  }
}


function validateFuncForm() {
    const isNomeValid = validateInput(funcNomeInput);
    const isCargoValid = validateInput(funcCargoSelect);
    const isCargaValid = validateInput(funcCargaHorariaInput);
    
    return isNomeValid && isCargoValid && isCargaValid;
}

function saveFuncFromForm() {
    if (!validateFuncForm()) {
        showToast("Preencha todos os campos obrigatórios.");
        return;
    }
    const { funcionarios } = store.getState();
    const documento = funcDocumentoInput.value.trim();
    if (documento && funcionarios.some(f => f.documento?.toLowerCase() === documento.toLowerCase() && f.id !== editingFuncId)) {
        return showToast("O número do documento já está em uso por outro funcionário.");
    }

    const disponibilidade = Object.entries(funcDisponibilidadeTemporaria)
        .filter(([, dias]) => dias && dias.length > 0)
        .reduce((acc, [turnoId, dias]) => ({ ...acc, [turnoId]: dias }), {});

    const funcData = {
        id: editingFuncId || uid(),
        nome: funcNomeInput.value.trim(),
        cargoId: funcCargoSelect.value,
        tipoContrato: funcContratoInput.value,
        cargaHoraria: funcCargaHorariaInput.value,
        periodoHoras: funcPeriodoHorasInput.value,
        fazHoraExtra: funcHoraExtraInput.value === 'sim',
        documento,
        disponibilidade,
    };
    
    if (!editingFuncId) {
        lastAddedFuncId = funcData.id;
    }

    store.dispatch('SAVE_FUNCIONARIO', funcData);
    
    cancelEditFunc();
    showToast("Funcionário salvo com sucesso!");
}

function editFuncInForm(id) {
  const { funcionarios } = store.getState();
  const func = funcionarios.find(f => f.id === id);
  if (!func) return;

  cancelEditFunc();
  editingFuncId = id;

  funcNomeInput.value = func.nome;
  funcCargoSelect.value = func.cargoId;
  funcCargaHorariaInput.value = func.cargaHoraria || '';
  funcDocumentoInput.value = func.documento || '';
  
  $(`button[data-value="${func.tipoContrato || 'clt'}"`, contratoToggleGroup).click();
  $(`button[data-value="${func.periodoHoras || 'semanal'}"`, periodoHorasToggleGroup).click();
  $(`button[data-value="${func.fazHoraExtra ? 'sim' : 'nao'}"`, horaExtraToggleGroup).click();

  funcDisponibilidadeTemporaria = JSON.parse(JSON.stringify(func.disponibilidade || {}));
  renderFuncTurnosForCargo(); 

  btnSalvarFunc.textContent = "💾 Salvar Alterações";
  btnCancelarEdFunc.classList.remove("hidden");
  setFuncFormDirty(false); // Reset dirty on edit
  window.scrollTo(0, 0);
}

function cancelEditFunc() {
  editingFuncId = null;
  funcNomeInput.value = "";
  funcCargoSelect.value = "";
  funcCargaHorariaInput.value = "";
  funcDocumentoInput.value = "";
  
  funcNomeInput.classList.remove('invalid');
  funcCargoSelect.classList.remove('invalid');
  funcCargaHorariaInput.classList.remove('invalid');
  
  $(`button[data-value="clt"]`, contratoToggleGroup).click();
  $(`button[data-value="semanal"]`, periodoHorasToggleGroup).click();
  $(`button[data-value="nao"]`, horaExtraToggleGroup).click();
  
  funcDisponibilidadeTemporaria = {};
  funcTurnosContainer.innerHTML = `<div class="turno-placeholder"><p>Selecione um cargo para ver os turnos disponíveis.</p></div>`;

  btnSalvarFunc.textContent = "💾 Salvar Funcionário";
  btnCancelarEdFunc.classList.add("hidden");
  setFuncFormDirty(false);
}

function deleteFuncionario(id) {
    handleDeleteItem({
        id: id,
        itemName: 'Funcionário',
        dispatchAction: 'DELETE_FUNCIONARIO'
    });
}

btnSalvarFunc.onclick = saveFuncFromForm;
btnCancelarEdFunc.onclick = cancelEditFunc;
$("#btnLimparFunc").onclick = cancelEditFunc;