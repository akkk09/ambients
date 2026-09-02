import { storage } from './storage.js';
import { renderIcons } from './icons.js';

document.addEventListener('DOMContentLoaded', () => {
  renderIcons();
  
  const metrics = storage.getMetrics();
  
  // Update Top Stats
  const hours = Math.floor((metrics.totalFocusMinutes || 0) / 60);
  const mins = (metrics.totalFocusMinutes || 0) % 60;
  document.getElementById('stat-total-time').textContent = `${hours}h ${mins}m`;
  document.getElementById('stat-streak').textContent = `${metrics.streak || 1} Days`;
  document.getElementById('stat-tasks').textContent = `${metrics.todayCompletedTasks || 0}`;

  // Initialize Charts
  const ctxFocus = document.getElementById('focusChart').getContext('2d');
  new Chart(ctxFocus, {
    type: 'bar',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Focus Minutes',
        data: [120, 150, 90, 200, 180, 250, 100], // Mock history for now
        backgroundColor: '#38bdf8',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#ffffff10' } },
        x: { grid: { display: false } }
      }
    }
  });

  const ctxTask = document.getElementById('taskChart').getContext('2d');
  new Chart(ctxTask, {
    type: 'doughnut',
    data: {
      labels: ['Focus', 'Drill', 'Review', 'Code'],
      datasets: [{
        data: [45, 25, 20, 10], // Mock distribution
        backgroundColor: ['#38bdf8', '#10b981', '#f59e0b', '#a855f7'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'right', labels: { color: '#cbd5e1' } }
      }
    }
  });
});
