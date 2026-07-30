// Thin wrapper around Chart.js (loaded via CDN in index.html) so page code
// never touches the charting library directly. Swapping charting libraries
// later means editing only this file.

const PALETTE = ['#4F46E5', '#A78BFA', '#F59E0B', '#10B981', '#EC4899', '#0EA5E9'];

function baseAxisOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#98A2B3' } },
      y: {
        grid: { color: '#EEF0F3' },
        ticks: { font: { family: 'Inter', size: 11 }, color: '#98A2B3', precision: 0 },
        beginAtZero: true
      }
    }
  };
}

export function renderLineChart(canvas, { labels, data, label }) {
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79,70,229,0.08)',
        fill: true,
        tension: 0.35,
        pointRadius: 2.5,
        pointBackgroundColor: '#4F46E5',
        borderWidth: 2
      }]
    },
    options: baseAxisOptions()
  });
}

export function renderBarChart(canvas, { labels, data, label }) {
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        backgroundColor: '#4F46E5',
        borderRadius: 6,
        maxBarThickness: 34
      }]
    },
    options: baseAxisOptions()
  });
}

export function renderDonutChart(canvas, { labels, data }) {
  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: labels.map(function (_, i) { return PALETTE[i % PALETTE.length]; }),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, padding: 14, font: { family: 'Inter', size: 11.5 }, color: '#667085' }
        }
      }
    }
  });
}
