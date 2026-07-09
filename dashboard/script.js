document.addEventListener('DOMContentLoaded', () => {
  // --- State & Constants ---
  let clicksChart = null;

  // --- Elements ---
  const healthBadge = document.getElementById('health-badge');

  const urlsLoading = document.getElementById('urls-loading');
  const urlsError = document.getElementById('urls-error');
  const urlsContent = document.getElementById('urls-content');
  const urlsTableBody = document.querySelector('#urls-table tbody');

  const shortenForm = document.getElementById('shorten-form');
  const shortenResult = document.getElementById('shorten-result');
  const shortenUrlText = document.getElementById('short-url-text');
  const shortenMeta = document.getElementById('shorten-meta');
  const shortenError = document.getElementById('shorten-error');
  const copyBtn = document.getElementById('copy-btn');

  const analyticsSlugInput = document.getElementById('analytics-slug');
  const loadAnalyticsBtn = document.getElementById('load-analytics-btn');
  const analyticsContent = document.getElementById('analytics-content');
  const analyticsLoading = document.getElementById('analytics-loading');
  const analyticsError = document.getElementById('analytics-error');
   const statTotalClicks = document.getElementById('stat-total-clicks');
   const statTopReferrer = document.getElementById('stat-top-referrer');
   const statCreatedAt = document.getElementById('stat-created-at');
   const referrersTableBody = document.querySelector('#referrers-table tbody');
   const countriesTableBody = document.querySelector('#countries-table tbody');
   const clicksCanvas = document.getElementById('clicks-chart');

   // --- Helpers ---
   function populateTable(tbody, data, fieldName, emptyMessage) {
     tbody.innerHTML = '';
     if (data && data.length > 0) {
       data.forEach(item => {
         const row = document.createElement('tr');
         row.innerHTML = `<td>${item[fieldName]}</td><td>${item.count.toLocaleString()}</td>`;
         tbody.appendChild(row);
       });
     } else {
       tbody.innerHTML = `<tr><td colspan="2" style="text-align:center">${emptyMessage}</td></tr>`;
     }
   }

   // --- Health Polling ---
  async function updateHealth() {
    try {
      const resp = await fetch('/health');
      const data = await resp.json();

      healthBadge.textContent = `System: ${data.status.toUpperCase()}`;
      healthBadge.className = `badge badge-${data.status}`;
    } catch (e) {
      healthBadge.textContent = 'Health: ERROR';
      healthBadge.className = 'badge badge-degraded';
    }
  }

  setInterval(updateHealth, 30000);
  updateHealth();

  // --- List URLs ---
  async function loadUrls() {
    urlsLoading.classList.remove('hidden');
    urlsError.classList.add('hidden');
    urlsContent.classList.add('hidden');

    try {
      const resp = await fetch('/api/urls');
      const urls = await resp.json();

      if (!resp.ok) {
        throw new Error(urls.error || 'Failed to load URLs');
      }

      urlsTableBody.innerHTML = '';
      if (urls.length > 0) {
        urls.forEach(url => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td><strong>${url.slug}</strong></td>
            <td class="truncate">${url.originalUrl}</td>
            <td>${new Date(url.createdAt).toLocaleString()}</td>
            <td>${url.totalClicks.toLocaleString()}</td>
          `;
          urlsTableBody.appendChild(row);
        });
      } else {
        urlsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center">No URLs found</td></tr>';
      }

      urlsLoading.classList.add('hidden');
      urlsContent.classList.remove('hidden');
    } catch (err) {
      urlsLoading.classList.add('hidden');
      urlsError.textContent = err.message;
      urlsError.classList.remove('hidden');
    }
  }

  loadUrls();

  // --- Shorten URL ---
  shortenForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const url = document.getElementById('long-url').value;
    const customSlug = document.getElementById('custom-slug').value;
    const expiresAt = document.getElementById('expiry-date').value;

    shortenResult.classList.add('hidden');
    shortenError.classList.add('hidden');

    const payload = { url };
    if (customSlug) payload.customSlug = customSlug;
    if (expiresAt) payload.expiresAt = expiresAt;

    try {
      const resp = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Failed to shorten URL');
      }

      shortenUrlText.textContent = data.shortUrl;

      let meta = `Created: ${new Date(data.createdAt).toLocaleString()}`;
      if (data.expiresAt) {
        meta += ` | Expires: ${new Date(data.expiresAt).toLocaleString()}`;
      }
      shortenMeta.textContent = meta;

      shortenResult.classList.remove('hidden');
      loadUrls();
    } catch (err) {
      shortenError.textContent = err.message;
      shortenError.classList.remove('hidden');
    }
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shortenUrlText.textContent);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = originalText, 2000);
    } catch (err) {
      alert('Failed to copy to clipboard');
    }
  });

  // --- Analytics ---
  async function loadAnalytics() {
    const slug = analyticsSlugInput.value.trim();
    if (!slug) return;

    analyticsContent.classList.add('hidden');
    analyticsError.classList.add('hidden');
    analyticsLoading.classList.remove('hidden');

    try {
      const resp = await fetch(`/api/analytics/${slug}`);
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Analytics not found for this slug');
      }

       // Update Stats
       statTotalClicks.textContent = data.totalClicks.toLocaleString();
       const topRef = data.topReferrers && data.topReferrers.length > 0
         ? data.topReferrers[0].referrer
         : 'Direct/Unknown';
       statTopReferrer.textContent = topRef;
       statCreatedAt.textContent = data.createdAt
         ? new Date(data.createdAt).toLocaleString()
         : 'N/A';

       // Update Table
       populateTable(referrersTableBody, data.topReferrers, 'referrer', 'No referrer data available');

       // Update Countries Table
       populateTable(countriesTableBody, data.topCountries, 'country', 'No country data available');

       // Update Chart
       analyticsLoading.classList.add('hidden');
       analyticsContent.classList.remove('hidden');

       requestAnimationFrame(() => {
         renderChart(data.clicksPerDay);
       });
    } catch (err) {
      analyticsLoading.classList.add('hidden');
      analyticsError.textContent = err.message;
      analyticsError.classList.remove('hidden');
    }
  }

  function renderChart(clicksPerDay) {
    if (clicksChart) {
      clicksChart.destroy();
    }

    const labels = clicksPerDay.map(d => d.date);
    const values = clicksPerDay.map(d => d.count);

    clicksChart = new (window.Chart || Chart)(clicksCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Clicks',
          data: values,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
          x: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  loadAnalyticsBtn.addEventListener('click', loadAnalytics);
  analyticsSlugInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadAnalytics();
  });
});
