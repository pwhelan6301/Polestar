import azure.functions as func
import logging
import json
import os
from azure.cosmos import CosmosClient

app = func.FunctionApp()

# --- NEW: Add a simple "hello" endpoint for diagnostics ---
@app.route(route="hello", auth_level=func.AuthLevel.ANONYMOUS)
def hello(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request for /api/hello.')
    
    # --- NEW: Diagnostic code to check environment variables ---
    endpoint = os.getenv("COSMOS_ENDPOINT")
    key = os.getenv("COSMOS_KEY")
    
    endpoint_status = f"COSMOS_ENDPOINT is set: {bool(endpoint)}. Value starts with: {str(endpoint)[:20]}..." if endpoint else "COSMOS_ENDPOINT is NOT SET."
    key_status = f"COSMOS_KEY is set: {bool(key)}. Value is hidden." if key else "COSMOS_KEY is NOT SET."
    
    diagnostic_message = f"API Diagnostics:\n1. {endpoint_status}\n2. {key_status}"
    
    return func.HttpResponse(diagnostic_message, status_code=200, mimetype="text/plain")


@app.route(route="prompts", auth_level=func.AuthLevel.ANONYMOUS)
def manage_prompts(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing prompt request for /api/prompts.')

    # --- NEW: Gracefully check for environment variables ---
    endpoint = os.getenv("COSMOS_ENDPOINT")
    key = os.getenv("COSMOS_KEY")

    if not all([endpoint, key]):
        error_message = "Server configuration error: COSMOS_ENDPOINT or COSMOS_KEY environment variables are not set."
        logging.error(error_message)
        return func.HttpResponse(
            json.dumps({"error": error_message}),
            status_code=500,
            mimetype="application/json"
        )

    try:
        # Initialize Client
        client = CosmosClient(endpoint, key)
        database = client.get_database_client("Prompt")
        container = database.get_container_client("Templates")

        # --- GET: Fetch Prompts by Sector ---
        if req.method == "GET":
            sector = req.params.get('sector')
            if not sector:
                return func.HttpResponse(
                    json.dumps({"error": "Missing 'sector' query parameter"}), 
                    status_code=400, mimetype="application/json"
                )
            
            # Query Cosmos DB
            query = "SELECT * FROM c WHERE c.sector = @sector"
            items = list(container.query_items(
                query=query,
                parameters=[{"name": " @sector", "value": sector}],
                enable_cross_partition_query=True
            ))
            
            return func.HttpResponse(json.dumps(items), mimetype="application/json")

        # --- POST: Save/Update Prompt ---
        elif req.method == "POST":
            req_body = req.get_json()
            
            # Validation: Ensure critical fields exist
            if 'id' not in req_body or 'sector' not in req_body:
                return func.HttpResponse(
                    json.dumps({"error": "Payload must contain 'id' and 'sector'"}),
                    status_code=400, mimetype="application/json"
                )

            # Upsert (Update if exists, Insert if new)
            container.upsert_item(req_body)
            
            return func.HttpResponse(
                json.dumps({"message": "Saved successfully", "id": req_body['id']}), 
                status_code=200, mimetype="application/json"
            )

    except Exception as e:
        logging.error(f"Error: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}), 
            status_code=500, mimetype="application/json"
        )

    return func.HttpResponse("Method not supported", status_code=405)