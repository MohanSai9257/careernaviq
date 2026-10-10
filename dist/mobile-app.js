(() => {
  const mobileQuery = window.matchMedia('(max-width: 760px)');

  function labelTableCells(table) {
    const labels = [...table.querySelectorAll('thead th')].map((cell) =>
      cell.textContent.trim().replace(/\s+/g, ' '),
    );
    for (const row of table.querySelectorAll('tbody tr')) {
      [...row.children].forEach((cell, index) => {
        const label = labels[index] || '';
        if (label) cell.dataset.label = label;
        else delete cell.dataset.label;
      });
    }
  }

  function updateMobileTables() {
    if (!mobileQuery.matches) return;
    document.querySelectorAll('table').forEach(labelTableCells);
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateMobileTables();
    const observer = new MutationObserver(updateMobileTables);
    observer.observe(document.body, { childList: true, subtree: true });
  });
  mobileQuery.addEventListener('change', updateMobileTables);
})();
