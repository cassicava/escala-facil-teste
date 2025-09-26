/**************************************
 * 🏦 Store (Gerenciador de Estado)
 **************************************/

// O store centraliza todos os dados da aplicação, evitando variáveis globais
// e facilitando o gerenciamento e a reatividade dos dados.

const KEYS = {
    turnos: "ge_turnos",
    cargos: "ge_cargos",
    funcs: "ge_funcionarios",
    escalas: "ge_escalas",
    config: "ge_config"
};

const store = {
    // 1. STATE: Onde todos os dados da aplicação residem.
    state: {
        turnos: [],
        cargos: [],
        funcionarios: [],
        escalas: [],
        config: { nome: '', theme: 'light' },
    },

    // 2. LISTENERS: Funções que serão chamadas quando o estado mudar.
    listeners: [],

    // 3. GETTERS: Funções para obter o estado atual.
    getState() {
        return this.state;
    },

    // 4. ACTIONS: Funções que modificam o estado. São a única maneira de alterar os dados.
    /**
     * Função central para despachar ações que modificam o estado.
     * @param {string} actionName - O nome da ação a ser executada (ex: 'LOAD_STATE', 'SAVE_TURNO').
     * @param {*} payload - Os dados necessários para a ação.
     */
    dispatch(actionName, payload) {
        // As ações encontram a mutação correspondente para alterar o estado.
        if (typeof this.mutations[actionName] === 'function') {
            this.mutations[actionName](this.state, payload);
            // Após a mutação, notificamos todos os 'listeners' sobre a mudança.
            this.notify(actionName); // <-- ALTERAÇÃO: Passa o nome da ação.
        } else {
            console.error(`Ação "${actionName}" não encontrada.`);
        }
    },

    // 5. MUTATIONS: Funções puras que efetivamente alteram o estado.
    mutations: {
        LOAD_STATE(state) {
            state.turnos = loadJSON(KEYS.turnos, []);
            state.cargos = loadJSON(KEYS.cargos, []);
            state.funcionarios = loadJSON(KEYS.funcs, []);
            state.escalas = loadJSON(KEYS.escalas, []);
            state.config = loadJSON(KEYS.config, { nome: '', theme: 'light' });
        },

        SAVE_TURNO(state, turno) {
            const index = state.turnos.findIndex(t => t.id === turno.id);
            if (index > -1) {
                state.turnos[index] = { ...state.turnos[index], ...turno };
            } else {
                state.turnos.push(turno);
            }
            saveJSON(KEYS.turnos, state.turnos);
        },
        DELETE_TURNO(state, turnoId) {
            state.turnos = state.turnos.filter(t => t.id !== turnoId);
            // Lógica cascata: remove o turno de cargos e funcionários
            state.cargos.forEach(cargo => {
                cargo.turnosIds = cargo.turnosIds.filter(id => id !== turnoId);
            });
            state.funcionarios.forEach(func => {
                if (func.disponibilidade && func.disponibilidade[turnoId]) {
                    delete func.disponibilidade[turnoId];
                }
            });
            saveJSON(KEYS.turnos, state.turnos);
            saveJSON(KEYS.cargos, state.cargos);
            saveJSON(KEYS.funcs, state.funcionarios);
        },

        SAVE_CARGO(state, cargo) {
            const index = state.cargos.findIndex(c => c.id === cargo.id);
            if (index > -1) {
                state.cargos[index] = { ...state.cargos[index], ...cargo };
                 // Lógica cascata: ajusta disponibilidade de funcionários se turnos foram removidos
                 state.funcionarios.forEach(func => {
                    if (func.cargoId === cargo.id) {
                        for (const turnoId in func.disponibilidade) {
                            if (!cargo.turnosIds.includes(turnoId)) {
                                delete func.disponibilidade[turnoId];
                            }
                        }
                    }
                });
                saveJSON(KEYS.funcs, state.funcionarios);
            } else {
                state.cargos.push(cargo);
            }
            saveJSON(KEYS.cargos, state.cargos);
        },
        DELETE_CARGO(state, cargoId) {
            state.cargos = state.cargos.filter(c => c.id !== cargoId);
            // Lógica cascata: remove o cargo dos funcionários (define como nulo)
            state.funcionarios.forEach(f => { if (f.cargoId === cargoId) f.cargoId = null; });
            // Lógica cascata: remove as escalas salvas associadas ao cargo
            state.escalas = state.escalas.filter(e => e.cargoId !== cargoId);

            saveJSON(KEYS.cargos, state.cargos);
            saveJSON(KEYS.funcs, state.funcionarios);
            saveJSON(KEYS.escalas, state.escalas);
        },

        SAVE_FUNCIONARIO(state, func) {
            const index = state.funcionarios.findIndex(f => f.id === func.id);
            if (index > -1) {
                state.funcionarios[index] = { ...state.funcionarios[index], ...func };
            } else {
                state.funcionarios.push(func);
            }
            saveJSON(KEYS.funcs, state.funcionarios);
        },
        DELETE_FUNCIONARIO(state, funcId) {
            // Lógica de exclusão em cascata para escalas salvas
            // Percorre todas as escalas e remove o funcionário dos slots, marcando-os como vagos.
            state.escalas.forEach(escala => {
                let escalaModificada = false;
                // Remove o funcionário dos slots
                escala.slots.forEach(slot => {
                    if (slot.assigned === funcId) {
                        slot.assigned = null;
                        escalaModificada = true;
                    }
                });
                // Remove o funcionário da lista de exceções da escala
                if (escala.excecoes && escala.excecoes[funcId]) {
                    delete escala.excecoes[funcId];
                    escalaModificada = true;
                }
                // Remove o funcionário do histórico de horas da escala
                if (escala.historico && escala.historico[funcId]) {
                    delete escala.historico[funcId];
                    escalaModificada = true;
                }
            });

            // Salva as escalas modificadas para garantir a integridade
            saveJSON(KEYS.escalas, state.escalas);

            // Continua com a exclusão do funcionário
            state.funcionarios = state.funcionarios.filter(f => f.id !== funcId);
            saveJSON(KEYS.funcs, state.funcionarios);
        },

        SAVE_ESCALA(state, escala) {
            const index = state.escalas.findIndex(e => e.id === escala.id);
            if (index > -1) {
                state.escalas[index] = escala;
            } else {
                state.escalas.push(escala);
            }
            saveJSON(KEYS.escalas, state.escalas);
        },
        DELETE_ESCALA_SALVA(state, escalaId) {
            state.escalas = state.escalas.filter(e => e.id !== escalaId);
            saveJSON(KEYS.escalas, state.escalas);
        },

        SAVE_CONFIG(state, config) {
            state.config = { ...state.config, ...config };
            saveJSON(KEYS.config, state.config);
        }
    },

    // 6. OBSERVER PATTERN: Mecanismo para 'ouvir' as mudanças no estado.
    /**
     * Adiciona uma função (callback) que será executada sempre que o estado for alterado.
     * @param {Function} listener - A função a ser chamada.
     */
    subscribe(listener) {
        this.listeners.push(listener);
    },

    /**
     * Executa todas as funções 'listener' registradas.
     * @param {string} actionName - O nome da ação que disparou a notificação.
     */
    notify(actionName) {
        this.listeners.forEach(listener => listener(actionName)); // <-- ALTERAÇÃO: Passa o nome da ação para o listener.
    }
};