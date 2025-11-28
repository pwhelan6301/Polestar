// Global state to hold data from the backend
let state = {
  templates: [], // Full template objects from Cosmos DB
  selectedSector: 'Technology', // Default sector for initial load
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

async function fetchTemplates(sector) {
  try {
    const response = await fetch(`/api/prompts?sector=${sector}`);
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
    await fetchTemplates(state.selectedSector);
    return result;
  } catch (error) {
    console.error("Error saving template:", error);
    alert('Failed to save template. See console for details.');
    throw error;
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
    if (introCard && !document.getElementById('sector-display')) {
        sectorSelector.id = 'sector-display';
        sectorSelector.innerHTML = `<p>Showing prompts for sector: <strong>${state.selectedSector}</strong></p>`;
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
        <small>System: ${template?.systemPrompt || 'Not set'}</small>
        <small>User: ${template?.userPrompt || 'Not set'}</small>
      </div>
      <div>
        <button class="link-ghost" data-action="edit-section" data-template-id="${template?.id ?? ''}">Edit</button>
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
  if (sectionSubmitButton) sectionSubmitButton.textContent = 'Add Section';
  if (cancelSectionEditButton) cancelSectionEditButton.hidden = true;
}

function populateSectionForm(template) {
  if (!addSectionForm || !template) return;
  state.editingSectionId = template.id;
  if (sectionNameInput) sectionNameInput.value = template.sectionTitle || '';
  if (sectionSystemInput) sectionSystemInput.value = template.systemPrompt || '';
  if (sectionUserInput) sectionUserInput.value = template.userPrompt || '';
  if (sectionSubmitButton) sectionSubmitButton.textContent = 'Save Changes';
  if (cancelSectionEditButton) cancelSectionEditButton.hidden = false;
}

function resetParagraphForm() {
  if (!addParagraphForm) return;
  addParagraphForm.reset();
  state.editingSubsection = null;
  if (paragraphSectionSelect) paragraphSectionSelect.disabled = false;
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

    if (!newSectionName || !systemPrompt || !userPrompt) {
      alert('Section name, system prompt, and user prompt are required.');
      return;
    }

    try {
      if (state.editingSectionId) {
        const template = state.templates.find(t => t.id === state.editingSectionId);
        if (!template) {
          alert('Unable to find the section being edited.');
          return;
        }
        template.sectionTitle = newSectionName;
        template.systemPrompt = systemPrompt;
        template.userPrompt = userPrompt;
        await saveTemplate(template);
      } else {
        const newTemplate = {
          id: `${state.selectedSector.toLowerCase()}-${newSectionName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
          sector: state.selectedSector,
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
  paragraphList.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;

    const action = e.target.dataset.action;
    const templateId = e.target.dataset.templateId;
    const subsectionId = e.target.dataset.subsectionId;

    const template = state.templates.find(t => t.id === templateId);
    if (!template) return;

    if (action === 'delete') {
      if (state.editingSubsection && state.editingSubsection.subsectionId === subsectionId) {
        resetParagraphForm();
      }
      // Filter out the subsection to be deleted
      template.subsections = template.subsections.filter(sub => sub.id !== subsectionId);
      // Save the modified template
      saveTemplate(template);
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
  sectionList.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    const action = e.target.dataset.action;
    if (action !== 'edit-section') return;
    const templateId = e.target.dataset.templateId;
    const template = state.templates.find(t => t.id === templateId);
    if (template) {
      populateSectionForm(template);
    }
  });
}


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
  // Load templates for the default sector when the page loads
  fetchTemplates(state.selectedSector);
});
