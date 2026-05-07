const authUser = JSON.parse(sessionStorage.getItem('greenherb_user'))
const currentPath = window.location.pathname

if (!authUser && !currentPath.includes('/login')) {
	window.location.href = '/login/'
} else if (authUser && currentPath.includes('/login')) {
	window.location.href = '/'
}

window.logout = function () {
	sessionStorage.removeItem('greenherb_user')
	window.location.href = '/login/'
}

window.currentUser = authUser
