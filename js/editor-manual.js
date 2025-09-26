/**************************************
 * 🛠️ Lógica do Editor Manual v3.9 (Novas Features)
 **************************************/

const editorState = {
    editMode: 'employee',
    selectedCell: null,
    focusedEmployeeId: null,
    focusedEmployeeIndex: -1,
    alphabetizedFuncs: [],
    selectedShiftBrush: null,
    lastHoveredDate: null, 
    animationDirection: 'right',
};

let lastEditedEmployeeId = null;

// --- FUNÇÕES AUXILIARES E DE VALIDAÇÃO ---
function calculateMetaHoras(employee, escala) {
    const horasContratadasBase = parseFloat(employee.cargaHoraria) || 0;
    if (horasContratadasBase === 0) return 0;
    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
    if (employee.periodoHoras === 'semanal') {
        return horasContratadasBase * (dateRange.length / 7);
    } else {
        let metaHoras = 0;
        const mesesNaEscala = {};
        dateRange.forEach(d => {
            const mesAno = d.slice(0, 7);
            mesesNaEscala[mesAno] = (mesesNaEscala[mesAno] || 0) + 1;
        });
        for (const mesAno in mesesNaEscala) {
            const [ano, mes] = mesAno.split('-').map(Number);
            const diasNoMesCalendario = new Date(ano, mes, 0).getDate();
            const diasDaEscalaNesseMes = mesesNaEscala[mesAno];
            metaHoras += (horasContratadasBase / diasNoMesCalendario) * diasDaEscalaNesseMes;
        }
        return metaHoras;
    }
}

/**
 * CORREÇÃO: Lógica alinhada com a do gerador para consistência.
 * Calcula a sequência de dias de trabalho que um funcionário TERIA se trabalhasse na data alvo.
 */
function calculateConsecutiveDaysPredictive(employeeId, escala, targetDate) {
    const { turnos } = store.getState();
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    
    const turnosDoFuncMap = new Map(
        escala.slots.filter(s => s.assigned === employeeId).map(s => [s.date, s])
    );

    // Adiciona o turno alvo para a predição
    if (!turnosDoFuncMap.has(targetDate)) {
        turnosDoFuncMap.set(targetDate, { date: targetDate });
    }

    let diasConsecutivos = 0;
    let dataAtual = targetDate;
    
    while (dataAtual >= escala.inicio) {
        if (turnosDoFuncMap.has(dataAtual)) {
            diasConsecutivos++;
        } else {
            const diaAnterior = addDays(dataAtual, -1);
            const turnoDoDiaAnterior = turnosDoFuncMap.get(diaAnterior);
            if (turnoDoDiaAnterior) {
                const infoTurno = turnosMap[turnoDoDiaAnterior.turnoId];
                if (infoTurno && infoTurno.fim < infoTurno.inicio) {
                    // Sequência não quebra por descanso de turno noturno
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        dataAtual = addDays(dataAtual, -1);
    }
    return diasConsecutivos;
}


/**
 * NOVO: Função de validação proativa para verificar conflitos ANTES de uma ação.
 * @returns {Array} - Uma lista de mensagens de conflito.
 */
function checkPotentialConflicts(employeeId, turnoId, date, escala) {
    const { turnos, funcionarios } = store.getState();
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    const employee = funcionarios.find(f => f.id === employeeId);
    const conflitos = [];

    // 1. Validação de Dias Consecutivos
    const maxDias = geradorState.maxDiasConsecutivos || 6;
    const diasFuturos = calculateConsecutiveDaysPredictive(employeeId, escala, date);
    if (diasFuturos > maxDias) {
        conflitos.push(`Excede o limite de ${maxDias} dias de trabalho consecutivos.`);
    }

    // 2. Validação de Descanso Obrigatório
    if (employee.tipoContrato === 'clt') {
        const turnosDoFunc = escala.slots.filter(s => s.assigned === employeeId).sort((a, b) => a.date.localeCompare(b.date));
        const turnoAnterior = turnosDoFunc.filter(s => s.date < date).pop();
        if (turnoAnterior) {
            const infoTurnoAnterior = turnosMap[turnoAnterior.turnoId];
            if (infoTurnoAnterior.descansoObrigatorioHoras) {
                const fimTurnoAnterior = new Date(`${turnoAnterior.date}T${infoTurnoAnterior.fim}`);
                if (infoTurnoAnterior.fim < infoTurnoAnterior.inicio) fimTurnoAnterior.setDate(fimTurnoAnterior.getDate() + 1);

                const inicioTurnoAtual = new Date(`${date}T${turnosMap[turnoId].inicio}`);
                const diffHoras = (inicioTurnoAtual - fimTurnoAnterior) / (1000 * 60 * 60);

                if (diffHoras < infoTurnoAnterior.descansoObrigatorioHoras) {
                    conflitos.push(`Viola descanso obrigatório de ${infoTurnoAnterior.descansoObrigatorioHoras}h.`);
                }
            }
        }
    }
    return conflitos;
}


// --- INICIALIZAÇÃO E CONTROLE DE MODO ---
function initEditor() {
    Object.assign(editorState, {
        editMode: 'employee', selectedCell: null, focusedEmployeeId: null,
        focusedEmployeeIndex: -1, alphabetizedFuncs: [],
        selectedShiftBrush: null, lastHoveredDate: null,
    });
    const toolbox = $("#editor-toolbox");
    if(!toolbox) return;

    toolbox.classList.remove("hidden");
    $$(".toolbox-mode-btn").forEach(btn => btn.onclick = () => setEditMode(btn.dataset.mode));
    
    const tableWrap = $("#escalaTabelaWrap");
    tableWrap.removeEventListener('click', handleTableClick);
    tableWrap.addEventListener('click', handleTableClick);
    tableWrap.removeEventListener('mouseover', handleTableMouseover);
    tableWrap.addEventListener('mouseover', handleTableMouseover);

    const toolboxContent = $(".toolbox-content");
    toolboxContent.removeEventListener('click', handleToolboxClick);
    toolboxContent.addEventListener('click', handleToolboxClick);

    document.removeEventListener('keydown', handleKeyboardNav);
    document.addEventListener('keydown', handleKeyboardNav);

    setEditMode(editorState.editMode);
}

function setEditMode(mode) {
    editorState.editMode = mode;
    editorState.selectedCell = null;
    editorState.selectedShiftBrush = null;
    editorState.lastHoveredDate = null;
    
    if (mode === 'employee') {
        const { funcionarios } = store.getState();
        editorState.alphabetizedFuncs = funcionarios
            .filter(f => f.cargoId === currentEscala.cargoId)
            .sort((a, b) => a.nome.localeCompare(b.nome));
        
        if (editorState.alphabetizedFuncs.length > 0) {
            editorState.focusedEmployeeIndex = 0;
            editorState.focusedEmployeeId = editorState.alphabetizedFuncs[0].id;
        } else {
             editorState.focusedEmployeeIndex = -1;
             editorState.focusedEmployeeId = null;
        }
    } else {
        editorState.focusedEmployeeId = null;
        editorState.focusedEmployeeIndex = -1;
    }

    highlightEmployeeRow(editorState.focusedEmployeeId);
    
    $$(".toolbox-mode-btn").forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    
    const table = $(".escala-final-table");
    if (table) {
        table.classList.toggle('employee-paint-mode', mode === 'employee');
        table.classList.toggle('eraser-mode', mode === 'eraser');
    }

    $$('.editable-cell.selected').forEach(c => c.classList.remove('selected'));
    updateToolboxView();
}

function handleTableClick(event) {
    const cell = event.target.closest('.editable-cell');
    if (!cell) return;

    if (editorState.editMode === 'employee') handleEmployeePaint(cell);
    else if (editorState.editMode === 'cell') handleCellSelection(cell);
    else if (editorState.editMode === 'eraser') handleEraseClick(cell);
}

function handleTableMouseover(event) {
    const cell = event.target.closest('.editable-cell');
    if (!cell) return;

    if (editorState.editMode === 'employee') {
        const targetDate = cell.dataset.date;
        const employeeId = editorState.focusedEmployeeId;
        const turnoId = editorState.selectedShiftBrush;

        // Limpa tooltips antigos
        $$('.proactive-conflict-tooltip').forEach(el => el.remove());

        if (targetDate && targetDate !== editorState.lastHoveredDate) {
            editorState.lastHoveredDate = targetDate;
            const card = $(".focused-employee-card");
            if(card) updateConsecutiveDaysIndicator(card, targetDate);
        }

        // Validação proativa no modo pintura
        if (employeeId && turnoId && targetDate) {
            const conflitos = checkPotentialConflicts(employeeId, turnoId, targetDate, currentEscala);
            if (conflitos.length > 0) {
                cell.title = conflitos.join('\n');
            } else {
                cell.title = store.getState().turnos.find(t => t.id === turnoId)?.nome || '';
            }
        }
    }
}


// --- LÓGICA DE ATUALIZAÇÃO "CIRÚRGICA" ---
function updateAllIndicators() {
    if(editorState.editMode === 'employee') {
        const card = $(".focused-employee-card");
        if(card) updateIndicatorsInCard(card);
    }
}

function updateIndicatorsInCard(card) {
    const employeeId = card.dataset.employeeId;
    const employee = store.getState().funcionarios.find(f => f.id === employeeId);
    if (!employee) return;
    
    const metaHoras = calculateMetaHoras(employee, currentEscala);
    const horasTrabalhadas = (currentEscala.historico[employee.id]?.horasTrabalhadas / 60) || 0;
    let mainPercentage = metaHoras > 0 ? (horasTrabalhadas / metaHoras) * 100 : 0;
    let overtimePercentage = 0;
    if (mainPercentage > 100) {
        overtimePercentage = mainPercentage - 100;
        mainPercentage = 100;
    }
    let barColorClass = 'progress-bar-blue';
    if (mainPercentage >= 100) barColorClass = 'progress-bar-green';
    else if (mainPercentage > 75) barColorClass = 'progress-bar-yellow';

    $('.employee-stats', card).innerHTML = `${horasTrabalhadas.toFixed(1)}h / ${metaHoras.toFixed(1)}h
        ${overtimePercentage > 0 ? `<span style="color: #f97316; font-weight: bold;"> +${(horasTrabalhadas - metaHoras).toFixed(1)}h</span>` : ''}`;
    
    const mainBar = $('.progress-bar-main', card);
    mainBar.className = `progress-bar progress-bar-main ${barColorClass}`;
    mainBar.style.width = `${mainPercentage.toFixed(2)}%`;
    $('.progress-bar-overtime', card).style.width = `${overtimePercentage.toFixed(2)}%`;

    const targetDate = editorState.lastHoveredDate || currentEscala.fim;
    updateConsecutiveDaysIndicator(card, targetDate);
}

function updateConsecutiveDaysIndicator(card, targetDate) {
    const employeeId = card.dataset.employeeId;
    const container = $('.consecutive-days-container', card);
    if (employeeId && container) {
        const diasConsecutivos = calculateConsecutiveDaysPredictive(employeeId, currentEscala, targetDate);
        const maxDias = geradorState.maxDiasConsecutivos || 6;
        let dotsHTML = '';
        for (let i = 1; i <= maxDias; i++) {
            const isFilled = i <= diasConsecutivos;
            const isLimit = isFilled && diasConsecutivos >= maxDias;
            dotsHTML += `<div class="day-dot ${isFilled ? 'filled' : ''} ${isLimit ? 'limit' : ''}" title="${diasConsecutivos}/${maxDias} dias"></div>`;
        }
        const isMaxDias = diasConsecutivos >= maxDias;
        container.innerHTML = `${dotsHTML} ${isMaxDias ? '<span class="limit-alert">!</span>' : ''}`;
    }
}


// --- LÓGICA DOS MODOS DE EDIÇÃO ---
function handleCellSelection(cell) {
    $$('.editable-cell.selected').forEach(c => c.classList.remove('selected'));
    cell.classList.add('selected');
    const { date, employeeId, slotId } = cell.dataset;
    editorState.selectedCell = { date, employeeId: employeeId === 'null' ? null : employeeId, slotId: slotId || null };
    updateToolboxView();
}

function handleEmployeePaint(cell) {
    if (!editorState.focusedEmployeeId || !editorState.selectedShiftBrush) {
        showToast("Selecione um turno para começar a pintar.");
        return;
    }
    const { date, employeeId: cellEmployeeId } = cell.dataset;
    if (cellEmployeeId !== editorState.focusedEmployeeId) {
        showToast("Você só pode adicionar turnos na linha do funcionário selecionado.");
        return;
    }
    handleAddShiftClick(editorState.focusedEmployeeId, editorState.selectedShiftBrush, date);
}

function handleEraseClick(cell) {
    const { slotId } = cell.dataset;
    if (slotId) {
        handleRemoveShiftClick(slotId);
    }
}

// --- NAVEGAÇÃO E ATUALIZAÇÃO DA VIEW ---
function handleKeyboardNav(event){
    const toolbox = $("#editor-toolbox");
    if(!toolbox || toolbox.classList.contains('hidden') || editorState.editMode !== 'employee') return;
    if(event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;

    if(event.key === 'ArrowRight'){
        event.preventDefault();
        showNextEmployee(true);
    } else if(event.key === 'ArrowLeft'){
        event.preventDefault();
        showPrevEmployee(true);
    }
}

function handleToolboxClick(event) {
    const shiftBrush = event.target.closest('.shift-brush');
    const navArrow = event.target.closest('.nav-arrow');
    const employeeCard = event.target.closest('.employee-card');

    if (shiftBrush) handleSelectShiftBrush(shiftBrush.dataset.turnoId);
    if (navArrow) {
        if(navArrow.id === 'next-employee-btn') showNextEmployee(true);
        if(navArrow.id === 'prev-employee-btn') showPrevEmployee(true);
    }
    if (employeeCard && typeof employeeCard.onclick === 'function') {
        employeeCard.onclick();
    }
}

function showNextEmployee(animate = false){
    if(editorState.focusedEmployeeIndex < editorState.alphabetizedFuncs.length - 1) editorState.focusedEmployeeIndex++;
    else editorState.focusedEmployeeIndex = 0;
    editorState.animationDirection = 'right';
    updateFocusedEmployee(animate);
}
function showPrevEmployee(animate = false){
     if(editorState.focusedEmployeeIndex > 0) editorState.focusedEmployeeIndex--;
    else editorState.focusedEmployeeIndex = editorState.alphabetizedFuncs.length - 1;
    editorState.animationDirection = 'left';
    updateFocusedEmployee(animate);
}

function updateFocusedEmployee(animate = false){
    editorState.focusedEmployeeId = editorState.alphabetizedFuncs[editorState.focusedEmployeeIndex].id;
    editorState.selectedShiftBrush = null;
    highlightEmployeeRow(editorState.focusedEmployeeId);
    
    const contentEl = $(".toolbox-content");
    const currentCard = $(".focused-employee-view", contentEl);

    if (animate && currentCard) {
        const outClass = editorState.animationDirection === 'right' ? 'card-slide-out-left' : 'card-slide-out-right';
        currentCard.classList.add(outClass);
        setTimeout(() => {
            updateToolboxView();
        }, 300);
    } else {
        updateToolboxView();
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
        headerEl.innerHTML = `<h3 class="toolbox-title">🖱️ Editar por Célula</h3><p class="toolbox-subtitle">Selecione uma célula na escala</p>`;
        if (selectedCell) {
            const { date, employeeId, slotId } = selectedCell;
            const employee = employeeId ? store.getState().funcionarios.find(f => f.id === employeeId) : null;
            const slot = currentEscala.slots.find(s => s.id === slotId);
            if (subView) {
                const backButton = document.createElement('button');
                backButton.className = 'toolbox-back-btn';
                backButton.innerHTML = '‹';
                backButton.onclick = () => updateToolboxView();
                headerEl.appendChild(backButton);
            }
            if (slot && employee) {
                const turno = store.getState().turnos.find(t => t.id === slot.turnoId);
                let title = 'Editar Turno';
                if(subView === 'reassign') title = 'Reatribuir';
                if(subView === 'swap') title = 'Trocar com...';
                
                headerEl.innerHTML += `<h3 class="toolbox-title">${title}</h3><p class="toolbox-subtitle">${employee.nome} - ${new Date(date + 'T12:00:00').toLocaleDateString()}</p>`;
                
                if (subView === 'reassign') contentEl.innerHTML = renderPaletteForReassign(slot);
                else if (subView === 'swap') contentEl.innerHTML = renderPaletteForSwap(slot);
                else contentEl.innerHTML = renderToolboxForFilledCell(employee, turno, slot);

            } else if (employee) {
                headerEl.innerHTML += `<h3 class="toolbox-title">Adicionar Turno</h3><p class="toolbox-subtitle">${employee.nome} - ${new Date(date + 'T12:00:00').toLocaleDateString()}</p>`;
                contentEl.innerHTML = renderToolboxForVacantCell(employee, date);
            } else if (slot) {
                const turno = store.getState().turnos.find(t => t.id === slot.turnoId);
                headerEl.innerHTML += `<h3 class="toolbox-title">Preencher Vaga</h3><p class="toolbox-subtitle">${turno.nome} - ${new Date(date + 'T12:00:00').toLocaleDateString()}</p>`;
                contentEl.innerHTML = renderPaletteForReassign(slot);
            }
        }
    } else if (editMode === 'employee') {
        headerEl.innerHTML = `<h3 class="toolbox-title">🎨 Editar por Funcionário</h3>
                            <p class="toolbox-subtitle">Use as setas para navegar e selecione um turno para pintar.</p>`;
        contentEl.innerHTML = renderFocusedEmployeeView(true);
    } else if (editMode === 'eraser') {
        headerEl.innerHTML = `<h3 class="toolbox-title">🗑️ Modo Borracha</h3>
                            <p class="toolbox-subtitle">Clique em um turno na escala para apagá-lo.</p>`;
    }
}

// --- RENDERIZAÇÃO DE CONTEÚDO PARA TOOLBOX ---
function renderToolboxForFilledCell(employee, turno, slot) {
    return `<div style="padding: 0 8px;">
            <p><strong>Funcionário:</strong> ${employee.nome}</p>
            <p><strong>Turno Atual:</strong> ${turno.nome} (${turno.inicio} - ${turno.fim})</p>
        </div>
        <div class="toolbox-actions is-palette">
            <button class="secondary" title="Trocar turno com outro funcionário" onclick="updateToolboxView('swap')">🔃 Trocar Turno</button>
            <button class="secondary" title="Reatribuir este turno para outro funcionário" onclick="updateToolboxView('reassign')">🔁 Reatribuir</button>
            <button class="danger" title="Limpar Turno (Deixar Vago)" onclick="handleRemoveShiftClick('${slot.id}')">🗑️ Limpar</button>
        </div>`;
}

function renderToolboxForVacantCell(employee, date) {
    const turnosDoCargo = store.getState().turnos.filter(t => currentEscala.cobertura[t.id]);
    let html = `<div class="shift-brushes-container" style="padding: 0 8px; justify-content: center;">`;
    turnosDoCargo.forEach(turno => {
        const conflitos = checkPotentialConflicts(employee.id, turno.id, date, currentEscala);
        const hasConflict = conflitos.length > 0;
        const conflictTitle = hasConflict ? `Aviso: ${conflitos.join(' ')}` : turno.nome;
        
        const card = document.createElement('div');
        card.className = 'shift-brush';
        card.dataset.turnoId = turno.id;
        card.style.backgroundColor = turno.cor;
        card.title = conflictTitle;
        card.innerHTML = `${turno.sigla} ${hasConflict ? '⚠️' : ''}`;
        card.onclick = () => handleAddShiftClick(employee.id, turno.id, date);
        html += card.outerHTML;
    });
    html += `</div>`;
    return html;
}

function renderPaletteForReassign(slot) {
    const candidatos = getEligibleEmployees(slot.date, slot.turnoId, slot.assigned);
    const container = document.createElement('div');
    container.className = 'employee-palette';

    if (candidatos.length > 0) {
        candidatos.forEach(candidato => {
             const conflitos = checkPotentialConflicts(candidato.id, slot.turnoId, slot.date, currentEscala);
             const hasConflict = conflitos.length > 0;
             const conflictTitle = hasConflict ? `Aviso: ${conflitos.join(' ')}` : "Elegível para o turno";
             
             const card = document.createElement('div');
             card.className = 'employee-card';
             card.title = conflictTitle;
             card.innerHTML = `<h5>${candidato.nome} ${hasConflict ? '⚠️' : ''}</h5>`;
             card.onclick = () => handleSelectEmployeeForSlot(candidato.id, slot.id);
             container.appendChild(card);
        });
    } else {
        container.innerHTML = `<p class="muted" style="padding: 0 8px;">Nenhum outro funcionário elegível.</p>`;
    }
    return container.outerHTML;
}

function renderPaletteForSwap(slotToSwap) {
    const { slots } = currentEscala;
    const funcsTrabalhando = slots
        .filter(s => s.date === slotToSwap.date && s.assigned && s.assigned !== slotToSwap.assigned)
        .map(s => store.getState().funcionarios.find(f => f.id === s.assigned))
        .filter(Boolean);

    const container = document.createElement('div');
    container.className = 'employee-palette';

    if (funcsTrabalhando.length > 0) {
        funcsTrabalhando.forEach(func => {
            const slotFunc = slots.find(s => s.date === slotToSwap.date && s.assigned === func.id);
            // Validação cruzada de conflitos
            const conflitosParaA = checkPotentialConflicts(slotToSwap.assigned, slotFunc.turnoId, slotToSwap.date, currentEscala);
            const conflitosParaB = checkPotentialConflicts(func.id, slotToSwap.turnoId, slotToSwap.date, currentEscala);
            const hasConflict = conflitosParaA.length > 0 || conflitosParaB.length > 0;
            const conflictTitle = hasConflict ? `Troca inviável: ${[...new Set([...conflitosParaA, ...conflitosParaB])].join(' ')}` : "Troca Válida";

            const card = document.createElement('div');
            card.className = 'employee-card';
            card.title = conflictTitle;
            card.innerHTML = `<h5>${func.nome} ${hasConflict ? '⚠️' : ''}</h5>`;
            if (!hasConflict) {
                 card.onclick = () => handleSwapShiftClick(slotToSwap.id, slotFunc.id);
            } else {
                card.style.cursor = 'not-allowed';
                card.style.opacity = '0.6';
            }
            container.appendChild(card);
        });
    } else {
        container.innerHTML = `<p class="muted" style="padding: 0 8px;">Nenhum outro funcionário trabalhando neste dia para trocar.</p>`;
    }
     return container.outerHTML;
}

function renderFocusedEmployeeView(animate = false) {
    const { focusedEmployeeId, alphabetizedFuncs, focusedEmployeeIndex } = editorState;
    if (!focusedEmployeeId) return `<div class="focused-employee-view"><p class="muted">Nenhum funcionário neste cargo.</p></div>`;

    const employee = alphabetizedFuncs[focusedEmployeeIndex];
    const { turnos } = store.getState();
    const turnosDisponiveis = turnos.filter(t => employee.disponibilidade && employee.disponibilidade[t.id]);
    
    const cardHTML = `<div class="focused-employee-card" data-employee-id="${employee.id}">
            <div class="focused-employee-header">
                <div class="employee-info">
                    <h5>${employee.nome}</h5>
                    <div class="employee-stats muted"></div>
                </div>
                <div class="shift-brushes-container">
                    ${turnosDisponiveis.map(turno => {
                        const isSelected = editorState.selectedShiftBrush === turno.id;
                        return `<div class="shift-brush ${isSelected ? 'selected' : ''}" data-turno-id="${turno.id}" style="background-color: ${turno.cor};" title="${turno.nome}">${turno.sigla}</div>`
                    }).join('')}
                </div>
            </div>
            <div class="employee-indicators">
                 <span class="indicator-label">Carga Horária</span>
                 <div class="progress-bar-container" title="Carga Horária">
                    <div class="progress-bar progress-bar-main"></div>
                    <div class="progress-bar progress-bar-overtime"></div>
                </div>
                <span class="indicator-label">Dias Consecutivos</span>
                <div class="consecutive-days-container" title="Dias Consecutivos"></div>
            </div>
        </div>`;

    let dotsHTML = '';
    alphabetizedFuncs.forEach((_, index) => {
        dotsHTML += `<div class="employee-dot ${index === focusedEmployeeIndex ? 'active' : ''}"></div>`;
    });

    const animationClass = animate ? (editorState.animationDirection === 'left' ? 'card-slide-in-left' : 'card-slide-in-right') : '';

    const fullHTML = `<div class="focused-employee-view ${animationClass}">
        <button id="prev-employee-btn" class="nav-arrow" title="Funcionário Anterior">◀</button>
        ${cardHTML}
        <button id="next-employee-btn" class="nav-arrow" title="Próximo Funcionário">▶</button>
    </div>
    <div class="employee-progress-indicator">${dotsHTML}</div>`;
    
    setTimeout(() => {
        const card = $('.focused-employee-card');
        if (card) updateIndicatorsInCard(card);
    }, 0);

    return fullHTML;
}

// --- AÇÕES ---
function handleSelectShiftBrush(turnoId) {
    if (editorState.selectedShiftBrush === turnoId) {
        editorState.selectedShiftBrush = null;
    } else {
        editorState.selectedShiftBrush = turnoId;
    }
    const cardContent = renderFocusedEmployeeView();
    $(".toolbox-content").innerHTML = cardContent;
}

function handleAddShiftClick(employeeId, turnoId, date) {
    const conflitos = checkPotentialConflicts(employeeId, turnoId, date, currentEscala);
    if(conflitos.length > 0){
        showToast(`Não é possível adicionar: ${conflitos.join(' ')}`);
        return;
    }

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

    renderEscalaTable(currentEscala);
    runAllValidations();
    updateAllIndicators(); 
}

function handleRemoveShiftClick(slotId) {
    const slot = currentEscala.slots.find(s => s.id === slotId);
    if (!slot || !slot.assigned) return;
    const turno = store.getState().turnos.find(t => t.id === slot.turnoId);
    const employeeId = slot.assigned;

    lastEditedEmployeeId = employeeId;
    currentEscala.historico[employeeId].horasTrabalhadas -= turno.cargaMin;
    slot.assigned = null;
    
    renderEscalaTable(currentEscala);
    runAllValidations();
    
    if (editorState.editMode === 'cell') {
        rerenderEscalaAndUpdateToolbox();
    } else {
        updateAllIndicators();
    }
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
    runAllValidations();
}

function handleSwapShiftClick(slot1Id, slot2Id) {
    const slot1 = currentEscala.slots.find(s => s.id === slot1Id);
    const slot2 = currentEscala.slots.find(s => s.id === slot2Id);
    if (!slot1 || !slot2) return;

    const { turnos } = store.getState();
    const turno1 = turnos.find(t => t.id === slot1.turnoId);
    const turno2 = turnos.find(t => t.id === slot2.turnoId);
    const func1Id = slot1.assigned;
    const func2Id = slot2.assigned;

    // Atualiza o histórico de horas
    currentEscala.historico[func1Id].horasTrabalhadas = (currentEscala.historico[func1Id].horasTrabalhadas - turno1.cargaMin) + turno2.cargaMin;
    currentEscala.historico[func2Id].horasTrabalhadas = (currentEscala.historico[func2Id].horasTrabalhadas - turno2.cargaMin) + turno1.cargaMin;

    // Troca os funcionários nos slots
    slot1.assigned = func2Id;
    slot2.assigned = func1Id;

    lastEditedEmployeeId = func1Id; // Para o feedback visual
    rerenderEscalaAndUpdateToolbox();
    runAllValidations();
    setTimeout(() => { lastEditedEmployeeId = func2Id; renderResumoDetalhado(currentEscala); }, 1);
}

function rerenderEscalaAndUpdateToolbox() {
    renderEscalaTable(currentEscala);
    updateToolboxView();
}

function getEligibleEmployees(date, turnoId, excludeEmployeeId = null) {
    const { funcionarios } = store.getState();
    const funcsDoCargo = funcionarios.filter(f => f.cargoId === currentEscala.cargoId && f.id !== excludeEmployeeId);
    return funcsDoCargo.map(func => {
        const { disponibilidade } = func;
        const excecoesFunc = currentEscala.excecoes[func.id];
        if (excecoesFunc) {
            const allFolgas = [...(excecoesFunc.ferias?.dates || []), ...(excecoesFunc.afastamento?.dates || []), ...(excecoesFunc.folgas?.map(f => f.date) || [])];
            if (allFolgas.includes(date)) return null;
        }
        const diaSemanaId = DIAS_SEMANA[new Date(date + 'T12:00:00').getUTCDay()].id;
        if (disponibilidade && disponibilidade[turnoId]?.includes(diaSemanaId)) {
            return func;
        }
        return null;
    }).filter(Boolean).sort((a, b) => {
        const horasA = currentEscala.historico[a.id]?.horasTrabalhadas || 0;
        const horasB = currentEscala.historico[b.id]?.horasTrabalhadas || 0;
        return horasA - horasB;
    });
}

function highlightEmployeeRow(employeeId) {
    $$('.escala-final-table tbody tr').forEach(row => row.classList.remove('employee-row-highlight'));
    if (employeeId) {
        const row = $(`#escalaTabelaWrap tr[data-employee-row-id="${employeeId}"]`);
        if (row) row.classList.add('employee-row-highlight');
    }
}


// --- MOTOR DE VALIDAÇÃO DE CONFLITOS ---
function runAllValidations() {
    $$('.editable-cell.has-conflict').forEach(cell => {
        cell.classList.remove('has-conflict');
        const marker = $('.conflict-marker', cell);
        if (marker) marker.remove();
        const tooltip = $('.conflict-marker-tooltip', cell);
        if (tooltip) tooltip.remove();
    });

    const { funcionarios } = store.getState();
    const funcsDaEscala = funcionarios.filter(f => currentEscala.historico[f.id]);

    funcsDaEscala.forEach(func => {
        const conflitos = validateEmployeeSchedule(func.id, currentEscala);
        conflitos.forEach(conflito => {
            const cell = $(`td[data-employee-id="${func.id}"][data-date="${conflito.date}"]`);
            if (cell) {
                cell.classList.add('has-conflict');
                const marker = document.createElement('div');
                marker.className = 'conflict-marker';
                
                const tooltip = document.createElement('div');
                tooltip.className = 'conflict-marker-tooltip';
                tooltip.textContent = conflito.message;

                cell.appendChild(marker);
                cell.appendChild(tooltip);
            }
        });
    });
}

function validateEmployeeSchedule(employeeId, escala) {
    const { turnos } = store.getState();
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    const maxDias = geradorState.maxDiasConsecutivos || 6;
    const conflitos = [];

    const turnosDoFunc = escala.slots
        .filter(s => s.assigned === employeeId)
        .sort((a, b) => a.date.localeCompare(b.date));

    // Validação de Descanso
    for (let i = 1; i < turnosDoFunc.length; i++) {
        const turnoAtual = turnosDoFunc[i];
        const turnoAnterior = turnosDoFunc[i - 1];
        
        const infoTurnoAnterior = turnosMap[turnoAnterior.turnoId];
        if (!infoTurnoAnterior || !infoTurnoAnterior.descansoObrigatorioHoras) continue;

        const fimTurnoAnterior = new Date(`${turnoAnterior.date}T${infoTurnoAnterior.fim}`);
        if(infoTurnoAnterior.fim < infoTurnoAnterior.inicio) fimTurnoAnterior.setDate(fimTurnoAnterior.getDate() + 1);

        const inicioTurnoAtual = new Date(`${turnoAtual.date}T${turnosMap[turnoAtual.turnoId].inicio}`);
        const diffHoras = (inicioTurnoAtual - fimTurnoAnterior) / (1000 * 60 * 60);

        if (diffHoras < infoTurnoAnterior.descansoObrigatorioHoras) {
            conflitos.push({
                date: turnoAtual.date,
                type: 'descanso',
                message: `Descanso insuficiente! Apenas ${diffHoras.toFixed(1)}h desde o último turno (mínimo ${infoTurnoAnterior.descansoObrigatorioHoras}h).`
            });
        }
    }

    // Validação de Dias Consecutivos
    turnosDoFunc.forEach(turno => {
        const dias = calculateConsecutiveDaysPredictive(employeeId, escala, turno.date);
        if (dias > maxDias) {
            // Adiciona conflito apenas se já não houver um para esta data
            if (!conflitos.some(c => c.date === turno.date && c.type === 'consecutivos')) {
                conflitos.push({
                    date: turno.date,
                    type: 'consecutivos',
                    message: `Excede o limite de ${maxDias} dias consecutivos de trabalho.`
                });
            }
        }
    });
    
    return conflitos;
}