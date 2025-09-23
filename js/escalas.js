/**************************************
 * 📅 Escalas
 **************************************/
let currentEscala = null;
let geradorState = { 
    excecoes: {},
    feriados: [],
    maxDiasConsecutivos: 6
};

const TIPOS_FOLGA = [
    { nome: "Folga Normal", sigla: "FN" },
    { nome: "Folga Abonada", sigla: "FA" },
    { nome: "Atestado Médico", sigla: "AM" },
    { nome: "Folga Aniversário", sigla: "ANIV" }
];

// --- RENDERIZAÇÃO E LÓGICA DO ASSISTENTE (WIZARD) ---

function resetGeradorEscala() {
    geradorState = { excecoes: {}, feriados: [], maxDiasConsecutivos: 6 };
    currentEscala = null;
    $("#escalaView").classList.add('hidden');
    $("#gerador-container").classList.remove('hidden');
    $$("#gerador-container .wizard-step").forEach(step => step.classList.remove('active'));
    $("#passo1-selecao").classList.add('active');
    $("#escCargo").value = '';
    $("#escIni").value = '';
    $("#escFim").value = '';
    $('#escFim').disabled = true;
    $("#escResumoDias").textContent = '';
    $$('#passo1-selecao .invalid').forEach(el => el.classList.remove('invalid'));
    $("#cobertura-turnos-container").innerHTML = '';
    $("#excecoes-funcionarios-container").innerHTML = '';
    renderFeriadosTags();
}

function navigateWizard(targetStep) {
    $$("#gerador-container .wizard-step").forEach(step => step.classList.remove('active'));
    $(`#${targetStep}`).classList.add('active');
}

function setupWizard() {
    const escIniInput = $("#escIni");
    const escFimInput = $("#escFim");

    $("#btn-goto-passo2").onclick = () => {
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

        renderPasso2_Cobertura(cargoId);
        navigateWizard('passo2-cobertura');
    };

    $("#btn-back-passo1").onclick = () => navigateWizard('passo1-selecao');
    $("#btn-goto-passo3").onclick = () => {
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
        renderPasso3_Excecoes(geradorState.cargoId);
        navigateWizard('passo3-excecoes');
    };

    $("#btn-back-passo2").onclick = () => navigateWizard('passo2-cobertura');
    $("#btnGerarEscala").onclick = gerarEscala;
    $("#btnVoltarPasso3").onclick = () => {
        $("#escalaView").classList.add('hidden');
        $("#gerador-container").classList.remove('hidden');
        navigateWizard('passo3-excecoes');
    };

    $("#escCargo").onchange = () => $("#escCargo").classList.remove('invalid');
    escIniInput.onchange = () => {
        escIniInput.classList.remove('invalid');
        if (escIniInput.value) {
            escFimInput.disabled = false;
            escFimInput.min = escIniInput.value;
        } else {
            escFimInput.disabled = true;
            escFimInput.value = '';
        }
        if (escFimInput.value && escFimInput.value < escIniInput.value) {
            escFimInput.value = '';
        }
        updateEscalaResumoDias();
    };
    escFimInput.onchange = () => {
        escFimInput.classList.remove('invalid');
        updateEscalaResumoDias();
    };

    $('#btn-add-feriado').onclick = addFeriado;
    $$('#feriado-trabalha-toggle .toggle-btn').forEach(button => {
        button.onclick = () => {
            $$('#feriado-trabalha-toggle .toggle-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        };
    });
    $$('#cobertura-manual-toggle .toggle-btn').forEach(button => {
        button.onclick = () => {
            $$('#cobertura-manual-toggle .toggle-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const show = button.dataset.value === 'sim';
            $('#cobertura-manual-container').classList.toggle('hidden', !show);
        };
    });
}

function updateEscalaResumoDias() {
    const inicio = $("#escIni").value;
    const fim = $("#escFim").value;
    const resumoEl = $("#escResumoDias");
    if (inicio && fim && fim >= inicio) {
        const dias = dateRangeInclusive(inicio, fim).length;
        resumoEl.textContent = `Total: ${dias} dia(s)`;
    } else {
        resumoEl.textContent = '';
    }
}

function renderPasso2_Cobertura(cargoId) {
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

    const date = dataInput.value;
    const nome = nomeInput.value.trim();

    if (!date || !nome) {
        showToast("Por favor, preencha a data e o nome do feriado.");
        return;
    }
    if (geradorState.feriados.some(f => f.date === date)) {
        showToast("Já existe um feriado nesta data.");
        return;
    }

    geradorState.feriados.push({ date, nome, trabalha });
    geradorState.feriados.sort((a, b) => a.date.localeCompare(b.date));
    renderFeriadosTags();
    dataInput.value = '';
    nomeInput.value = '';
}

function removeFeriado(date) {
    geradorState.feriados = geradorState.feriados.filter(f => f.date !== date);
    renderFeriadosTags();
}

function renderFeriadosTags() {
    const container = $('#feriados-tags-container');
    container.innerHTML = geradorState.feriados.map(f => {
        const trabalhaText = f.trabalha ? '' : ' (Não trabalha)';
        return `<span class="tag">${new Date(f.date+'T12:00:00').toLocaleDateString()} - ${f.nome}${trabalhaText}<button data-remove-feriado="${f.date}">x</button></span>`
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
            geradorState.excecoes[func.id] = { ferias: { dates: [], motivo: '' }, afastamento: { dates: [], motivo: '' }, folgas: [] };
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
        div.querySelector(`[data-add-folga="${func.id}"]`).onclick = () => addFolga(func.id);
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
        iniInput.value = '';
        fimInput.value = '';
        if($(`[data-motivo="${tipo}"][data-func-id="${funcId}"]`)) {
            $(`[data-motivo="${tipo}"][data-func-id="${funcId}"]`).value = '';
        }
        // Dispara o evento onchange para limpar o estado
        iniInput.dispatchEvent(new Event('change'));
    }
}

/**
 * NOVA LÓGICA DE VALIDAÇÃO DE DATAS
 * Verifica se um conjunto de datas para um funcionário se sobrepõe a outras exceções existentes.
 * @param {string} funcId - ID do funcionário.
 * @param {string[]} datesToCheck - Array de datas (ISO string) a serem validadas.
 * @param {string} tipoExcecaoAtual - O tipo da exceção atual ('ferias', 'afastamento', 'folgas') para evitar comparar consigo mesma.
 * @returns {boolean} - Retorna true se houver sobreposição, false caso contrário.
 */
function checkDateOverlap(funcId, datesToCheck, tipoExcecaoAtual) {
    const excecoesFunc = geradorState.excecoes[funcId];
    const allExistingDates = new Set();

    if (tipoExcecaoAtual !== 'ferias') {
        excecoesFunc.ferias.dates.forEach(d => allExistingDates.add(d));
    }
    if (tipoExcecaoAtual !== 'afastamento') {
        excecoesFunc.afastamento.dates.forEach(d => allExistingDates.add(d));
    }
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


function updateDiasResumo(event, tipo, funcId) {
    const inicioInput = $(`[data-date-ini="${tipo}"][data-func-id="${funcId}"]`);
    const fimInput = $(`[data-date-fim="${tipo}"][data-func-id="${funcId}"]`);
    const motivoInput = $(`[data-motivo="${tipo}"][data-func-id="${funcId}"]`);
    const resumoEl = $(`[data-resumo-dias="${tipo}"][data-func-id="${funcId}"]`);
    
    const inicio = inicioInput.value;
    const fim = fimInput.value;

    if (inicio && fim && fim >= inicio) {
        const newDates = dateRangeInclusive(inicio, fim);
        
        if (checkDateOverlap(funcId, newDates, tipo)) {
            showToast("Erro: O período selecionado conflita com outra folga, férias ou afastamento.");
            event.target.value = ''; // Limpa o campo que causou o conflito
            // Força a re-checagem para limpar o estado se um dos campos foi limpo
            const otherInput = event.target === inicioInput ? fimInput : inicioInput;
            if (otherInput.value === '') {
                 resumoEl.textContent = '';
                 geradorState.excecoes[funcId][tipo].dates = [];
            }
            return;
        }

        const dias = newDates.length;
        resumoEl.textContent = `Total: ${dias} dia(s)`;
        geradorState.excecoes[funcId][tipo].dates = newDates;
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

function gerarEscala() {
    const { cargos, funcionarios, turnos } = store.getState();
    const { cargoId, inicio, fim, cobertura, excecoes, maxDiasConsecutivos, feriados } = geradorState;
    const cargo = cargos.find(c => c.id === cargoId);
    const funcs = funcionarios.filter(f => f.cargoId === cargoId);
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    
    // Otimização de performance: cria um mapa de consulta rápida para exceções
    const excecoesMap = {};
    funcs.forEach(f => {
        const funcExcecoes = excecoes[f.id];
        const datasInvalidas = new Set([
            ...funcExcecoes.ferias.dates,
            ...funcExcecoes.afastamento.dates,
            ...funcExcecoes.folgas.map(folga => folga.date)
        ]);
        excecoesMap[f.id] = datasInvalidas;
    });

    let historico = {};
    funcs.forEach(f => {
        historico[f.id] = { horasTrabalhadas: 0, ultimoTurnoFim: null, diasTrabalhados: 0 };
    });

    const dateRange = dateRangeInclusive(inicio, fim);
    let slots = [];
    dateRange.forEach(date => {
        const diaSemanaId = DIAS_SEMANA[new Date(date + 'T12:00:00').getUTCDay()].id;
        const feriado = feriados.find(f => f.date === date);

        if (feriado && !feriado.trabalha) {
            return; 
        }

        if (cargo.regras.dias.includes(diaSemanaId)) {
            for (const turnoId in cobertura) {
                if (cobertura[turnoId] > 0) {
                    for (let i = 0; i < cobertura[turnoId]; i++) {
                        slots.push({ date, turnoId, assigned: null, id: uid() });
                    }
                }
            }
        }
    });

    function checkDiasConsecutivos(funcId, date, max, assignedSlots) {
        let diasSeguidos = 0;
        for (let i = 1; i <= max; i++) {
            const checkDate = addDays(date, -i);
            if (assignedSlots.some(s => s.date === checkDate && s.assigned === funcId)) {
                diasSeguidos++;
            } else {
                break;
            }
        }
        return diasSeguidos < max;
    }

    function tentarPreencher(slotsParaTentar, usarHoraExtra = false) {
        slotsParaTentar.forEach(slot => {
            if (slot.assigned) return;
            const turno = turnosMap[slot.turnoId];
            const diaSemanaId = DIAS_SEMANA[new Date(slot.date + 'T12:00:00').getUTCDay()].id;
            const candidatos = funcs
                .filter(f => {
                    if (excecoesMap[f.id].has(slot.date)) return false; // Check otimizado
                    if (!f.disponibilidade[turno.id]?.includes(diaSemanaId)) return false;
                    if (slots.some(s => s.assigned === f.id && s.date === slot.date)) return false;
                    if (!checkDiasConsecutivos(f.id, slot.date, maxDiasConsecutivos, slots)) return false;
                    
                    const ultimoFim = historico[f.id].ultimoTurnoFim;
                    if (f.tipoContrato === 'clt' && ultimoFim) {
                        const descansoMin = (turnosMap[ultimoFim.turnoId]?.descansoObrigatorioHoras || 0) * 60;
                        const proximoInicio = new Date(`${slot.date}T${turno.inicio}`);
                        const diffMin = (proximoInicio - ultimoFim.data) / (1000 * 60);
                        if (diffMin < descansoMin) return false;
                    }
                    if (!usarHoraExtra || !f.fazHoraExtra) {
                        const maxHoras = f.periodoHoras === 'semanal' ? f.cargaHoraria * (dateRange.length / 7) : f.cargaHoraria;
                        if ((historico[f.id].horasTrabalhadas / 60) >= maxHoras) return false;
                    }
                    return true;
                })
                .sort((a, b) => historico[a.id].horasTrabalhadas - historico[b.id].horasTrabalhadas);

            if (candidatos.length > 0) {
                const escolhido = candidatos[0];
                slot.assigned = escolhido.id;
                historico[escolhido.id].horasTrabalhadas += turno.cargaMin;
                historico[escolhido.id].diasTrabalhados++;
                let dataFimTurno = new Date(`${slot.date}T${turno.fim}`);
                if (turno.fim < turno.inicio) dataFimTurno.setUTCDate(dataFimTurno.getUTCDate() + 1);
                historico[escolhido.id].ultimoTurnoFim = { data: dataFimTurno, turnoId: turno.id };
            }
        });
    }
    
    // Potencial ponto de lentidão para escalas muito grandes.
    // Para otimizar no futuro, este processo poderia ser movido para um Web Worker
    // para não bloquear a interface do usuário.
    tentarPreencher(slots, false);
    tentarPreencher(slots.filter(s => !s.assigned), true);
    
    const cargoNome = cargos.find(c => c.id === cargoId)?.nome || 'Cargo';
    const nomeEscala = `Escala: ${cargoNome} (${new Date(inicio+'T12:00:00').toLocaleDateString()} a ${new Date(fim+'T12:00:00').toLocaleDateString()})`;

    currentEscala = { id: uid(), nome: nomeEscala, cargoId, inicio, fim, slots, historico, excecoes: JSON.parse(JSON.stringify(excecoes)), feriados: [...geradorState.feriados] };
    renderEscalaTable(currentEscala);
}

function renderResumoDetalhado(escala) {
    const { funcionarios } = store.getState();
    const container = $("#escalaResumoDetalhado");
    if (!escala || !escala.historico) {
        container.innerHTML = "";
        return;
    }

    const funcsDaEscala = funcionarios.filter(f => escala.historico[f.id] && escala.historico[f.id].horasTrabalhadas > 0)
                                      .sort((a,b) => a.nome.localeCompare(b.nome));
    
    let html = '<h4>Resumo de Horas no Período</h4>';
    funcsDaEscala.forEach(func => {
        const horasTrabalhadas = (escala.historico[func.id].horasTrabalhadas / 60);
        const horasContratadasBase = parseFloat(func.cargaHoraria) || 0;
        const periodoDias = dateRangeInclusive(escala.inicio, escala.fim).length;
        
        let metaHoras = 0;
        if(func.periodoHoras === 'semanal') {
            metaHoras = (horasContratadasBase / 7) * periodoDias;
        } else { // mensal
            const diasNoMes = new Date(escala.inicio.slice(0, 7) + '-28').getDate(); // Aproximação de dias no mês
            metaHoras = (horasContratadasBase / diasNoMes) * periodoDias;
        }

        let extraInfo = '';
        if (horasTrabalhadas > metaHoras) {
            const horasExtras = horasTrabalhadas - metaHoras;
            extraInfo = `<span style="color:var(--danger); font-weight:bold;"> (+${horasExtras.toFixed(2)}h extra)</span>`;
        }

        html += `<p style="margin: 4px 0;"><strong>${func.nome}:</strong> ${horasTrabalhadas.toFixed(2)}h / ${metaHoras.toFixed(2)}h${extraInfo}</p>`;
    });
    container.innerHTML = html;
}

function renderEscalaTable(escala) {
    const { funcionarios, turnos } = store.getState();
    const container = $("#escalaTabelaWrap");

    const funcsDaEscala = [...new Set(escala.slots.map(s => s.assigned).filter(Boolean))]
        .map(funcId => funcionarios.find(f => f.id === funcId)).filter(Boolean)
        .sort((a,b) => a.nome.localeCompare(b.nome));

    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    const turnosDoCargo = turnos.filter(t => geradorState.cobertura[t.id] > 0).sort((a,b) => a.inicio.localeCompare(b.inicio));

    let tableHTML = `<table class="escala-final-table"><thead><tr><th>Funcionário</th>`;
    dateRange.forEach(date => {
        const d = new Date(date + 'T12:00:00');
        const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'short' });
        const dia = d.getDate();
        const feriado = escala.feriados.find(f => f.date === date);
        const isFeriado = feriado ? 'feriado' : '';
        const isWeekend = (d.getUTCDay() === 0 || d.getUTCDay() === 6) ? 'weekend' : '';
        
        tableHTML += `<th class="${isFeriado} ${isWeekend}" title="${feriado ? feriado.nome : ''}">${dia}<br>${diaSemana}</th>`;
    });
    tableHTML += `</tr></thead><tbody>`;

    funcsDaEscala.forEach(func => {
        tableHTML += `<tr><td>${func.nome}</td>`;
        dateRange.forEach(date => {
            const exce = escala.excecoes[func.id];
            const folgaDoDia = exce?.folgas.find(f => f.date === date);
            if (exce && exce.ferias.dates.includes(date)) {
                tableHTML += `<td class="celula-excecao">Férias</td>`;
            } else if (exce && exce.afastamento.dates.includes(date)) {
                tableHTML += `<td class="celula-excecao" title="Motivo: ${exce.afastamento.motivo || 'Não informado'}">Afastado</td>`;
            } else if (folgaDoDia) {
                const sigla = TIPOS_FOLGA.find(tf => tf.nome === folgaDoDia.tipo)?.sigla || 'F';
                 tableHTML += `<td class="celula-excecao" data-tipo-folga="${folgaDoDia.tipo}" title="${folgaDoDia.tipo}">${sigla}</td>`;
            } else {
                const slot = escala.slots.find(s => s.date === date && s.assigned === func.id);
                if (slot) {
                    const turno = turnosMap[slot.turnoId];
                    tableHTML += `<td class="celula-turno" style="background-color:${turno.cor}" data-slot-id="${slot.id}">${turno.nome}</td>`;
                } else {
                    tableHTML += `<td></td>`;
                }
            }
        });
        tableHTML += `</tr>`;
    });
    
    tableHTML += `</tbody><tfoot>`;
    turnosDoCargo.forEach(turno => {
        tableHTML += `<tr><td><strong>Total ${turno.nome}</strong></td>`;
        dateRange.forEach(date => {
            const total = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).length;
            tableHTML += `<td>${total}</td>`;
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tfoot>`;

    container.innerHTML = tableHTML;
    
    $$('.celula-turno').forEach(cell => cell.onclick = () => showSwapModal(cell.dataset.slotId));
    
    const turnosVagos = escala.slots.filter(s => !s.assigned).length;
    $("#escalaResumo").innerHTML = `<strong>Resumo:</strong> ${turnosVagos > 0 ? `<span style="color:red;">${turnosVagos} turnos vagos.</span>` : 'Todos os turnos foram preenchidos.'}`;
    
    $("#gerador-container").classList.add('hidden');
    $("#escalaView").classList.remove('hidden');
    $("#escalaViewTitle").textContent = escala.nome;
    
    renderResumoDetalhado(escala);
}

function showSwapModal(slotId) {
    const { funcionarios, turnos } = store.getState();
    closeSwapModal();
    const slot = currentEscala.slots.find(s => s.id === slotId);
    if (!slot) return;

    const turno = turnos.find(t => t.id === slot.turnoId);
    const funcAtual = funcionarios.find(f => f.id === slot.assigned);
    const diaSemanaId = DIAS_SEMANA[new Date(slot.date + 'T12:00:00').getUTCDay()].id;

    const candidatos = funcionarios.filter(f => {
        if (!f || (funcAtual && f.id === funcAtual.id)) return false;
        if (f.cargoId !== currentEscala.cargoId) return false;
        
        const exce = currentEscala.excecoes[f.id];
        if (exce && (exce.ferias.dates.includes(slot.date) || exce.afastamento.dates.includes(slot.date) || exce.folgas.some(folga => folga.date === slot.date))) return false;
        if (!f.disponibilidade[turno.id]?.includes(diaSemanaId)) return false;
        if (currentEscala.slots.some(s => s.assigned === f.id && s.date === slot.date)) return false;

        return true;
    });

    const modal = document.createElement('div');
    modal.id = 'swapModal';
    modal.className = 'swap-modal-backdrop';
    let optionsHTML = candidatos.map(c => `<li><button data-swap-to="${c.id}">${c.nome}</button></li>`).join('');

    modal.innerHTML = `
        <div class="swap-modal-content">
            <h4>Trocar Turno</h4>
            <p><strong>Turno:</strong> ${turno.nome} em ${new Date(slot.date+'T12:00:00').toLocaleDateString()}</p>
            <p><strong>Atual:</strong> ${funcAtual ? funcAtual.nome : 'Vago'}</p>
            <hr>
            <p><strong>Trocar por:</strong></p>
            ${candidatos.length > 0 ? `<ul class="swap-list">${optionsHTML}</ul>` : '<p class="muted">Nenhum outro funcionário elegível.</p>'}
            <div class="swap-actions">
                <button class="danger" data-swap-to="null">Deixar Vago</button>
                <button class="secondary" onclick="closeSwapModal()">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    $$('#swapModal [data-swap-to]').forEach(btn => {
        btn.onclick = () => {
            const newFuncId = btn.dataset.swapTo === 'null' ? null : btn.dataset.swapTo;
            const oldFuncId = slot.assigned;

            // Recalcula o histórico de horas ao trocar
            if (oldFuncId !== newFuncId) {
                if (oldFuncId && currentEscala.historico[oldFuncId]) {
                    currentEscala.historico[oldFuncId].horasTrabalhadas -= turno.cargaMin;
                }
                if (newFuncId) {
                     if(!currentEscala.historico[newFuncId]) currentEscala.historico[newFuncId] = { horasTrabalhadas: 0 };
                    currentEscala.historico[newFuncId].horasTrabalhadas += turno.cargaMin;
                }
            }
            
            slot.assigned = newFuncId;
            renderEscalaTable(currentEscala);
            closeSwapModal();
        };
    });
}

function closeSwapModal() {
    const modal = $("#swapModal");
    if (modal) modal.remove();
}

async function salvarEscalaAtual(){
    if (currentEscala) {
        store.dispatch('SAVE_ESCALA', currentEscala);
        
        const confirmado = await showConfirm({
            title: "Escala Salva com Sucesso!",
            message: "O que você deseja fazer agora?",
            confirmText: "Ir para Escalas Salvas",
            cancelText: "Continuar Editando"
        });

        if (confirmado) {
            go('escalas-salvas');
        }
    }
}

function renderEscCargoSelect(){
  const { cargos } = store.getState();
  const sel = $("#escCargo");
  sel.innerHTML = "<option value=''>Selecione um cargo</option>";
  cargos.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.nome;
    sel.appendChild(opt);
  });
}

$("#btnSalvarEscala").onclick = salvarEscalaAtual;
$("#btnExcluirEscala").onclick = resetGeradorEscala;
setupWizard();