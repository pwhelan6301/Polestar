# Polestar Document Drafter

Polestar Document Drafter is a web-based tool that helps users generate first-draft documents using Polestar's internal AI orchestration.

## Functionality

- **Document Generation**: Users can select a document type, provide key details, and generate a first-draft document.
- **Dynamic Form**: The form for document requests dynamically updates based on the selected document type.
- **User Authentication**: The application includes user authentication to ensure that only authorized users can access the tool.
- **Backend Integration**: The tool is integrated with an Azure Logic App that handles the document generation process.
- **Status and Output**: Users can view the status of their document requests and the generated output in real-time.

## How to Use

1. **Sign In**: Sign in to the application using your authorized credentials.
2. **Select Document Type**: Choose the type of document you want to generate from the dropdown list.
3. **Fill in Details**: Complete the form with the required details, such as the client name, sector, and a description of the document.
4. **Generate Draft**: Click the "Generate draft" button to send the request to the backend.
5. **Review Output**: The status of the request and the generated document will be displayed on the right-hand side of the page.

## Technical Details

- **Frontend**: The frontend is built with HTML, CSS, and vanilla JavaScript.
- **Backend**: The backend is an Azure Logic App that handles the AI-powered document generation.
- **Authentication**: The application uses Azure Static Web Apps' built-in authentication.
- **Styling**: The UI is styled with a modern, dark theme and is fully responsive.
