initDB().then(() => {
	carregarLotesNoSelect()
	carregarAlertas()
}).catch(erro => {
	alert("Erro crítico ao ligar à base de dados.")
})

async function carregarLotesNoSelect() {
	const select = document.getElementById("loteIdMed")
	try {
		const lotes = await dbGetAll("lotes")
		const lotesAtivos = lotes.filter(l => l.estado === "Ativo")

		select.innerHTML = lotesAtivos.length ? '<option value="" disabled selected>Selecione o Lote...</option>' : '<option disabled>Sem lotes ativos.</option>'
		lotesAtivos.forEach(l => { select.innerHTML += `<option value="${l.id}" data-planoid="${l.planoId}">Lote L-${l.id}</option>` })
	} catch (error) {
		console.error("Erro ao carregar lotes:", error)
	}
}

document.getElementById("medicaoForm").addEventListener("submit", async function (e) {
	e.preventDefault()
	const loteSelect = document.getElementById("loteIdMed")
	const loteId = parseInt(loteSelect.value)
	const planoId = parseInt(loteSelect.options[loteSelect.selectedIndex].dataset.planoid)

	const medicao = {
		loteId: loteId,
		temperatura: parseFloat(document.getElementById("valTemp").value),
		humidade: parseFloat(document.getElementById("valHum").value),
		luminosidade: parseFloat(document.getElementById("valLum").value),
		data: new Date().toLocaleString("pt-PT")
	}

	try {
		await dbAdd("medicoes", medicao)
		await registarLog(`Registou leitura (Temp: ${medicao.temperatura}ºC, Hum: ${medicao.humidade}%, Lum: ${medicao.luminosidade}lx) no Lote #${medicao.loteId}.`)
		await verificarLimites(medicao, planoId)
	} catch (error) {
		alert("Erro ao gravar medição.")
	}
})

async function verificarLimites(medicao, planoId) {
	try {
		const plano = await dbGet("planos", planoId)
		if (plano && plano.tipo === "Regular") {
			const minT = parseFloat(plano.detalhes.tempMin)
			const maxT = parseFloat(plano.detalhes.tempMax)

			if (medicao.temperatura > maxT || medicao.temperatura < minT) {
				await gerarAlerta(`Temperatura anómala (${medicao.temperatura}°C) no Lote #${medicao.loteId}. Limites: ${minT}-${maxT}°C`, "Crítico")
			} else {
				alert("Medição guardada. Tudo dentro dos limites normais.")
				document.getElementById("medicaoForm").reset()
			}
		} else {
			alert("Medição guardada. Regras só se aplicam a planos regulares.")
			document.getElementById("medicaoForm").reset()
		}
	} catch (error) {
		console.error("Erro ao verificar limites do plano:", error)
	}
}

async function gerarAlerta(mensagem, gravidade) {
	const alerta = {
		mensagem: mensagem,
		gravidade: gravidade,
		estado: "Pendente",
		data: new Date().toLocaleString("pt-PT")
	}
	try {
		await dbAdd("alertas", alerta)
		alert("⚠️ ALERTA GERADO: " + mensagem)
		document.getElementById("medicaoForm").reset()
		carregarAlertas()
	} catch (error) {
		console.error("Erro ao gerar alerta:", error)
	}
}

async function carregarAlertas() {
	const lista = document.getElementById("listaAlertas")
	try {
		const todosAlertas = await dbGetAll("alertas")
		const alertasPendentes = todosAlertas.filter(a => a.estado === "Pendente").reverse()

		lista.innerHTML = alertasPendentes.length ? "" : "<p class='alerta-vazio'>A estufa está estável. Sem alertas pendentes.</p>"

		alertasPendentes.forEach(a => {
			const classAlerta = a.gravidade === "Crítico" ? "alerta-critico" : "alerta-aviso"
			const user = window.currentUser
			let btnAcoes = `<button data-id="${a.id}" class="btn-ignorar">Ignorar (Exige Justificação)</button>`

			if (user.perfil === "Técnico" && a.gravidade === "Crítico") {
				btnAcoes = `<span style="font-size: 0.8rem; color: #991b1b;">🚫 Requer Responsável/Admin para ignorar</span>`
			}

			lista.innerHTML += `
                <div class="alerta-card ${classAlerta}">
                    <strong>[${a.gravidade}]</strong> ${a.mensagem}
                    <div class="alerta-acoes">
                        ${btnAcoes}
                    </div>
                </div>
            `
		})
	} catch (error) {
		console.error("Erro ao carregar alertas:", error)
	}
}

document.getElementById("listaAlertas").addEventListener("click", function (e) {
	if (e.target && e.target.classList.contains("btn-ignorar")) {
		const id = parseInt(e.target.getAttribute("data-id"))
		ignorarAlerta(id)
	}
})

async function ignorarAlerta(id) {
	const justificacao = prompt("Justificação OBRIGATÓRIA para ignorar este alerta:")
	if (!justificacao || justificacao.trim() === "") {
		alert("Ação cancelada. Justificação é obrigatória pelas regras de negócio.")
		return
	}

	try {
		const alerta = await dbGet("alertas", id)
		alerta.estado = "Ignorado"
		alerta.justificacao = justificacao
		await dbUpdate("alertas", alerta)
		await registarLog(`Ignorou o alerta #${id} com a justificação: "${justificacao}"`)
		carregarAlertas()
	} catch (error) {
		alert("Erro ao ignorar alerta.")
	}
}
