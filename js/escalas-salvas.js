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
        // Usa a função genérica para renderizar a tabela
        const container = $("#escalaSalvaTabelaWrap");
        renderGenericEscalaTable(escala, container, { isInteractive: false });

        // Renderiza a legenda para a escala salva
        renderEscalaLegend(escala, $("#escalaSalvaViewLegenda"));

        const turnosVagos = escala.slots.filter(s => !s.assigned).length;
        $("#escalaSalvaResumo").innerHTML = `<strong>Resumo:</strong> ${turnosVagos > 0 ? `<span style="color:red;">${turnosVagos} turnos vagos.</span>` : 'Todos os turnos foram preenchidos.'}`;
        $("#escalaSalvaViewTitle").textContent = escala.nome || 'Visualização da Escala';

        $('#lista-escalas-container').classList.add('hidden');
        $('#escalaSalvaView').classList.remove('hidden');
    }
}

async function excluirEscalaSalva(id){
  handleDeleteItem({
      id: id,
      itemName: 'Escala Salva',
      dispatchAction: 'DELETE_ESCALA_SALVA'
  });
}

// Lógica do botão de voltar
$("#btnVoltarParaLista").onclick = () => {
    $('#escalaSalvaView').classList.add('hidden');
    $('#lista-escalas-container').classList.remove('hidden');
};