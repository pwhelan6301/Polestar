// --- Auth: show who is signed in ---
async function fetchUser() {
  try {
    const res = await fetch('/.auth/me', { credentials: 'include' });
    if (!res.ok) return;

    const data = await res.json();
    const user = data?.clientPrincipal;
    if (!user) return;

    const name = user.userDetails || user.userId || 'Signed in user';
    const el = document.getElementById('user-info');
    if (el) {
      el.textContent = `Signed in as ${name}`;
    }
  } catch (err) {
    console.error('Error fetching user info', err);
  }
}

// --- Backend configuration ---
// TODO: paste your Logic App HTTP POST URL in here:
const BACKEND_URL = 'https://prod-40.uksouth.logic.azure.com:443/workflows/6db33d3cd27b417ea9e44626967943a0/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=ZwOmLWp7EHwVaz_uYIGGGb_0m7lgZZFEuHHOXSxFRC0';

async function callBackend(payload) {
  if (!BACKEND_URL || BACKEND_URL.includes('YOUR-LOGIC-APP')) {
    throw new Error('BACKEND_URL is not configured. Please set it in app.js.');
  }

  const res = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let body;
  const ct = res.headers.get('content-type') || '';

  if (ct.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  if (!res.ok && res.status !== 202) {
    throw new Error(
      `Backend error: ${res.status} ${typeof body === 'string' ? body : JSON.stringify(body)}`
    );
  }

  return {
    status: res.status,
    body
  };
}

const keyToLabel = {
  doc_type: 'Document Type',
  query: 'Prompt',
  operationID: 'Operation ID',
  templateID: 'Template ID',
  im_section: 'IM Section',
  sector: 'Sector',
  status: 'Status',
  'Find file here': 'SharePoint Link',
  operationId: 'Operation ID'
};

function renderJsonAsList(outputEl, jsonString) {
  try {
    const data = JSON.parse(jsonString);
    let html = '<ul>';
    for (const key in data) {
      const label = keyToLabel[key] || key;
      const value = data[key];
      if (key === 'Find file here') {
        html += `<li><strong>${label}:</strong> <a href="${value}" target="_blank" rel="noopener noreferrer">Open document</a></li>`;
      } else {
        html += `<li><strong>${label}:</strong> ${value}</li>`;
      }
    }
    html += '</ul>';
    outputEl.innerHTML = html;
  } catch (error) {
    outputEl.textContent = jsonString;
  }
}

// Mock data for sections and paragraphs (will be replaced by API calls)
const MOCK_SECTIONS = [
  { name: 'IM', templateMap: { 'Executive Summary': 1, 'Financials': 3, 'Market': 4, 'Background & History': 5, 'Clients': 6 } },
  { name: 'SectorValuation', templateMap: { 'Overview': 2 } }
];

const MOCK_PARAGRAPHS = {
  'Background & History': [
    { section_header: 'OVERVIEW', task_description: 'Describe how the client\'s business has evolved over time...', style_query: 'overview of a company\'s evolution and current position' },
    { section_header: 'TIMELINE', task_description: 'Set out a clear, chronological timeline of the client\'s development...', style_query: 'concise chronological company history and key milestones' },
    { section_header: 'FUTURE GROWTH', task_description: 'Explain why the client is well positioned for future growth...', style_query: 'Polestar style, explaining how future growth is to be achieved' }
  ],
  'Executive Summary': [
    { section_header: 'SECTION A', task_description: 'Section A description...', style_query: 'style A' },
    { section_header: 'SECTION B', task_description: 'Section B description...', style_query: 'style B' }
  ],
  'Overview': [
    { section_header: 'Overview Sub A', task_description: 'Overview Sub A description...', style_query: 'Overview A' },
    { section_header: 'Overview Sub B', task_description: 'Overview Sub B description...', style_query: 'Overview B' }
  ]
};


async function fetchSections() {
  return new Promise(resolve => setTimeout(() => resolve(MOCK_SECTIONS), 100));
}

async function fetchParagraphsForSection(sectionName) {
  return new Promise(resolve => setTimeout(() => resolve(MOCK_PARAGRAPHS[sectionName] || []), 100));
}


// --- Form handling ---
function initForm() {
  const form = document.getElementById('draft-form');
  const submitBtn = document.getElementById('submitBtn');
  const statusEl = document.getElementById('form-status');
  const statusText = document.getElementById('statusText');
  const previewEl = document.getElementById('requestPreview');
  const outputEl = document.getElementById('draftOutput');
  const sectionOrFocusDiv = document.getElementById('sectionOrFocus-div');

  if (!form) return;

  const docTypeSelect = form.docType;
  const sectionSelect = form.sectionOrFocus;
  const paragraphSelectionDiv = document.createElement('div');
  paragraphSelectionDiv.id = 'paragraph-selection-div';
  paragraphSelectionDiv.className = 'field-group';
  sectionSelect.parentNode.parentNode.insertBefore(paragraphSelectionDiv, sectionSelect.parentNode.nextSibling); // Insert after the section select field-group


  async function populateDocTypeOptions() {
    const sections = await fetchSections();
    docTypeSelect.innerHTML = '<option value="">Select a document type…</option>';
    sections.forEach(sec => {
      const option = document.createElement('option');
      option.value = sec.name;
      option.textContent = sec.name === 'IM' ? 'Information Memorandum (IM)' : sec.name;
      docTypeSelect.appendChild(option);
    });
  }


  async function populateSectionOptions(selectedDocType) {
    const sections = await fetchSections();
    const currentSection = sections.find(s => s.name === selectedDocType);

    sectionSelect.innerHTML = '<option value="">Select section / focus…</option>';
    if (currentSection && currentSection.templateMap) {
      Object.keys(currentSection.templateMap).forEach(sectionName => {
        const option = document.createElement('option');
        option.value = sectionName;
        option.textContent = sectionName;
        sectionSelect.appendChild(option);
      });
    }
    sectionSelect.disabled = !currentSection;
  }

  async function renderParagraphCheckboxes(selectedSectionName) {
    paragraphSelectionDiv.innerHTML = '';
    if (!selectedSectionName) return;

    const paragraphs = await fetchParagraphsForSection(selectedSectionName);
    if (paragraphs.length === 0) return;

    const label = document.createElement('label');
    label.textContent = 'Select paragraphs:';
    paragraphSelectionDiv.appendChild(label);

    paragraphs.forEach((p, index) => {
      const div = document.createElement('div');
      div.className = 'checkbox-group';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `paragraph-${index}`;
      checkbox.value = p.section_header;
      checkbox.checked = true; // Default to all selected
      checkbox.dataset.task = p.task_description;
      checkbox.dataset.style = p.style_query;
      checkbox.dataset.imSection = p.im_section || selectedSectionName; // Assuming im_section might be needed for payload

      const checkboxLabel = document.createElement('label');
      checkboxLabel.htmlFor = `paragraph-${index}`;
      checkboxLabel.textContent = p.section_header;

      const description = document.createElement('p');
      description.className = 'field-hint';
      description.textContent = p.task_description;

      div.appendChild(checkbox);
      div.appendChild(checkboxLabel);
      div.appendChild(description);
      paragraphSelectionDiv.appendChild(div);
    });
  }


  // Event listeners
  docTypeSelect.addEventListener('change', async () => {
    await populateSectionOptions(docTypeSelect.value);
    await renderParagraphCheckboxes(sectionSelect.value);
  });

  sectionSelect.addEventListener('change', async () => {
    await renderParagraphCheckboxes(sectionSelect.value);
  });

  // Initial population
  populateDocTypeOptions();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const docType = docTypeSelect.value;
    if (!docType) {
      statusEl.textContent = 'Please select a document type.';
      statusEl.style.color = 'var(--danger)';
      return;
    }

    const operationId = form.operationId.value.trim();

    if (!operationId) {
      statusEl.textContent = 'Please add a document title.';
      statusEl.style.color = 'var(--danger)';
      return;
    }

    // Determine templateID based on docType and sectionOrFocus
    let templateID;
    const selectedSectionName = sectionSelect.value;
    const sections = await fetchSections();
    const currentSection = sections.find(s => s.name === docType);

    if (currentSection && currentSection.templateMap && selectedSectionName) {
      templateID = currentSection.templateMap[selectedSectionName];
    }

    if (!templateID) {
      statusEl.textContent = 'Please select a valid section/document type combination.';
      statusEl.style.color = 'var(--danger)';
      return;
    }


    const formIdRaw = form.formId.value.trim();
    const clientName = form.clientName.value.trim();
    // const sectionOrFocus = sectionSelect.value.trim(); // Now dynamic based on paragraphs
    const taskDescription = form.taskDescription.value.trim();
    const styleQuery = form.styleQuery.value.trim();
    const extraContext = form.extraContext.value.trim();

    const selectedParagraphs = Array.from(paragraphSelectionDiv.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => ({
      section_header: checkbox.value,
      task_description: checkbox.dataset.task,
      style_query: checkbox.dataset.style,
      im_section: checkbox.dataset.imSection || selectedSectionName, // Use selectedSectionName if im_section not explicitly set
    }));

    // If no paragraphs selected, or if docType requires a query directly
    let query = '';
    if (selectedParagraphs.length > 0) {
      query = selectedParagraphs.map(p => `Section: ${p.section_header}\nTask: ${p.task_description}\nStyle: ${p.style_query}`).join('\n\n');
      if (taskDescription) query = `Overall Task: ${taskDescription}\n\n` + query; // Prepend overall task if present
    } else {
      // Fallback to original query construction if no paragraphs are selected
      const queryParts = [
        taskDescription && `Task: ${taskDescription}`,
        clientName && `Client / project: ${clientName}`,
        formIdRaw && `Form / deal ID: ${formIdRaw}`,
        selectedSectionName && `Section / focus: ${selectedSectionName}`,
        styleQuery && `Style guidance: ${styleQuery}`,
        extraContext && `Additional context: ${extraContext}`
      ].filter(Boolean);
      query = queryParts.join('\n') || taskDescription || '';
    }


    const payload = {
      doc_type: docType,
      query,
      operationID: operationId,
      templateID: templateID
    };

    if (formIdRaw) {
      const parsedFormId = Number(formIdRaw);
      if (!Number.isInteger(parsedFormId)) {
        statusEl.textContent = 'Form ID must be a whole number.';
        statusEl.style.color = 'var(--danger)';
        return;
      }
      payload.form_id = parsedFormId;
    }

    if (selectedSectionName) { // Use selectedSectionName as im_section if needed
      payload.im_section = selectedSectionName;
    }

    if (form.sector.value) {
      payload.sector = form.sector.value;
    }

    if (previewEl) {
      renderJsonAsList(previewEl, JSON.stringify(payload, null, 2));
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    statusEl.style.color = 'var(--text-soft)';
    statusEl.textContent = 'Sending request to Logic App…';
    if (statusText) {
      statusText.textContent = 'Processing your request…';
    }

    try {
      const result = await callBackend(payload);
      const { status, body } = result;

      let displayText;

      if (status === 202) {
        // Your orchestrator returns 202 + operationId / status
        displayText =
          typeof body === 'string'
            ? body
            : JSON.stringify(body, null, 2);
        statusEl.style.color = 'var(--success)';
        statusEl.textContent =
          'Request accepted by Logic App (202). The document will be generated in the background.';
      } else if (status === 200) {
        // If you ever return the draft text directly
        const generated = body?.generated_text || body;
        displayText =
          typeof generated === 'string'
            ? generated
            : JSON.stringify(generated, null, 2);
        statusEl.style.color = 'var(--success)';
        statusEl.textContent = 'Draft generated successfully.';
      } else {
        displayText = JSON.stringify(body, null, 2);
        statusEl.style.color = 'var(--text-soft)';
        statusEl.textContent = `Received response with status ${status}.`;
      }

      if (outputEl) {
        renderJsonAsList(outputEl, displayText);
      }

      if (statusText) {
        statusText.textContent =
          'Request completed. Check the status and output on the right.';
      }
    } catch (err) {
      console.error(err);
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = 'There was a problem calling the Logic App.';
      if (statusText) {
        statusText.textContent =
          'The request failed. Please try again or contact the AI tooling team.';
      }
      if (outputEl) {
        outputEl.textContent = err.message || String(err);
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    }
  });
}
// --- Initialise on load ---
fetchUser();
initForm();

// --- Copy to clipboard ---
const copyBtn = document.getElementById('copyBtn');
const draftOutput = document.getElementById('draftOutput');

if (copyBtn && draftOutput) {
  copyBtn.addEventListener('click', () => {
    const textToCopy = draftOutput.textContent;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
        }, 2000);
      });
    }
  });
}
