initDB().then(() => {
	carregarLotesNoSelect()
	carregarTarefas()
}).catch(erro => {
	alert("Erro crítico ao ligar à base de dados.")
})

async function carregarLotesNoSelect() {
	const select = document.getElementById("loteId")
	try {
		const lotes = await dbGetAll("lotes")
		const lotesAtivos = lotes.filter(l => l.estado === "Ativo")

		select.innerHTML = lotesAtivos.length ? '<option value="" disabled selected>Selecione um lote ativo...</option>' : '<option disabled>Nenhum lote ativo.</option>'
		lotesAtivos.forEach(l => {
			select.innerHTML += `<option value="${l.id}">Lote L-${l.id} (${l.ervaAromatica})</option>`
		})
	} catch (error) {
		console.error("Erro ao carregar lotes:", error)
	}
}

document.getElementById("tarefaForm").addEventListener("submit", async function (e) {
	e.preventDefault()
	const tarefa = {
		loteId: parseInt(document.getElementById("loteId").value),
		tipo: document.getElementById("tipoTarefa").value,
		observacoes: document.getElementById("obsTarefa").value,
		dataExecucao: new Date().toLocaleString("pt-PT"),
		sincronizado: false
	}
	try {
		await dbAdd("tarefas", tarefa)
		await registarLog(`Registou uma tarefa de ${tarefa.tipo} no Lote #${tarefa.loteId}.`)
		alert("Tarefa registada!")
		document.getElementById("tarefaForm").reset()
		carregarTarefas()
	} catch (error) {
		alert("Erro ao registar tarefa.")
	}
})

async function carregarTarefas() {
	const lista = document.getElementById("listaTarefas")
	try {
		const todasTarefas = await dbGetAll("tarefas")
		const tarefas = todasTarefas.reverse()

		lista.innerHTML = tarefas.length ? "" : "<p>Nenhuma tarefa registada.</p>"
		tarefas.forEach(t => {
			lista.innerHTML += `
                <div class="tarefa-card">
                    <h3 class="tarefa-header">${t.tipo} <span class="tarefa-lote">Lote #${t.loteId}</span></h3>
                    <p class="tarefa-obs">${t.observacoes || "Sem observações."}</p>
                    <small class="tarefa-data">Executado em: ${t.dataExecucao}</small>
                </div>
            `
		})
	} catch (error) {
		console.error("Erro ao carregar tarefas:", error)
	}
}

document.getElementById("btnExportarTarefas")?.addEventListener("click", async () => {
	try {
		const tarefas = await dbGetAll("tarefas")
		if (tarefas.length === 0) {
			alert("Não há tarefas para exportar.")
			return
		}

		let csvContent = "ID Tarefa,Lote Alvo,Tipo de Tarefa,Data de Execução,Observações\n"

		tarefas.forEach(t => {
			const obsSeguras = t.observacoes ? `"${t.observacoes.replace(/"/g, '""')}"` : "Sem observações"

			csvContent += `${t.id},${t.loteId},${t.tipo},${t.dataExecucao},${obsSeguras}\n`
		})

		const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' })
		const url = URL.createObjectURL(blob)

		const link = document.createElement("a")
		link.setAttribute("href", url)
		link.setAttribute("download", `Relatorio_Tarefas_GREENHERB_${new Date().toISOString().split('T')[0]}.csv`)
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)

		await registarLog("Exportou o histórico de Tarefas para formato CSV.")
	} catch (e) {
		console.error("Erro na exportação das tarefas", e)
		alert("Erro ao exportar dados.")
	}
})
