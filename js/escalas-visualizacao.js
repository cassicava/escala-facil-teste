/**************************************
 * 📅 Visualização da Escala
 **************************************/

function renderEscalaLegend(escala, container) {
    const { turnos } = store.getState();
    if (!container) return;
    container.innerHTML = '';
    const turnosNaEscalaIds = [...new Set(escala.slots.map(s => s.turnoId))];
    const turnosNaEscala = turnos.filter(t => turnosNaEscalaIds.includes(t.id)).sort((a, b) => a.inicio.localeCompare(b.inicio));
    if (turnosNaEscala.length === 0 && escala.feriados.length === 0) return;

    const legendaItems = [];

    turnosNaEscala.forEach(turno => {
        legendaItems.push(`<div class="legenda-item"><span class="color-dot" style="background-color: ${turno.cor}"></span><strong>${turno.sigla}</strong> - ${turno.nome}</div>`);
    });

    if(escala.feriados.some(f => f.trabalha)) {
         legendaItems.push(`<div class="legenda-item"><span class="color-dot" style="background-color: #dbeafe"></span> Dia de Feriado</div>`);
    }

    if (legendaItems.length > 0) {
        container.innerHTML = `<h4 style="width: 100%; margin-bottom: 0;">Legenda:</h4>` + legendaItems.join('');
    }
}

function renderGenericEscalaTable(escala, container, options = {}) {
    const { isInteractive = false } = options;
    const { funcionarios, turnos } = store.getState();

    const cobertura = escala.cobertura || {};

    const allFuncsInvolved = new Set();
    escala.slots.forEach(s => { if(s.assigned) allFuncsInvolved.add(s.assigned) });
    Object.keys(escala.excecoes).forEach(funcId => allFuncsInvolved.add(funcId));

    const funcsDaEscala = [...allFuncsInvolved].map(funcId => funcionarios.find(f => f.id === funcId)).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome));

    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    const turnosDoCargo = turnos.filter(t => cobertura[t.id]).sort((a, b) => a.inicio.localeCompare(b.inicio));

    let tableHTML = `<table class="escala-final-table"><thead><tr><th>Funcionário</th>`;
    dateRange.forEach(date => {
        const d = new Date(date + 'T12:00:00');
        const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
        const dia = d.getDate();
        const feriado = escala.feriados.find(f => f.date === date);
        const isFeriado = feriado && feriado.trabalha ? 'feriado' : '';
        const isWeekend = (d.getUTCDay() === 0 || d.getUTCDay() === 6) ? 'weekend' : '';
        tableHTML += `<th class="${isFeriado} ${isWeekend}" title="${feriado ? feriado.nome : ''}">${dia}<br>${diaSemana}</th>`;
    });
    tableHTML += `</tr></thead><tbody>`;

    funcsDaEscala.forEach(func => {
        const nomeHtml = `
            <td>
                ${func.nome}
                <br>
                <small class="muted">${func.documento || '---'}</small>
            </td>
        `;
        tableHTML += `<tr data-employee-row-id="${func.id}">${nomeHtml}`;
        dateRange.forEach(date => {
            const dataAttrs = isInteractive ? `data-date="${date}" data-employee-id="${func.id}"` : '';
            const cellClass = isInteractive ? 'editable-cell' : '';
            const excecoesFunc = escala.excecoes ? escala.excecoes[func.id] : null;
            const folgaDoDia = excecoesFunc?.folgas.find(f => f.date === date);
            const slot = escala.slots.find(s => s.date === date && s.assigned === func.id);

            if (slot) {
                const turno = turnosMap[slot.turnoId];
                const slotAttr = isInteractive ? `data-slot-id="${slot.id}"` : '';
                tableHTML += `<td class="${cellClass}" style="background-color:${turno.cor}" ${dataAttrs} ${slotAttr} title="${turno.nome}">${turno.sigla}</td>`;
            } else if (folgaDoDia) {
                const sigla = TIPOS_FOLGA.find(tf => tf.nome === folgaDoDia.tipo)?.sigla || 'F';
                tableHTML += `<td class="${isInteractive ? '' : 'celula-turno-salva'}"><span class="celula-excecao" data-tipo-folga="${folgaDoDia.tipo}" title="${folgaDoDia.tipo}">${sigla}</span></td>`;
            } else {
                 tableHTML += `<td class="${cellClass}" ${dataAttrs}></td>`;
            }
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody>`;

    if (isInteractive) {
        tableHTML += `<tfoot>`;
        turnosDoCargo.forEach(turno => {
            tableHTML += `<tr class="total-row"><td><strong>Total ${turno.sigla}</strong></td>`;
            dateRange.forEach(date => {
                const total = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).length;
                tableHTML += `<td>${total}</td>`;
            });
            tableHTML += `</tr>`;
        });
        turnosDoCargo.forEach(turno => {
            let hasVagas = false;
            let rowVagasHTML = `<tr class="vagas-row"><td><strong>Vagas ${turno.sigla}</strong></td>`;
            dateRange.forEach(date => {
                const coberturaNecessaria = cobertura[turno.id] || 0;
                const coberturaAtual = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).length;
                if (coberturaAtual < coberturaNecessaria) {
                    hasVagas = true;
                    const vagaSlot = escala.slots.find(s => s.date === date && s.turnoId === turno.id && !s.assigned);
                    if (vagaSlot) {
                        rowVagasHTML += `<td><button class="btn-add-vaga editable-cell" data-slot-id="${vagaSlot.id}" data-date="${vagaSlot.date}" data-employee-id="null" title="Adicionar funcionário">+</button></td>`;
                    } else {
                        rowVagasHTML += `<td></td>`;
                    }
                } else {
                    rowVagasHTML += `<td></td>`;
                }
            });
            rowVagasHTML += `</tr>`;
            if (hasVagas) tableHTML += rowVagasHTML;
        });
        tableHTML += `</tfoot>`;
    }
    container.innerHTML = tableHTML;
}


function renderResumoDetalhado(escala) {
    const { funcionarios } = store.getState();
    const container = $("#escalaResumoDetalhado");
    if (!escala || !escala.historico) {
        container.innerHTML = "";
        return;
    }
    const funcsDaEscala = funcionarios.filter(f => escala.historico[f.id]).sort((a,b) => a.nome.localeCompare(b.nome));
    if(funcsDaEscala.length === 0) {
        container.innerHTML = "";
        return;
    }

    let html = '<h4>Resumo de Horas no Período</h4>';
    funcsDaEscala.forEach(func => {
        const horasTrabalhadas = (escala.historico[func.id].horasTrabalhadas / 60);
        const horasContratadasBase = parseFloat(func.cargaHoraria) || 0;
        let metaHoras = 0;
        const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
        if (func.periodoHoras === 'semanal') {
            metaHoras = (horasContratadasBase / 7) * dateRange.length;
        } else { // Mensal
            const mesesNaEscala = {};
            dateRange.forEach(d => {
                const mesAno = d.slice(0, 7);
                mesesNaEscala[mesAno] = (mesesNaEscala[mesAno] || 0) + 1;
            });
            for (const mesAno in mesesNaEscala) {
                const [ano, mes] = mesAno.split('-').map(Number);
                const diasNoMes = new Date(ano, mes, 0).getDate();
                const diasDaEscalaNesseMes = mesesNaEscala[mesAno];
                metaHoras += (horasContratadasBase / diasNoMes) * diasDaEscalaNesseMes;
            }
        }
        let extraInfo = '';
        if (horasTrabalhadas > metaHoras) {
            const horasExtras = horasTrabalhadas - metaHoras;
            extraInfo = `<span style="color:var(--danger); font-weight:bold;"> (+${horasExtras.toFixed(2)}h extra)</span>`;
        } else if (horasTrabalhadas < metaHoras) {
            const horasFaltantes = metaHoras - horasTrabalhadas;
            extraInfo = `<span style="color:var(--brand); font-weight:bold;"> (-${horasFaltantes.toFixed(2)}h)</span>`;
        }
        
        const flashClass = func.id === lastEditedEmployeeId ? 'flash-update' : '';
        html += `<div class="resumo-detalhado-item ${flashClass}"><strong>${func.nome}:</strong> ${horasTrabalhadas.toFixed(2)}h / ${metaHoras.toFixed(2)}h${extraInfo}</div>`;
    });
    container.innerHTML = html;
    
    lastEditedEmployeeId = null;
}

function renderEscalaTable(escala) {
    currentEscala = escala;
    const container = $("#escalaTabelaWrap");
    
    renderGenericEscalaTable(escala, container, { isInteractive: true });
    renderEscalaLegend(escala, $("#escalaViewLegenda"));
    const turnosVagos = escala.slots.filter(s => !s.assigned).length;
    $("#escalaResumo").innerHTML = `<strong>Resumo:</strong> ${turnosVagos > 0 ? `<span style="color:red;">${turnosVagos} turnos vagos.</span>` : 'Todos os turnos foram preenchidos.'}`;
    
    $("#gerador-container").classList.add('hidden');
    $("#escalaView").classList.remove('hidden');
    $("#escalaViewTitle").textContent = escala.nome;
    
    renderResumoDetalhado(escala);
}

async function salvarEscalaAtual(){
    if (currentEscala) {
        store.dispatch('SAVE_ESCALA', currentEscala);
        showToast("Alterações salvas com sucesso!");
    }
}