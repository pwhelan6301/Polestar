import azure.functions as func
import logging
import json
import os
from azure.cosmos import CosmosClient

app = func.FunctionApp()

# 1. Database Connection (Best practice: Use Environment Variables)
# You set these in the Azure Portal -> Configuration
ENDPOINT = os.environ["COSMOS_ENDPOINT"]
KEY = os.environ["COSMOS_KEY"]
DATABASE_NAME = "PromptLibrary"
CONTAINER_NAME = "Templates"

client = CosmosClient(ENDPOINT, KEY)
database = client.get_database_client(DATABASE_NAME)
container = database.get_container_client(CONTAINER_NAME)

@app.route(route="prompts", auth_level=func.AuthLevel.FUNCTION)
def manage_prompts(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing prompt request.')

    # --- SCENARIO 1: GET (Load Prompts) ---
    if req.method == "GET":
        sector = req.params.get('sector')
        if not sector:
            return func.HttpResponse("Please pass a sector on the query string", status_code=400)
        
        # SQL Query
        query = "SELECT * FROM c WHERE c.sector = @sector"
        items = list(container.query_items(
            query=query,
            parameters=[{"name": "@sector", "value": sector}],
            enable_cross_partition_query=True
        ))
        
        return func.HttpResponse(json.dumps(items), mimetype="application/json")

    # --- SCENARIO 2: POST (Save/Amend Prompts) ---
    elif req.method == "POST":
        try:
            req_body = req.get_json()
            
            # Upsert (Create or Replace)
            # The 'req_body' is the JSON schema we defined earlier
            container.upsert_item(req_body)
            
            return func.HttpResponse(
                json.dumps({"message": "Saved successfully", "id": req_body.get("id")}), 
                status_code=200
            )
        except Exception as e:
            return func.HttpResponse(f"Error: {str(e)}", status_code=500)

    return func.HttpResponse("Method not supported", status_code=405)