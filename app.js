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

// --- Section options per document type ---
const SECTION_OPTIONS = {
  IM: [
    'Executive Summary',
    'Financials',
    'Market',
    'Background & History',
    'Clients'
  ],
  SectorValuation: [
    'Overview',
    'Market context',
    'Trading comparables',
    'Transaction comparables',
    'Valuation summary',
    'Key themes & risks'
  ]
  // NDA, Teaser, Blog, Deck will be added here later
};

function populateSectionOptions(docType, selectEl) {
  if (!selectEl) return;

  selectEl.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select section / focus…';
  selectEl.appendChild(placeholder);

  const options = SECTION_OPTIONS[docType] || [];
  options.forEach(label => {
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    selectEl.appendChild(opt);
  });

  selectEl.disabled = options.length === 0;
}

// --- Form handling ---
function initForm() {
  const form = document.getElementById('draft-form');
  const submitBtn = document.getElementById('submitBtn');
  const statusEl = document.getElementById('form-status');
  const statusText = document.getElementById('statusText');
  const previewEl = document.getElementById('requestPreview');
  const outputEl = document.getElementById('draftOutput');

  if (!form) return;

  const docTypeSelect = form.docType;
  const sectionSelect = form.sectionOrFocus;

  // Update sections when document type changes
  if (docTypeSelect && sectionSelect) {
    docTypeSelect.addEventListener('change', () => {
      populateSectionOptions(docTypeSelect.value, sectionSelect);
    });
    populateSectionOptions(docTypeSelect.value, sectionSelect);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const docType = form.docType.value;
    if (!docType) {
      statusEl.textContent = 'Please select a document type.';
      statusEl.style.color = 'var(--danger)';
      return;
    }

        const operationId = form.operationId.value.trim();
    const templateIdRaw = form.templateId.value.trim();

    if (!operationId) {
      statusEl.textContent = 'Please add a document title.';
      statusEl.style.color = 'var(--danger)';
      return;
    }

    if (!templateIdRaw) {
      statusEl.textContent = 'Please enter a template ID from the SharePoint list.';
      statusEl.style.color = 'var(--danger)';
      return;
    }

    const formIdRaw = form.formId.value.trim();
    const clientName = form.clientName.value.trim();
    const sectionOrFocus = form.sectionOrFocus.value.trim();
    const taskDescription = form.taskDescription.value.trim();
    const styleQuery = form.styleQuery.value.trim();
    const extraContext = form.extraContext.value.trim();

    const queryParts = [
      taskDescription && `Task: ${taskDescription}`,
      clientName && `Client / project: ${clientName}`,
      formIdRaw && `Form / deal ID: ${formIdRaw}`,
      sectionOrFocus && `Section / focus: ${sectionOrFocus}`,
      styleQuery && `Style guidance: ${styleQuery}`,
      extraContext && `Additional context: ${extraContext}`
    ].filter(Boolean);

    const query = queryParts.join('\n') || taskDescription || '';

    const payload = {
      doc_type: docType,
      query,
         operationID: operationId
    };

        const parsedTemplateId = Number(templateIdRaw);
    if (!Number.isInteger(parsedTemplateId)) {
      statusEl.textContent = 'Template ID must be a whole number.';
      statusEl.style.color = 'var(--danger)';
      return;
    }
    payload.templateID = parsedTemplateId;

    if (formIdRaw) {
      const parsedFormId = Number(formIdRaw);
      if (!Number.isInteger(parsedFormId)) {
        statusEl.textContent = 'Form ID must be a whole number.';
        statusEl.style.color = 'var(--danger)';
        return;
      }
      payload.form_id = parsedFormId;
    }

    if (docType === 'IM' && sectionOrFocus) {
      payload.im_section = sectionOrFocus;
    }

    if (form.sector.value) {
      payload.sector = form.sector.value;
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
        outputEl.textContent = displayText;
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
