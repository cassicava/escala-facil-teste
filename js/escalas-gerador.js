/**************************************
 * 📅 Lógica do Gerador de Escalas (v2 - Aprimorada)
 **************************************/

/**
 * NOVO: Função robusta para calcular a sequência de dias de trabalho.
 * Conta quantos dias consecutivos um funcionário trabalhou, terminando no dia anterior à data fornecida.
 * Leva em conta que descansos obrigatórios de turnos noturnos não quebram a sequência.
 * @returns {number} O número de dias na sequência.
 */
function getConsecutiveWorkDaysEndingBefore(funcId, date, assignedSlots, turnosMap) {
    const turnosDoFuncMap = new Map(
        assignedSlots.filter(s => s.assigned === funcId).map(s => [s.date, s])
    );

    let streak = 0;
    let currentDate = addDays(date, -1); // Começa a verificar a partir do dia anterior

    while (true) {
        if (turnosDoFuncMap.has(currentDate)) {
            streak++;
        } else {
            // Se o dia está vazio, verifica se foi um descanso obrigatório de turno noturno
            const previousDay = addDays(currentDate, -1);
            const previousShiftSlot = turnosDoFuncMap.get(previousDay);

            if (previousShiftSlot) {
                const turnoInfo = turnosMap[previousShiftSlot.turnoId];
                if (turnoInfo && turnoInfo.fim < turnoInfo.inicio) {
                    // Sim, era um turno noturno. A sequência não é quebrada.
                    // Não incrementa a sequência, mas continua verificando para trás.
                } else {
                    // Era um turno diurno, então esta é uma folga real. Quebra a sequência.
                    break;
                }
            } else {
                // Dois dias vazios seguidos. Definitivamente uma folga. Quebra a sequência.
                break;
            }
        }
        currentDate = addDays(currentDate, -1); // Continua para o dia anterior
    }
    return streak;
}


async function gerarEscala() {
    showLoader("Analisando dados...");
    await new Promise(res => setTimeout(res, 50));

    try {
        const { cargos, funcionarios, turnos } = store.getState();
        const { cargoId, inicio, fim, cobertura, excecoes, maxDiasConsecutivos, minFolgasFimSemana, feriados, otimizarFolgas } = geradorState;

        const cargo = cargos.find(c => c.id === cargoId);
        if (!cargo) {
            showToast("Erro: O cargo selecionado para a escala não foi encontrado. Por favor, reinicie.");
            hideLoader();
            return;
        }

        const funcs = funcionarios.filter(f => f.cargoId === cargoId);
        const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));

        const excecoesMap = {};
        funcs.forEach(f => {
            const funcExcecoes = excecoes[f.id];
            const datasInvalidas = new Set([...funcExcecoes.ferias.dates, ...funcExcecoes.afastamento.dates, ...funcExcecoes.folgas.map(folga => folga.date)]);
            const adicionarCarencia = (excecao) => {
                if (excecao.dates.length > 0) {
                    const ultimaData = excecao.dates[excecao.dates.length - 1];
                    for (let i = 1; i <= (excecao.carência || 0); i++) {
                        datasInvalidas.add(addDays(ultimaData, i));
                    }
                }
            };
            adicionarCarencia(funcExcecoes.ferias);
            adicionarCarencia(funcExcecoes.afastamento);
            excecoesMap[f.id] = datasInvalidas;
        });

        let historico = {};
        let finsDeSemanaTrabalhados = {};
        funcs.forEach(f => {
            historico[f.id] = { horasTrabalhadas: 0, ultimoTurnoFim: null };
            finsDeSemanaTrabalhados[f.id] = new Set();
        });

        const dateRange = dateRangeInclusive(inicio, fim);

        const metaHorasMap = new Map();
        funcs.forEach(f => {
            const horasContratadasBase = parseFloat(f.cargaHoraria) || 0;
            if (f.periodoHoras === 'semanal') {
                metaHorasMap.set(f.id, horasContratadasBase * (dateRange.length / 7));
            } else { // Mensal
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
                metaHorasMap.set(f.id, metaHoras);
            }
        });


        const totalFinsDeSemanaNoPeriodo = new Set();
        const mesesNoPeriodo = new Set();
        dateRange.forEach(date => {
            const d = new Date(date + 'T12:00:00');
            mesesNoPeriodo.add(date.substring(0, 7));
            if (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
                const semanaId = getWeekNumber(d);
                const mesAno = d.toISOString().substring(0, 7);
                totalFinsDeSemanaNoPeriodo.add(`${mesAno}-${semanaId}`);
            }
        });

        const totalMesesExatos = mesesNoPeriodo.size;
        const minFolgasFdsExigidas = Math.floor(minFolgasFimSemana * totalMesesExatos);

        let slots = [];
        dateRange.forEach(date => {
            const diaSemana = new Date(date + 'T12:00:00');
            const diaSemanaId = DIAS_SEMANA[diaSemana.getUTCDay()].id;
            const feriado = feriados.find(f => f.date === date);
            if (feriado && !feriado.trabalha) return;
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

        async function tentarPreencher(slotsParaTentar, usarHoraExtra = false) {
            for (const slot of slotsParaTentar) {
                if (slot.assigned) continue;
                await new Promise(res => setTimeout(res, 0));

                const turno = turnosMap[slot.turnoId];
                const diaSemanaId = DIAS_SEMANA[new Date(slot.date + 'T12:00:00').getUTCDay()].id;

                const candidatos = funcs.map(f => {
                    if (excecoesMap[f.id].has(slot.date)) return null;
                    if (!f.disponibilidade[turno.id]?.includes(diaSemanaId)) return null;
                    if (slots.some(s => s.assigned === f.id && s.date === slot.date)) return null;
                    
                    // CORREÇÃO: Utiliza a nova função para verificar a sequência de trabalho
                    const diasConsecutivosAnteriores = getConsecutiveWorkDaysEndingBefore(f.id, slot.date, slots, turnosMap);
                    if ((diasConsecutivosAnteriores + 1) > maxDiasConsecutivos) {
                        return null;
                    }
                    
                    const ultimoFim = historico[f.id].ultimoTurnoFim;
                    if (f.tipoContrato === 'clt' && ultimoFim) {
                        const descansoMin = (turnosMap[ultimoFim.turnoId]?.descansoObrigatorioHoras || 0) * 60;
                        const proximoInicio = new Date(`${slot.date}T${turno.inicio}`);
                        const diffMin = (proximoInicio - ultimoFim.data) / (1000 * 60);
                        if (diffMin < descansoMin) return null;
                    }

                    const maxHoras = metaHorasMap.get(f.id) || 0;
                    if (!usarHoraExtra && (historico[f.id].horasTrabalhadas / 60) >= maxHoras) return null;
                    if (usarHoraExtra && !f.fazHoraExtra) return null;

                    const d = new Date(slot.date + 'T12:00:00');
                    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
                        const fdsTrabalhados = finsDeSemanaTrabalhados[f.id].size;
                        if ((totalFinsDeSemanaNoPeriodo.size - fdsTrabalhados) < minFolgasFdsExigidas) return null;
                    }

                    // --- SCORING APRIMORADO ---
                    // 1. Prioridade base: preencher a carga horária
                    let score = (historico[f.id].horasTrabalhadas / 60) / (maxHoras || 1) * 100;
                    
                    // 2. Penalidade por dias consecutivos (incentiva folgas)
                    score += (diasConsecutivosAnteriores / maxDiasConsecutivos) * 25;
                    
                    // 3. MELHORIA: Penalidade por trabalhar em fins de semana (incentiva distribuição justa)
                    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
                        score += finsDeSemanaTrabalhados[f.id].size * 20;
                    }
                    
                    if (otimizarFolgas && diasConsecutivosAnteriores > 0) score += 15;

                    return { func: f, score };
                }).filter(Boolean).sort((a, b) => a.score - b.score);

                if (candidatos.length > 0) {
                    const escolhido = candidatos[0].func;
                    slot.assigned = escolhido.id;
                    historico[escolhido.id].horasTrabalhadas += turno.cargaMin;
                    let dataFimTurno = new Date(`${slot.date}T${turno.fim}`);
                    if (turno.fim < turno.inicio) dataFimTurno.setUTCDate(dataFimTurno.getUTCDate() + 1);
                    historico[escolhido.id].ultimoTurnoFim = { data: dataFimTurno, turnoId: turno.id };
                    const diaSemana = new Date(slot.date + 'T12:00:00');
                    if (diaSemana.getUTCDay() === 0 || diaSemana.getUTCDay() === 6) {
                        const semanaId = getWeekNumber(diaSemana);
                        const mesAno = diaSemana.toISOString().substring(0, 7);
                        finsDeSemanaTrabalhados[escolhido.id].add(`${mesAno}-${semanaId}`);
                    }
                }
            }
        }

        showLoader("Preenchendo turnos...");
        await tentarPreencher(slots.filter(s => !s.assigned), false);
        showLoader("Otimizando com horas extras...");
        await tentarPreencher(slots.filter(s => !s.assigned), true);

        showLoader("Ajustando feriados...");
        feriados.filter(f => f.descontaHoras).forEach(feriado => {
            const funcsNaoTrabalharamNoFeriado = funcs.filter(f => !slots.some(s => s.date === feriado.date && s.assigned === f.id));
            funcsNaoTrabalharamNoFeriado.forEach(f => {
                if (historico[f.id]) {
                    historico[f.id].horasTrabalhadas -= (feriado.horasDesconto * 60);
                }
            });
        });

        const cargoNome = cargos.find(c => c.id === cargoId)?.nome || 'Cargo';
        const nomeEscala = `Escala: ${cargoNome} (${new Date(inicio+'T12:00:00').toLocaleDateString()} a ${new Date(fim+'T12:00:00').toLocaleDateString()})`;

        currentEscala = { id: uid(), nome: nomeEscala, cargoId, inicio, fim, slots, historico, excecoes: JSON.parse(JSON.stringify(excecoes)), feriados: [...geradorState.feriados], cobertura };

        showLoader("Renderizando visualização...");
        await new Promise(res => setTimeout(res, 20));
        renderEscalaTable(currentEscala);
        
        if (typeof initEditor === 'function') {
            initEditor();
        }

    } catch (error) {
        console.error("Ocorreu um erro ao gerar a escala:", error);
        showToast("Ocorreu um erro inesperado. Verifique os dados e tente novamente.");
    } finally {
        hideLoader();
    }
}