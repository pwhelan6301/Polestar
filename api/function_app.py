import azure.functions as func
import logging
import json
import os
from azure.cosmos import CosmosClient

app = func.FunctionApp()

# Connection Details (Loaded from Environment Variables)
ENDPOINT = os.environ["COSMOS_ENDPOINT"]
KEY = os.environ["COSMOS_KEY"]
DATABASE_NAME = "PromptLibrary"
CONTAINER_NAME = "Templates"

# Initialize Client
client = CosmosClient(ENDPOINT, KEY)
database = client.get_database_client(DATABASE_NAME)
container = database.get_container_client(CONTAINER_NAME)

@app.route(route="prompts", auth_level=func.AuthLevel.ANONYMOUS)
def manage_prompts(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing prompt request.')

    try:
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