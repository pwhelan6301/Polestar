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

const templateCache = new Map();

async function fetchTemplates(docType, sector) {
  if (!docType || !sector) {
    return [];
  }

  const cacheKey = `${docType}::${sector}`;
  if (templateCache.has(cacheKey)) {
    return templateCache.get(cacheKey);
  }

  const url = `/api/prompts?sector=${encodeURIComponent(sector)}&docType=${encodeURIComponent(docType)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to load prompts: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  templateCache.set(cacheKey, data);
  return data;
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
  const sectorSelect = form.sector;
  const paragraphSelectionDiv = document.createElement('div');
  paragraphSelectionDiv.id = 'paragraph-selection-div';
  paragraphSelectionDiv.className = 'field-group';

  const subsectionDropdown = document.createElement('details');
  subsectionDropdown.className = 'subsection-dropdown';
  const subsectionSummary = document.createElement('summary');
  subsectionSummary.textContent = 'Add subsections';
  subsectionDropdown.appendChild(subsectionSummary);
  const subsectionOptions = document.createElement('div');
  subsectionOptions.className = 'subsection-options';
  subsectionDropdown.appendChild(subsectionOptions);
  const subsectionSelectionHint = document.createElement('p');
  subsectionSelectionHint.className = 'field-hint';
  subsectionSelectionHint.id = 'subsection-selection-hint';
  subsectionSelectionHint.textContent = 'Select a document type and sector to load sections.';
  paragraphSelectionDiv.appendChild(subsectionDropdown);
  paragraphSelectionDiv.appendChild(subsectionSelectionHint);

  sectionSelect.parentNode.parentNode.insertBefore(paragraphSelectionDiv, sectionSelect.parentNode.nextSibling); // Insert after the section select field-group

  let currentTemplates = [];


  function populateDocTypeOptions() {
    docTypeSelect.innerHTML = '<option value="">Select a document type…</option>';
    DOCUMENT_TYPES.forEach((doc) => {
      const option = document.createElement('option');
      option.value = doc.value;
      option.textContent = doc.label;
      docTypeSelect.appendChild(option);
    });
  }

  function populateSectionOptions() {
    sectionSelect.innerHTML = '<option value="">Select section / focus…</option>';
    currentTemplates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.sectionTitle;
      option.textContent = template.sectionTitle;
      sectionSelect.appendChild(option);
    });
    sectionSelect.value = '';
    sectionSelect.disabled = currentTemplates.length === 0;
  }

  function updateSubsectionHint(message) {
    if (subsectionSelectionHint) {
      subsectionSelectionHint.textContent = message;
    }
  }

  function clearSubsectionOptions() {
    subsectionOptions.innerHTML = '';
    subsectionDropdown.open = false;
    updateSubsectionHint('Select a document type and sector to load sections.');
  }

  function renderParagraphCheckboxes(selectedSectionName) {
    subsectionOptions.innerHTML = '';
    subsectionDropdown.open = false;

    if (!selectedSectionName) {
      updateSubsectionHint('Choose a section to add available subsections.');
      return;
    }

    const template = currentTemplates.find(t => t.sectionTitle === selectedSectionName);
    if (!template) {
      updateSubsectionHint('No template found for this section.');
      return;
    }

    const subsections = Array.isArray(template.subsections) ? template.subsections : [];
    if (subsections.length === 0) {
      updateSubsectionHint('This section has no subsections configured yet.');
      return;
    }

    subsections.forEach((sub, index) => {
      const wrapper = document.createElement('label');
      wrapper.className = 'checkbox-group';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `paragraph-${index}`;
      checkbox.checked = true;
      checkbox.dataset.subsectionId = sub.id || `tmp-${index}`;
      checkbox.dataset.title = sub.title || '';
      checkbox.dataset.detail = sub.detailTaskDescription || sub.prompt || '';
      checkbox.dataset.style = sub.styleQuery || '';
      checkbox.dataset.prompt = sub.prompt || '';
      checkbox.dataset.sectionTitle = template.sectionTitle;
      checkbox.value = sub.title || '';

      const checkboxLabel = document.createElement('span');
      checkboxLabel.textContent = sub.title || `Subsection ${index + 1}`;

      const description = document.createElement('small');
      description.className = 'field-hint';
      description.textContent = sub.detailTaskDescription || sub.prompt || 'No description';

      wrapper.appendChild(checkbox);
      wrapper.appendChild(checkboxLabel);
      wrapper.appendChild(description);
      subsectionOptions.appendChild(wrapper);
    });

    updateSubsectionHint('Tick the subsections you want to include in this draft.');

    subsectionOptions.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const count = subsectionOptions.querySelectorAll('input[type="checkbox"]:checked').length;
        updateSubsectionHint(count > 0 ? `${count} subsections selected` : 'No subsections selected.');
      });
    });

    const initialCount = subsectionOptions.querySelectorAll('input[type="checkbox"]:checked').length;
    updateSubsectionHint(initialCount > 0 ? `${initialCount} subsections selected` : 'No subsections selected.');
  }


  async function refreshTemplates() {
    const docType = docTypeSelect.value;
    const sector = sectorSelect.value;

    if (!docType || !sector) {
      currentTemplates = [];
      populateSectionOptions();
      renderParagraphCheckboxes(null);
      return;
    }

    try {
      updateSubsectionHint('Loading subsections from Cosmos DB…');
      const templates = await fetchTemplates(docType, sector);
      currentTemplates = templates;
      populateSectionOptions();
      renderParagraphCheckboxes(sectionSelect.value);
    } catch (error) {
      console.error(error);
      currentTemplates = [];
      populateSectionOptions();
      renderParagraphCheckboxes(null);
      updateSubsectionHint('Failed to load subsections. Please try again.');
      statusEl.textContent = 'Unable to load prompts for the selected document type/sector.';
      statusEl.style.color = 'var(--danger)';
    }
  }


  // Event listeners
  docTypeSelect.addEventListener('change', refreshTemplates);
  if (sectorSelect) {
    sectorSelect.addEventListener('change', refreshTemplates);
  }

  sectionSelect.addEventListener('change', () => {
    renderParagraphCheckboxes(sectionSelect.value);
  });

  // Initial population
  populateDocTypeOptions();
  if (sectorSelect && !sectorSelect.value && SECTORS.length) {
    sectorSelect.value = SECTORS[0].value;
  }
  refreshTemplates();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const docType = docTypeSelect.value;
    const sectorValue = sectorSelect ? sectorSelect.value : '';
    if (!docType) {
      statusEl.textContent = 'Please select a document type.';
      statusEl.style.color = 'var(--danger)';
      return;
    }

    if (!sectorValue) {
      statusEl.textContent = 'Please select a sector.';
      statusEl.style.color = 'var(--danger)';
      return;
    }

    const operationId = form.operationId.value.trim();

    if (!operationId) {
      statusEl.textContent = 'Please add a document title.';
      statusEl.style.color = 'var(--danger)';
      return;
    }

    const selectedSectionName = sectionSelect.value;
    const selectedTemplate = currentTemplates.find(t => t.sectionTitle === selectedSectionName);
    if (!selectedTemplate) {
      statusEl.textContent = 'Please select a section after loading prompts.';
      statusEl.style.color = 'var(--danger)';
      return;
    }

    const templateID = selectedTemplate.id;
    if (!templateID) {
      statusEl.textContent = 'This section is missing an ID. Please re-create it in Manage Prompts.';
      statusEl.style.color = 'var(--danger)';
      return;
    }

    const formIdRaw = form.formId.value.trim();
    const clientName = form.clientName.value.trim();
    const taskDescription = form.taskDescription.value.trim();
    const styleQuery = form.styleQuery.value.trim();
    const extraContext = form.extraContext.value.trim();

    const selectedParagraphs = Array.from(subsectionOptions.querySelectorAll('input[type="checkbox"]:checked')).map((checkbox) => ({
      id: checkbox.dataset.subsectionId,
      title: checkbox.dataset.title,
      detailTaskDescription: checkbox.dataset.detail,
      styleQuery: checkbox.dataset.style,
      prompt: checkbox.dataset.prompt,
      sectionTitle: checkbox.dataset.sectionTitle
    }));

    let query = '';
    if (selectedParagraphs.length > 0) {
      query = selectedParagraphs.map(p => `Section: ${p.title}\nTask: ${p.detailTaskDescription}\nStyle: ${p.styleQuery}`).join('\n\n');
      if (taskDescription) query = `Overall Task: ${taskDescription}\n\n` + query;
    } else {
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
      operationID: operationId,
      templateID,
      query,
      sector: sectorValue,
      clientName,
      promptSet: {
        section: {
          id: selectedTemplate.id,
          title: selectedTemplate.sectionTitle,
          systemPrompt: selectedTemplate.systemPrompt,
          userPrompt: selectedTemplate.userPrompt,
          mainPrompt: selectedTemplate.mainPrompt || null
        },
        subsections: selectedParagraphs
      },
      manualInputs: {
        taskDescription,
        styleQuery,
        extraContext
      }
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

    if (selectedSectionName) {
      payload.im_section = selectedSectionName;
    }

    if (previewEl) {
      previewEl.textContent = JSON.stringify(payload, null, 2);
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
