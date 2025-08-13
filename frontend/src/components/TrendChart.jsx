import { Line } from "react-chartjs-2"
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip } from 'chart.js'
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip)

export default function TrendChart({ data=[] }){
  const labels = data.map(d => d.date)
  const weights = data.map(d => d.weight)
  const trends = data.map(d => d.trend)

  return (
    <div className="card">
      <h3 className="text-xl font-bold mb-4">Poids & Tendance</h3>
      <Line
        data={{
          labels,
          datasets: [
            { label: "Poids", data: weights, tension: 0.3 },
            { label: "Tendance (EWMA)", data: trends, tension: 0.3 }
          ]
        }}
        options={{
          responsive: true,
          plugins: { legend: { position: 'top' } },
          scales: { y: { beginAtZero: false } }
        }}
      />
    </div>
  )
}
