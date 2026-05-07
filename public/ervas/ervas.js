initDB().then(() => {
	carregarErvas()
}).catch(erro => console.error("Erro na BD:", erro))

const form = document.getElementById("ervaForm")
const fileInput = document.getElementById("csvFile")

form.addEventListener("submit", async (e) => {
	e.preventDefault()
	const novaErva = {
		nome: document.getElementById("nome").value,
		cientifico: document.getElementById("cientifico").value
	}

	try {
		await dbAdd("ervas", novaErva)
		await registarLog(`Registou a planta aromática: ${novaErva.nome}`)
		form.reset()
		alert("Planta registada com sucesso!")
		carregarErvas()
	} catch (error) {
		alert("Erro ao guardar erva.")
		console.error(error)
	}
})

async function carregarErvas() {
	const lista = document.getElementById("listaErvas")

	try {
		const ervas = await dbGetAll("ervas")

		if (ervas.length === 0) {
			lista.innerHTML = "<p>Nenhuma planta no catálogo. Adicione uma ou importe via CSV.</p>"
			return
		}

		lista.innerHTML = ervas.map(erv => `
			<div class="erva-card">
				<h3>${erv.nome}</h3>
				<p><em>${erv.cientifico || '---'}</em></p>
			</div>
		`).join("")
	} catch (error) {
		console.error("Erro ao carregar ervas:", error)
	}
}

fileInput.addEventListener("change", e => {
	const file = e.target.files[0]
	if (!file) return

	const reader = new FileReader()
	reader.onload = async function (event) {
		try {
			const lines = event.target.result.split('\n')
			let count = 0

			for (const line of lines) {
				const parts = line.split(',')
				if (parts[0] && parts[0].trim() !== '') {
					await dbAdd("ervas", { nome: parts[0].trim(), cientifico: parts[1]?.trim() })
					count++
				}
			}
			alert(`${count} plantas importadas com sucesso!`)
			await registarLog(`Importou ${count} plantas aromáticas via CSV.`)
			carregarErvas()
		} catch (error) {
			alert("Ocorreu um erro ao ler ou gravar o ficheiro CSV.")
			console.error(error)
		} finally {
			fileInput.value = ""
		}
	}
	reader.readAsText(file)
})
