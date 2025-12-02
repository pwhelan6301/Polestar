// Simple shared helper to fetch and maintain the client registry.
(function () {
  const ADD_OPTION_VALUE = '__add_client__';
  let cache = [];
  let loadPromise = null;

  async function fetchAll(forceRefresh = false) {
    if (loadPromise) {
      return loadPromise;
    }
    if (!forceRefresh && cache.length > 0) {
      return cache;
    }

    loadPromise = fetch('/api/clients')
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Failed to load clients (${response.status})`);
        }
        return response.json();
      })
      .then((data) => {
        const list = Array.isArray(data?.clients) ? data.clients : [];
        cache = list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return cache;
      })
      .catch((error) => {
        console.error('Unable to load client registry', error);
        throw error;
      })
      .finally(() => {
        loadPromise = null;
      });

    return loadPromise;
  }

  async function addClient(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      throw new Error('Client name is required.');
    }
    const response = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to add client.');
    }
    const data = await response.json();
    const list = Array.isArray(data?.clients) ? data.clients : [];
    if (list.length > 0) {
      cache = list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (data?.client) {
      cache = [...cache, data.client].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return data?.client || null;
  }

  function getCached() {
    return cache.slice();
  }

  window.ClientRegistry = {
    ADD_OPTION_VALUE,
    fetchAll,
    addClient,
    getCached
  };
})();
