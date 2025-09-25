/**************************************
 * 📅 Lógica da Interface do Gerador
 **************************************/

// --- NOVA FUNÇÃO ADICIONADA PARA CORRIGIR O BUG ---
function renderEscCargoSelect() {
    const { cargos } = store.getState();
    const sel = $("#escCargo");
    if (!sel) return; // Garante que o código não quebre se o elemento não existir

    const currentValue = sel.value; // Salva o valor selecionado
    sel.innerHTML = "<option value=''>Selecione um cargo para a escala</option>";
    
    const cargosOrdenados = [...cargos].sort((a,b) => a.nome.localeCompare(b.nome));
    cargosOrdenados.forEach(c => {
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.nome;
        sel.appendChild(o);
    });

    // Restaura o valor se ele ainda existir na lista
    if (cargos.some(c => c.id === currentValue)) {
        sel.value = currentValue;
    }
}
// --- FIM DA NOVA FUNÇÃO ---

function updateEscalaResumoDias() {
    const inicio = $("#escIni").value;
    const fim = $("#escFim").value;
    const resumoEl = $("#escResumoDias");

    if (inicio && fim && fim >= inicio) {
        const dias = dateRangeInclusive(inicio, fim).length;
        resumoEl.textContent = `Total: ${dias} dia(s)`;
    } else {
        resumoEl.textContent = 'Selecione o período para ver a duração da escala.';
    }
}

function renderPasso2_Regras(cargoId) {
    const { cargos, turnos } = store.getState();
    const cargo = cargos.find(c => c.id === cargoId);
    const container = $("#cobertura-turnos-container");
    container.innerHTML = "";
    if (!cargo || !cargo.turnosIds || cargo.turnosIds.length === 0) {
        container.innerHTML = `<p class="muted">Este cargo não possui turnos associados. Volte e edite o cargo primeiro.</p>`;
        return;
    }
    const turnosDoCargo = turnos.filter(t => cargo.turnosIds.includes(t.id)).sort((a, b) => a.nome.localeCompare(b.nome));
    turnosDoCargo.forEach(turno => {
        const div = document.createElement('div');
        div.className = 'form-row-aligned cobertura-item';
        div.innerHTML = `
            <label for="cobertura-${turno.id}">${turno.nome} (${turno.inicio} - ${turno.fim})</label>
            <input type="number" id="cobertura-${turno.id}" data-turno-id="${turno.id}" class="input-sm" value="1" min="0">
            <span>funcionário(s)</span>
        `;
        container.appendChild(div);
    });
}

function addFeriado() {
    const dataInput = $('#feriado-data-input');
    const nomeInput = $('#feriado-nome-input');
    const trabalha = $('#feriado-trabalha-toggle .toggle-btn.active').dataset.value === 'sim';
    const descontaHoras = $('#feriado-descontar-toggle .toggle-btn.active').dataset.value === 'sim';
    const horasDescontoInput = $('#feriado-horas-desconto');
    let horasDesconto = 0;

    const date = dataInput.value;
    const nome = nomeInput.value.trim();

    if (!date || !nome) {
        showToast("Por favor, preencha a data e o nome do feriado.");
        return;
    }
    
    // Validação para garantir que o feriado está dentro do período da escala
    if (geradorState.inicio && geradorState.fim && (date < geradorState.inicio || date > geradorState.fim)) {
        showToast("A data do feriado deve estar dentro do período selecionado para a escala.");
        return;
    }
    
    if (descontaHoras) {
        horasDesconto = parseInt(horasDescontoInput.value, 10);
        if (isNaN(horasDesconto) || horasDesconto < 0) {
            showToast("Por favor, informe uma quantidade válida de horas para descontar.");
            horasDescontoInput.classList.add('invalid');
            return;
        }
    }
    horasDescontoInput.classList.remove('invalid');

    if (geradorState.feriados.some(f => f.date === date)) {
        showToast("Já existe um feriado nesta data.");
        return;
    }

    geradorState.feriados.push({ date, nome, trabalha, descontaHoras, horasDesconto });
    geradorState.feriados.sort((a, b) => a.date.localeCompare(b.date));
    renderFeriadosTags();
    dataInput.value = '';
    nomeInput.value = '';
    $('#feriado-descontar-toggle .toggle-btn[data-value="nao"]').click();
    $('#feriado-horas-desconto').value = '';
}

function removeFeriado(date) {
    geradorState.feriados = geradorState.feriados.filter(f => f.date !== date);
    renderFeriadosTags();
}

function renderFeriadosTags() {
    const container = $('#feriados-tags-container');
    container.innerHTML = geradorState.feriados.map(f => {
        const trabalhaText = f.trabalha ? '' : ' (Não trabalha)';
        const descontoText = f.descontaHoras ? ` (-${f.horasDesconto}h)` : '';
        return `<span class="tag">${new Date(f.date+'T12:00:00').toLocaleDateString()} - ${f.nome}${trabalhaText}${descontoText}<button data-remove-feriado="${f.date}">x</button></span>`
    }).join('');
    $$('[data-remove-feriado]').forEach(btn => {
        btn.onclick = () => removeFeriado(btn.dataset.removeFeriado);
    });
}

function renderPasso3_Excecoes(cargoId) {
    const { funcionarios } = store.getState();
    const funcs = funcionarios.filter(f => f.cargoId === cargoId).sort((a,b) => a.nome.localeCompare(b.nome));
    const container = $("#excecoes-funcionarios-container");
    container.innerHTML = "";
    if (funcs.length === 0) {
        container.innerHTML = `<p class="muted">Nenhum funcionário encontrado para este cargo.</p>`;
        return;
    }

    funcs.forEach(func => {
        if (!geradorState.excecoes[func.id]) {
            geradorState.excecoes[func.id] = { ferias: { dates: [], motivo: '', carência: 0 }, afastamento: { dates: [], motivo: '', carência: 0 }, folgas: [] };
        }
        const div = document.createElement('div');
        div.className = 'excecao-func-card';
        const tipoFolgaOptions = TIPOS_FOLGA.map(t => `<option value="${t.nome}">${t.nome} (${t.sigla})</option>`).join('');

        div.innerHTML = `
            <div class="excecao-header"><strong>${func.nome}</strong></div>
            <div class="excecao-body">
                <div class="form-row-aligned excecao-linha">
                    <label>Férias?</label>
                    <div class="toggle-group" data-toggle-container="ferias" data-func-id="${func.id}">
                        <button type="button" class="toggle-btn active" data-value="nao">Não</button>
                        <button type="button" class="toggle-btn" data-value="sim">Sim</button>
                    </div>
                    <div class="dates-container hidden" data-dates-container="ferias" data-func-id="${func.id}">
                        <input type="date" title="Início das férias" data-date-ini="ferias" data-func-id="${func.id}" min="${geradorState.inicio}" max="${geradorState.fim}">
                        <span>até</span>
                        <input type="date" title="Fim das férias" data-date-fim="ferias" data-func-id="${func.id}" min="${geradorState.inicio}" max="${geradorState.fim}">
                        <div class="form-row-aligned">
                            <label>Carência (dias)</label>
                            <input type="number" class="input-sm" data-carência="ferias" data-func-id="${func.id}" min="0" value="0">
                        </div>
                    </div>
                    <span class="dias-resumo" data-resumo-dias="ferias" data-func-id="${func.id}"></span>
                </div>
                <div class="form-row-aligned excecao-linha">
                    <label>Afastado?</label>
                    <div class="toggle-group" data-toggle-container="afastamento" data-func-id="${func.id}">
                        <button type="button" class="toggle-btn active" data-value="nao">Não</button>
                        <button type="button" class="toggle-btn" data-value="sim">Sim</button>
                    </div>
                    <div class="dates-container hidden" data-dates-container="afastamento" data-func-id="${func.id}">
                        <input type="date" title="Início do afastamento" data-date-ini="afastamento" data-func-id="${func.id}" min="${geradorState.inicio}" max="${geradorState.fim}">
                        <span>até</span>
                        <input type="date" title="Fim do afastamento" data-date-fim="afastamento" data-func-id="${func.id}" min="${geradorState.inicio}" max="${geradorState.fim}">
                        <input type="text" placeholder="Motivo" class="input-sm" data-motivo="afastamento" data-func-id="${func.id}">
                        <div class="form-row-aligned">
                            <label>Carência (dias)</label>
                            <input type="number" class="input-sm" data-carência="afastamento" data-func-id="${func.id}" min="0" value="0">
                        </div>
                    </div>
                    <span class="dias-resumo" data-resumo-dias="afastamento" data-func-id="${func.id}"></span>
                </div>
                <div class="excecao-linha">
                    <label>Folgas Avulsas:</label>
                    <div class="form-row-aligned">
                        <input type="date" class="input-sm" data-folga-input="${func.id}" min="${geradorState.inicio}" max="${geradorState.fim}">
                        <select class="select-sm" data-folga-tipo="${func.id}">${tipoFolgaOptions}</select>
                        <button class="secondary" data-add-folga="${func.id}">Adicionar</button>
                    </div>
                    <div class="folgas-tags" data-folgas-tags="${func.id}"></div>
                </div>
            </div>
        `;
        container.appendChild(div);
        
        $$(`[data-toggle-container][data-func-id="${func.id}"] .toggle-btn`).forEach(btn => {
            btn.onclick = (e) => handleExcecaoToggle(e, func.id);
        });
        $$(`[data-date-ini][data-func-id="${func.id}"], [data-date-fim][data-func-id="${func.id}"], [data-motivo][data-func-id="${func.id}"]`).forEach(input => {
            input.onchange = (e) => updateDiasResumo(e, input.dataset.dateIni || input.dataset.dateFim || input.dataset.motivo, func.id);
        });
        $$(`[data-carência][data-func-id="${func.id}"]`).forEach(input => {
             input.onchange = (e) => updateCarência(e, input.dataset.carência, func.id);
        });
        div.querySelector(`[data-add-folga="${func.id}"]`).onclick = () => addFolga(func.id);

        // *** MELHORIA ADICIONADA AQUI ***
        // Adiciona o evento de clique a todos os inputs de data para abrir o calendário
        $$(`input[type="date"]`, div).forEach(dateInput => {
            dateInput.onclick = () => dateInput.showPicker();
        });
    });
}

function handleExcecaoToggle(event, funcId) {
    const container = event.target.closest('[data-toggle-container]');
    const tipo = container.dataset.toggleContainer;
    const value = event.target.dataset.value;
    
    container.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    $(`[data-dates-container="${tipo}"][data-func-id="${funcId}"]`).classList.toggle('hidden', value === 'nao');
    if(value === 'nao') { 
        const iniInput = $(`[data-date-ini="${tipo}"][data-func-id="${funcId}"]`);
        const fimInput = $(`[data-date-fim="${tipo}"][data-func-id="${funcId}"]`);
        const carenciaInput = $(`[data-carência="${tipo}"][data-func-id="${funcId}"]`);
        iniInput.value = '';
        fimInput.value = '';
        carenciaInput.value = 0;
        if($(`[data-motivo="${tipo}"][data-func-id="${funcId}"]`)) {
            $(`[data-motivo="${tipo}"][data-func-id="${funcId}"]`).value = '';
        }
        // Dispara o evento onchange para limpar o estado
        iniInput.dispatchEvent(new Event('change'));
    }
}

function handleGoToPasso2() {
    const escIniInput = $("#escIni");
    const escFimInput = $("#escFim");
    const cargoId = $("#escCargo").value;
    const inicio = escIniInput.value;
    const fim = escFimInput.value;
    
    $("#escCargo").classList.toggle('invalid', !cargoId);
    escIniInput.classList.toggle('invalid', !inicio);
    escFimInput.classList.toggle('invalid', !fim);

    if (!cargoId || !inicio || !fim) {
        return showToast("Por favor, selecione o cargo e o período completo.");
    }
    if (fim < inicio) {
        return showToast("A data de fim não pode ser anterior à data de início.");
    }

    geradorState.cargoId = cargoId;
    geradorState.inicio = inicio;
    geradorState.fim = fim;

    $('#feriado-data-input').min = inicio;
    $('#feriado-data-input').max = fim;

    renderPasso2_Regras(cargoId);
    navigateWizard('passo2-cobertura');
}

function handleGoToPasso3() {
    const { cargos } = store.getState();
    geradorState.cobertura = {};
    const manual = $('#cobertura-manual-toggle .toggle-btn.active').dataset.value === 'sim';
    
    if (manual) {
        $$('#cobertura-turnos-container input').forEach(input => {
            geradorState.cobertura[input.dataset.turnoId] = parseInt(input.value, 10) || 0;
        });
    } else {
        const cargo = cargos.find(c => c.id === geradorState.cargoId);
        if (cargo) {
            cargo.turnosIds.forEach(turnoId => {
                geradorState.cobertura[turnoId] = 1; // Padrão de 1 funcionário por turno
            });
        }
    }

    geradorState.maxDiasConsecutivos = parseInt($('#maxDiasConsecutivos').value, 10) || 6;
    geradorState.minFolgasFimSemana = parseInt($('#minFolgasFimSemana').value, 10) || 2;
    geradorState.otimizarFolgas = $('#otimizar-folgas-toggle .toggle-btn.active').dataset.value === 'sim';
    renderPasso3_Excecoes(geradorState.cargoId);
    navigateWizard('passo3-excecoes');
}


/**
 * LÓGICA DE VALIDAÇÃO DE DATAS CORRIGIDA
 * Verifica se um conjunto de datas para um funcionário se sobrepõe a outras exceções existentes, incluindo carência.
 * @param {string} funcId - ID do funcionário.
 * @param {string[]} datesToCheck - Array de datas (ISO string) a serem validadas.
 * @param {string} tipoExcecaoAtual - O tipo da exceção atual ('ferias', 'afastamento', 'folgas') para evitar comparar consigo mesma.
 * @returns {boolean} - Retorna true se houver sobreposição, false caso contrário.
 */
function checkDateOverlap(funcId, datesToCheck, tipoExcecaoAtual) {
    const excecoesFunc = geradorState.excecoes[funcId];
    const allExistingDates = new Set();

    const addExcecaoToSet = (excecao) => {
        if (excecao.dates.length > 0) {
            excecao.dates.forEach(d => allExistingDates.add(d));
            const carencia = excecao.carência || 0;
            if (carencia > 0) {
                const ultimaData = excecao.dates[excecao.dates.length - 1];
                for (let i = 1; i <= carencia; i++) {
                    allExistingDates.add(addDays(ultimaData, i));
                }
            }
        }
    };

    if (tipoExcecaoAtual !== 'ferias') addExcecaoToSet(excecoesFunc.ferias);
    if (tipoExcecaoAtual !== 'afastamento') addExcecaoToSet(excecoesFunc.afastamento);
    if (tipoExcecaoAtual !== 'folgas') {
        excecoesFunc.folgas.forEach(f => allExistingDates.add(f.date));
    }
    
    for (const date of datesToCheck) {
        if (allExistingDates.has(date)) {
            return true; // Encontrou sobreposição
        }
    }
    return false; // Nenhuma sobreposição encontrada
}

function updateCarência(event, tipo, funcId) {
    const carencia = parseInt(event.target.value, 10) || 0;
    if(carencia < 0) {
        event.target.value = 0;
        return;
    }
    geradorState.excecoes[funcId][tipo].carência = carencia;
    
    // Força a revalidação, pois a carência pode gerar um novo conflito
    const inicioInput = $(`[data-date-ini="${tipo}"][data-func-id="${funcId}"]`);
    inicioInput.dispatchEvent(new Event('change'));
}


function updateDiasResumo(event, tipo, funcId) {
    const inicioInput = $(`[data-date-ini="${tipo}"][data-func-id="${funcId}"]`);
    const fimInput = $(`[data-date-fim="${tipo}"][data-func-id="${funcId}"]`);
    const motivoInput = $(`[data-motivo="${tipo}"][data-func-id="${funcId}"]`);
    const resumoEl = $(`[data-resumo-dias="${tipo}"][data-func-id="${funcId}"]`);
    
    const inicio = inicioInput.value;
    const fim = fimInput.value;

    if (inicio && fim && fim >= inicio) {
        const newDates = dateRangeInclusive(inicio, fim);
        const carencia = geradorState.excecoes[funcId][tipo].carência || 0;
        let allDatesForCheck = [...newDates];
        if (carencia > 0) {
            const ultimaData = newDates[newDates.length-1];
            for (let i = 1; i <= carencia; i++) {
                allDatesForCheck.push(addDays(ultimaData, i));
            }
        }

        if (checkDateOverlap(funcId, allDatesForCheck, tipo)) {
            showToast("Erro: O período selecionado (incluindo carência) conflita com outra folga, férias ou afastamento.");
            event.target.value = ''; // Limpa o campo que causou o conflito
            // Força a re-checagem para limpar o estado se um dos campos foi limpo
            const otherInput = event.target === inicioInput ? fimInput : inicioInput;
            if (otherInput.value === '') {
                 resumoEl.textContent = '';
                 geradorState.excecoes[funcId][tipo].dates = [];
            }
            return;
        }
        const diasEfetivos = dateRangeInclusive(inicio,fim).length;
        resumoEl.textContent = `Total: ${diasEfetivos} dia(s)`;
        geradorState.excecoes[funcId][tipo].dates = dateRangeInclusive(inicio, fim);
        if(motivoInput) geradorState.excecoes[funcId][tipo].motivo = motivoInput.value;
    } else {
        resumoEl.textContent = '';
        geradorState.excecoes[funcId][tipo].dates = [];
        if(motivoInput) geradorState.excecoes[funcId][tipo].motivo = '';
    }
}

function addFolga(funcId) {
    const input = $(`[data-folga-input="${funcId}"]`);
    const tipoSelect = $(`[data-folga-tipo="${funcId}"]`);
    const date = input.value;
    const tipo = tipoSelect.value;
    
    if (!date) {
        showToast("Selecione uma data para a folga.");
        return;
    }

    if (checkDateOverlap(funcId, [date], 'folgas')) {
        showToast("Erro: Esta data conflita com outra folga, férias ou afastamento.");
        input.value = '';
        return;
    }

    if (!geradorState.excecoes[funcId].folgas.some(f => f.date === date)) {
        geradorState.excecoes[funcId].folgas.push({ date, tipo });
        renderFolgas(funcId);
        input.value = '';
    }
}

function removeFolga(funcId, date) {
    geradorState.excecoes[funcId].folgas = geradorState.excecoes[funcId].folgas.filter(f => f.date !== date);
    renderFolgas(funcId);
}

function renderFolgas(funcId) {
    const container = $(`[data-folgas-tags="${funcId}"]`);
    container.innerHTML = geradorState.excecoes[funcId].folgas
        .sort((a,b) => a.date.localeCompare(b.date))
        .map(f => {
            const sigla = TIPOS_FOLGA.find(tf => tf.nome === f.tipo)?.sigla || 'F';
            return `<span class="tag" data-tipo-folga="${f.tipo}">${new Date(f.date+'T12:00:00').toLocaleDateString()} (${sigla})<button data-remove-folga="${funcId}" data-date="${f.date}">x</button></span>`
        }).join('');
    
    $$(`[data-remove-folga="${funcId}"]`).forEach(btn => {
        btn.onclick = () => removeFolga(funcId, btn.dataset.date);
    });
}