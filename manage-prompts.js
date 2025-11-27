// Mock data for initial display
let mockSections = [
  'Background & History',
  'Market'
];

let mockParagraphs = [
  {
    id: 1,
    section: 'Background & History',
    header: 'OVERVIEW',
    task: 'Describe how the client\'s business has evolved over time...', // Corrected: escaped apostrophe
    style: 'overview of a company\'s evolution and current position' // Corrected: escaped apostrophe
  },
  {
    id: 2,
    section: 'Background & History',
    header: 'TIMELINE',
    task: 'Set out a clear, chronological timeline of the client\'s development...', // Corrected: escaped apostrophe
    style: 'concise chronological company history and key milestones'
  }
];

// --- DOM Elements ---
const sectionList = document.getElementById('section-list');
const paragraphList = document.getElementById('paragraph-list');
const addSectionForm = document.getElementById('add-section-form');
const addParagraphForm = document.getElementById('add-paragraph-form');
const paragraphSectionSelect = document.getElementById('paragraph-section');

// --- Functions ---

function renderSections() {
  if (!sectionList) return;
  sectionList.innerHTML = '';
  mockSections.forEach((section, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${section}</span>
      <button class="link-ghost" data-index="${index}">Delete</button>
    `; // Corrected: escaped double quotes within template literal
    sectionList.appendChild(li);
  });

  if (!paragraphSectionSelect) return;
  paragraphSectionSelect.innerHTML = '<option value="">Select a section...</option>'; // Corrected: escaped double quotes within template literal
  mockSections.forEach(section => {
    const option = document.createElement('option');
    option.value = section;
    option.textContent = section;
    paragraphSectionSelect.appendChild(option);
  });
}

function renderParagraphs() {
  if (!paragraphList) return;
  paragraphList.innerHTML = '';
  mockParagraphs.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${p.header}</strong>
        <small>Section: ${p.section}</small>
      </div>
      <div>
        <button class="link-ghost" data-id="${p.id}" data-action="edit">Edit</button>
        <button class="link-ghost" data-id="${p.id}" data-action="delete">Delete</button>
      </div>
    `; // Corrected: escaped double quotes within template literal
    paragraphList.appendChild(li);
  });
}

// --- Event Listeners ---

if (addSectionForm) {
  addSectionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newSectionName = document.getElementById('new-section-name').value;
    if (newSectionName) {
      mockSections.push(newSectionName);
      renderSections();
      addSectionForm.reset();
    }
  });
}

if (addParagraphForm) {
  addParagraphForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newParagraph = {
      id: Date.now(),
      section: document.getElementById('paragraph-section').value,
      header: document.getElementById('paragraph-header').value,
      task: document.getElementById('paragraph-task').value,
      style: document.getElementById('paragraph-style').value
    };
    if (newParagraph.section && newParagraph.header && newParagraph.task) {
      mockParagraphs.push(newParagraph);
      renderParagraphs();
      addParagraphForm.reset();
    }
  });
}

if (sectionList) {
  sectionList.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      const index = e.target.dataset.index;
      mockSections.splice(index, 1);
      renderSections();
      renderParagraphs();
    }
  });
}

if (paragraphList) {
  paragraphList.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      const id = parseInt(e.target.dataset.id);
      const action = e.target.dataset.action;

      if (action === 'delete') {
        mockParagraphs = mockParagraphs.filter(p => p.id !== id);
        renderParagraphs();
      }

      if (action === 'edit') {
        const p = mockParagraphs.find(p => p.id === id);
        if (p) {
          document.getElementById('paragraph-section').value = p.section;
          document.getElementById('paragraph-header').value = p.header;
          document.getElementById('paragraph-task').value = p.task;
          document.getElementById('paragraph-style').value = p.style;

          // For simplicity, we'll just remove the old one and add a new one on form submit
          mockParagraphs = mockParagraphs.filter(p => p.id !== id);
          renderParagraphs();
        }
      }
    }
  });
}


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
  renderSections();
  renderParagraphs();
});
