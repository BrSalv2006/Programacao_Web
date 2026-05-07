initDB().then(() => {
	carregarPlanosNoSelect()
	carregarLotes()
}).catch(erro => {
	alert("Erro crítico ao ligar à base de dados.")
})

async function carregarPlanosNoSelect() {
	const select = document.getElementById("planoAssociado")
	try {
		const planos = await dbGetAll("planos")
		select.innerHTML = '<option value="" disabled selected>Selecione um plano...</option>'
		if (planos.length === 0) {
			select.innerHTML = '<option value="" disabled>Nenhum plano encontrado. Crie um primeiro.</option>'
			return
		}
		planos.forEach(plano => {
			const option = document.createElement("option")
			option.value = plano.id
			option.textContent = `Plano #${plano.id} (${plano.tipo}) - ${plano.ervaAromatica || plano.erva}`
			option.dataset.erva = plano.ervaAromatica || plano.erva
			select.appendChild(option)
		})
	} catch (error) {
		console.error("Erro ao carregar planos:", error)
	}
}

document.getElementById("loteForm").addEventListener("submit", async function (e) {
	e.preventDefault()

	const selectPlano = document.getElementById("planoAssociado")
	const planoId = selectPlano.value
	const erva = selectPlano.options[selectPlano.selectedIndex].dataset.erva
	const qtdInicial = parseInt(document.getElementById("quantidadeInicial").value)

	const novoLote = {
		planoId: parseInt(planoId),
		ervaAromatica: erva,
		dataInicio: document.getElementById("dataInicio").value,
		quantidadeInicial: qtdInicial,
		quantidadeAtual: qtdInicial,
		estado: "Ativo",
		perdasRegistadas: 0,
		sincronizado: false,
		dataFimReal: null,
		produtividade: null
	}

	try {
		const loteId = await dbAdd("lotes", novoLote)
		await registarLog(`Criou o Lote #${loteId} de ${erva} com ${qtdInicial} unidades.`)
		alert("Lote iniciado com sucesso!")
		document.getElementById("loteForm").reset()
		carregarLotes()
	} catch (error) {
		alert("Erro ao registar o lote.")
	}
})

async function carregarLotes() {
	const lista = document.getElementById("listaLotes")
	if (!lista) return

	try {
		const lotes = await dbGetAll("lotes")
		if (lotes.length === 0) {
			lista.innerHTML = "<p>Ainda não existem lotes registados.</p>"
			lista.style.display = "block"
			return
		}

		lista.innerHTML = ""
		lista.style.display = "grid"

		lotes.forEach(lote => {
			const item = document.createElement("div")
			const classeEstado = `estado-${lote.estado.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`
			const badgeClass = `badge-${lote.estado.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`

			item.classList.add("lote-card", classeEstado)

			let infoProdutividade = ""
			if (lote.estado === "Concluído" && lote.produtividade !== null) {
				infoProdutividade = `<p class="produtividade-info">🏆 Produtividade: <strong>${lote.produtividade}%</strong> (Fim: ${lote.dataFimReal})</p>`
			}

			let botoesExtras = ""
			if (lote.estado === "Ativo") {
				botoesExtras = `
					<button data-id="${lote.id}" class="btn-perda">Registrar Perda</button>
					<button data-id="${lote.id}" class="btn-dividir">Dividir Lote</button>
				`
			}

			item.innerHTML = `
                <h3>Lote L-${lote.id} <span class="badge ${badgeClass}">${lote.estado}</span></h3>
                <p><strong>Erva:</strong> ${lote.ervaAromatica} (Plano #${lote.planoId})</p>
                <p><strong>Data Início:</strong> ${lote.dataInicio}</p>
                <div class="lote-qtd-box">
					<p>Plantas Atuais: <strong class="qtd-atual">${lote.quantidadeAtual}</strong> <span class="qtd-inicial">de ${lote.quantidadeInicial}</span></p>
					<p class="txt-perdas">Perdas: ${lote.perdasRegistadas}</p>
				</div>
				${infoProdutividade}
                <div class="lote-actions">
                    ${botoesExtras}
                    <button data-id="${lote.id}" class="btn-mudar-estado" ${lote.estado !== 'Ativo' ? 'disabled' : ''}>Mudar Estado</button>
                </div>
            `
			lista.appendChild(item)
		})
	} catch (error) {
		console.error("Erro ao carregar lotes:", error)
	}
}

document.getElementById("listaLotes").addEventListener("click", function (e) {
	const id = parseInt(e.target.getAttribute("data-id"))
	if (!id) return

	if (e.target.classList.contains("btn-mudar-estado")) mudarEstado(id)
	else if (e.target.classList.contains("btn-perda")) registarPerda(id)
	else if (e.target.classList.contains("btn-dividir")) dividirLote(id)
})

async function registarPerda(loteId) {
	const lote = await dbGet("lotes", loteId)
	const qtdPerdida = parseInt(prompt(`Lote #${loteId} - Quantas plantas se perderam? (Atual: ${lote.quantidadeAtual})`))

	if (isNaN(qtdPerdida) || qtdPerdida <= 0 || qtdPerdida > lote.quantidadeAtual) {
		alert("Quantidade inválida."); return
	}

	lote.quantidadeAtual -= qtdPerdida
	lote.perdasRegistadas += qtdPerdida

	await dbUpdate("lotes", lote)
	await registarLog(`Registou a perda de ${qtdPerdida} unidades no Lote #${loteId}.`)
	carregarLotes()
}

async function dividirLote(loteId) {
	const loteOriginal = await dbGet("lotes", loteId)
	const qtdSeparar = parseInt(prompt(`Lote #${loteId} tem ${loteOriginal.quantidadeAtual} plantas. Quantas deseja mover para o novo Lote?`))

	if (isNaN(qtdSeparar) || qtdSeparar <= 0 || qtdSeparar >= loteOriginal.quantidadeAtual) {
		alert("Quantidade inválida ou superior ao total disponível."); return
	}

	loteOriginal.quantidadeAtual -= qtdSeparar
	await dbUpdate("lotes", loteOriginal)

	const novoLote = {
		planoId: loteOriginal.planoId,
		ervaAromatica: loteOriginal.ervaAromatica,
		dataInicio: new Date().toISOString().split('T')[0],
		quantidadeInicial: qtdSeparar,
		quantidadeAtual: qtdSeparar,
		estado: "Ativo",
		perdasRegistadas: 0,
		sincronizado: false,
		dataFimReal: null,
		produtividade: null
	}
	const novoLoteId = await dbAdd("lotes", novoLote)

	await registarLog(`Dividiu o Lote #${loteId}: Moveu ${qtdSeparar} unidades para o novo Lote #${novoLoteId}.`)
	alert(`Lote dividido com sucesso! O novo Lote é o L-${novoLoteId}.`)
	carregarLotes()
}

async function mudarEstado(loteId) {
	const novoEstado = prompt("Digite o novo estado (Ativo, Concluído, Comprometido):", "Concluído")
	if (!novoEstado || !["Ativo", "Concluído", "Comprometido"].includes(novoEstado)) {
		alert("Estado inválido.")
		return
	}

	try {
		const lote = await dbGet("lotes", loteId)
		lote.estado = novoEstado

		if (novoEstado === "Concluído") {
			const dataFim = prompt("Indique a data de término real (YYYY-MM-DD):", new Date().toISOString().split('T')[0])
			lote.dataFimReal = dataFim
			lote.produtividade = ((lote.quantidadeAtual / lote.quantidadeInicial) * 100).toFixed(1)
			await registarLog(`Concluiu o Lote #${loteId} com uma produtividade de ${lote.produtividade}%.`)
		} else {
			await registarLog(`Alterou o estado do Lote #${loteId} para ${novoEstado}.`)
		}

		await dbUpdate("lotes", lote)
		carregarLotes()
	} catch (error) {
		console.error("Erro ao alterar estado do lote:", error)
	}
}

document.getElementById("btnExportarLotes")?.addEventListener("click", async () => {
	try {
		const lotes = await dbGetAll("lotes")
		if (lotes.length === 0) {
			alert("Não há lotes para exportar.")
			return
		}

		let csvContent = "ID Lote,Plano Associado,Erva Aromatica,Data Inicio,Data Fim Real,Quantidade Inicial,Quantidade Atual,Perdas,Estado,Produtividade (%)\n"

		lotes.forEach(l => {
			const dataFim = l.dataFimReal || "N/A"
			const prod = l.produtividade ? `${l.produtividade}%` : "N/A"
			csvContent += `${l.id},${l.planoId},${l.ervaAromatica},${l.dataInicio},${dataFim},${l.quantidadeInicial},${l.quantidadeAtual},${l.perdasRegistadas},${l.estado},${prod}\n`
		})

		const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' })
		const url = URL.createObjectURL(blob)
		const link = document.createElement("a")
		link.setAttribute("href", url)
		link.setAttribute("download", `Relatorio_Lotes_GREENHERB_${new Date().toISOString().split('T')[0]}.csv`)
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)

		await registarLog("Exportou o relatório de Lotes para formato CSV.")
	} catch (e) {
		console.error("Erro na exportação", e)
		alert("Erro ao exportar dados.")
	}
})
