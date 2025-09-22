/**************************************
 * 👤 Funcionários
 **************************************/
let FUNCS = loadJSON(KEYS.funcs, []);
let editingFuncId=null;
let lastAddedFuncId = null;
let funcDisponibilidadeTemporaria = {}; // Objeto para manipular a disponibilidade no formulário

const SEM_CARGO_DEFINIDO = "Sem Cargo Definido";

// --- LÓgica do Tipo de Contrato ---
const contratoToggleButtons = $$('#contratoToggleGroup .toggle-btn');
const contratoHiddenInput = $("#funcContrato");
const contratoExplicacao = $("#contratoExplicacao");
const explicacoesContrato = {
    clt: 'Funcionários <strong>CLT / Concursados</strong> seguirão rigorosamente as regras de descanso obrigatório cadastradas nos turnos.',
    pj: 'Funcionários <strong>Prestadores de Serviço</strong> terão as regras de descanso obrigatório ignoradas, permitindo maior flexibilidade na montagem da escala.'
};
contratoToggleButtons.forEach(button => {
    button.onclick = () => {
        contratoToggleButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        const valor = button.dataset.value;
        contratoHiddenInput.value = valor;
        contratoExplicacao.innerHTML = explicacoesContrato[valor];
    };
});

// --- LÓgica do Período da Carga Horária ---
const periodoHorasToggleButtons = $$('#periodoHorasToggleGroup .toggle-btn');
const periodoHorasHiddenInput = $("#funcPeriodoHoras");
periodoHorasToggleButtons.forEach(button => {
    button.onclick = () => {
        periodoHorasToggleButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        periodoHorasHiddenInput.value = button.dataset.value;
    };
});

// --- LÓgica de Renderização e Interação da Disponibilidade ---

const dias = [
    { id: 'seg', nome: 'Segunda', abrev: 'S' }, { id: 'ter', nome: 'Terça', abrev: 'T' },
    { id: 'qua', nome: 'Quarta', abrev: 'Q' }, { id: 'qui', nome: 'Quinta', abrev: 'Q' },
    { id: 'sex', nome: 'Sexta', abrev: 'S' }, { id: 'sab', nome: 'Sábado', abrev: 'S' },
    { id: 'dom', nome: 'Domingo', abrev: 'D' }
];

function renderFuncTurnosForCargo() {
    const cargoId = $("#funcCargo").value;
    const container = $("#funcTurnosContainer");
    const placeholder = $(".turno-placeholder", container);
    
    container.innerHTML = ''; 
    container.appendChild(placeholder); 

    if (!cargoId) {
        placeholder.style.display = 'block';
        return;
    }
    
    const cargo = CARGOS.find(c => c.id === cargoId);
    if (!cargo || !cargo.turnosIds || cargo.turnosIds.length === 0) {
        placeholder.style.display = 'block';
        placeholder.querySelector('p').textContent = 'Nenhum turno associado a este cargo.';
        return;
    }

    placeholder.style.display = 'none'; 

    const turnosDoCargo = TURNOS.filter(t => cargo.turnosIds.includes(t.id))
                                .sort((a, b) => a.nome.localeCompare(b.nome));

    turnosDoCargo.forEach(t => {
        const isTurnoSelecionado = !!funcDisponibilidadeTemporaria[t.id]; 
        
        const item = document.createElement('div');
        item.className = 'turno-disponibilidade-item';
        item.dataset.turnoId = t.id;
        item.classList.toggle('selecionado', isTurnoSelecionado); 

        const diasHtml = dias.map(d => {
            const isDiaSelecionado = isTurnoSelecionado && (funcDisponibilidadeTemporaria[t.id] || []).includes(d.id);
            return `
                <span class="dia-selecionavel" data-dia-id="${d.id}" title="${d.nome}" ${isDiaSelecionado ? 'class="dia-selecionavel selecionado-dia"' : ''}>
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

        // Lógica para o "card todo como checkbox" no cabeçalho
        header.onclick = (e) => {
            if (e.target.tagName !== 'INPUT') { 
                chkPrincipal.checked = !chkPrincipal.checked;
                chkPrincipal.dispatchEvent(new Event('change'));
            }
        };

        chkPrincipal.onchange = () => {
            const isChecked = chkPrincipal.checked;
            item.classList.toggle('selecionado', isChecked); 

            spansDias.forEach(spanDia => {
                if (!isChecked) {
                    spanDia.classList.remove('selecionado-dia'); // Desmarca o dia visualmente
                }
            });

            if (isChecked) {
                // Se marcar o turno, e não houver dias selecionados para ele,
                // seleciona todos os dias por padrão na funcDisponibilidadeTemporaria.
                if (!funcDisponibilidadeTemporaria[t.id] || funcDisponibilidadeTemporaria[t.id].length === 0) {
                    funcDisponibilidadeTemporaria[t.id] = dias.map(d => d.id);
                }
                // Atualiza os spans visíveis dos dias para refletir o estado da funcDisponibilidadeTemporaria
                spansDias.forEach(spanDia => {
                    const diaId = spanDia.dataset.diaId;
                    spanDia.classList.toggle('selecionado-dia', (funcDisponibilidadeTemporaria[t.id] || []).includes(diaId));
                });
            } else {
                delete funcDisponibilidadeTemporaria[t.id];
            }
        };

        // Lógica para os spans de dias individuais
        spansDias.forEach(spanDia => {
            spanDia.onclick = () => {
                // Só permite interação se o turno principal estiver marcado
                if (chkPrincipal.checked) {
                    const diaId = spanDia.dataset.diaId;
                    let diasDoTurno = funcDisponibilidadeTemporaria[t.id] || [];

                    if (spanDia.classList.contains('selecionado-dia')) {
                        // Desmarcar dia
                        spanDia.classList.remove('selecionado-dia');
                        const index = diasDoTurno.indexOf(diaId);
                        if (index > -1) diasDoTurno.splice(index, 1);
                    } else {
                        // Marcar dia
                        spanDia.classList.add('selecionado-dia');
                        if (!diasDoTurno.includes(diaId)) diasDoTurno.push(diaId);
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
    funcDisponibilidadeTemporaria = {}; // Limpa a disponibilidade ao trocar de cargo
    renderFuncTurnosForCargo();
});
function validateInput(inputElement) {
    if (inputElement.value.trim() !== '') {
        inputElement.classList.remove('invalid');
    } else {
        inputElement.classList.add('invalid');
    }
}
$("#filtroFuncionarios").addEventListener("input", (e) => { renderFuncs(e.target.value); });

function renderFuncCargoSelect(){
  const sel=$("#funcCargo");
  sel.innerHTML="<option value=''>Selecione um cargo</option>";
  // CORREÇÃO APLICADA AQUI
  const cargosOrdenados = [...CARGOS].sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  cargosOrdenados.forEach(c=>{
    const o=document.createElement("option");
    o.value=c.id;
    o.textContent=c.nome;
    sel.appendChild(o);
  });
}

function renderFuncs(filtro = ''){
  const tbody = $("#tblFuncionarios tbody");
  tbody.innerHTML = "";
  const filtroLower = filtro.toLowerCase();
  const funcsFiltrados = FUNCS.filter(f => f.nome.toLowerCase().includes(filtroLower));
  const colspan = 6;

  if (funcsFiltrados.length === 0) {
    if (FUNCS.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colspan}"><div class="empty-state"><div class="empty-state-icon">👤</div><h3>Nenhum Funcionário Cadastrado</h3><p>Comece a cadastrar funcionários para poder gerar escalas.</p></div></td></tr>`;
    } else {
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="muted center">Nenhum funcionário encontrado com o termo "${filtro}".</td></tr>`;
    }
    return;
  }
  const cargosMap = Object.fromEntries(CARGOS.map(c => [c.id, c.nome]));
  const turnosMap = Object.fromEntries(TURNOS.map(t => [t.id, t]));
  const agrupados = funcsFiltrados.reduce((acc, func) => {
      const cargoNome = cargosMap[func.cargoId] || SEM_CARGO_DEFINIDO;
      if (!acc[cargoNome]) acc[cargoNome] = [];
      acc[cargoNome].push(func);
      return acc;
  }, {});
  const cargosOrdenados = Object.keys(agrupados).sort((a,b) => a.localeCompare(b));
  for (const cargoNome of cargosOrdenados) {
      const funcsDoGrupo = agrupados[cargoNome].sort((a,b) => a.nome.localeCompare(b.nome));
      const isWarning = cargoNome === SEM_CARGO_DEFINIDO;
      const headerRow = document.createElement('tr');
      headerRow.innerHTML = `<th colspan="${colspan}" class="group-header ${isWarning ? 'warning' : ''}">${cargoNome}</th>`;
      tbody.appendChild(headerRow);
      funcsDoGrupo.forEach(f => {
          const turnosIds = f.disponibilidade ? Object.keys(f.disponibilidade) : [];
          const nomesTurnos = turnosIds.map(id => turnosMap[id]?.nome || "").join(", ");
          const periodo = f.periodoHoras === 'mensal' ? '/mês' : '/semana';
          const cargaHoraria = f.cargaHoraria ? `${f.cargaHoraria}h ${periodo}` : 'N/D';
          const documento = f.documento || '---';
          const tipoContrato = f.tipoContrato === 'pj' ? 'Prestador' : 'CLT';
          const row = document.createElement('tr');
          row.dataset.funcId = f.id;
          row.innerHTML = `
            <td>${f.nome}</td>
            <td>${documento}</td>
            <td>${tipoContrato}</td>
            <td>${cargaHoraria}</td>
            <td>${nomesTurnos || "Nenhum"}</td>
            <td>
              <button class="secondary" data-edit="${f.id}">Editar</button>
              <button class="danger" data-del="${f.id}">Excluir</button>
            </td>
          `;
          tbody.appendChild(row);
      });
  }
  if (lastAddedFuncId) {
    const novaLinha = tbody.querySelector(`tr[data-func-id="${lastAddedFuncId}"]`);
    if (novaLinha) novaLinha.classList.add('new-item');
    lastAddedFuncId = null;
  }
  $$(`#tblFuncionarios [data-edit]`).forEach(b=> b.onclick=()=>editFuncInForm(b.dataset.edit));
  $$(`#tblFuncionarios [data-del]`).forEach(b=> b.onclick=()=>deleteFuncionario(b.dataset.del));
}
function validateFuncForm() {
    let isValid = true;
    const nome = $("#funcNome").value.trim();
    const cargoId = $("#funcCargo").value;
    const cargaHoraria = $("#funcCargaHoraria").value;
    if (!nome) { $("#funcNome").classList.add('invalid'); isValid = false; }
    if (!cargoId) { $("#funcCargo").classList.add('invalid'); isValid = false; }
    if (!cargaHoraria) { $("#funcCargaHoraria").classList.add('invalid'); isValid = false; }
    return isValid;
}
function saveFuncFromForm() {
    if (!validateFuncForm()) {
        showToast("Preencha todos os campos obrigatórios.");
        return;
    }
    const btn = $("#btnSalvarFunc");
    const nome = $("#funcNome").value.trim();
    const cargoId = $("#funcCargo").value;
    const cargaHoraria = $("#funcCargaHoraria").value;
    const periodoHoras = $("#funcPeriodoHoras").value;
    const documento = $("#funcDocumento").value.trim();
    const tipoContrato = $("#funcContrato").value;

    const disponibilidade = {};
    for (const turnoId in funcDisponibilidadeTemporaria) {
        if (funcDisponibilidadeTemporaria[turnoId] && funcDisponibilidadeTemporaria[turnoId].length > 0) {
            disponibilidade[turnoId] = funcDisponibilidadeTemporaria[turnoId];
        }
    }


    if (documento) {
        const isDuplicate = FUNCS.some(func => 
            func.documento && func.documento.toLowerCase() === documento.toLowerCase() && func.id !== editingFuncId
        );
        if (isDuplicate) return showToast("O número do documento já está em uso por outro funcionário.");
    }
    btn.disabled = true;
    btn.textContent = "Salvando...";
    setTimeout(() => {
        const funcData = { nome, cargoId, tipoContrato, cargaHoraria, periodoHoras, documento, disponibilidade };
        delete funcData.turnosIds;
        if (editingFuncId) {
            const func = FUNCS.find(f => f.id === editingFuncId);
            if (func) Object.assign(func, funcData);
        } else {
            const novoFunc = { id: uid(), ...funcData };
            FUNCS.push(novoFunc);
            lastAddedFuncId = novoFunc.id;
        }
        saveJSON(KEYS.funcs, FUNCS);
        renderFuncs();
        renderCargos();
        cancelEditFunc();
        showToast("Funcionário salvo com sucesso!");
        btn.disabled = false;
        btn.textContent = "Salvar Funcionário";
    }, 200);
}
function editFuncInForm(id) {
    const func = FUNCS.find(f => f.id === id);
    if (!func) return;
    editingFuncId = id;
    $("#funcNome").value = func.nome;
    $("#funcCargo").value = func.cargoId;
    $("#funcCargaHoraria").value = func.cargaHoraria || '';
    $("#funcDocumento").value = func.documento || '';

    const tipoContrato = func.tipoContrato || 'clt';
    $(`#contratoToggleGroup .toggle-btn[data-value="${tipoContrato}"]`).click();
    const periodoHoras = func.periodoHoras || 'semanal';
    $(`#periodoHorasToggleGroup .toggle-btn[data-value="${periodoHoras}"]`).click();

    funcDisponibilidadeTemporaria = JSON.parse(JSON.stringify(func.disponibilidade || {}));
    
    renderFuncTurnosForCargo(); 

    $("#btnSalvarFunc").textContent = "Salvar Alterações";
    $("#btnCancelarEdFunc").classList.remove("hidden");
    window.scrollTo(0, 0);
}
function cancelEditFunc() {
    editingFuncId = null;
    $("#funcNome").value = "";
    $("#funcNome").classList.remove('invalid');
    $("#funcCargo").value = "";
    $("#funcCargo").classList.remove('invalid');
    $("#funcCargaHoraria").value = "";
    $("#funcCargaHoraria").classList.remove('invalid');
    $("#funcDocumento").value = "";
    
    $(`#contratoToggleGroup .toggle-btn[data-value="clt"]`).click();
    $(`#periodoHorasToggleGroup .toggle-btn[data-value="semanal"]`).click();
    
    funcDisponibilidadeTemporaria = {};
    const container = $("#funcTurnosContainer");
    container.innerHTML = '';
    const placeholder = document.createElement('div');
    placeholder.className = 'turno-placeholder';
    placeholder.innerHTML = '<p>Selecione um cargo para ver os turnos disponíveis.</p>';
    container.appendChild(placeholder);


    $("#btnSalvarFunc").textContent = "Salvar Funcionário";
    $("#btnSalvarFunc").disabled = false;
    $("#btnCancelarEdFunc").classList.add("hidden");
}
async function deleteFuncionario(id) {
    const confirmado = await showConfirm({
        title: "Confirmar Exclusão?",
        message: "Atenção: esta ação é permanente e não pode ser desfeita. Excluir este item pode afetar outras partes do sistema. Deseja continuar?"
    });
    if (confirmado) {
        FUNCS = FUNCS.filter(f => f.id !== id);
        saveJSON(KEYS.funcs, FUNCS);
        renderFuncs();
        renderCargos();
        showToast("Funcionário excluído com sucesso.");
    }
}
$("#btnSalvarFunc").onclick = saveFuncFromForm;
$("#btnCancelarEdFunc").onclick = cancelEditFunc;
$("#btnLimparFunc").onclick = cancelEditFunc;