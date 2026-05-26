export const limitesFisicos = {
	temperatura: { min: -20, max: 60 },
	humidade: { min: 0, max: 100 },
	luminosidade: { min: 0, max: 200000 }
}

export function valorValido(valor) {
	return typeof valor === 'number' && Number.isFinite(valor)
}

export function avaliarFalhasSensor(medicao) {
	const problemas = []

	Object.entries(limitesFisicos).forEach(([campo, limite]) => {
		const valor = medicao[campo]
		if (!valorValido(valor)) {
			problemas.push(`Dados em falta: ${campo}`)
			return
		}
		if (valor < limite.min || valor > limite.max) {
			problemas.push(`Dados incoerentes: ${campo}`)
		}
	})

	return problemas
}

export function avaliarCondicoesPlano(medicao, condicoes = {}) {
	const problemas = []

	if (valorValido(condicoes.temperaturaMax) && medicao.temperatura > condicoes.temperaturaMax) problemas.push('Temperatura alta')
	if (valorValido(condicoes.temperaturaMin) && medicao.temperatura < condicoes.temperaturaMin) problemas.push('Temperatura baixa')
	if (valorValido(condicoes.humidadeMax) && medicao.humidade > condicoes.humidadeMax) problemas.push('Humidade alta')
	if (valorValido(condicoes.humidadeMin) && medicao.humidade < condicoes.humidadeMin) problemas.push('Humidade baixa')
	if (valorValido(condicoes.luminosidadeMax) && medicao.luminosidade > condicoes.luminosidadeMax) problemas.push('Luminosidade alta')
	if (valorValido(condicoes.luminosidadeMin) && medicao.luminosidade < condicoes.luminosidadeMin) problemas.push('Luminosidade baixa')

	return problemas
}

export function escolherAcaoAutomacao(problemas) {
	if (problemas.includes('Humidade baixa')) return { tarefa: 'rega', descricao: 'Ativar rega' }
	if (problemas.includes('Temperatura alta')) return { tarefa: 'monitorização', descricao: 'Ajustar ventilação' }
	if (problemas.some(problema => problema.includes('Luminosidade'))) return { tarefa: 'monitorização', descricao: 'Ajustar luminosidade' }
	return { tarefa: 'monitorização', descricao: 'Verificar condições ambientais' }
}
