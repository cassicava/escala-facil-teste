/**************************************
 * 📅 Lógica do Gerador de Escalas
 **************************************/

// ALTERAÇÃO: A função agora é assíncrona para não travar a interface.
async function gerarEscala() {
    // Mostra o loader antes de iniciar o processamento pesado
    showLoader("Analisando dados...");

    // Usamos um bloco try...finally para garantir que o loader seja escondido
    try {
        // Adiciona uma pequena pausa para garantir que o loader renderize antes do processamento pesado
        await new Promise(res => setTimeout(res, 50));

        const { cargos, funcionarios, turnos } = store.getState();
        const { cargoId, inicio, fim, cobertura, excecoes, maxDiasConsecutivos, minFolgasFimSemana, feriados, otimizarFolgas } = geradorState;

        const cargo = cargos.find(c => c.id === cargoId);
        if (!cargo) {
            showToast("Erro: O cargo selecionado para a escala não foi encontrado. Por favor, reinicie.");
            hideLoader(); // Garante que o loader feche em caso de erro
            return;
        }

        const funcs = funcionarios.filter(f => f.cargoId === cargoId);
        const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
        
        const excecoesMap = {};
        funcs.forEach(f => {
            const funcExcecoes = excecoes[f.id];
            const datasInvalidas = new Set([
                ...funcExcecoes.ferias.dates,
                ...funcExcecoes.afastamento.dates,
                ...funcExcecoes.folgas.map(folga => folga.date)
            ]);
            
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
            historico[f.id] = { horasTrabalhadas: 0, ultimoTurnoFim: null, diasTrabalhadosConsecutivos: 0 };
            finsDeSemanaTrabalhados[f.id] = new Set();
        });

        const dateRange = dateRangeInclusive(inicio, fim);
        
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
        
        function getDiasConsecutivos(funcId, date, assignedSlots) {
            let diasSeguidos = 0;
            for (let i = 1; i <= maxDiasConsecutivos; i++) {
                const checkDate = addDays(date, -i);
                if (assignedSlots.some(s => s.date === checkDate && s.assigned === funcId)) {
                    diasSeguidos++;
                } else {
                    break;
                }
            }
            return diasSeguidos;
        }
        
        // ALTERAÇÃO: A função de preenchimento agora também é assíncrona
        async function tentarPreencher(slotsParaTentar, usarHoraExtra = false) {
            for (const slot of slotsParaTentar) {
                if (slot.assigned) continue;
                
                // ALTERAÇÃO: Libera o processamento para a interface a cada slot, evitando travamentos.
                await new Promise(res => setTimeout(res, 0)); 
                
                const turno = turnosMap[slot.turnoId];
                const diaSemanaId = DIAS_SEMANA[new Date(slot.date + 'T12:00:00').getUTCDay()].id;

                const candidatos = funcs
                    .map(f => {
                        if (excecoesMap[f.id].has(slot.date)) return null; 
                        if (!f.disponibilidade[turno.id]?.includes(diaSemanaId)) return null;
                        if (slots.some(s => s.assigned === f.id && s.date === slot.date)) return null;
                        
                        const diasConsecutivos = getDiasConsecutivos(f.id, slot.date, slots);
                        if (diasConsecutivos >= maxDiasConsecutivos) return null;

                        const ultimoFim = historico[f.id].ultimoTurnoFim;
                        if (f.tipoContrato === 'clt' && ultimoFim) {
                            const descansoMin = (turnosMap[ultimoFim.turnoId]?.descansoObrigatorioHoras || 0) * 60;
                            const proximoInicio = new Date(`${slot.date}T${turno.inicio}`);
                            const diffMin = (proximoInicio - ultimoFim.data) / (1000 * 60);
                            if (diffMin < descansoMin) return null;
                        }

                        const maxHoras = f.periodoHoras === 'semanal' ? f.cargaHoraria * (dateRange.length / 7) : f.cargaHoraria;
                        if (!usarHoraExtra && (historico[f.id].horasTrabalhadas / 60) >= maxHoras) return null;
                        if (usarHoraExtra && !f.fazHoraExtra) return null;

                        const d = new Date(slot.date + 'T12:00:00');
                        if (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
                            const fdsTrabalhados = finsDeSemanaTrabalhados[f.id].size;
                            if ((totalFinsDeSemanaNoPeriodo.size - fdsTrabalhados) < minFolgasFdsExigidas) {
                                return null;
                            }
                        }

                        let score = 0;
                        score += (historico[f.id].horasTrabalhadas / 60) / maxHoras * 100;
                        score += (diasConsecutivos / maxDiasConsecutivos) * 50;
                        if(otimizarFolgas && diasConsecutivos > 0) {
                            score += 25;
                        }

                        return { func: f, score };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.score - b.score);

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

        currentEscala = { id: uid(), nome: nomeEscala, cargoId, inicio, fim, slots, historico, excecoes: JSON.parse(JSON.stringify(excecoes)), feriados: [...geradorState.feriados] };
        
        showLoader("Renderizando visualização...");
        await new Promise(res => setTimeout(res, 20)); // Pausa para renderizar
        renderEscalaTable(currentEscala);

    } catch (error) {
        console.error("Ocorreu um erro ao gerar a escala:", error);
        showToast("Ocorreu um erro inesperado. Verifique os dados e tente novamente.");
    } finally {
        hideLoader();
    }
}