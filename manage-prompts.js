// Global state to hold data from the backend
let state = {
  templates: [], // This will hold the full template objects from Cosmos DB
  selectedSector: 'Technology' // Default sector for initial load
};

// --- DOM Elements ---
const sectionList = document.getElementById('section-list');
const paragraphList = document.getElementById('paragraph-list');
const addSectionForm = document.getElementById('add-section-form');
const addParagraphForm = document.getElementById('add-paragraph-form');
const paragraphSectionSelect = document.getElementById('paragraph-section');
const sectorSelector = document.createElement('div'); // A new element to select sector

// --- API Functions ---

async function fetchTemplates(sector) {
  try {
    const response = await fetch(`/api/prompts?sector=${sector}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const templates = await response.json();
    state.templates = templates;
    render();
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
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    console.log('Save successful:', result);
    // Refresh data after saving
    fetchTemplates(state.selectedSector);
  } catch (error) {
    console.error("Error saving template:", error);
    alert('Failed to save template. See console for details.');
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
    const li = document.createElement('li');
    // Note: Deleting a "section" from the UI would mean deleting all templates with that sectionTitle.
    // This is a complex operation, so for now, the delete button is simplified.
    li.innerHTML = `
      <span>${sectionTitle}</span>
      <button class="link-ghost" data-section-title="${sectionTitle}">Delete</button>
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
        li.innerHTML = `
          <div>
            <strong>${sub.title}</strong>
            <small>Section: ${template.sectionTitle}</small>
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

// --- Event Listeners ---

if (addSectionForm) {
  addSectionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newSectionName = document.getElementById('new-section-name').value;
    if (newSectionName) {
      const newTemplate = {
        // e.g., "tech-exec-summary-v1" - needs a robust way to be generated
        id: `${state.selectedSector.toLowerCase()}-${newSectionName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
        sector: state.selectedSector,
        sectionTitle: newSectionName,
        mainPrompt: { text: "Default main prompt...", tone: "Default" },
        subsections: []
      };
      saveTemplate(newTemplate);
      addSectionForm.reset();
    }
  });
}

if (addParagraphForm) {
  addParagraphForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const sectionTitle = document.getElementById('paragraph-section').value;
    const template = state.templates.find(t => t.sectionTitle === sectionTitle);

    if (!template) {
        alert('Please select a valid section.');
        return;
    }

    const newSubsection = {
      id: `sub-${Date.now()}`, // Simple unique ID for the subsection
      title: document.getElementById('paragraph-header').value,
      prompt: document.getElementById('paragraph-task').value,
      type: 'text' // Or derive from a new form field
    };

    if (newSubsection.title && newSubsection.prompt) {
      // Add the new subsection to the found template
      template.subsections.push(newSubsection);
      // Save the entire updated template
      saveTemplate(template);
      addParagraphForm.reset();
    }
  });
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
      // Filter out the subsection to be deleted
      template.subsections = template.subsections.filter(sub => sub.id !== subsectionId);
      // Save the modified template
      saveTemplate(template);
    }

    if (action === 'edit') {
      const subsection = template.subsections.find(sub => sub.id === subsectionId);
      if (subsection) {
        // Pre-fill the form
        document.getElementById('paragraph-section').value = template.sectionTitle;
        document.getElementById('paragraph-header').value = subsection.title;
        document.getElementById('paragraph-task').value = subsection.prompt;
        // For simplicity, we remove the old one. The user can then re-submit the form to add the "edited" one.
        template.subsections = template.subsections.filter(sub => sub.id !== subsectionId);
        saveTemplate(template);
      }
    }
  });
}


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
  // Load templates for the default sector when the page loads
  fetchTemplates(state.selectedSector);
});
