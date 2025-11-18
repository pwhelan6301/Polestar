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

// --- Backend configuration (placeholder) ---
// When you’re ready to connect to Logic Apps / APIM, put the URL here.
const BACKEND_URL = ''; // e.g. 'https://<apim-or-logic-app-endpoint>/generate'

async function callBackend(payload) {
  if (!BACKEND_URL) {
    // For now, just pretend and return a fake response
    await new Promise(r => setTimeout(r, 800));
    return {
      generated_text:
        'This is a placeholder draft. Once the backend URL is configured, this area will show the actual AI-generated content from Polestar’s Logic Apps.'
    };
  }

  const res = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      // Later: include any auth headers / tokens if needed
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Backend error: ${res.status} ${text}`);
  }

  return res.json();
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const docType = form.docType.value;
    if (!docType) {
      statusEl.textContent = 'Please select a document type.';
      statusEl.style.color = 'var(--danger)';
      return;
    }

    const payload = {
      doc_type: docType,
      client_name: form.clientName.value || null,
      form_id: form.formId.value || null,
      sector: form.sector.value || null,
      section_or_focus: form.sectionOrFocus.value || null,
      task_description: form.taskDescription.value || null,
      style_query: form.styleQuery.value || null,
      extra_context: form.extraContext.value || null
    };

    // Update request preview
    if (previewEl) {
      previewEl.textContent = JSON.stringify(payload, null, 2);
    }

    // UI state
    submitBtn.disabled = true;
    statusEl.style.color = 'var(--text-soft)';
    statusEl.textContent = BACKEND_URL
      ? 'Sending request to backend…'
      : 'Simulating request (backend URL not configured yet)…';
    if (statusText) {
      statusText.textContent = 'Processing your request…';
    }

    try {
      const result = await callBackend(payload);

      if (outputEl) {
        const text = result.generated_text || JSON.stringify(result, null, 2);
        outputEl.textContent = text;
      }

      statusEl.style.color = 'var(--success)';
      statusEl.textContent = 'Draft generated successfully.';
      if (statusText) {
        statusText.textContent =
          'Draft generated. Review the text on the right and refine it before sharing.';
      }
    } catch (err) {
      console.error(err);
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = 'There was a problem generating the draft.';
      if (statusText) {
        statusText.textContent = 'The request failed. Please try again or contact the AI tooling team.';
      }
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// --- Initialise everything on load ---
fetchUser();
initForm();
