import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const PIE_COLORS = ['#2563eb', '#7c3aed', '#0f766e', '#f59e0b', '#ef4444', '#14b8a6']

function formatNumber(value) {
  return Number(value || 0).toLocaleString()
}

function ChartTooltip({ active, payload, label, valueSuffix = '' }) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const item = payload[0]

  return (
    <div className="chart-tooltip">
      <strong>{label || item.name}</strong>
      <span>{formatNumber(item.value)}{valueSuffix}</span>
    </div>
  )
}

function formatHeaderValue(value, suffix = '') {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (typeof value === 'number') {
    return `${formatNumber(value)}${suffix}`
  }

  return `${value}${suffix}`
}

function ChartPanel({
  title,
  description,
  children,
  emptyText,
  totalLabel,
  totalValue,
  totalSuffix = '',
  legendItems = [],
}) {
  return (
    <section className="card analytics-card dashboard-chart-card">
      <div className="dashboard-chart-header">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        <div className="dashboard-chart-meta">
          {totalLabel && totalValue !== undefined && totalValue !== null && (
            <div className="dashboard-chart-total">
              <span>{totalLabel}</span>
              <strong>{formatHeaderValue(totalValue, totalSuffix)}</strong>
            </div>
          )}
          {legendItems.length > 0 && (
            <div className="dashboard-chart-legend">
              {legendItems.map((item) => (
                <span className="dashboard-chart-legend-item" key={item.label} title={item.label}>
                  <span className="dashboard-chart-legend-dot" style={{ backgroundColor: item.color || '#2563eb' }} />
                  <span>{item.label}</span>
                  {item.value !== undefined && item.value !== null && <strong>{formatHeaderValue(item.value, item.valueSuffix || '')}</strong>}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {children}
      {emptyText && <div className="chart-empty-state">{emptyText}</div>}
    </section>
  )
}

export default function AnalyticsCharts({
  pieTitle,
  pieDescription,
  pieData = [],
  pieValueSuffix = '',
  lineTitle,
  lineDescription,
  lineData = [],
  lineXAxisKey = 'label',
  lineValueKey = 'value',
  lineValueSuffix = '',
  lineStroke = '#2563eb',
  barTitle,
  barDescription,
  barData = [],
  barXAxisKey = 'label',
  barValueKey = 'value',
  barValueSuffix = '',
  barColor = '#0f766e',
  pieTotalLabel,
  pieTotalValue,
  pieTotalSuffix = '',
  pieLegendItems = [],
  lineTotalLabel,
  lineTotalValue,
  lineTotalSuffix = '',
  lineLegendItems = [],
  barTotalLabel,
  barTotalValue,
  barTotalSuffix = '',
  barLegendItems = [],
}) {
  const pieTotal = pieData.reduce((sum, item) => sum + Number(item.value || 0), 0)
  const pieLabel = (entry) => {
    const value = Number(entry?.value || 0)
    if (!pieTotal || !value) {
      return null
    }

    const percent = Math.round((value / pieTotal) * 100)
    return `${percent}%`
  }

  return (
    <div className="dashboard-chart-grid">
      <ChartPanel
        title={pieTitle}
        description={pieDescription}
        emptyText={!pieData.length ? 'No pie chart data yet.' : ''}
        totalLabel={pieTotalLabel}
        totalValue={pieTotalValue}
        totalSuffix={pieTotalSuffix}
        legendItems={pieLegendItems}
      >
        {pieData.length > 0 && (
          <div className="dashboard-chart-frame dashboard-chart-frame-pie">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Tooltip content={<ChartTooltip valueSuffix={pieValueSuffix} />} />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={3}
                  labelLine={false}
                  label={pieLabel}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`pie-cell-${entry.name}-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartPanel>

      <ChartPanel
        title={lineTitle}
        description={lineDescription}
        emptyText={!lineData.length ? 'No trend data yet.' : ''}
        totalLabel={lineTotalLabel}
        totalValue={lineTotalValue}
        totalSuffix={lineTotalSuffix}
        legendItems={lineLegendItems}
      >
        {lineData.length > 0 && (
          <div className="dashboard-chart-frame">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={lineData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey={lineXAxisKey} tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                <Tooltip content={<ChartTooltip valueSuffix={lineValueSuffix} />} />
                <Line
                  type="monotone"
                  dataKey={lineValueKey}
                  stroke={lineStroke}
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartPanel>

      <ChartPanel
        title={barTitle}
        description={barDescription}
        emptyText={!barData.length ? 'No bar chart data yet.' : ''}
        totalLabel={barTotalLabel}
        totalValue={barTotalValue}
        totalSuffix={barTotalSuffix}
        legendItems={barLegendItems}
      >
        {barData.length > 0 && (
          <div className="dashboard-chart-frame">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey={barXAxisKey} tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                <Tooltip content={<ChartTooltip valueSuffix={barValueSuffix} />} />
                <Bar dataKey={barValueKey} fill={barColor} radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartPanel>
    </div>
  )
}