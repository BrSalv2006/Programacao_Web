import { apiFetch } from '/js/storage/api.js'
import { showAlert } from '/js/utils/alert.js'

document.addEventListener('DOMContentLoaded', () => {
	const tbody = document.getElementById('table-body')

	async function loadUsers() {
		try {
			const res = await apiFetch('/api/admin/users')
			const data = await res.json()
			if (data.success) {
				renderTable(data.data)
			} else {
				throw data
			}
		} catch (e) {
			tbody.innerHTML = `
				<tr>
					<td colspan="4" class="color-danger">Acesso Negado ou Erro. Apenas Admins.</td>
				</tr>
			`
		}
	}

	function renderTable(users) {
		tbody.innerHTML = users.map(u => {
			const date = new Date(u.createdAt).toLocaleDateString('pt-PT')
			return `
                <tr>
                    <td class="text-bold color-dark">${u.name}</td>
                    <td>${u.email}</td>
                    <td>${date}</td>
                    <td>
                        <select class="form-control role-select role-select-custom" data-id="${u._id}">
                            <option value="Pendente" ${u.role === 'Pendente' ? 'selected' : ''}>Pendente</option>
                            <option value="Técnico" ${u.role === 'Técnico' ? 'selected' : ''}>Técnico</option>
                            <option value="Responsável" ${u.role === 'Responsável' ? 'selected' : ''}>Responsável</option>
                            <option value="Administrador" ${u.role === 'Administrador' ? 'selected' : ''}>Administrador</option>
                        </select>
                    </td>
                </tr>
            `
		}).join('')

		document.querySelectorAll('.role-select').forEach(select => {
			select.addEventListener('change', async (e) => {
				const newRole = e.target.value
				const id = e.target.dataset.id
				try {
					const res = await apiFetch(`/api/admin/users/${id}/role`, {
						method: 'PATCH', body: JSON.stringify({ role: newRole })
					})
					const data = await res.json()
					if (data.success) {
						showAlert('alert', 'Cargo atualizado com sucesso.', 'success')
					} else {
						showAlert('alert', data.error || 'Erro ao atualizar o cargo.', 'error')
					}
				} catch (error) {
					console.error('Erro ao atualizar cargo', error)
					showAlert('alert', 'Ocorreu um erro de comunicação ao atualizar o cargo.', 'error')
				}
			})
		})
	}

	loadUsers()
})
