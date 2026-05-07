initDB().then(() => {
	carregarErvasNoSelect()
	carregarPlanos()
}).catch(err => console.error("Erro ao iniciar DB nos Planos:", err))

async function carregarErvasNoSelect() {
	const sel = document.getElementById("ervaSelect")

	try {
		const ervas = await dbGetAll("ervas")

		if (ervas.length === 0) {
			sel.innerHTML = '<option value="" disabled>Registe uma erva primeiro na página de Ervas!</option>'
			return
		}
		sel.innerHTML = '<option value="" disabled selected>Selecione a planta...</option>' +
			ervas.map(ev => `<option value="${ev.nome}">${ev.nome}</option>`).join("")
	} catch (error) {
		console.error("Erro ao carregar ervas:", error)
	}
}

const selectTipo = document.getElementById("tipo")
const sections = {
	"Regular": document.getElementById("secRegular"),
	"Emergência": document.getElementById("secEmergencia"),
	"Pontual": document.getElementById("secPontual")
}

selectTipo.addEventListener("change", function () {
	Object.values(sections).forEach(sec => sec.classList.add("hidden"))

	const tipo = this.value
	if (sections[tipo]) {
		sections[tipo].classList.remove("hidden")
	}
})

document.getElementById("planForm").addEventListener("submit", async e => {
	e.preventDefault()

	const tipo = selectTipo.value
	const plano = {
		erva: document.getElementById("ervaSelect").value,
		tipo: tipo,
		data: new Date().toLocaleString("pt-PT"),
		detalhes: {}
	}

	if (tipo === "Regular") {
		plano.detalhes = {
			tempMin: document.getElementById("tempMin").value,
			tempMax: document.getElementById("tempMax").value,
			humMin: document.getElementById("humMin").value,
			humMax: document.getElementById("humMax").value,
			lumMin: document.getElementById("lumMin").value,
			lumMax: document.getElementById("lumMax").value,
			rega: document.getElementById("planoRega").value,
			fertilizacao: document.getElementById("planoFertilizacao").value,
			duracao: document.getElementById("duracao").value
		}
	} else if (tipo === "Emergência") {
		plano.detalhes = {
			intervencao: document.getElementById("tipoIntervencao").value,
			dosagem: document.getElementById("dosagem").value,
			intervalo: document.getElementById("intervaloMin").value
		}
	} else if (tipo === "Pontual") {
		plano.detalhes = {
			responsavel: document.getElementById("respTecnico").value,
			motivo: document.getElementById("motivo").value
		}
	}
	try {
		await dbAdd("planos", plano)
		await registarLog(`Criou um Plano ${tipo} para a planta ${plano.erva}.`)
		alert("Plano de Cultivo guardado com sucesso!")
		document.getElementById("planForm").reset()
		Object.values(sections).forEach(sec => sec.classList.add("hidden"))
		carregarPlanos()
	} catch (error) {
		alert("Erro ao guardar plano.")
	}
})

async function carregarPlanos() {
	const lista = document.getElementById("listaPlanos")
	if (!lista) return

	try {
		const planos = await dbGetAll("planos")

		if (planos.length === 0) {
			lista.innerHTML = "<p>Nenhum plano configurado até ao momento.</p>"
			return
		}

		lista.innerHTML = planos.map(p => {
			const badgeClass = p.tipo.toLowerCase()
			let desc = ""

			if (p.tipo === "Regular") {
				desc = `Temp: ${p.detalhes.tempMin}-${p.detalhes.tempMax}°C | Rega: ${p.detalhes.rega}`
			} else if (p.tipo === "Emergência") {
				desc = `Ação: ${p.detalhes.intervencao} (${p.detalhes.dosagem})`
			} else {
				desc = `Responsável: ${p.detalhes.responsavel}`
			}

			return `
                <div class="plano-card">
                    <h3>${p.erva} <span class="badge ${badgeClass}">${p.tipo}</span></h3>
                    <p><strong>Resumo:</strong> ${desc}</p>
                    <p><small>Criado em: ${p.data}</small></p>
                </div>
            `
		}).join("")
	} catch (error) {
		console.error("Erro ao carregar planos:", error)
	}
}
