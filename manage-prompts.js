// Mock data for initial display
const mockSections = [
  'Background & History',
  'Market'
];

const mockParagraphs = [
  {
    section: 'Background & History',
    header: 'OVERVIEW',
    task: 'Describe how the client\'s business has evolved over time...', // Corrected: escaped apostrophe
    style: 'overview of a company\'s evolution and current position' // Corrected: escaped apostrophe
  },
  {
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
  mockSections.forEach(section => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${section}</span>
      <button class="link-ghost">Delete</button>
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
        <button class="link-ghost">Edit</button>
        <button class="link-ghost">Delete</button>
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


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
  renderSections();
  renderParagraphs();
});
