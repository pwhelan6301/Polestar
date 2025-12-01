# Polestar Document Drafter

Polestar Document Drafter is an Azure Static Web Apps project that lets teams assemble first‑draft Information Memoranda (IMs) and other document types by orchestrating a Logic App workflow. The UI pulls section/paragraph prompts from Cosmos DB, so content editors can change the drafting behaviour without touching the codebase.

## Repository layout

| Path | Description |
| --- | --- |
| `index.html`, `app.js`, `styles.css` | Document drafting UI served to end users. |
| `manage-prompts.html`, `manage-prompts.js` | Admin UI for creating/updating sections and subsections stored in Cosmos DB. |
| `api/function_app.py` | Python Azure Function (`/api/prompts`, `/api/hello`) that mediates access to Cosmos DB. |
| `IM_Generator.json` | Logic App definition that receives drafting payloads from the frontend. |
| `staticwebapp.config.json` | Static Web Apps configuration (routes/auth). |

## What’s in the UI

- **Dynamic request form** – document types and sectors drive the available sections. Once a section is chosen the UI surfaces individual subsections that can be toggled on/off, and the payload preview updates live.
- **Status + output panel** – shows submission progress, the JSON payload we send to the Logic App, and the eventual response rendered as labelled fields. There is a built‑in “Copy” helper for quick sharing.
- **Authentication helpers** – the shell surfaces the currently signed-in Static Web Apps user and provides sign-in/out links. The drafting page links straight to the prompt-management UI so editors can adjust prompts without redeploying.
- **Prompt manager** – `/manage-prompts.html` now walks editors through doc type → sector → template scope before exposing the relevant sections. Once a branch is selected they can edit section metadata (system/user prompts) and CRUD subsections, with every change flowing straight into Cosmos DB through `/api/prompts`.
- **Template branching** – prompt templates can now be filtered by doc type → sector → client/use case. Start from the guided “Sector template” view, then use “Copy to new template” to create a client-specific branch while keeping the base template untouched.

## Backend services

- **Logic App (document generator)** – `app.js` sends drafting payloads to the Logic App HTTP trigger. Update `BACKEND_URL` with the production Logic App URL before deploying. The Logic App schema (`IM_Generator.json`) shows the shape we submit: `doc_type`, `operationID`, `templateID`, `promptSet`, etc.
- **Cosmos DB (prompt storage)** – templates are stored in the `Prompt` database, `Templates` container, partitioned by `sector`. Each template document resembles:

  ```json
  {
    "id": "im-business-services-section-title",
    "docType": "IM",
    "sector": "Business Services",
    "sectionTitle": "Business overview",
    "systemPrompt": "High-level system instructions…",
    "userPrompt": "User-facing framing…",
    "mainPrompt": null,
    "subsections": [
      {
        "id": "sub-12345",
        "title": "History",
        "detailTaskDescription": "Summarise major milestones…",
        "styleQuery": "Concise, factual tone",
        "prompt": "Summarise…"
      }
    ]
  }
  ```

- **Azure Function API** – `api/function_app.py` exposes:
  - `GET /api/prompts?sector=…&docType=…` – list templates for the drafting UI + prompt manager.
  - `POST /api/prompts` – upsert a complete template document (used when adding/editing sections or subsections).
  - `DELETE /api/prompts?id=…&sector=…` – delete a template (removes the section and all subsections).
  - `GET /api/hello` – lightweight health probe to verify the API is deployed.

  Set `COSMOS_ENDPOINT` and `COSMOS_KEY` in the Azure Function environment (or `api/local.settings.json` when running locally).

## Running locally

1. **Install tooling**
   - Python 3.10+ plus [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local).
   - Optional but recommended: [Azure Static Web Apps CLI](https://learn.microsoft.com/azure/static-web-apps/static-web-apps-cli) (`npm install -g @azure/static-web-apps/cli`) to proxy the frontend + API together.

2. **Configure secrets**
   - Create `api/local.settings.json` with:

     ```json
     {
       "IsEncrypted": false,
       "Values": {
         "AzureWebJobsStorage": "",
         "FUNCTIONS_WORKER_RUNTIME": "python",
         "COSMOS_ENDPOINT": "<https-endpoint>",
         "COSMOS_KEY": "<primary-key>"
       }
     }
     ```

   - Update `BACKEND_URL` in `app.js` to point at either your dev Logic App or a mock endpoint.

3. **Install Python dependencies and start the API**

   ```bash
   cd api
   pip install -r requirements.txt
   func start
   ```

4. **Serve the frontend**
   - Quick test: run any static file server from the repo root (`python -m http.server 4280`).
   - Full Static Web Apps emulation (recommended so `/api/*` is proxied and `/.auth/*` works):

     ```bash
     swa start http://localhost:4280 --api-location ./api --swa-config staticwebapp.config.json
     ```

   Open `http://localhost:4280` to interact with the drafting UI and `http://localhost:4280/manage-prompts.html` for prompt management.

## Authoring prompts

1. Navigate to **Manage Prompts** (link in the top bar).
2. **Step 1 – Document type:** select the doc type you want to curate. Until you choose one, the downstream controls stay disabled.
3. **Step 2 – Sector:** once the doc type is chosen, pick the sector to manage. This unlocks the template scope controls.
4. **Step 3 – Template scope:** pick whether you’re working on the sector template (“base”) or a client/use case branch. Use **Copy to new template** in the section list to duplicate a sector section into a named client branch.
5. Add or edit sections to tweak the system prompt, user prompt, and metadata for the currently selected branch. All saves go straight into Cosmos DB, so the drafting form immediately reflects the updates.
6. Add subsections under a section, defining the title, task description, and style. These show up as selectable checkboxes in the drafting UI so requesters can include/exclude specific content.
7. Deleted sections immediately remove the associated subsections, and the drafting UI clears cached prompts.

## Deployment notes

- Deploy the frontend + API through Azure Static Web Apps to benefit from the built-in auth endpoints (`/.auth/login`, `/.auth/me`, `/.auth/logout`).
- Ensure the Static Web App has access to the same Cosmos DB and configure the Azure Function’s application settings (`COSMOS_ENDPOINT`, `COSMOS_KEY`).
- Grant the Logic App permission to reach downstream systems that supply the generated content, and keep the `BACKEND_URL` secret in Azure (e.g., Static Web Apps’ application settings) rather than hardcoding production URLs for public repos.
