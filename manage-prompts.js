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
  selectedDocType: '',
  selectedSector: '',
  selectedClient: null, // null until a branch is selected, 'base' for sector template, or clientTag
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
const sectionDocTypeSelect = document.getElementById('section-doc-type');
const sectionSectorSelect = document.getElementById('section-sector');
const sectionClientInput = document.getElementById('section-client');
const sectionClientAdder = document.getElementById('section-client-adder');
const sectionClientNameInput = document.getElementById('section-client-name');
const sectionClientSaveButton = document.getElementById('section-client-save');
const sectionClientCancelButton = document.getElementById('section-client-cancel');
const sectionSystemInput = document.getElementById('section-system-prompt');
const sectionUserInput = document.getElementById('section-user-prompt');
const sectionSubmitButton = document.getElementById('section-submit-btn');
const cancelSectionEditButton = document.getElementById('cancel-section-edit');
const sectionSuggestButton = document.getElementById('section-suggest-btn');
const paragraphStyleInput = document.getElementById('paragraph-style');
const paragraphSubmitButton = document.getElementById('paragraph-submit-btn');
const cancelParagraphEditButton = document.getElementById('cancel-paragraph-edit');
const paragraphSuggestButton = document.getElementById('paragraph-suggest-btn');
const sectionNameInput = document.getElementById('new-section-name');
const paragraphHeaderInput = document.getElementById('paragraph-header');
const paragraphTaskInput = document.getElementById('paragraph-task');
const templateScopeLabel = document.getElementById('template-scope-label');
const branchButtonsContainer = document.getElementById('branch-buttons');
const branchPickerHint = document.getElementById('branch-picker-hint');
const clientPickerModal = document.getElementById('client-picker');
const clientPickerSelect = document.getElementById('client-picker-select');
const clientPickerAdder = document.getElementById('client-picker-adder');
const clientPickerInput = document.getElementById('client-picker-input');
const clientPickerSaveButton = document.getElementById('client-picker-save');
const clientPickerCloseAdder = document.getElementById('client-picker-close-adder');
const clientPickerCancelButton = document.getElementById('client-picker-cancel');
const clientPickerConfirmButton = document.getElementById('client-picker-confirm');
const ADD_CLIENT_OPTION = (window.ClientRegistry && window.ClientRegistry.ADD_OPTION_VALUE) || '__add_client__';
let clientRegistry = [];
let clientPickerResolver = null;
let originalSectionSnapshot = null;
let originalSubsectionSnapshot = null;

async function refreshClientRegistry() {
  if (!window.ClientRegistry) {
    clientRegistry = [];
    populateSectionClientSelect();
    populateClientPickerSelect();
    return;
  }
  try {
    clientRegistry = await window.ClientRegistry.fetchAll();
  } catch (error) {
    console.warn('Failed to load client registry', error);
    clientRegistry = [];
  }
  populateSectionClientSelect();
  populateClientPickerSelect();
}

function populateSectionClientSelect(selectedValue = '') {
  if (!sectionClientInput) return;
  const desiredValue = selectedValue || (sectionClientInput.value === ADD_CLIENT_OPTION ? '' : sectionClientInput.value);
  sectionClientInput.innerHTML = '<option value=\"\">Sector template</option>';
  clientRegistry.forEach(client => {
    if (!client?.name) return;
    const option = document.createElement('option');
    option.value = client.name;
    option.textContent = client.name;
    sectionClientInput.appendChild(option);
  });
  const addOption = document.createElement('option');
  addOption.value = ADD_CLIENT_OPTION;
  addOption.textContent = 'Add client…';
  sectionClientInput.appendChild(addOption);
  if (desiredValue) {
    const exists = clientRegistry.some(client => client.name === desiredValue);
    if (exists) {
      sectionClientInput.value = desiredValue;
    } else {
      const legacyOption = document.createElement('option');
      legacyOption.value = desiredValue;
      legacyOption.textContent = `${desiredValue} (legacy)`;
      sectionClientInput.insertBefore(legacyOption, addOption);
      sectionClientInput.value = desiredValue;
    }
  } else {
    sectionClientInput.value = '';
  }
}

function populateClientPickerSelect(selectedValue = '') {
  if (!clientPickerSelect) return;
  const desiredValue = selectedValue || (clientPickerSelect.value === ADD_CLIENT_OPTION ? '' : clientPickerSelect.value);
  clientPickerSelect.innerHTML = '<option value=\"\">Select client…</option>';
  clientRegistry.forEach(client => {
    if (!client?.name) return;
    const option = document.createElement('option');
    option.value = client.name;
    option.textContent = client.name;
    clientPickerSelect.appendChild(option);
  });
  const addOption = document.createElement('option');
  addOption.value = ADD_CLIENT_OPTION;
  addOption.textContent = 'Add client…';
  clientPickerSelect.appendChild(addOption);
  if (desiredValue) {
    const exists = clientRegistry.some(client => client.name === desiredValue);
    if (exists) {
      clientPickerSelect.value = desiredValue;
    } else {
      const fallback = document.createElement('option');
      fallback.value = desiredValue;
      fallback.textContent = desiredValue;
      clientPickerSelect.insertBefore(fallback, addOption);
      clientPickerSelect.value = desiredValue;
    }
  } else {
    clientPickerSelect.value = '';
  }
}

function showSectionClientAdder() {
  if (!sectionClientAdder) return;
  sectionClientAdder.hidden = false;
  if (sectionClientNameInput) sectionClientNameInput.focus();
}

function hideSectionClientAdder(resetSelect = false) {
  if (!sectionClientAdder) return;
  sectionClientAdder.hidden = true;
  if (sectionClientNameInput) sectionClientNameInput.value = '';
  if (resetSelect && sectionClientInput) {
    sectionClientInput.value = '';
  }
}

function showClientPickerAdder() {
  if (!clientPickerAdder) return;
  clientPickerAdder.hidden = false;
  if (clientPickerInput) clientPickerInput.focus();
}

function hideClientPickerAdder(resetSelect = false) {
  if (!clientPickerAdder) return;
  clientPickerAdder.hidden = true;
  if (clientPickerInput) clientPickerInput.value = '';
  if (resetSelect && clientPickerSelect) {
    clientPickerSelect.value = '';
  }
}

function openClientPicker(initialValue = '') {
  if (!clientPickerModal) {
    const fallback = window.prompt('Enter the client / use case name:');
    return Promise.resolve(fallback ? fallback.trim() : null);
  }
  populateClientPickerSelect(initialValue);
  clientPickerModal.hidden = false;
  document.body.classList.add('client-picker-open');
  if (clientPickerSelect) {
    clientPickerSelect.focus();
  }
  return new Promise(resolve => {
    clientPickerResolver = resolve;
  });
}

function closeClientPicker(value = null) {
  if (clientPickerModal) {
    clientPickerModal.hidden = true;
  }
  document.body.classList.remove('client-picker-open');
  hideClientPickerAdder();
  if (clientPickerResolver) {
    clientPickerResolver(value);
    clientPickerResolver = null;
  }
}

if (sectionClientInput) {
  sectionClientInput.addEventListener('change', () => {
    if (sectionClientInput.value === ADD_CLIENT_OPTION) {
      showSectionClientAdder();
    } else {
      hideSectionClientAdder();
    }
  });
}

if (sectionClientSaveButton) {
  sectionClientSaveButton.addEventListener('click', async () => {
    const newName = (sectionClientNameInput?.value || '').trim();
    if (!newName) {
      alert('Enter a client / use case before saving.');
      return;
    }
    if (!window.ClientRegistry) {
      alert('Client registry is unavailable.');
      return;
    }
    sectionClientSaveButton.disabled = true;
    try {
      const added = await window.ClientRegistry.addClient(newName);
      clientRegistry = window.ClientRegistry.getCached();
      populateSectionClientSelect(added?.name || newName);
      populateClientPickerSelect(added?.name || newName);
      hideSectionClientAdder();
    } catch (error) {
      console.error('Unable to save client', error);
      alert(error.message || 'Failed to save client.');
    } finally {
      sectionClientSaveButton.disabled = false;
    }
  });
}

if (sectionClientCancelButton) {
  sectionClientCancelButton.addEventListener('click', () => hideSectionClientAdder(true));
}

if (clientPickerSelect) {
  clientPickerSelect.addEventListener('change', () => {
    if (clientPickerSelect.value === ADD_CLIENT_OPTION) {
      showClientPickerAdder();
    } else {
      hideClientPickerAdder();
    }
  });
}

if (clientPickerSaveButton) {
  clientPickerSaveButton.addEventListener('click', async () => {
    const newName = (clientPickerInput?.value || '').trim();
    if (!newName) {
      alert('Enter a client / use case before saving.');
      return;
    }
    if (!window.ClientRegistry) {
      alert('Client registry is unavailable.');
      return;
    }
    clientPickerSaveButton.disabled = true;
    try {
      const added = await window.ClientRegistry.addClient(newName);
      clientRegistry = window.ClientRegistry.getCached();
      populateSectionClientSelect();
      populateClientPickerSelect(added?.name || newName);
      hideClientPickerAdder();
    } catch (error) {
      console.error('Unable to save client', error);
      alert(error.message || 'Failed to save client.');
    } finally {
      clientPickerSaveButton.disabled = false;
    }
  });
}

if (clientPickerCloseAdder) {
  clientPickerCloseAdder.addEventListener('click', () => hideClientPickerAdder(true));
}

if (clientPickerCancelButton) {
  clientPickerCancelButton.addEventListener('click', () => closeClientPicker(null));
}

if (clientPickerConfirmButton) {
  clientPickerConfirmButton.addEventListener('click', () => {
    const value = clientPickerSelect ? clientPickerSelect.value : '';
    const trimmed = value.trim();
    if (!trimmed || value === ADD_CLIENT_OPTION) {
      alert('Select a client before continuing.');
      return;
    }
    closeClientPicker(trimmed);
  });
}

if (clientPickerModal) {
  clientPickerModal.addEventListener('click', (event) => {
    if (event.target === clientPickerModal) {
      closeClientPicker(null);
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && clientPickerModal && !clientPickerModal.hidden) {
    closeClientPicker(null);
  }
});

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
  renderBranchPicker();
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
    const docLabel = state.selectedDocType || 'Select doc type';
    const sectorLabel = state.selectedSector || 'Select sector';
    let clientLabel = 'Choose template scope';
    if (state.selectedDocType && state.selectedSector) {
      if (state.selectedClient === 'base') {
        clientLabel = 'Sector template';
      } else if (state.selectedClient) {
        clientLabel = state.selectedClient;
      } else {
        clientLabel = 'Pick a template branch';
      }
    }
    sectorSelector.innerHTML = `<p>Managing prompts for <strong>${docLabel}</strong> / <strong>${sectorLabel}</strong> / <strong>${clientLabel}</strong></p>`;
    if (!introCard.contains(sectorSelector)) {
        introCard.appendChild(sectorSelector);
    }
}


function renderSections() {
  if (!sectionList) return;
  sectionList.innerHTML = '';

  if (!state.selectedDocType) {
    sectionList.appendChild(createEmptyState('Select a document type to load templates.'));
    resetSubsectionDropdown(true);
    return;
  }

  if (!state.selectedSector) {
    sectionList.appendChild(createEmptyState('Pick a sector next to see its templates.'));
    resetSubsectionDropdown(true);
    return;
  }

  if (!state.selectedClient) {
    sectionList.appendChild(createEmptyState('Choose the sector template or a client branch above.'));
    resetSubsectionDropdown(true);
    return;
  }

  const visibleTemplates = getVisibleTemplates();

  if (visibleTemplates.length === 0) {
    sectionList.appendChild(createEmptyState(
      state.selectedClient === 'base'
        ? 'No sections yet. Use the form above to create the sector template.'
        : 'No sections exist for this client/use case. Copy from the sector template to get started.'
    ));
  }

  visibleTemplates.forEach(template => {
    const scopeLabel = template?.clientTag ? `Client/use case: ${template.clientTag}` : 'Sector template';
    const systemDisplay = formatAnnotatedPromptText(template?.systemPrompt);
    const userDisplay = formatAnnotatedPromptText(template?.userPrompt);
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${template.sectionTitle}</strong>
        <small>Doc type: ${template?.docType || 'Not set'}</small>
        <small>Sector: ${template?.sector || 'Not set'}</small>
        <small>${scopeLabel}</small>
        <small>System: ${systemDisplay}</small>
        <small>User: ${userDisplay}</small>
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
    const suffix = template.clientTag ? ` (${template.clientTag})` : ' (sector template)';
    option.textContent = `${template.sectionTitle}${suffix}`;
    paragraphSectionSelect.appendChild(option);
  });
  paragraphSectionSelect.disabled = visibleTemplates.length === 0;
}

function renderParagraphs() {
  if (!paragraphList) return;
  paragraphList.innerHTML = '';
  if (!state.selectedDocType) {
    paragraphList.appendChild(createEmptyState('Select a document type to manage subsections.'));
    disableParagraphSelect(true);
    return;
  }

  if (!state.selectedSector) {
    paragraphList.appendChild(createEmptyState('Pick a sector to continue.'));
    disableParagraphSelect(true);
    return;
  }

  if (!state.selectedClient) {
    paragraphList.appendChild(createEmptyState('Choose a template scope to display its subsections.'));
    disableParagraphSelect(true);
    return;
  }

  const templatesToRender = getVisibleTemplates();
  disableParagraphSelect(templatesToRender.length === 0);

  if (templatesToRender.length === 0) {
    paragraphList.appendChild(createEmptyState(
      state.selectedClient === 'base'
        ? 'No subsections yet. Add section content on the left, then create subsections here.'
        : 'This client branch has no subsections yet.'
    ));
    return;
  }

  templatesToRender.forEach(template => {
    if (template.subsections && Array.isArray(template.subsections)) {
      template.subsections.forEach(sub => {
        const li = document.createElement('li');
        const detail = sub.detailTaskDescription || sub.prompt || '';
        const style = sub.styleQuery || '';
        const detailDisplay = detail ? formatAnnotatedPromptText(detail) : '';
        const styleDisplay = style ? formatAnnotatedPromptText(style) : '';
        li.innerHTML = `
          <div>
            <strong>${sub.title}</strong>
            <small>Section: ${template.sectionTitle}</small>
            <small>${template?.clientTag ? `Client: ${template.clientTag}` : 'Sector template'}</small>
            ${detail ? `<small>Task: ${detailDisplay}</small>` : ''}
            ${style ? `<small>Style: ${styleDisplay}</small>` : ''}
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

function renderBranchPicker() {
  if (!branchButtonsContainer || !branchPickerHint) return;

  if (!state.selectedDocType) {
    branchButtonsContainer.innerHTML = '';
    branchPickerHint.textContent = 'Select a document type to continue.';
    state.selectedClient = null;
    return;
  }

  if (!state.selectedSector) {
    branchButtonsContainer.innerHTML = '';
    branchPickerHint.textContent = 'Pick a sector to unlock template branches.';
    state.selectedClient = null;
    return;
  }

  const clientOptions = getClientOptions();
  branchButtonsContainer.innerHTML = '';

  const buttons = [createBranchButton('base', 'Sector template')];
  clientOptions.forEach(client => buttons.push(createBranchButton(client, client)));
  buttons.forEach(btn => branchButtonsContainer.appendChild(btn));

  if (!state.selectedClient) {
    state.selectedClient = 'base';
  } else if (state.selectedClient !== 'base' && !clientOptions.includes(state.selectedClient)) {
    state.selectedClient = clientOptions[0] || 'base';
  }

  branchPickerHint.textContent = buttons.length > 1
    ? 'Pick the branch you want to view, then edit/copy sections below.'
    : 'Currently viewing the sector template.';
}

function createBranchButton(value, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `branch-button${state.selectedClient === value ? ' active' : ''}`;
  button.textContent = label;
  button.addEventListener('click', () => {
    if (state.selectedClient === value) return;
    state.selectedClient = value;
    resetSectionForm();
    resetParagraphForm();
    render();
  });
  return button;
}

function createEmptyState(message) {
  const li = document.createElement('li');
  li.className = 'empty-state';
  li.innerHTML = `<div>${message}</div>`;
  return li;
}

function resetSubsectionDropdown(disable) {
  if (!paragraphSectionSelect) return;
  paragraphSectionSelect.innerHTML = '<option value="">Select a section...</option>';
  paragraphSectionSelect.disabled = disable;
  if (disable) {
    paragraphSectionSelect.value = '';
  }
}

function disableParagraphSelect(disabled) {
  if (!paragraphSectionSelect) return;
  paragraphSectionSelect.disabled = disabled;
  if (disabled) {
    paragraphSectionSelect.value = '';
  }
}

function resetSectionForm() {
  if (!addSectionForm) return;
  addSectionForm.reset();
  state.editingSectionId = null;
  originalSectionSnapshot = null;
  if (sectionDocTypeSelect) {
    sectionDocTypeSelect.value = state.selectedDocType || '';
    sectionDocTypeSelect.disabled = !state.selectedDocType;
  }
  if (sectionSectorSelect) {
    sectionSectorSelect.value = state.selectedSector || '';
    sectionSectorSelect.disabled = !state.selectedSector;
  }
  if (sectionClientInput) {
    const desiredClient = state.selectedClient && state.selectedClient !== 'base' ? state.selectedClient : '';
    populateSectionClientSelect(desiredClient);
  }
  if (sectionSubmitButton) sectionSubmitButton.textContent = 'Add Section';
  if (cancelSectionEditButton) cancelSectionEditButton.hidden = true;
  if (sectionSuggestButton) sectionSuggestButton.hidden = true;
}

function populateSectionForm(template) {
  if (!addSectionForm || !template) return;
  state.editingSectionId = template.id;
  originalSectionSnapshot = JSON.parse(JSON.stringify(template));
  if (sectionNameInput) sectionNameInput.value = template.sectionTitle || '';
  if (sectionDocTypeSelect) sectionDocTypeSelect.value = template.docType || '';
  if (sectionSectorSelect) sectionSectorSelect.value = template.sector || '';
  if (sectionClientInput) populateSectionClientSelect(template.clientTag || '');
  if (sectionSystemInput) sectionSystemInput.value = template.systemPrompt || '';
  if (sectionUserInput) sectionUserInput.value = template.userPrompt || '';
  if (sectionSubmitButton) sectionSubmitButton.textContent = 'Save Changes';
  if (cancelSectionEditButton) cancelSectionEditButton.hidden = false;
  if (sectionSuggestButton) sectionSuggestButton.hidden = false;
}

function resetParagraphForm() {
  if (!addParagraphForm) return;
  addParagraphForm.reset();
  state.editingSubsection = null;
  originalSubsectionSnapshot = null;
  if (paragraphSectionSelect) {
    paragraphSectionSelect.disabled = !state.selectedClient;
    paragraphSectionSelect.value = '';
  }
  if (paragraphSubmitButton) paragraphSubmitButton.textContent = 'Add Subsection';
  if (cancelParagraphEditButton) cancelParagraphEditButton.hidden = true;
  if (paragraphSuggestButton) paragraphSuggestButton.hidden = true;
}

function populateParagraphForm(template, subsection) {
  if (!addParagraphForm || !subsection) return;
  state.editingSubsection = {
    templateId: template.id,
    subsectionId: subsection.id
  };
  originalSubsectionSnapshot = JSON.parse(JSON.stringify(subsection));
  if (paragraphSectionSelect) {
    paragraphSectionSelect.value = template.id;
    paragraphSectionSelect.disabled = true;
  }
  if (paragraphHeaderInput) paragraphHeaderInput.value = subsection.title || '';
  if (paragraphTaskInput) paragraphTaskInput.value = subsection.detailTaskDescription || subsection.prompt || '';
  if (paragraphStyleInput) paragraphStyleInput.value = subsection.styleQuery || '';
  if (paragraphSubmitButton) paragraphSubmitButton.textContent = 'Save Changes';
  if (cancelParagraphEditButton) cancelParagraphEditButton.hidden = false;
  if (paragraphSuggestButton) paragraphSuggestButton.hidden = false;
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

if (sectionSuggestButton) {
  sectionSuggestButton.addEventListener('click', handleSectionSuggestion);
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

if (paragraphSuggestButton) {
  paragraphSuggestButton.addEventListener('click', handleParagraphSuggestion);
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
    state.selectedSector = '';
    if (filterSectorSelect) {
      filterSectorSelect.value = '';
      filterSectorSelect.disabled = !state.selectedDocType;
    }
    state.selectedClient = null;
    resetSectionForm();
    resetParagraphForm();
    fetchTemplates();
  });
}

if (filterSectorSelect) {
  filterSectorSelect.addEventListener('change', () => {
    state.selectedSector = filterSectorSelect.value;
    state.selectedClient = state.selectedSector ? 'base' : null;
    resetSectionForm();
    resetParagraphForm();
    fetchTemplates();
  });
}


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
  if (filterDocTypeSelect) filterDocTypeSelect.value = state.selectedDocType;
  if (filterSectorSelect) {
    filterSectorSelect.value = state.selectedSector;
    filterSectorSelect.disabled = !state.selectedDocType;
  }
  if (sectionDocTypeSelect) {
    sectionDocTypeSelect.value = state.selectedDocType;
    sectionDocTypeSelect.disabled = !state.selectedDocType;
  }
  if (sectionSectorSelect) {
    sectionSectorSelect.value = state.selectedSector;
    sectionSectorSelect.disabled = !state.selectedSector;
  }
  refreshClientRegistry();
  // Load templates for the default selections when the page loads
  fetchTemplates();
});

// --- Template helpers ---

function getVisibleTemplates() {
  if (!state.selectedClient) {
    return [];
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

function renderTemplateScopeLabel() {
  if (!templateScopeLabel) return;
  if (!state.selectedDocType || !state.selectedSector) {
    templateScopeLabel.textContent = 'Select a document type and sector to manage subsections.';
    return;
  }
  if (!state.selectedClient) {
    templateScopeLabel.textContent = 'Choose the sector template or a client branch to load subsections.';
    return;
  }
  if (state.selectedClient === 'base') {
    templateScopeLabel.textContent = 'Sector template';
    return;
  }
  templateScopeLabel.textContent = `Client / use case: ${state.selectedClient}`;
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
  await refreshClientRegistry();
  const clientName = await openClientPicker();
  if (clientName === null) {
    return;
  }
  const trimmed = (clientName || '').trim();
  if (!trimmed) {
    alert('Select a client / use case to create a copy.');
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

async function handleSectionSuggestion() {
  if (!state.editingSectionId || !originalSectionSnapshot) {
    alert('Select a section and load it before suggesting changes.');
    return;
  }
  const template = state.templates.find(t => t.id === state.editingSectionId);
  if (!template) {
    alert('Unable to find the section being edited.');
    return;
  }
  const systemValue = (sectionSystemInput?.value || '').trim();
  const userValue = (sectionUserInput?.value || '').trim();
  let changed = false;

  if (systemValue && normalizePromptValue(systemValue) !== normalizePromptValue(originalSectionSnapshot.systemPrompt)) {
    template.systemPrompt = appendSuggestionBlock(
      originalSectionSnapshot.systemPrompt || '',
      buildPromptSuggestion('system prompt', systemValue)
    );
    changed = true;
  } else {
    template.systemPrompt = originalSectionSnapshot.systemPrompt || '';
  }

  if (userValue && normalizePromptValue(userValue) !== normalizePromptValue(originalSectionSnapshot.userPrompt)) {
    template.userPrompt = appendSuggestionBlock(
      originalSectionSnapshot.userPrompt || '',
      buildPromptSuggestion('user prompt', userValue)
    );
    changed = true;
  } else {
    template.userPrompt = originalSectionSnapshot.userPrompt || '';
  }

  if (!changed) {
    alert('No edits to convert into suggestions.');
    return;
  }

  try {
    await saveTemplate(template);
    alert('Suggestions saved as inline annotations for this section.');
    resetSectionForm();
    fetchTemplates();
  } catch (error) {
    // saveTemplate already alerts on failure
  }
}

async function handleParagraphSuggestion() {
  if (!state.editingSubsection || !originalSubsectionSnapshot) {
    alert('Select a subsection to suggest changes.');
    return;
  }
  const template = state.templates.find(t => t.id === state.editingSubsection.templateId);
  if (!template || !Array.isArray(template.subsections)) {
    alert('Unable to find the subsection being edited.');
    return;
  }
  const subsection = template.subsections.find(sub => sub.id === state.editingSubsection.subsectionId);
  if (!subsection) {
    alert('Unable to find the subsection being edited.');
    return;
  }

  const headerValue = (paragraphHeaderInput?.value || '').trim();
  const taskValue = (paragraphTaskInput?.value || '').trim();
  const styleValue = (paragraphStyleInput?.value || '').trim();

  const originalTask = originalSubsectionSnapshot.detailTaskDescription || originalSubsectionSnapshot.prompt || '';
  const originalStyle = originalSubsectionSnapshot.styleQuery || '';
  const originalTitle = originalSubsectionSnapshot.title || '';

  const detailSuggestions = [];
  if (headerValue && normalizePromptValue(headerValue) !== normalizePromptValue(originalTitle)) {
    detailSuggestions.push(buildPromptSuggestion('header', headerValue));
  }
  if (taskValue && normalizePromptValue(taskValue) !== normalizePromptValue(originalTask)) {
    detailSuggestions.push(buildPromptSuggestion('task', taskValue));
  }
  let changed = detailSuggestions.length > 0;
  if (detailSuggestions.length > 0) {
    const combined = detailSuggestions.join('\n');
    const updatedDescription = appendSuggestionBlock(originalTask, combined);
    subsection.detailTaskDescription = updatedDescription;
    subsection.prompt = updatedDescription;
  } else {
    subsection.detailTaskDescription = originalTask;
    subsection.prompt = originalTask;
  }

  if (styleValue && normalizePromptValue(styleValue) !== normalizePromptValue(originalStyle)) {
    subsection.styleQuery = appendSuggestionBlock(originalStyle, buildPromptSuggestion('style', styleValue));
    changed = true;
  } else {
    subsection.styleQuery = originalStyle;
  }

  subsection.title = originalTitle;

  if (!changed) {
    alert('No edits to convert into suggestions.');
    return;
  }

  try {
    await saveTemplate(template);
    alert('Subsection suggestions saved as inline annotations.');
    resetParagraphForm();
    fetchTemplates();
  } catch (error) {
    // saveTemplate handles alerting
  }
}

function appendSuggestionBlock(baseText, suggestion) {
  if (!suggestion) return baseText || '';
  if (!baseText) return suggestion;
  return `${baseText}\n\n${suggestion}`;
}

function buildPromptSuggestion(label, value) {
  const trimmed = (value || '').trim();
  const limited = trimmed.length > 1200 ? `${trimmed.slice(0, 1200)}…` : trimmed;
  return `[Suggestion for ${label}: ${limited}]`;
}

function normalizePromptValue(value) {
  return (value || '').trim();
}

function formatAnnotatedPromptText(value) {
  if (!value) return 'Not set';
  return escapePromptHtml(value).replace(/\[([^\]]+)\]/g, (match) => `<span class="inline-annotation">${match}</span>`);
}

function escapePromptHtml(value) {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
