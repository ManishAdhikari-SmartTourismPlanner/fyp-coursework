export function monthKeyFromDate(dateValue) {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabelFromKey(monthKey) {
  if (!monthKey) {
    return 'Unknown'
  }

  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) {
    return 'Unknown'
  }

  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export function buildMonthlySeries(items, dateKey, valueGetter = () => 1) {
  const monthlyTotals = new Map()

  items.forEach((item) => {
    const monthKey = monthKeyFromDate(item?.[dateKey])
    if (!monthKey) {
      return
    }

    monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + Number(valueGetter(item) || 0))
  })

  return Array.from(monthlyTotals.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([monthKey, value]) => ({
      label: monthLabelFromKey(monthKey),
      value,
    }))
}

export function buildCountSeries(items, labelGetter, valueGetter = () => 1, limit = 6) {
  const counts = new Map()

  items.forEach((item) => {
    const label = String(labelGetter(item) || '').trim()
    if (!label) {
      return
    }

    counts.set(label, (counts.get(label) || 0) + Number(valueGetter(item) || 0))
  })

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, value]) => ({
      label,
      value,
    }))
}