const DOCUMENT_TYPES = [
  { value: 'IM', label: 'Information Memorandum (IM)' },
  { value: 'SectorValuation', label: 'Sector valuation' }
];

const SECTORS = [
  { value: 'Business Services', label: 'Business Services' },
  { value: 'Software, Media & Technology', label: 'Software, Media & Technology' },
  { value: 'Sustainability', label: 'Sustainability' },
  { value: 'Manufacturing & Industrial', label: 'Manufacturing & Industrial' },
  { value: 'Health & Education', label: 'Health & Education' }
];

// Global state to hold data from the backend
let state = {
  templates: [], // Full template objects from Cosmos DB
  selectedDocType: DOCUMENT_TYPES[0].value,
  selectedSector: SECTORS[0].value,
  selectedClient: 'all', // 'all', 'base', or specific clientTag
  editingSectionId: null,
  editingSubsection: null
};

// --- DOM Elements ---
const sectionList = document.getElementById('section-list');
const paragraphList = document.getElementById('paragraph-list');
const addSectionForm = document.getElementById('add-section-form');
const addParagraphForm = document.getElementById('add-paragraph-form');
const paragraphSectionSelect = document.getElementById('paragraph-section');
const sectorSelector = document.createElement('div'); // A new element to select sector
const filterDocTypeSelect = document.getElementById('filter-doc-type');
const filterSectorSelect = document.getElementById('filter-sector');
const filterClientSelect = document.getElementById('filter-client');
const sectionDocTypeSelect = document.getElementById('section-doc-type');
const sectionSectorSelect = document.getElementById('section-sector');
const sectionClientInput = document.getElementById('section-client');
const sectionSystemInput = document.getElementById('section-system-prompt');
const sectionUserInput = document.getElementById('section-user-prompt');
const sectionSubmitButton = document.getElementById('section-submit-btn');
const cancelSectionEditButton = document.getElementById('cancel-section-edit');
const paragraphStyleInput = document.getElementById('paragraph-style');
const paragraphSubmitButton = document.getElementById('paragraph-submit-btn');
const cancelParagraphEditButton = document.getElementById('cancel-paragraph-edit');
const sectionNameInput = document.getElementById('new-section-name');
const paragraphHeaderInput = document.getElementById('paragraph-header');
const paragraphTaskInput = document.getElementById('paragraph-task');
const templateScopeLabel = document.getElementById('template-scope-label');

// --- API Functions ---

async function fetchTemplates() {
  try {
    const { selectedSector, selectedDocType } = state;
    if (!selectedSector || !selectedDocType) {
      state.templates = [];
      render();
      return;
    }
    const response = await fetch(`/api/prompts?sector=${encodeURIComponent(selectedSector)}&docType=${encodeURIComponent(selectedDocType)}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} body: ${errorText}`);
    }
    const templates = await response.json();
    state.templates = templates;
    render();
    resetSectionForm();
    resetParagraphForm();
  } catch (error) {
    console.error("Error fetching templates:", error);
    alert('Failed to load templates. See console for details.');
  }
}

async function saveTemplate(template) {
  try {
    const response = await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} body: ${errorText}`);
    }
    const result = await response.json();
    console.log('Save successful:', result);
    // Refresh data after saving
    await fetchTemplates();
    return result;
  } catch (error) {
    console.error("Error saving template:", error);
    alert('Failed to save template. See console for details.');
    throw error;
  }
}

async function deleteTemplate(template) {
  if (!template) return;
  try {
    const response = await fetch(`/api/prompts?id=${encodeURIComponent(template.id)}&sector=${encodeURIComponent(template.sector)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} body: ${errorText}`);
    }
    await fetchTemplates();
  } catch (error) {
    console.error("Error deleting template:", error);
    alert('Failed to delete section. See console for details.');
  }
}

// --- Render Functions ---

function render() {
  renderClientFilterOptions();
  renderSectorSelector();
  renderSections();
  renderParagraphs();
  renderTemplateScopeLabel();
}

function renderSectorSelector() {
    // For now, let's just display the selected sector, not make it a dropdown.
    // This can be enhanced later.
    const introCard = document.querySelector('.intro.card');
    if (!introCard) return;
    sectorSelector.id = 'sector-display';
    const clientLabel = state.selectedClient === 'all'
      ? 'All templates'
      : state.selectedClient === 'base'
        ? 'Sector default'
        : state.selectedClient;
    sectorSelector.innerHTML = `<p>Managing prompts for <strong>${state.selectedDocType}</strong> / <strong>${state.selectedSector}</strong> / <strong>${clientLabel}</strong></p>`;
    if (!introCard.contains(sectorSelector)) {
        introCard.appendChild(sectorSelector);
    }
}


function renderSections() {
  if (!sectionList) return;
  sectionList.innerHTML = '';
  const visibleTemplates = getVisibleTemplates();

  if (visibleTemplates.length === 0) {
    const emptyState = document.createElement('li');
    emptyState.innerHTML = '<div>No templates match the current filters.</div>';
    sectionList.appendChild(emptyState);
  }

  visibleTemplates.forEach(template => {
    const scopeLabel = template?.clientTag ? `Client/use case: ${template.clientTag}` : 'Sector default';
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${template.sectionTitle}</strong>
        <small>Doc type: ${template?.docType || 'Not set'}</small>
        <small>Sector: ${template?.sector || 'Not set'}</small>
        <small>${scopeLabel}</small>
        <small>System: ${template?.systemPrompt || 'Not set'}</small>
        <small>User: ${template?.userPrompt || 'Not set'}</small>
      </div>
      <div>
        <button class="link-ghost" data-action="edit-section" data-template-id="${template?.id ?? ''}">View / Edit</button>
        <button class="link-ghost" data-action="copy-section" data-template-id="${template?.id ?? ''}">Copy to new template</button>
        <button class="link-ghost" data-action="delete-section" data-template-id="${template?.id ?? ''}">Delete</button>
      </div>
    `;
    sectionList.appendChild(li);
  });

  if (!paragraphSectionSelect) return;
  paragraphSectionSelect.innerHTML = '<option value="">Select a section...</option>';
  visibleTemplates.forEach(template => {
    if (!template?.id) return;
    const option = document.createElement('option');
    option.value = template.id;
    const suffix = template.clientTag ? ` (${template.clientTag})` : ' (sector default)';
    option.textContent = `${template.sectionTitle}${suffix}`;
    paragraphSectionSelect.appendChild(option);
  });
}

function renderParagraphs() {
  if (!paragraphList) return;
  paragraphList.innerHTML = '';
  const templatesToRender = getVisibleTemplates();
  templatesToRender.forEach(template => {
    if (template.subsections && Array.isArray(template.subsections)) {
      template.subsections.forEach(sub => {
        const li = document.createElement('li');
        const detail = sub.detailTaskDescription || sub.prompt || '';
        const style = sub.styleQuery || '';
        li.innerHTML = `
          <div>
            <strong>${sub.title}</strong>
            <small>Section: ${template.sectionTitle}</small>
            <small>${template?.clientTag ? `Client: ${template.clientTag}` : 'Sector default'}</small>
            ${detail ? `<small>Task: ${detail}</small>` : ''}
            ${style ? `<small>Style: ${style}</small>` : ''}
          </div>
          <div>
            <button class="link-ghost" data-template-id="${template.id}" data-subsection-id="${sub.id}" data-action="edit">Edit</button>
            <button class="link-ghost" data-template-id="${template.id}" data-subsection-id="${sub.id}" data-action="delete">Delete</button>
          </div>
        `;
        paragraphList.appendChild(li);
      });
    }
  });
}

// --- Helpers ---

function resetSectionForm() {
  if (!addSectionForm) return;
  addSectionForm.reset();
  state.editingSectionId = null;
  if (sectionDocTypeSelect) sectionDocTypeSelect.value = state.selectedDocType || '';
  if (sectionSectorSelect) sectionSectorSelect.value = state.selectedSector || '';
  if (sectionClientInput) sectionClientInput.value = state.selectedClient && state.selectedClient !== 'all' && state.selectedClient !== 'base' ? state.selectedClient : '';
  if (sectionSubmitButton) sectionSubmitButton.textContent = 'Add Section';
  if (cancelSectionEditButton) cancelSectionEditButton.hidden = true;
}

function populateSectionForm(template) {
  if (!addSectionForm || !template) return;
  state.editingSectionId = template.id;
  if (sectionNameInput) sectionNameInput.value = template.sectionTitle || '';
  if (sectionDocTypeSelect) sectionDocTypeSelect.value = template.docType || '';
  if (sectionSectorSelect) sectionSectorSelect.value = template.sector || '';
  if (sectionClientInput) sectionClientInput.value = template.clientTag || '';
  if (sectionSystemInput) sectionSystemInput.value = template.systemPrompt || '';
  if (sectionUserInput) sectionUserInput.value = template.userPrompt || '';
  if (sectionSubmitButton) sectionSubmitButton.textContent = 'Save Changes';
  if (cancelSectionEditButton) cancelSectionEditButton.hidden = false;
}

function resetParagraphForm() {
  if (!addParagraphForm) return;
  addParagraphForm.reset();
  state.editingSubsection = null;
  if (paragraphSectionSelect) {
    paragraphSectionSelect.disabled = false;
    paragraphSectionSelect.value = '';
  }
  if (paragraphSubmitButton) paragraphSubmitButton.textContent = 'Add Subsection';
  if (cancelParagraphEditButton) cancelParagraphEditButton.hidden = true;
}

function populateParagraphForm(template, subsection) {
  if (!addParagraphForm || !subsection) return;
  state.editingSubsection = {
    templateId: template.id,
    subsectionId: subsection.id
  };
  if (paragraphSectionSelect) {
    paragraphSectionSelect.value = template.id;
    paragraphSectionSelect.disabled = true;
  }
  if (paragraphHeaderInput) paragraphHeaderInput.value = subsection.title || '';
  if (paragraphTaskInput) paragraphTaskInput.value = subsection.detailTaskDescription || subsection.prompt || '';
  if (paragraphStyleInput) paragraphStyleInput.value = subsection.styleQuery || '';
  if (paragraphSubmitButton) paragraphSubmitButton.textContent = 'Save Changes';
  if (cancelParagraphEditButton) cancelParagraphEditButton.hidden = false;
}

// --- Event Listeners ---

if (addSectionForm) {
  addSectionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newSectionName = (sectionNameInput?.value || '').trim();
    const systemPrompt = (sectionSystemInput?.value || '').trim();
    const userPrompt = (sectionUserInput?.value || '').trim();
    const docTypeValue = sectionDocTypeSelect?.value || '';
    const sectorValue = sectionSectorSelect?.value || '';
    const clientValue = (sectionClientInput?.value || '').trim();

    if (!newSectionName || !systemPrompt || !userPrompt || !docTypeValue || !sectorValue) {
      alert('Document type, sector, section name, system prompt, and user prompt are required.');
      return;
    }

    state.selectedDocType = docTypeValue;
    state.selectedSector = sectorValue;
    if (filterDocTypeSelect) filterDocTypeSelect.value = docTypeValue;
    if (filterSectorSelect) filterSectorSelect.value = sectorValue;

    try {
      if (state.editingSectionId) {
        const template = state.templates.find(t => t.id === state.editingSectionId);
        if (!template) {
          alert('Unable to find the section being edited.');
          return;
        }
        template.sectionTitle = newSectionName;
        template.docType = docTypeValue;
        template.sector = sectorValue;
        if (clientValue) {
          template.clientTag = clientValue;
        } else {
          delete template.clientTag;
        }
        template.systemPrompt = systemPrompt;
        template.userPrompt = userPrompt;
        await saveTemplate(template);
      } else {
        const newTemplate = {
          id: `${docTypeValue.toLowerCase()}-${sectorValue.replace(/\s+/g, '-').toLowerCase()}-${newSectionName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
          sector: sectorValue,
          docType: docTypeValue,
          clientTag: clientValue || undefined,
          sectionTitle: newSectionName,
          systemPrompt,
          userPrompt,
          mainPrompt: { text: "Default main prompt...", tone: "Default" },
          subsections: []
        };
        await saveTemplate(newTemplate);
      }
      resetSectionForm();
    } catch {
      // errors handled in saveTemplate
    }
  });
}

if (cancelSectionEditButton) {
  cancelSectionEditButton.addEventListener('click', resetSectionForm);
}

if (addParagraphForm) {
  addParagraphForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedTemplateId = paragraphSectionSelect ? paragraphSectionSelect.value : '';
    const headerValue = (paragraphHeaderInput?.value || '').trim();
    const descriptionValue = (paragraphTaskInput?.value || '').trim();
    const styleValue = (paragraphStyleInput?.value || '').trim();

    if (!selectedTemplateId) {
      alert('Select a section / template to edit its subsections.');
      return;
    }

    if (!headerValue || !descriptionValue) {
      alert('Subsection header and task description are required.');
      return;
    }

    const template = state.templates.find(t => t.id === selectedTemplateId);

    if (!template) {
        alert('Please select a valid section.');
        return;
    }

    if (!Array.isArray(template.subsections)) {
      template.subsections = [];
    }

    try {
      if (state.editingSubsection) {
        const subsectionIndex = template.subsections.findIndex(
          sub => sub.id === state.editingSubsection.subsectionId
        );
        if (subsectionIndex === -1) {
          alert('Unable to find the subsection being edited.');
          return;
        }
        template.subsections[subsectionIndex] = {
          ...template.subsections[subsectionIndex],
          title: headerValue,
          detailTaskDescription: descriptionValue,
          styleQuery: styleValue,
          prompt: descriptionValue,
          type: template.subsections[subsectionIndex].type || 'text'
        };
        await saveTemplate(template);
      } else {
        const newSubsection = {
          id: `sub-${Date.now()}`, // Simple unique ID for the subsection
          title: headerValue,
          detailTaskDescription: descriptionValue,
          styleQuery: styleValue,
          prompt: descriptionValue,
          type: 'text' // Or derive from a new form field
        };
        template.subsections.push(newSubsection);
        await saveTemplate(template);
      }
      resetParagraphForm();
    } catch {
      // handled in saveTemplate
    }
  });
}

if (cancelParagraphEditButton) {
  cancelParagraphEditButton.addEventListener('click', resetParagraphForm);
}

if (paragraphList) {
  paragraphList.addEventListener('click', async (e) => {
    if (e.target.tagName !== 'BUTTON') return;

    const action = e.target.dataset.action;
    const templateId = e.target.dataset.templateId;
    const subsectionId = e.target.dataset.subsectionId;

    const template = state.templates.find(t => t.id === templateId);
    if (!template) return;
    if (!Array.isArray(template.subsections)) {
      template.subsections = [];
    }

    if (action === 'delete') {
      if (state.editingSubsection && state.editingSubsection.subsectionId === subsectionId) {
        resetParagraphForm();
      }
      // Filter out the subsection to be deleted
      template.subsections = template.subsections.filter(sub => sub.id !== subsectionId);
      // Save the modified template
      try {
        await saveTemplate(template);
      } catch {
        // errors handled in saveTemplate
      }
    }

    if (action === 'edit') {
      const subsection = template.subsections.find(sub => sub.id === subsectionId);
      if (subsection) {
        populateParagraphForm(template, subsection);
      }
    }
  });
}

if (sectionList) {
  sectionList.addEventListener('click', async (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    const action = e.target.dataset.action;
    const templateId = e.target.dataset.templateId;
    const template = state.templates.find(t => t.id === templateId);
    if (!template) return;

    if (action === 'edit-section') {
      populateSectionForm(template);
    }

    if (action === 'copy-section') {
      await copyTemplateToClient(template);
    }

    if (action === 'delete-section') {
      const confirmDelete = window.confirm(`Delete the "${template.sectionTitle}" section? This removes all of its subsections.`);
      if (confirmDelete) {
        if (state.editingSectionId === template.id) {
          resetSectionForm();
          resetParagraphForm();
        }
        await deleteTemplate(template);
      }
    }
  });
}

if (filterDocTypeSelect) {
  filterDocTypeSelect.addEventListener('change', () => {
    state.selectedDocType = filterDocTypeSelect.value;
    state.selectedClient = 'all';
    resetSectionForm();
    resetParagraphForm();
    fetchTemplates();
  });
}

if (filterSectorSelect) {
  filterSectorSelect.addEventListener('change', () => {
    state.selectedSector = filterSectorSelect.value;
    state.selectedClient = 'all';
    resetSectionForm();
    resetParagraphForm();
    fetchTemplates();
  });
}

if (filterClientSelect) {
  filterClientSelect.addEventListener('change', () => {
    state.selectedClient = filterClientSelect.value;
    resetSectionForm();
    resetParagraphForm();
    render();
  });
}


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
  if (filterDocTypeSelect) filterDocTypeSelect.value = state.selectedDocType;
  if (filterSectorSelect) filterSectorSelect.value = state.selectedSector;
  if (filterClientSelect) filterClientSelect.value = state.selectedClient;
  if (sectionDocTypeSelect) sectionDocTypeSelect.value = state.selectedDocType;
  if (sectionSectorSelect) sectionSectorSelect.value = state.selectedSector;
  // Load templates for the default selections when the page loads
  fetchTemplates();
});

// --- Template helpers ---

function getVisibleTemplates() {
  if (state.selectedClient === 'all') {
    return state.templates;
  }
  if (state.selectedClient === 'base') {
    return state.templates.filter(t => !t.clientTag);
  }
  return state.templates.filter(t => (t.clientTag || '') === state.selectedClient);
}

function getClientOptions() {
  const options = state.templates
    .map(t => t.clientTag)
    .filter(tag => !!tag);
  return [...new Set(options)].sort((a, b) => a.localeCompare(b));
}

function renderClientFilterOptions() {
  if (!filterClientSelect) return;
  const currentValue = state.selectedClient;
  const options = getClientOptions();
  filterClientSelect.innerHTML = '';

  const baseOptions = [
    { value: 'all', label: 'All templates' },
    { value: 'base', label: 'Sector default only' }
  ];
  baseOptions.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    filterClientSelect.appendChild(option);
  });

  options.forEach(client => {
    const option = document.createElement('option');
    option.value = client;
    option.textContent = client;
    filterClientSelect.appendChild(option);
  });

  if (currentValue !== 'all' && currentValue !== 'base' && !options.includes(currentValue)) {
    state.selectedClient = 'all';
  }

  filterClientSelect.value = state.selectedClient;
}

function renderTemplateScopeLabel() {
  if (!templateScopeLabel) return;
  if (state.selectedClient === 'all') {
    templateScopeLabel.textContent = 'All templates (select a client to narrow down)';
  } else if (state.selectedClient === 'base') {
    templateScopeLabel.textContent = 'Sector default template';
  } else {
    templateScopeLabel.textContent = `Client / use case: ${state.selectedClient}`;
  }
}

function slugify(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function copyTemplateToClient(template) {
  if (!template) return;
  const clientName = window.prompt('Enter the client / use case name for this template copy:');
  if (clientName === null) {
    return;
  }
  const trimmed = clientName.trim();
  if (!trimmed) {
    alert('Client / use case name is required to create a copy.');
    return;
  }

  const sanitizedTemplate = sanitizeTemplate(template);
  const slugParts = [
    template.docType || 'doc',
    template.sector || 'sector',
    template.sectionTitle || 'section',
    trimmed
  ].map(slugify);

  sanitizedTemplate.id = `${slugParts.join('-')}-${Date.now()}`;
  sanitizedTemplate.clientTag = trimmed;
  sanitizedTemplate.parentTemplateId = template.parentTemplateId || template.id;

  try {
    await saveTemplate(sanitizedTemplate);
    state.selectedClient = trimmed;
    resetSectionForm();
    resetParagraphForm();
    render();
  } catch {
    // errors handled in saveTemplate
  }
}

function sanitizeTemplate(template) {
  const clone = JSON.parse(JSON.stringify(template));
  Object.keys(clone).forEach(key => {
    if (key.startsWith('_')) {
      delete clone[key];
    }
  });
  return clone;
}
