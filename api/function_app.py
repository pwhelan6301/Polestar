import azure.functions as func
import logging
import json
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from azure.cosmos import CosmosClient
from azure.cosmos.exceptions import CosmosResourceNotFoundError

COSMOS_ENDPOINT = os.getenv("COSMOS_ENDPOINT")
COSMOS_KEY = os.getenv("COSMOS_KEY")
PROMPT_DB_NAME = os.getenv("COSMOS_PROMPT_DB", "Prompt")
PROMPT_CONTAINER_NAME = os.getenv("COSMOS_PROMPT_CONTAINER", "Templates")
DRAFTS_DB_NAME = os.getenv("COSMOS_DRAFTS_DB", "DocumentDrafts")
DRAFTS_CONTAINER_NAME = os.getenv("COSMOS_DRAFTS_CONTAINER", "Drafts")

CLIENT_REGISTRY_PARTITION_KEY = os.getenv("CLIENT_REGISTRY_PARTITION_KEY", "__clients__")
CLIENT_REGISTRY_ITEM_ID = os.getenv("CLIENT_REGISTRY_ITEM_ID", "client-registry")

app = func.FunctionApp()


def _get_cosmos_container(database_name: str, container_name: str):
    """
    Helper that validates Cosmos configuration and returns a container client.
    """
    if not COSMOS_ENDPOINT or not COSMOS_KEY:
        raise ValueError("COSMOS_ENDPOINT or COSMOS_KEY environment variables are not set.")

    client = CosmosClient(COSMOS_ENDPOINT, COSMOS_KEY)
    database = client.get_database_client(database_name)
    return database.get_container_client(container_name)


def _json_response(payload: Any, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(payload),
        status_code=status_code,
        mimetype="application/json"
    )


def _fetch_draft_by_id(container, draft_id: str) -> Optional[Dict[str, Any]]:
    query = "SELECT * FROM c WHERE c.id = @id"
    results = list(container.query_items(
        query=query,
        parameters=[{"name": "@id", "value": draft_id}],
        enable_cross_partition_query=True,
        max_item_count=1
    ))
    return results[0] if results else None


def _get_draft_partition_key(draft: Dict[str, Any]) -> Optional[str]:
    """
    Drafts in Cosmos DB are partitioned by their document type (`/doctype`).
    We have historically written this field as `docType`, `doc_type`, or `doctype`,
    but some legacy containers were partitioned on `sector`. Try all variations before giving up.
    """
    for key in ("docType", "doc_type", "doctype", "sector"):
        value = draft.get(key)
        if value:
            return value
    return None


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    normalized = re.sub(r"-{2,}", "-", normalized).strip("-")
    return normalized or "client"


def _normalize_client_name(value: str) -> str:
    return " ".join(value.split())


def _get_client_registry(container) -> Dict[str, Any]:
    try:
        registry = container.read_item(
            item=CLIENT_REGISTRY_ITEM_ID,
            partition_key=CLIENT_REGISTRY_PARTITION_KEY
        )
    except CosmosResourceNotFoundError:
        registry = {
            "id": CLIENT_REGISTRY_ITEM_ID,
            "sector": CLIENT_REGISTRY_PARTITION_KEY,
            "type": "ClientRegistry",
            "clients": [],
            "updatedAt": datetime.utcnow().isoformat()
        }
        container.create_item(registry)
    if "clients" not in registry or not isinstance(registry["clients"], list):
        registry["clients"] = []
    return registry


def _save_client_registry(container, registry: Dict[str, Any]) -> Dict[str, Any]:
    registry["updatedAt"] = datetime.utcnow().isoformat()
    container.upsert_item(registry)
    return registry


def _upsert_client(container, name: str) -> Dict[str, Any]:
    normalized = _normalize_client_name(name)
    if not normalized:
        raise ValueError("Client name cannot be empty.")
    slug = _slugify(normalized)
    registry = _get_client_registry(container)
    clients: List[Dict[str, Any]] = registry.get("clients", [])
    existing = next((c for c in clients if c.get("slug") == slug), None)
    if existing:
        return existing
    new_client = {
        "id": slug,
        "name": normalized,
        "slug": slug,
        "createdAt": datetime.utcnow().isoformat()
    }
    clients.append(new_client)
    clients.sort(key=lambda c: c.get("name", "").lower())
    registry["clients"] = clients
    _save_client_registry(container, registry)
    return new_client

# --- NEW: Add a simple "hello" endpoint for diagnostics ---
@app.route(route="hello", auth_level=func.AuthLevel.ANONYMOUS)
def hello(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request for /api/hello.')
    return func.HttpResponse(
        "Hello from the API! If you see this, the API is deployed and routing is working.",
        status_code=200
    )


@app.route(route="clients", methods=["GET", "POST"], auth_level=func.AuthLevel.ANONYMOUS)
def clients_registry(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing client registry request for /api/clients.')
    try:
        container = _get_cosmos_container(PROMPT_DB_NAME, PROMPT_CONTAINER_NAME)
    except ValueError as err:
        logging.error(str(err))
        return _json_response({"error": str(err)}, status_code=500)

    if req.method == "GET":
        registry = _get_client_registry(container)
        return _json_response({"clients": registry.get("clients", [])})

    if req.method == "POST":
        try:
            payload = req.get_json()
        except ValueError:
            return _json_response({"error": "Invalid JSON body."}, status_code=400)
        name = (payload.get("name") or "").strip()
        if not name:
            return _json_response({"error": "Client name is required."}, status_code=400)
        try:
            client = _upsert_client(container, name)
        except ValueError as exc:
            return _json_response({"error": str(exc)}, status_code=400)
        registry = _get_client_registry(container)
        return _json_response({"client": client, "clients": registry.get("clients", [])})

    return _json_response({"error": "Method not supported"}, status_code=405)


@app.route(route="prompts", auth_level=func.AuthLevel.ANONYMOUS)
def manage_prompts(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing prompt request for /api/prompts.')

    try:
        container = _get_cosmos_container(PROMPT_DB_NAME, PROMPT_CONTAINER_NAME)

        # --- GET: Fetch Prompts by Sector/Doc Type ---
        if req.method == "GET":
            sector = req.params.get('sector')
            doc_type = req.params.get('docType')
            if not sector:
                return func.HttpResponse(
                    json.dumps({"error": "Missing 'sector' query parameter"}), 
                    status_code=400, mimetype="application/json"
                )
            parameters = [{"name": "@sector", "value": sector}]

            if doc_type:
                parameters.append({"name": "@docType", "value": doc_type})
                query = "SELECT * FROM c WHERE c.sector = @sector AND (NOT IS_DEFINED(c.docType) OR c.docType = @docType)"
            else:
                query = "SELECT * FROM c WHERE c.sector = @sector"

            items = list(container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            
            return func.HttpResponse(json.dumps(items), mimetype="application/json")

        # --- POST: Save/Update Prompt ---
        elif req.method == "POST":
            req_body = req.get_json()
            
            # Validation: Ensure critical fields exist
            required_fields = ['id', 'sector', 'docType']
            missing_fields = [field for field in required_fields if field not in req_body]
            if missing_fields:
                return func.HttpResponse(
                    json.dumps({"error": f"Payload missing required fields: {', '.join(missing_fields)}"}),
                    status_code=400, mimetype="application/json"
                )

            # Upsert (Update if exists, Insert if new)
            container.upsert_item(req_body)
            
            return func.HttpResponse(
                json.dumps({"message": "Saved successfully", "id": req_body['id']}), 
                status_code=200, mimetype="application/json"
            )

        # --- DELETE: Remove Prompt Section ---
        elif req.method == "DELETE":
            template_id = req.params.get('id')
            sector = req.params.get('sector')

            if not template_id or not sector:
                return func.HttpResponse(
                    json.dumps({"error": "Missing 'id' or 'sector' query parameter"}),
                    status_code=400, mimetype="application/json"
                )

            container.delete_item(item=template_id, partition_key=sector)

            return func.HttpResponse(
                json.dumps({"message": "Deleted successfully", "id": template_id}),
                status_code=200,
                mimetype="application/json"
            )

    except Exception as e:
        logging.error(f"Error: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}), 
            status_code=500, mimetype="application/json"
        )

    return func.HttpResponse("Method not supported", status_code=405)


@app.route(route="drafts", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def list_drafts(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing draft request for /api/drafts.')
    try:
        container = _get_cosmos_container(DRAFTS_DB_NAME, DRAFTS_CONTAINER_NAME)
    except ValueError as err:
        logging.error(str(err))
        return _json_response({"error": str(err)}, status_code=500)

    doc_type = req.params.get('docType')
    sector = req.params.get('sector')
    status = req.params.get('status')
    client_query = req.params.get('client')
    search_query = req.params.get('search')
    limit = req.params.get('limit')

    try:
        limit_value = int(limit) if limit else 50
    except ValueError:
        limit_value = 50
    limit_value = max(1, min(limit_value, 200))

    conditions: List[str] = []
    parameters: List[Dict[str, Any]] = []

    if doc_type:
        conditions.append("c.docType = @docType")
        parameters.append({"name": "@docType", "value": doc_type})
    if sector:
        conditions.append("c.sector = @sector")
        parameters.append({"name": "@sector", "value": sector})
    if status:
        conditions.append("c.status = @status")
        parameters.append({"name": "@status", "value": status})

    query = "SELECT * FROM c"
    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    try:
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
    except Exception as exc:
        logging.error("Failed to query drafts: %s", exc)
        return _json_response({"error": str(exc)}, status_code=500)

    def _matches_client(item: Dict[str, Any]) -> bool:
        if not client_query:
            return True
        value = item.get('client')
        return bool(value and client_query.lower() in value.lower())

    def _matches_search(item: Dict[str, Any]) -> bool:
        if not search_query:
            return True
        haystack = " ".join([
            str(item.get('operationID', '')),
            str(item.get('templateID', '')),
            str(item.get('client', '')),
            str(item.get('content', ''))
        ]).lower()
        return search_query.lower() in haystack

    filtered = [item for item in items if _matches_client(item) and _matches_search(item)]
    filtered.sort(key=lambda doc: doc.get('updatedAt') or doc.get('generatedAt') or "", reverse=True)

    return _json_response(filtered[:limit_value])


@app.route(route="drafts/{draft_id}", methods=["GET", "PATCH", "DELETE"], auth_level=func.AuthLevel.ANONYMOUS)
def draft_detail(req: func.HttpRequest) -> func.HttpResponse:
    draft_id = req.route_params.get("draft_id")
    if not draft_id:
        return _json_response({"error": "Missing draft_id in route"}, status_code=400)
    logging.info('Processing draft detail request for /api/drafts/%s', draft_id)
    try:
        container = _get_cosmos_container(DRAFTS_DB_NAME, DRAFTS_CONTAINER_NAME)
    except ValueError as err:
        logging.error(str(err))
        return _json_response({"error": str(err)}, status_code=500)

    draft = _fetch_draft_by_id(container, draft_id)
    if not draft:
        return _json_response({"error": "Draft not found."}, status_code=404)

    if req.method == "GET":
        return _json_response(draft)

    if req.method == "PATCH":
        try:
            updates = req.get_json()
        except ValueError:
            return _json_response({"error": "Invalid JSON body."}, status_code=400)

        allowed_fields = {"status", "annotations", "sections", "content"}
        has_change = False
        for key, value in updates.items():
            if key in allowed_fields:
                draft[key] = value
                has_change = True

        if not has_change:
            return _json_response({"error": "No valid fields provided to update."}, status_code=400)

        draft["updatedAt"] = datetime.utcnow().isoformat()

        try:
            container.upsert_item(draft)
        except Exception as exc:
            logging.error("Failed to update draft %s: %s", draft_id, exc)
            return _json_response({"error": str(exc)}, status_code=500)

        return _json_response({"message": "Draft updated.", "id": draft_id})

    if req.method == "DELETE":
        partition_value = _get_draft_partition_key(draft)
        if not partition_value:
            logging.error("Draft %s missing docType/doctype partition key; cannot delete.", draft_id)
            return _json_response(
                {"error": "Draft is missing docType/doctype partition key; cannot delete."},
                status_code=500
            )
        try:
            container.delete_item(item=draft_id, partition_key=partition_value)
        except Exception as exc:
            logging.error("Failed to delete draft %s: %s", draft_id, exc)
            return _json_response({"error": str(exc)}, status_code=500)

        return _json_response({"message": "Draft deleted.", "id": draft_id})

    return _json_response({"error": "Method not supported"}, status_code=405)
