/**************************************
 * 📅 Visualização da Escala
 **************************************/

function renderResumoDetalhado(escala) {
    const { funcionarios } = store.getState();
    const container = $("#escalaResumoDetalhado");
    if (!escala || !escala.historico) {
        container.innerHTML = "";
        return;
    }

    const funcsDaEscala = funcionarios.filter(f => escala.historico[f.id] && (escala.historico[f.id].horasTrabalhadas > 0 || escala.historico[f.id].horasTrabalhadas < 0))
                                      .sort((a,b) => a.nome.localeCompare(b.nome));
    
    let html = '<h4>Resumo de Horas no Período</h4>';
    funcsDaEscala.forEach(func => {
        const horasTrabalhadas = (escala.historico[func.id].horasTrabalhadas / 60);
        const horasContratadasBase = parseFloat(func.cargaHoraria) || 0;
        
        let metaHoras = 0;
        if(func.periodoHoras === 'semanal') {
            const periodoDias = dateRangeInclusive(escala.inicio, escala.fim).length;
            metaHoras = (horasContratadasBase / 7) * periodoDias;
        } else { // mensal - Cálculo Preciso
            const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
            const mesesNaEscala = {}; // Ex: { '2025-09': 15, '2025-10': 10 }
            
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
    const turnosDoCargo = turnos.filter(t => escala.slots.some(s => s.turnoId === t.id)).sort((a,b) => a.inicio.localeCompare(b.inicio));

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
    const { maxDiasConsecutivos } = geradorState;
    closeSwapModal();
    const slot = currentEscala.slots.find(s => s.id === slotId);
    if (!slot) return;

    const turno = turnos.find(t => t.id === slot.turnoId);
    const funcAtual = funcionarios.find(f => f.id === slot.assigned);
    const diaSemanaId = DIAS_SEMANA[new Date(slot.date + 'T12:00:00').getUTCDay()].id;

    // --- VALIDAÇÃO DE CANDIDATOS MELHORADA ---
    const candidatos = funcionarios.filter(f => {
        if (!f || (funcAtual && f.id === funcAtual.id)) return false;
        if (f.cargoId !== currentEscala.cargoId) return false;
        
        const exce = currentEscala.excecoes[f.id];
        if (exce && (exce.ferias.dates.includes(slot.date) || exce.afastamento.dates.includes(slot.date) || exce.folgas.some(folga => folga.date === slot.date))) return false;
        
        if (!f.disponibilidade[turno.id]?.includes(diaSemanaId)) return false;
        if (currentEscala.slots.some(s => s.assigned === f.id && s.date === slot.date)) return false;

        // Validar dias consecutivos
        let diasSeguidos = 0;
        for (let i = 1; i <= maxDiasConsecutivos; i++) {
            const checkDate = addDays(slot.date, -i);
            if (currentEscala.slots.some(s => s.date === checkDate && s.assigned === f.id)) {
                diasSeguidos++;
            } else break;
        }
        if (diasSeguidos >= maxDiasConsecutivos) return false;

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