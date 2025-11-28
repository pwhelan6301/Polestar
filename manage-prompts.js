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
  renderSectorSelector();
  renderSections();
  renderParagraphs();
}

function renderSectorSelector() {
    // For now, let's just display the selected sector, not make it a dropdown.
    // This can be enhanced later.
    const introCard = document.querySelector('.intro.card');
    if (!introCard) return;
    sectorSelector.id = 'sector-display';
    sectorSelector.innerHTML = `<p>Managing prompts for <strong>${state.selectedDocType}</strong> / <strong>${state.selectedSector}</strong></p>`;
    if (!introCard.contains(sectorSelector)) {
        introCard.appendChild(sectorSelector);
    }
}


function getUniqueSections() {
    const sectionTitles = state.templates.map(t => t.sectionTitle);
    return [...new Set(sectionTitles)];
}

function renderSections() {
  if (!sectionList) return;
  sectionList.innerHTML = '';
  const uniqueSections = getUniqueSections();

  uniqueSections.forEach(sectionTitle => {
    const template = state.templates.find(t => t.sectionTitle === sectionTitle);
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${sectionTitle}</strong>
        <small>Doc type: ${template?.docType || 'Not set'}</small>
        <small>Sector: ${template?.sector || 'Not set'}</small>
        <small>System: ${template?.systemPrompt || 'Not set'}</small>
        <small>User: ${template?.userPrompt || 'Not set'}</small>
      </div>
      <div>
        <button class="link-ghost" data-action="edit-section" data-template-id="${template?.id ?? ''}">Edit</button>
        <button class="link-ghost" data-action="delete-section" data-template-id="${template?.id ?? ''}">Delete</button>
      </div>
    `;
    sectionList.appendChild(li);
  });

  if (!paragraphSectionSelect) return;
  paragraphSectionSelect.innerHTML = '<option value="">Select a section...</option>';
  uniqueSections.forEach(sectionTitle => {
    const option = document.createElement('option');
    option.value = sectionTitle;
    option.textContent = sectionTitle;
    paragraphSectionSelect.appendChild(option);
  });
}

function renderParagraphs() {
  if (!paragraphList) return;
  paragraphList.innerHTML = '';
  state.templates.forEach(template => {
    if (template.subsections && Array.isArray(template.subsections)) {
      template.subsections.forEach(sub => {
        const li = document.createElement('li');
        const detail = sub.detailTaskDescription || sub.prompt || '';
        const style = sub.styleQuery || '';
        li.innerHTML = `
          <div>
            <strong>${sub.title}</strong>
            <small>Section: ${template.sectionTitle}</small>
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
  if (sectionSubmitButton) sectionSubmitButton.textContent = 'Add Section';
  if (cancelSectionEditButton) cancelSectionEditButton.hidden = true;
}

function populateSectionForm(template) {
  if (!addSectionForm || !template) return;
  state.editingSectionId = template.id;
  if (sectionNameInput) sectionNameInput.value = template.sectionTitle || '';
  if (sectionDocTypeSelect) sectionDocTypeSelect.value = template.docType || '';
  if (sectionSectorSelect) sectionSectorSelect.value = template.sector || '';
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
  if (paragraphSubmitButton) paragraphSubmitButton.textContent = 'Add Paragraph';
  if (cancelParagraphEditButton) cancelParagraphEditButton.hidden = true;
}

function populateParagraphForm(template, subsection) {
  if (!addParagraphForm || !subsection) return;
  state.editingSubsection = {
    templateId: template.id,
    subsectionId: subsection.id
  };
  if (paragraphSectionSelect) {
    paragraphSectionSelect.value = template.sectionTitle;
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
        template.systemPrompt = systemPrompt;
        template.userPrompt = userPrompt;
        await saveTemplate(template);
      } else {
        const newTemplate = {
          id: `${docTypeValue.toLowerCase()}-${sectorValue.replace(/\s+/g, '-').toLowerCase()}-${newSectionName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
          sector: sectorValue,
          docType: docTypeValue,
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
    const sectionTitle = paragraphSectionSelect ? paragraphSectionSelect.value : '';
    const headerValue = (paragraphHeaderInput?.value || '').trim();
    const descriptionValue = (paragraphTaskInput?.value || '').trim();
    const styleValue = (paragraphStyleInput?.value || '').trim();

    if (!headerValue || !descriptionValue) {
      alert('Paragraph header and task description are required.');
      return;
    }

    const template = state.templates.find(t => t.sectionTitle === sectionTitle);

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
          alert('Unable to find the paragraph being edited.');
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

    if (action === 'delete-section') {
      const confirmDelete = window.confirm(`Delete the "${template.sectionTitle}" section? This removes all of its paragraphs.`);
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
    resetSectionForm();
    resetParagraphForm();
    fetchTemplates();
  });
}

if (filterSectorSelect) {
  filterSectorSelect.addEventListener('change', () => {
    state.selectedSector = filterSectorSelect.value;
    resetSectionForm();
    resetParagraphForm();
    fetchTemplates();
  });
}


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
  if (filterDocTypeSelect) filterDocTypeSelect.value = state.selectedDocType;
  if (filterSectorSelect) filterSectorSelect.value = state.selectedSector;
  if (sectionDocTypeSelect) sectionDocTypeSelect.value = state.selectedDocType;
  if (sectionSectorSelect) sectionSectorSelect.value = state.selectedSector;
  // Load templates for the default selections when the page loads
  fetchTemplates();
});
