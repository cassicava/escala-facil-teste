/**************************************
 * 🗂️ Escalas Salvas
 **************************************/

function renderEscalasList(){
  const { escalas } = store.getState();
  const ul = $("#listaEscalas");
  ul.innerHTML = "";

  if(escalas.length === 0) {
    ul.innerHTML = `<div class="empty-state" style="padding: 24px;">
        <div class="empty-state-icon">🗂️</div>
        <h3>Nenhuma Escala Salva</h3>
        <p>As escalas que você gerar e salvar aparecerão aqui para consulta futura.</p>
    </div>`;
    return;
  }
  
  const escalasOrdenadas = [...escalas].sort((a,b) => b.inicio.localeCompare(a.inicio));

  escalasOrdenadas.forEach(esc => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${esc.nome || 'Escala Salva'}</strong>
        <br>
        <small class="muted">${new Date(esc.inicio+'T12:00:00').toLocaleDateString()} a ${new Date(esc.fim+'T12:00:00').toLocaleDateString()}</small>
      </div>
      <div>
        <button class="secondary" data-view="${esc.id}">Ver</button>
        <button class="danger" data-del="${esc.id}">Excluir</button>
      </div>
    `;
    ul.appendChild(li);
  });

  $$('#listaEscalas [data-del]').forEach(b => b.onclick = () => excluirEscalaSalva(b.dataset.del));
  $$('#listaEscalas [data-view]').forEach(b => b.onclick = () => verEscalaSalva(b.dataset.view));
}

function verEscalaSalva(id) {
    const { escalas } = store.getState();
    const escala = escalas.find(e => e.id === id);
    if(escala) {
        renderEscalaSalvaTable(escala);
        $('#lista-escalas-container').classList.add('hidden');
        $('#escalaSalvaView').classList.remove('hidden');
    }
}

async function excluirEscalaSalva(id){
  const confirmado = await showConfirm({ title: "Excluir Escala Salva?", message: "Tem certeza que deseja excluir esta escala permanentemente?" });
  if (confirmado) {
      store.dispatch('DELETE_ESCALA_SALVA', id);
      showToast("Escala excluída.");
  }
}

function renderEscalaSalvaTable(escala) {
    const { funcionarios, turnos } = store.getState();
    const container = $("#escalaSalvaTabelaWrap");

    const funcsDaEscala = [...new Set(escala.slots.map(s => s.assigned).filter(Boolean))]
        .map(funcId => funcionarios.find(f => f.id === funcId))
        .filter(Boolean)
        .sort((a,b) => a.nome.localeCompare(b.nome));

    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));

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
            const slot = escala.slots.find(s => s.date === date && s.assigned === func.id);
            const excecoesFunc = escala.excecoes ? escala.excecoes[func.id] : null;

            if (slot) {
                const turno = turnosMap[slot.turnoId];
                tableHTML += `<td class="celula-turno-salva" style="background-color:${turno.cor}">${turno.nome}</td>`;
            } else if (excecoesFunc) {
                const folgaDoDia = excecoesFunc.folgas.find(f => f.date === date);
                if (excecoesFunc.ferias.dates.includes(date)) {
                    tableHTML += `<td class="celula-excecao">Férias</td>`;
                } else if (excecoesFunc.afastamento.dates.includes(date)) {
                    tableHTML += `<td class="celula-excecao" title="Motivo: ${excecoesFunc.afastamento.motivo || 'Não informado'}">Afastado</td>`;
                } else if (folgaDoDia) {
                    const sigla = TIPOS_FOLGA.find(tf => tf.nome === folgaDoDia.tipo)?.sigla || 'F';
                    tableHTML += `<td class="celula-excecao" data-tipo-folga="${folgaDoDia.tipo}" title="${folgaDoDia.tipo}">${sigla}</td>`;
                } else {
                    tableHTML += `<td></td>`;
                }
            } else {
                tableHTML += `<td></td>`;
            }
        });
        tableHTML += `</tr>`;
    });
    
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;

    const turnosVagos = escala.slots.filter(s => !s.assigned).length;
    $("#escalaSalvaResumo").innerHTML = `<strong>Resumo:</strong> ${turnosVagos > 0 ? `<span style="color:red;">${turnosVagos} turnos vagos.</span>` : 'Todos os turnos foram preenchidos.'}`;
    $("#escalaSalvaViewTitle").textContent = escala.nome || 'Visualização da Escala';
}

$("#btnVoltarParaLista").onclick = () => {
    $('#escalaSalvaView').classList.add('hidden');
    $('#lista-escalas-container').classList.remove('hidden');
};