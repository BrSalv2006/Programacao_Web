if (window.currentUser && window.currentUser.perfil !== 'Administrador') {
	alert("Acesso Negado: Apenas Administradores podem visualizar o Registo de Auditoria.")
	window.location.href = "/"
}

initDB().then(() => {
	carregarLogs()
}).catch(err => console.error("Erro na BD:", err))

async function carregarLogs() {
	const tbody = document.getElementById('logsTableBody')

	try {
		const logs = await dbGetAll("logs")
		logs.reverse()

		if (logs.length === 0) {
			tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum registo encontrado.</td></tr>'
			return
		}

		tbody.innerHTML = logs.map(log => {
			let classePerfil = "tecnico"
			if (log.perfil === "Administrador") classePerfil = "admin"
			else if (log.perfil === "Responsável") classePerfil = "responsavel"

			return `
                <tr>
                    <td class="log-date">${log.data}</td>
                    <td><strong>${log.utilizador}</strong></td>
                    <td><span class="badge-perfil ${classePerfil}">${log.perfil}</span></td>
                    <td>${log.acao}</td>
                </tr>
            `
		}).join("")
	} catch (error) {
		console.error("Erro ao carregar logs:", error)
		tbody.innerHTML = '<tr><td colspan="4" class="text-error">Erro ao ler os dados de auditoria.</td></tr>'
	}
}
