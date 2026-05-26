export function csvEscape(value) {
	const safe = value === null || value === undefined ? '' : value
	return `"${String(safe).replace(/"/g, '""')}"`
}

export function csvLine(values) {
	return values.map(csvEscape).join(',')
}
