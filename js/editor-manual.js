/**************************************
 * 🛠️ Lógica do Editor Manual v3.3 (Fluxo Otimizado)
 **************************************/

const editorState = {
    editMode: 'cell', // 'cell' ou 'employee'
    selectedCell: null, // { date, employeeId, slotId }
    selectedEmployeeBrush: null, // ID do funcionário selecionado
    selectedShiftBrush: null, // ID do turno selecionado como "pincel"
};

let lastEditedEmployeeId = null;

// --- INICIALIZAÇÃO E CONTROLE DE MODO ---

function initEditor() {
    editorState.selectedCell = null;
    editorState.selectedEmployeeBrush = null;
    editorState.selectedShiftBrush = null;

    const toolbox = $("#editor-toolbox");
    toolbox.classList.remove("hidden");

    $$(".toolbox-mode-btn").forEach(btn => {
        btn.onclick = () => setEditMode(btn.dataset.mode);
    });

    const tableWrap = $("#escalaTabelaWrap");
    tableWrap.removeEventListener('click', handleTableClick);
    tableWrap.addEventListener('click', handleTableClick);

    const toolboxContent = $(".toolbox-content");
    toolboxContent.removeEventListener('click', handleToolboxClick);
    toolboxContent.addEventListener('click', handleToolboxClick);

    setEditMode('cell');
}

function setEditMode(mode) {
    editorState.editMode = mode;
    editorState.selectedCell = null;
    editorState.selectedEmployeeBrush = null;
    editorState.selectedShiftBrush = null;
    highlightEmployeeRow(null);
    $$('.employee-card.is-armed').forEach(c => c.classList.remove('is-armed'));

    $$(".toolbox-mode-btn").forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const table = $(".escala-final-table");
    if (table) {
        table.classList.toggle('employee-paint-mode', mode === 'employee');
    }

    $$('.editable-cell.selected').forEach(c => c.classList.remove('selected'));
    updateToolboxView();
}

function handleTableClick(event) {
    const cell = event.target.closest('.editable-cell');
    if (!cell) return;

    if (editorState.editMode === 'cell') {
        handleCellSelection(cell);
    } else if (editorState.editMode === 'employee') {
        handleEmployeePaint(cell);
    }
}

// --- LÓGICA DO MODO "EDITAR POR CÉLULA" ---
function handleCellSelection(cell) {
    $$('.editable-cell.selected').forEach(c => c.classList.remove('selected'));
    cell.classList.add('selected');
    const { date, employeeId, slotId } = cell.dataset;
    editorState.selectedCell = { date, employeeId: employeeId === 'null' ? null : employeeId, slotId: slotId || null };
    updateToolboxView();
}

// --- LÓGICA DO MODO "EDITAR POR FUNCIONÁRIO" (Pincel de Turnos) ---
function handleEmployeePaint(cell) {
    const { selectedEmployeeBrush, selectedShiftBrush } = editorState;
    if (!selectedEmployeeBrush || !selectedShiftBrush) {
        showToast("Selecione um funcionário e um turno na caixa de ferramentas.");
        return;
    }
    const { date, employeeId: cellEmployeeId } = cell.dataset;
    if (cellEmployeeId !== selectedEmployeeBrush) {
        showToast("Você só pode adicionar turnos na linha do funcionário selecionado.");
        return;
    }
    handleAddShiftClick(selectedEmployeeBrush, selectedShiftBrush, date);
}

// --- LÓGICA DA TOOLBOX ---
function handleToolboxClick(event) {
    const employeeCardHeader = event.target.closest('.employee-card-header');
    const shiftBrush = event.target.closest('.shift-brush');

    if (employeeCardHeader) {
        const employeeId = employeeCardHeader.parentElement.dataset.employeeId;
        handleSelectEmployeeBrush(employeeId);
    }
    if (shiftBrush) {
        const turnoId = shiftBrush.dataset.turnoId;
        if (shiftBrush.dataset.employeeId && shiftBrush.dataset.date) {
            handleAddShiftClick(shiftBrush.dataset.employeeId, turnoId, shiftBrush.dataset.date);
        } else {
            handleSelectShiftBrush(turnoId);
        }
    }
}

function updateToolboxView(subView = null) {
    const { editMode, selectedCell } = editorState;
    const toolbox = $("#editor-toolbox");
    const headerEl = $(".toolbox-header", toolbox);
    const contentEl = $(".toolbox-content", toolbox);

    headerEl.innerHTML = '';
    contentEl.innerHTML = '';

    if (editMode === 'cell') {
        if (selectedCell) {
            const { date, employeeId, slotId } = selectedCell;
            const employee = employeeId ? store.getState().funcionarios.find(f => f.id === employeeId) : null;
            const slot = currentEscala.slots.find(s => s.id === slotId);
            if (subView) {
                headerEl.innerHTML += `<button class="toolbox-back-btn" onclick="updateToolboxView()">‹</button>`;
                headerEl.classList.add('with-back-btn');
            } else {
                headerEl.classList.remove('with-back-btn');
            }
            if (slot && employee) {
                const turno = store.getState().turnos.find(t => t.id === slot.turnoId);
                headerEl.innerHTML += `<h3 class="toolbox-title">${subView ? 'Reatribuir Turno' : 'Editar Turno'}</h3>
                                     <p class="toolbox-subtitle">${employee.nome} - ${new Date(date + 'T12:00:00').toLocaleDateString()}</p>`;
                contentEl.innerHTML = subView === 'reassign' ? renderPaletteForReassign(slot) : renderToolboxForFilledCell(employee, turno, slot);
            } else if (employee) {
                headerEl.innerHTML += `<h3 class="toolbox-title">Adicionar Turno</h3>
                                     <p class="toolbox-subtitle">${employee.nome} - ${new Date(date + 'T12:00:00').toLocaleDateString()}</p>`;
                contentEl.innerHTML = renderToolboxForVacantCell(employee, date);
            } else if (slot) {
                const turno = store.getState().turnos.find(t => t.id === slot.turnoId);
                headerEl.innerHTML += `<h3 class="toolbox-title">Preencher Vaga</h3>
                                     <p class="toolbox-subtitle">${turno.nome} - ${new Date(date + 'T12:00:00').toLocaleDateString()}</p>`;
                contentEl.innerHTML = renderPaletteForReassign(slot);
            }
        } else {
            headerEl.innerHTML = `<h3 class="toolbox-title">🖱️ Editar por Célula</h3>
                                <p class="toolbox-subtitle">Selecione uma célula na escala</p>`;
        }
    } else if (editMode === 'employee') {
        const subtitle = editorState.selectedEmployeeBrush ? 'Selecione um turno e pinte na escala' : 'Selecione um funcionário';
        headerEl.innerHTML = `<h3 class="toolbox-title">🎨 Editar por Funcionário</h3>
                            <p class="toolbox-subtitle">${subtitle}</p>`;
        contentEl.innerHTML = renderEmployeeListForBrush();
    }
}

// --- RENDERIZAÇÃO DE CONTEÚDO PARA TOOLBOX ---
function renderToolboxForFilledCell(employee, turno, slot) {
    return `<div style="padding: 0 8px;">
            <p><strong>Funcionário:</strong> ${employee.nome}</p>
            <p><strong>Turno Atual:</strong> ${turno.nome} (${turno.inicio} - ${turno.fim})</p>
        </div>
        <div class="toolbox-actions is-palette">
            <button class="secondary" title="Reatribuir Funcionário" onclick="updateToolboxView('reassign')">🔁 Reatribuir</button>
            <button class="danger" title="Limpar Turno (Deixar Vago)" onclick="handleRemoveShiftClick('${slot.id}')">🗑️ Limpar</button>
        </div>`;
}

function renderToolboxForVacantCell(employee, date) {
    const turnosDoCargo = store.getState().turnos.filter(t => currentEscala.cobertura[t.id]);
    let html = `<h4 class="toolbox-section-title">Adicionar Turno</h4>
                <div class="toolbox-actions is-palette">`;
    turnosDoCargo.forEach(turno => {
        html += `<div class="shift-brush" 
                      data-turno-id="${turno.id}"
                      data-employee-id="${employee.id}"
                      data-date="${date}"
                      style="background-color: ${turno.cor};" 
                      title="${turno.nome}">
                    ${turno.sigla}
                 </div>`;
    });
    html += `</div>`;
    return html;
}

function renderPaletteForReassign(slot) {
    const candidatos = getEligibleEmployees(slot.date, slot.turnoId, slot.assigned);
    let paletteHTML = `<div class="employee-palette">`;
    if (candidatos.length > 0) {
        candidatos.forEach(candidato => {
            const card = document.createElement('div');
            card.innerHTML = renderEmployeeCard(candidato, 'reassign', slot.id);
            paletteHTML += card.innerHTML;
        });
    } else {
        paletteHTML += `<p class="muted">Nenhum outro funcionário elegível para este turno.</p>`;
    }
    paletteHTML += `</div>`;
    return paletteHTML;
}

function renderEmployeeListForBrush() {
    const { funcionarios } = store.getState();
    const funcsDoCargo = funcionarios.filter(f => f.cargoId === currentEscala.cargoId).sort((a, b) => a.nome.localeCompare(b.nome));
    let listHTML = `<div class="employee-palette">`;
    funcsDoCargo.forEach(func => { listHTML += renderEmployeeCard(func, 'brush'); });
    listHTML += `</div>`;
    return listHTML;
}

function renderEmployeeCard(employee, context, slotId = null) {
    const { turnos } = store.getState();
    const { historico } = currentEscala;
    const horasTrabalhadas = (historico[employee.id]?.horasTrabalhadas / 60) || 0;
    let onClickAction = '';
    let cardClass = 'employee-card';
    let paletteHTML = '';

    if (context === 'brush') {
        const isSelectedEmployee = editorState.selectedEmployeeBrush === employee.id;
        if (isSelectedEmployee) {
            cardClass += ' active is-expanded';
            if (editorState.selectedShiftBrush) {
                cardClass += ' is-armed';
            }
            const turnosDisponiveis = turnos.filter(t => employee.disponibilidade[t.id]);
            paletteHTML = `<div class="employee-shift-palette">
                            <h5 class="shift-palette-title">Selecione o Turno:</h5>
                            <div class="shift-brushes-container">`;
            paletteHTML += turnosDisponiveis.map(turno => {
                const isSelectedShift = editorState.selectedShiftBrush === turno.id;
                return `<div class="shift-brush ${isSelectedShift ? 'selected' : ''}" data-turno-id="${turno.id}" style="background-color: ${turno.cor};" title="${turno.nome}">
                            ${turno.sigla}
                        </div>`;
            }).join('');
            paletteHTML += `</div></div>`;
        }
    } else if (context === 'reassign') {
        onClickAction = `onclick="handleSelectEmployeeForSlot('${employee.id}', '${slotId}')"`;
    }

    return `<div class="${cardClass}" data-employee-id="${employee.id}">
            <div class="employee-card-header" ${onClickAction}>
                <div class="employee-info">
                    <h5>${employee.nome}</h5>
                    <div class="employee-stats">Horas: ${horasTrabalhadas.toFixed(1)}h</div>
                </div>
            </div>
            ${paletteHTML}
        </div>`;
}

// --- AÇÕES ---
function handleSelectEmployeeBrush(employeeId) {
    $$('.employee-card.is-armed').forEach(c => c.classList.remove('is-armed'));
    if (editorState.selectedEmployeeBrush === employeeId) {
        editorState.selectedEmployeeBrush = null;
        editorState.selectedShiftBrush = null;
        highlightEmployeeRow(null);
    } else {
        editorState.selectedEmployeeBrush = employeeId;
        editorState.selectedShiftBrush = null;
        highlightEmployeeRow(employeeId);
    }
    updateToolboxView();
}

function handleSelectShiftBrush(turnoId) {
    const card = $(`.employee-card[data-employee-id="${editorState.selectedEmployeeBrush}"]`);
    if (editorState.selectedShiftBrush === turnoId) {
        editorState.selectedShiftBrush = null;
        if (card) card.classList.remove('is-armed');
    } else {
        editorState.selectedShiftBrush = turnoId;
        if (card) card.classList.add('is-armed');
    }
    $(".toolbox-content").innerHTML = renderEmployeeListForBrush();
}

function handleAddShiftClick(employeeId, turnoId, date) {
    const turno = store.getState().turnos.find(t => t.id === turnoId);
    if (currentEscala.slots.some(s => s.date === date && s.assigned === employeeId)) {
        showToast("Este funcionário já possui um turno neste dia.");
        return;
    }
    let slotParaPreencher = currentEscala.slots.find(s => s.date === date && s.turnoId === turnoId && !s.assigned);

    if (!slotParaPreencher) {
        slotParaPreencher = { date, turnoId, assigned: null, id: uid() };
        currentEscala.slots.push(slotParaPreencher);
    }

    if (!currentEscala.historico[employeeId]) currentEscala.historico[employeeId] = { horasTrabalhadas: 0 };
    currentEscala.historico[employeeId].horasTrabalhadas += turno.cargaMin;
    slotParaPreencher.assigned = employeeId;

    lastEditedEmployeeId = employeeId;
    rerenderEscalaAndUpdateToolbox();
}

function handleRemoveShiftClick(slotId) {
    const slot = currentEscala.slots.find(s => s.id === slotId);
    if (!slot || !slot.assigned) return;
    const turno = store.getState().turnos.find(t => t.id === slot.turnoId);

    lastEditedEmployeeId = slot.assigned;
    currentEscala.historico[slot.assigned].horasTrabalhadas -= turno.cargaMin;
    slot.assigned = null;

    rerenderEscalaAndUpdateToolbox();
}

function handleSelectEmployeeForSlot(newEmployeeId, slotId) {
    const slot = currentEscala.slots.find(s => s.id === slotId);
    if (!slot) return;
    const oldEmployeeId = slot.assigned;
    const turno = store.getState().turnos.find(t => t.id === slot.turnoId);

    if (oldEmployeeId) {
        currentEscala.historico[oldEmployeeId].horasTrabalhadas -= turno.cargaMin;
    }
    if (!currentEscala.historico[newEmployeeId]) currentEscala.historico[newEmployeeId] = { horasTrabalhadas: 0 };
    currentEscala.historico[newEmployeeId].horasTrabalhadas += turno.cargaMin;
    slot.assigned = newEmployeeId;

    lastEditedEmployeeId = newEmployeeId;
    rerenderEscalaAndUpdateToolbox();
}

function rerenderEscalaAndUpdateToolbox() {
    renderEscalaTable(currentEscala);
    updateToolboxView();
}

function getEligibleEmployees(date, turnoId, excludeEmployeeId = null) {
    const { funcionarios } = store.getState();
    const funcsDoCargo = funcionarios.filter(f => f.cargoId === currentEscala.cargoId && f.id !== excludeEmployeeId);
    const elegiveis = funcsDoCargo.filter(func => {
        const { disponibilidade, excecoes } = func;
        if (excecoes && excecoes[func.id]) {
            const allFolgas = [...excecoes[func.id].ferias.dates, ...excecoes[func.id].afastamento.dates, ...excecoes[func.id].folgas.map(f => f.date)];
            if (allFolgas.includes(date)) return false;
        }
        const diaSemanaId = DIAS_SEMANA[new Date(date + 'T12:00:00').getUTCDay()].id;
        return disponibilidade[turnoId]?.includes(diaSemanaId);
    }).sort((a, b) => {
        const horasA = currentEscala.historico[a.id]?.horasTrabalhadas || 0;
        const horasB = currentEscala.historico[b.id]?.horasTrabalhadas || 0;
        return horasA - horasB;
    });
    return elegiveis;
}

function highlightEmployeeRow(employeeId) {
    $$('.escala-final-table tbody tr').forEach(row => row.classList.remove('employee-row-highlight'));
    if (employeeId) {
        const row = $(`#escalaTabelaWrap tr[data-employee-row-id="${employeeId}"]`);
        if (row) {
            row.classList.add('employee-row-highlight');
        }
    }
}