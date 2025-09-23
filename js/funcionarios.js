/**************************************
 * 👤 Funcionários
 **************************************/

let editingFuncId=null;
let lastAddedFuncId = null;
let funcDisponibilidadeTemporaria = {}; // Objeto para manipular a disponibilidade no formulário

const SEM_CARGO_DEFINIDO = "Sem Cargo Definido";

// --- Lógicas dos Toggles ---
$$('#contratoToggleGroup .toggle-btn').forEach(button => {
    button.onclick = () => {
        $$('#contratoToggleGroup .toggle-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        $("#funcContrato").value = button.dataset.value;
        $("#contratoExplicacao").innerHTML = button.dataset.value === 'clt' 
            ? 'Funcionários <strong>CLT / Concursados</strong> seguirão rigorosamente as regras de descanso obrigatório cadastradas nos turnos.'
            : 'Funcionários <strong>Prestadores de Serviço</strong> terão as regras de descanso obrigatório ignoradas, permitindo maior flexibilidade.';
    };
});

$$('#periodoHorasToggleGroup .toggle-btn').forEach(button => {
    button.onclick = () => {
        $$('#periodoHorasToggleGroup .toggle-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        $("#funcPeriodoHoras").value = button.dataset.value;
    };
});

$$('#horaExtraToggleGroup .toggle-btn').forEach(button => {
    button.onclick = () => {
        $$('#horaExtraToggleGroup .toggle-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        $("#funcHoraExtra").value = button.dataset.value;
    };
});

// --- Lógica de Renderização e Interação da Disponibilidade ---

function renderFuncTurnosForCargo() {
    const { cargos, turnos } = store.getState();
    const cargoId = $("#funcCargo").value;
    const container = $("#funcTurnosContainer");
    container.innerHTML = `<div class="turno-placeholder"><p>Selecione um cargo para ver os turnos disponíveis.</p></div>`;
    const placeholder = $(".turno-placeholder", container);

    if (!cargoId) {
        placeholder.style.display = 'block';
        return;
    }
    
    const cargo = cargos.find(c => c.id === cargoId);
    if (!cargo || !cargo.turnosIds || cargo.turnosIds.length === 0) {
        placeholder.style.display = 'block';
        placeholder.querySelector('p').textContent = 'Nenhum turno associado a este cargo.';
        return;
    }

    placeholder.style.display = 'none'; 

    const turnosDoCargo = turnos.filter(t => cargo.turnosIds.includes(t.id))
                                .sort((a, b) => a.nome.localeCompare(b.nome));

    // Usa a constante global DIAS_SEMANA
    const diasParaRender = DIAS_SEMANA.filter(d => d.id !== 'dom').concat(DIAS_SEMANA.filter(d => d.id === 'dom')); // Move Dom para o final

    turnosDoCargo.forEach(t => {
        const isTurnoSelecionado = !!funcDisponibilidadeTemporaria[t.id]; 
        
        const item = document.createElement('div');
        item.className = 'turno-disponibilidade-item';
        item.dataset.turnoId = t.id;
        item.classList.toggle('selecionado', isTurnoSelecionado); 

        const diasHtml = diasParaRender.map(d => {
            const isDiaSelecionado = isTurnoSelecionado && (funcDisponibilidadeTemporaria[t.id] || []).includes(d.id);
            return `
                <span class="dia-selecionavel ${isDiaSelecionado ? 'selecionado-dia' : ''}" data-dia-id="${d.id}" title="${d.nome}">
                    ${d.abrev}
                </span>
            `;
        }).join('');

        item.innerHTML = `
            <div class="turno-disponibilidade-header">
                <input type="checkbox" name="turnoPrincipal" value="${t.id}" ${isTurnoSelecionado ? 'checked' : ''}>
                <span class="color-dot" style="background-color: ${t.cor || '#e2e8f0'}"></span>
                <div class="turno-info">
                    <strong>${t.nome}</strong> (${t.inicio}-${t.fim})
                </div>
            </div>
            <div class="turno-disponibilidade-dias">
                ${diasHtml}
            </div>
        `;
        container.appendChild(item);

        const header = item.querySelector('.turno-disponibilidade-header');
        const chkPrincipal = header.querySelector('input[name="turnoPrincipal"]');
        const diasContainer = item.querySelector('.turno-disponibilidade-dias');
        const spansDias = $$('.dia-selecionavel', diasContainer);

        header.onclick = (e) => {
            if (e.target.tagName !== 'INPUT') { 
                chkPrincipal.checked = !chkPrincipal.checked;
                chkPrincipal.dispatchEvent(new Event('change'));
            }
        };

        chkPrincipal.onchange = () => {
            const isChecked = chkPrincipal.checked;
            item.classList.toggle('selecionado', isChecked); 

            if (isChecked) {
                if (!funcDisponibilidadeTemporaria[t.id] || funcDisponibilidadeTemporaria[t.id].length === 0) {
                    funcDisponibilidadeTemporaria[t.id] = diasParaRender.map(d => d.id);
                }
                spansDias.forEach(spanDia => {
                    const diaId = spanDia.dataset.diaId;
                    spanDia.classList.toggle('selecionado-dia', (funcDisponibilidadeTemporaria[t.id] || []).includes(diaId));
                });
            } else {
                delete funcDisponibilidadeTemporaria[t.id];
                spansDias.forEach(spanDia => spanDia.classList.remove('selecionado-dia'));
            }
        };

        spansDias.forEach(spanDia => {
            spanDia.onclick = () => {
                if (chkPrincipal.checked) {
                    const diaId = spanDia.dataset.diaId;
                    let diasDoTurno = funcDisponibilidadeTemporaria[t.id] || [];
                    spanDia.classList.toggle('selecionado-dia');

                    if (spanDia.classList.contains('selecionado-dia')) {
                        if (!diasDoTurno.includes(diaId)) diasDoTurno.push(diaId);
                    } else {
                        const index = diasDoTurno.indexOf(diaId);
                        if (index > -1) diasDoTurno.splice(index, 1);
                    }
                    funcDisponibilidadeTemporaria[t.id] = diasDoTurno;
                }
            };
        });
    });
}


// --- RESTANTE DO ARQUIVO JS (save, edit, delete, etc.) ---

$("#funcNome").addEventListener("input", (e) => {
    const input = e.target;
    if (input.value.length > 0) {
      input.value = input.value.charAt(0).toUpperCase() + input.value.slice(1);
    }
    validateInput(input);
});
$("#funcCargaHoraria").addEventListener("input", (e) => { validateInput(e.target); });
$("#funcCargo").addEventListener("change", (e) => {
    validateInput(e.target);
    funcDisponibilidadeTemporaria = {};
    renderFuncTurnosForCargo();
});

function validateInput(inputElement) {
    if (inputElement.value.trim() !== '') {
        inputElement.classList.remove('invalid');
    } else {
        inputElement.classList.add('invalid');
    }
}
$("#filtroFuncionarios").addEventListener("input", () => { renderFuncs(); });

function renderFuncCargoSelect(){
  const { cargos } = store.getState();
  const sel=$("#funcCargo");
  sel.innerHTML="<option value=''>Selecione um cargo</option>";
  const cargosOrdenados = [...cargos].sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  cargosOrdenados.forEach(c=>{
    const o=document.createElement("option");
    o.value=c.id;
    o.textContent=c.nome;
    sel.appendChild(o);
  });
}

function renderFuncs(){
  const { funcionarios, cargos, turnos } = store.getState();
  const filtro = $("#filtroFuncionarios").value.toLowerCase();

  const tbody = $("#tblFuncionarios tbody");
  tbody.innerHTML = "";
  
  const funcsFiltrados = funcionarios.filter(f => f.nome.toLowerCase().includes(filtro));
  const colspan = 7;

  if (funcsFiltrados.length === 0) {
    tbody.innerHTML = funcionarios.length === 0 
        ? `<tr><td colspan="${colspan}"><div class="empty-state"><div class="empty-state-icon">👤</div><h3>Nenhum Funcionário Cadastrado</h3><p>Comece a cadastrar funcionários para poder gerar escalas.</p></div></td></tr>`
        : `<tr><td colspan="${colspan}" class="muted center">Nenhum funcionário encontrado com o termo "${filtro}".</td></tr>`;
    return;
  }
  
  const cargosMap = Object.fromEntries(cargos.map(c => [c.id, c.nome]));
  const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
  
  const agrupados = funcsFiltrados.reduce((acc, func) => {
      const cargoNome = cargosMap[func.cargoId] || SEM_CARGO_DEFINIDO;
      if (!acc[cargoNome]) acc[cargoNome] = [];
      acc[cargoNome].push(func);
      return acc;
  }, {});

  const cargosOrdenados = Object.keys(agrupados).sort((a,b) => a.localeCompare(b));
  
  for (const cargoNome of cargosOrdenados) {
      const funcsDoGrupo = agrupados[cargoNome].sort((a,b) => a.nome.localeCompare(b.nome));
      tbody.innerHTML += `<th colspan="${colspan}" class="group-header ${cargoNome === SEM_CARGO_DEFINIDO ? 'warning' : ''}">${cargoNome}</th>`;
      
      funcsDoGrupo.forEach(f => {
          const nomesTurnos = Object.keys(f.disponibilidade || {}).map(id => turnosMap[id]?.nome || "").join(", ") || "Nenhum";
          const cargaHoraria = f.cargaHoraria ? `${f.cargaHoraria}h ${f.periodoHoras === 'mensal' ? '/mês' : '/semana'}` : 'N/D';
          const horaExtra = f.fazHoraExtra ? 'Sim' : 'Não';
          const tipoContrato = f.tipoContrato === 'pj' ? 'Prestador' : 'CLT';
          
          const row = document.createElement('tr');
          row.dataset.funcId = f.id;
          row.innerHTML = `
            <td>${f.nome}</td>
            <td>${f.documento || '---'}</td>
            <td>${tipoContrato}</td>
            <td>${cargaHoraria}</td>
            <td>${horaExtra}</td>
            <td>${nomesTurnos}</td>
            <td>
              <button class="secondary" data-edit="${f.id}">Editar</button>
              <button class="danger" data-del="${f.id}">Excluir</button>
            </td>
          `;
          tbody.appendChild(row);
      });
  }

  if (lastAddedFuncId) {
    tbody.querySelector(`tr[data-func-id="${lastAddedFuncId}"]`)?.classList.add('new-item');
    lastAddedFuncId = null;
  }
  $$(`#tblFuncionarios [data-edit]`).forEach(b=> b.onclick=()=>editFuncInForm(b.dataset.edit));
  $$(`#tblFuncionarios [data-del]`).forEach(b=> b.onclick=()=>deleteFuncionario(b.dataset.del));
}

function validateFuncForm() {
    let isValid = true;
    if (!$("#funcNome").value.trim()) { $("#funcNome").classList.add('invalid'); isValid = false; }
    if (!$("#funcCargo").value) { $("#funcCargo").classList.add('invalid'); isValid = false; }
    if (!$("#funcCargaHoraria").value) { $("#funcCargaHoraria").classList.add('invalid'); isValid = false; }
    return isValid;
}

function saveFuncFromForm() {
    if (!validateFuncForm()) {
        showToast("Preencha todos os campos obrigatórios.");
        return;
    }
    const { funcionarios } = store.getState();
    const documento = $("#funcDocumento").value.trim();
    if (documento && funcionarios.some(f => f.documento?.toLowerCase() === documento.toLowerCase() && f.id !== editingFuncId)) {
        return showToast("O número do documento já está em uso por outro funcionário.");
    }

    const disponibilidade = Object.entries(funcDisponibilidadeTemporaria)
        .filter(([, dias]) => dias && dias.length > 0)
        .reduce((acc, [turnoId, dias]) => ({ ...acc, [turnoId]: dias }), {});

    const funcData = {
        id: editingFuncId || uid(),
        nome: $("#funcNome").value.trim(),
        cargoId: $("#funcCargo").value,
        tipoContrato: $("#funcContrato").value,
        cargaHoraria: $("#funcCargaHoraria").value,
        periodoHoras: $("#funcPeriodoHoras").value,
        fazHoraExtra: $("#funcHoraExtra").value === 'sim',
        documento,
        disponibilidade,
    };
    
    if (!editingFuncId) {
        lastAddedFuncId = funcData.id;
    }

    store.dispatch('SAVE_FUNCIONARIO', funcData);
    
    cancelEditFunc();
    showToast("Funcionário salvo com sucesso!");
}

function editFuncInForm(id) {
    const { funcionarios } = store.getState();
    const func = funcionarios.find(f => f.id === id);
    if (!func) return;

    cancelEditFunc();
    editingFuncId = id;

    $("#funcNome").value = func.nome;
    $("#funcCargo").value = func.cargoId;
    $("#funcCargaHoraria").value = func.cargaHoraria || '';
    $("#funcDocumento").value = func.documento || '';
    
    $(`#contratoToggleGroup .toggle-btn[data-value="${func.tipoContrato || 'clt'}"]`).click();
    $(`#periodoHorasToggleGroup .toggle-btn[data-value="${func.periodoHoras || 'semanal'}"]`).click();
    $(`#horaExtraToggleGroup .toggle-btn[data-value="${func.fazHoraExtra ? 'sim' : 'nao'}"]`).click();

    funcDisponibilidadeTemporaria = JSON.parse(JSON.stringify(func.disponibilidade || {}));
    renderFuncTurnosForCargo(); 

    $("#btnSalvarFunc").textContent = "Salvar Alterações";
    $("#btnCancelarEdFunc").classList.remove("hidden");
    window.scrollTo(0, 0);
}

function cancelEditFunc() {
    editingFuncId = null;
    $("#funcNome").value = "";
    $("#funcCargo").value = "";
    $("#funcCargaHoraria").value = "";
    $("#funcDocumento").value = "";
    
    $$("#page-funcionarios .invalid").forEach(el => el.classList.remove('invalid'));

    $(`#contratoToggleGroup .toggle-btn[data-value="clt"]`).click();
    $(`#periodoHorasToggleGroup .toggle-btn[data-value="semanal"]`).click();
    $(`#horaExtraToggleGroup .toggle-btn[data-value="nao"]`).click();
    
    funcDisponibilidadeTemporaria = {};
    $("#funcTurnosContainer").innerHTML = `<div class="turno-placeholder"><p>Selecione um cargo para ver os turnos disponíveis.</p></div>`;

    $("#btnSalvarFunc").textContent = "Salvar Funcionário";
    $("#btnCancelarEdFunc").classList.add("hidden");
}

async function deleteFuncionario(id) {
    const confirmado = await showConfirm({
        title: "Confirmar Exclusão?",
        message: "Atenção: esta ação é permanente e não pode ser desfeita. Excluir este item pode afetar outras partes do sistema. Deseja continuar?"
    });
    if (confirmado) {
        store.dispatch('DELETE_FUNCIONARIO', id);
        showToast("Funcionário excluído com sucesso.");
    }
}
$("#btnSalvarFunc").onclick = saveFuncFromForm;
$("#btnCancelarEdFunc").onclick = cancelEditFunc;
$("#btnLimparFunc").onclick = cancelEditFunc;