/**************************************
 * 📅 Escalas
 **************************************/
let ESCALAS = loadJSON(KEYS.escalas, []);
let currentEscala = null; // Objeto da escala sendo visualizada/editada

function renderEscalasList(){
  const ul = $("#listaEscalas");
  ul.innerHTML = "";
  if(ESCALAS.length === 0) {
    ul.innerHTML = `<li class="muted">Nenhuma escala salva.</li>`;
    return;
  }
  ESCALAS.forEach(esc => {
    const li = document.createElement("li");
    const cargo = CARGOS.find(c => c.id === esc.cargoId);
    li.innerHTML = `
      <div>
        <strong>${cargo ? cargo.nome : 'Cargo não encontrado'}</strong>
        <br>
        <small class="muted">${esc.inicio} a ${esc.fim}</small>
      </div>
      <div>
        <button class="secondary" data-view="${esc.id}">Ver</button>
        <button class="danger" data-del="${esc.id}">Excluir</button>
      </div>
    `;
    ul.appendChild(li);
  });

  $$('#listaEscalas [data-del]').forEach(b => b.onclick = () => excluirEscala(b.dataset.del));
  // Adicionar lógica para o botão "Ver"
}

function renderEscCargoSelect(){
  const sel = $("#escCargo");
  sel.innerHTML = "<option value=''>Selecione um cargo</option>";
  CARGOS.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.nome;
    sel.appendChild(opt);
  });
}

function gerarEscala(){
    // Esta é a função principal que precisa da sua lógica de negócio.
    // Como exemplo simples, vamos apenas criar a estrutura.

    const cargoId = $("#escCargo").value;
    const inicio = $("#escIni").value;
    const fim = $("#escFim").value;

    if (!cargoId || !inicio || !fim) {
        alert("Selecione o cargo e o período para gerar a escala.");
        return;
    }

    const funcionariosDoCargo = FUNCS.filter(f => f.cargoId === cargoId);
    if (funcionariosDoCargo.length === 0) {
        alert("Não há funcionários cadastrados para este cargo.");
        return;
    }

    // Lógica de distribuição de turnos (aqui entra a sua regra de negócio)
    // Ex: Rodízio simples, considerar folgas, etc.
    alert(`Gerando escala para ${funcionariosDoCargo.length} funcionário(s) de ${inicio} a ${fim}.\n\n(Implemente aqui sua lógica de distribuição de turnos)`);

    // A partir daqui, você montaria a estrutura de dados da escala
    // e a renderizaria na tela.
}


function salvarEscala(){
  // Lógica para salvar a 'currentEscala' no array 'ESCALAS'
  // e depois no localStorage.
  alert("Funcionalidade de salvar escala a ser implementada.");
}

function excluirEscala(id){
  if (!confirm("Tem certeza que deseja excluir esta escala?")) return;
  ESCALAS = ESCALAS.filter(e => e.id !== id);
  saveJSON(KEYS.escalas, ESCALAS);
  renderEscalasList();
  $("#escalaView").classList.add('hidden'); // Esconde a visualização se a escala atual for excluída
}

// Eventos do Wizard
$$(".wizard-step .next").forEach(btn => {
  btn.onclick = () => {
    const nextStep = btn.dataset.next;
    $(`#${btn.closest(".wizard-step").id}`).classList.remove('active');
    $(`#${nextStep}`).classList.add('active');
  }
});
$$(".wizard-step .prev").forEach(btn => {
  btn.onclick = () => {
    const prevStep = btn.dataset.prev;
    $(`#${btn.closest(".wizard-step").id}`).classList.remove('active');
    $(`#${prevStep}`).classList.add('active');
  }
});

$("#btnGerarEscala").onclick = gerarEscala;