const DOC_TYPES = [
  { value: 'IM', label: 'Information Memorandum (IM)' },
  { value: 'SectorValuation', label: 'Sector valuation' }
];

const SECTORS = [
  'Business Services',
  'Software, Media & Technology',
  'Sustainability',
  'Manufacturing & Industrial',
  'Health & Education'
];

const STATUS_LABELS = {
  new: 'New',
  in_review: 'In review',
  needs_changes: 'Needs changes',
  approved: 'Approved'
};

const state = {
  drafts: [],
  selectedDraftId: null,
  filters: {
    docType: '',
    sector: '',
    client: '',
    status: '',
    search: ''
  }
};

// DOM references
const draftListEl = document.getElementById('draft-list');
const draftMetaEl = document.getElementById('draft-meta');
const draftContentEl = document.getElementById('draft-content');
const draftStatusSelect = document.getElementById('draft-status-select');
const draftAnnotations = document.getElementById('draft-annotations');
const draftSaveBtn = document.getElementById('draft-save-btn');
const draftStatusMsg = document.getElementById('draft-status-message');
const draftExportBtn = document.getElementById('draft-export-btn');
const draftCopyBtn = document.getElementById('draft-copy-btn');

const filterDocSelect = document.getElementById('filter-draft-doc');
const filterSectorSelect = document.getElementById('filter-draft-sector');
const filterClientInput = document.getElementById('filter-draft-client');
const filterStatusSelect = document.getElementById('filter-draft-status');
const filterSearchInput = document.getElementById('filter-draft-search');
const selectionToolbar = document.getElementById('selection-toolbar');
const selectionAddNoteBtn = document.getElementById('selection-add-note');
let currentSelectionData = null;

document.addEventListener('DOMContentLoaded', () => {
  populateFilters();
  attachFilterListeners();
  attachDetailListeners();
  loadDrafts();
});

function populateFilters() {
  if (filterDocSelect) {
    DOC_TYPES.forEach(doc => {
      const option = document.createElement('option');
      option.value = doc.value;
      option.textContent = doc.label;
      filterDocSelect.appendChild(option);
    });
  }

  if (filterSectorSelect) {
    SECTORS.forEach(sector => {
      const option = document.createElement('option');
      option.value = sector;
      option.textContent = sector;
      filterSectorSelect.appendChild(option);
    });
  }
}

function attachFilterListeners() {
  if (filterDocSelect) {
    filterDocSelect.addEventListener('change', () => {
      state.filters.docType = filterDocSelect.value;
      renderDrafts();
    });
  }
  if (filterSectorSelect) {
    filterSectorSelect.addEventListener('change', () => {
      state.filters.sector = filterSectorSelect.value;
      renderDrafts();
    });
  }
  if (filterClientInput) {
    filterClientInput.addEventListener('input', () => {
      state.filters.client = filterClientInput.value.trim();
      renderDrafts();
    });
  }
  if (filterStatusSelect) {
    filterStatusSelect.addEventListener('change', () => {
      state.filters.status = filterStatusSelect.value;
      renderDrafts();
    });
  }
  if (filterSearchInput) {
    filterSearchInput.addEventListener('input', () => {
      state.filters.search = filterSearchInput.value.trim();
      renderDrafts();
    });
  }
}

function attachDetailListeners() {
  if (draftStatusSelect) {
    draftStatusSelect.addEventListener('change', () => {
      const draft = getSelectedDraft();
      if (!draft) return;
      draft.status = draftStatusSelect.value;
      queueDraftSave({ status: draft.status });
    });
  }

  if (draftAnnotations) {
    draftAnnotations.addEventListener('input', () => {
      const draft = getSelectedDraft();
      if (!draft) return;
      draft.annotations = draftAnnotations.value;
      draftSaveBtn.disabled = false;
    });
  }

  if (draftSaveBtn) {
    draftSaveBtn.addEventListener('click', async () => {
      const draft = getSelectedDraft();
      if (!draft) return;
      await queueDraftSave({ annotations: draft.annotations });
      draftSaveBtn.disabled = true;
    });
  }

  if (draftCopyBtn) {
    draftCopyBtn.addEventListener('click', () => {
      const draft = getSelectedDraft();
      if (!draft) return;
      const text = renderDraftText(draft);
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        showStatusMessage('Draft copied to clipboard.', 'success');
      }).catch(() => {
        showStatusMessage('Unable to copy draft. Select the content and copy manually.', 'error');
      });
    });
  }

  if (draftExportBtn) {
    draftExportBtn.addEventListener('click', () => {
      const draft = getSelectedDraft();
      if (!draft) return;
      const htmlDocument = buildWordDocument(draft);
      const blob = new Blob([htmlDocument], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slugifyFilename(draft.operationID || draft.id || 'draft')}.doc`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  if (draftContentEl) {
    ['mouseup', 'keyup'].forEach(eventName => {
      draftContentEl.addEventListener(eventName, handleSelectionChange);
    });
    draftContentEl.addEventListener('scroll', hideSelectionToolbar);
  }

  document.addEventListener('scroll', hideSelectionToolbar, true);

  if (selectionAddNoteBtn) {
    selectionAddNoteBtn.addEventListener('click', handleSelectionNote);
  }
}

async function loadDrafts() {
  try {
    const response = await fetch('/api/drafts');
    if (!response.ok) throw new Error('Failed to load drafts');
    const data = await response.json();
    state.drafts = Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('Falling back to placeholder drafts', error);
    state.drafts = getPlaceholderDrafts();
  }
  renderDrafts();
}

function renderDrafts() {
  if (!draftListEl) return;
  draftListEl.innerHTML = '';
  const filtered = getFilteredDrafts();

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'draft-card';
    empty.innerHTML = '<div>No drafts match the current filters.</div>';
    draftListEl.appendChild(empty);
    renderDraftDetail();
    return;
  }

  filtered.forEach(draft => {
    const card = document.createElement('div');
    card.className = `draft-card${draft.id === state.selectedDraftId ? ' active' : ''}`;
    card.innerHTML = `
      <div class="draft-card__details">
        <h3>${draft.operationID || draft.id}</h3>
        <div class="draft-card__meta">
          <span>${draft.docType || '-'}</span>
          <span>${draft.sector || '-'}</span>
          ${draft.client ? `<span>${draft.client}</span>` : ''}
          <span>Updated ${formatDate(draft.updatedAt || draft.generatedAt)}</span>
        </div>
      </div>
      <div class="draft-card__status">
        <span class="badge">${STATUS_LABELS[draft.status] || 'Not set'}</span>
      </div>
    `;
    card.addEventListener('click', () => {
      state.selectedDraftId = draft.id;
      renderDrafts();
    });
    draftListEl.appendChild(card);
  });

  if (!state.selectedDraftId) {
    state.selectedDraftId = filtered[0].id;
  }

  renderDraftDetail();
}

function renderDraftDetail() {
  hideSelectionToolbar();
  const draft = getSelectedDraft();
  if (!draft) {
    if (draftMetaEl) draftMetaEl.innerHTML = '<p>Select a draft from the left to see its content.</p>';
    if (draftContentEl) draftContentEl.innerHTML = '<p class="field-hint">No draft selected.</p>';
    updateDetailControls(false);
    return;
  }

  if (draftMetaEl) {
    draftMetaEl.innerHTML = `
      <p><strong>Operation:</strong> ${draft.operationID || '—'}</p>
      <p><strong>Client:</strong> ${draft.client || '—'}</p>
      <p><strong>Template:</strong> ${draft.templateID || '—'}</p>
      <p><strong>Updated:</strong> ${formatDate(draft.updatedAt || draft.generatedAt)}</p>
    `;
  }

  if (draftContentEl) {
    draftContentEl.innerHTML = renderDraftContent(draft);
  }

  if (draftStatusSelect) {
    draftStatusSelect.value = draft.status || '';
    draftStatusSelect.disabled = false;
  }

  if (draftAnnotations) {
    draftAnnotations.value = draft.annotations || '';
    draftAnnotations.disabled = false;
  }

  if (draftSaveBtn) {
    draftSaveBtn.disabled = true;
  }
}

function updateDetailControls(enabled) {
  if (draftStatusSelect) draftStatusSelect.disabled = !enabled;
  if (draftAnnotations) draftAnnotations.disabled = !enabled;
  if (draftSaveBtn) draftSaveBtn.disabled = !enabled;
  if (draftCopyBtn) draftCopyBtn.disabled = !enabled;
  if (draftExportBtn) draftExportBtn.disabled = !enabled;
}

function getFilteredDrafts() {
  return state.drafts.filter(draft => {
    if (state.filters.docType && draft.docType !== state.filters.docType) return false;
    if (state.filters.sector && draft.sector !== state.filters.sector) return false;
    if (state.filters.client && !matchesText(draft.client, state.filters.client)) return false;
    if (state.filters.status && draft.status !== state.filters.status) return false;
    if (state.filters.search && !matchesAnyField(draft, state.filters.search)) return false;
    return true;
  });
}

function matchesText(value, query) {
  if (!value) return false;
  return value.toLowerCase().includes(query.toLowerCase());
}

function matchesAnyField(draft, query) {
  const haystack = [
    draft.operationID,
    draft.templateID,
    draft.client,
    draft.summary,
    draft.content
  ].join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function getSelectedDraft() {
  if (!state.selectedDraftId) return null;
  return state.drafts.find(d => d.id === state.selectedDraftId) || null;
}

async function queueDraftSave(update) {
  const draft = getSelectedDraft();
  if (!draft) return;
  Object.assign(draft, update);
  if (draftStatusMsg) {
    draftStatusMsg.textContent = 'Saving…';
    draftStatusMsg.style.color = 'var(--text-soft)';
  }

  try {
    const response = await fetch(`/api/drafts/${encodeURIComponent(draft.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    });
    if (!response.ok) throw new Error('Failed to save');
    showStatusMessage('Draft updated.', 'success');
  } catch (error) {
    console.error('Failed to save draft', error);
    showStatusMessage('Unable to save draft. Changes are stored locally until you retry.', 'error');
  }
}

function showStatusMessage(message, type) {
  if (!draftStatusMsg) return;
  draftStatusMsg.textContent = message;
  draftStatusMsg.style.color = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--text-soft)';
  setTimeout(() => {
    if (draftStatusMsg.textContent === message) {
      draftStatusMsg.textContent = '';
    }
  }, 3000);
}

function renderDraftContent(draft) {
  if (Array.isArray(draft.sections) && draft.sections.length > 0) {
    return draft.sections.map(renderDraftSection).join('');
  }
  if (typeof draft.content === 'string') {
    return renderDraftSection({
      title: draft.operationID || draft.docType || 'Draft',
      body: draft.content
    });
  }
  return '<p class="field-hint">No content available for this draft.</p>';
}

function renderDraftText(draft) {
  if (Array.isArray(draft.sections) && draft.sections.length > 0) {
    return draft.sections.map(section => `${section.title}\n${section.body || section.content || ''}`).join('\n\n');
  }
  return draft.content || '';
}

function renderDraftSection(section) {
  const title = section?.title || 'Untitled section';
  const bodyHtml = formatDraftParagraphs(section?.body || section?.content || '');
  return `
    <section class="draft-section" data-section-title="${escapeAttribute(title)}">
      <div class="draft-section__header">
        <h4>${escapeHtml(title)}</h4>
      </div>
      <div class="draft-section__body">
        ${bodyHtml}
      </div>
    </section>
  `;
}

function formatDraftParagraphs(text) {
  const safe = escapeHtml(text || '');
  if (!safe) {
    return '<p class="field-hint">No content available for this section.</p>';
  }
  return safe
    .split(/\n{2,}/)
    .map(block => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleString();
}

function buildWordDocument(draft) {
  const bodyMarkup = renderDraftContent(draft);
  const title = escapeHtml(draft.operationID || draft.id || 'Draft document');
  return `
    <!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #222; }
          h4 { margin-bottom: 0.25rem; }
          section { margin-bottom: 1.25rem; }
          p { margin: 0 0 0.75rem; }
        </style>
      </head>
      <body>
        ${bodyMarkup}
      </body>
    </html>
  `;
}

function slugifyFilename(value) {
  return (value || 'draft')
    .toString()
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_');
}

function escapeHtml(value) {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function getSectionTitleFromNode(node) {
  if (!node) return '';
  let current = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  while (current && current !== draftContentEl) {
    if (current.classList && current.classList.contains('draft-section')) {
      return current.dataset.sectionTitle || current.querySelector('h4')?.textContent || '';
    }
    current = current.parentElement;
  }
  return '';
}

function handleSelectionChange() {
  if (!draftContentEl || !selectionToolbar) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    hideSelectionToolbar();
    return;
  }
  const range = selection.getRangeAt(0);
  if (!draftContentEl.contains(range.commonAncestorContainer)) {
    hideSelectionToolbar();
    return;
  }
  const snippet = selection.toString().trim();
  if (!snippet) {
    hideSelectionToolbar();
    return;
  }

  const rect = range.getBoundingClientRect();
  selectionToolbar.hidden = false;
  const toolbarWidth = selectionToolbar.offsetWidth || 160;
  const left = Math.min(
    window.scrollX + rect.left,
    window.scrollX + window.innerWidth - toolbarWidth - 16
  );
  selectionToolbar.style.top = `${rect.bottom + window.scrollY + 10}px`;
  selectionToolbar.style.left = `${Math.max(window.scrollX + 16, left)}px`;
  currentSelectionData = {
    text: snippet,
    section: getSectionTitleFromNode(range.commonAncestorContainer)
  };
}

function hideSelectionToolbar() {
  if (selectionToolbar) {
    selectionToolbar.hidden = true;
  }
  currentSelectionData = null;
}

function handleSelectionNote() {
  if (!currentSelectionData || !draftAnnotations) {
    hideSelectionToolbar();
    return;
  }
  const suggestion = window.prompt('Describe your suggested change for the selected text:');
  if (!suggestion) {
    hideSelectionToolbar();
    return;
  }
  const parts = [];
  if (currentSelectionData.section) {
    parts.push(`Section: ${currentSelectionData.section}`);
  }
  parts.push(`Selection: "${currentSelectionData.text}"`);
  parts.push(`Suggestion: ${suggestion.trim()}`);
  const entry = parts.join('\n');
  const existing = draftAnnotations.value.trim();
  draftAnnotations.value = existing ? `${existing}\n\n${entry}` : entry;
  draftAnnotations.dispatchEvent(new Event('input'));
  showStatusMessage('Annotation added. Click Save annotations to persist.', 'success');
  hideSelectionToolbar();
}

function getPlaceholderDrafts() {
  return [
    {
      id: 'draft-placeholder-1',
      docType: 'IM',
      sector: 'Business Services',
      client: 'Project Atlas',
      status: 'new',
      operationID: 'ATLAS-IM-2024',
      templateID: 'im-business-services-overview',
      generatedAt: new Date().toISOString(),
      annotations: '',
      sections: [
        { title: 'Executive summary', body: 'Placeholder summary for Project Atlas.\nHighlight key growth story and market positioning.' },
        { title: 'Investment highlights', body: '1. Strong recurring revenue\n2. Diversified enterprise clients\n3. Margin expansion underway' }
      ]
    },
    {
      id: 'draft-placeholder-2',
      docType: 'SectorValuation',
      sector: 'Software, Media & Technology',
      client: 'Project Helios',
      status: 'needs_changes',
      operationID: 'HELIOS-SV',
      templateID: 'sv-smt-valuation',
      generatedAt: new Date(Date.now() - 86400000).toISOString(),
      annotations: 'Review financial model assumptions with sector team.',
      content: 'Sector valuation draft placeholder for Helios.'
    }
  ];
}
