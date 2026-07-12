package rest

import "net/http"

func (s *Server) openAPI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(openAPISpec))
}

func (s *Server) swaggerUI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(swaggerHTML))
}

const swaggerHTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Inclusive AI Trust Gateway API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/openapi.json",
      dom_id: "#swagger-ui",
      deepLinking: true,
      persistAuthorization: true
    });
  </script>
</body>
</html>`

const openAPISpec = `{
  "openapi": "3.0.3",
  "info": {
    "title": "Inclusive AI Trust Gateway",
    "version": "0.2.0",
    "description": "REST, GraphQL, WebSocket, UCP, and Connect-RPC surfaces for public-service trust assessment and ADM safety telemetry."
  },
  "servers": [
    { "url": "https://aitrustgateway-97n0puz9.b4a.run", "description": "Back4App demo" },
    { "url": "http://localhost:8080", "description": "Local gateway" }
  ],
  "security": [{ "ApiKeyAuth": [] }],
  "tags": [
    { "name": "System" },
    { "name": "Assessments" },
    { "name": "ADM Safety" },
    { "name": "Dashboard" },
    { "name": "GraphQL" },
    { "name": "UCP Commerce" },
    { "name": "Connect-RPC" },
    { "name": "WebSocket" }
  ],
  "paths": {
    "/healthz": {
      "get": {
        "tags": ["System"],
        "security": [],
        "summary": "Health check",
        "responses": {
          "200": { "description": "Gateway is healthy", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Health" } } } }
        }
      }
    },
    "/v1/assessments": {
      "post": {
        "tags": ["Assessments"],
        "summary": "Create a trust assessment",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/CreateAssessmentRequest" } } } },
        "responses": {
          "201": { "description": "Assessment created", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Assessment" } } } },
          "401": { "$ref": "#/components/responses/Unauthorized" },
          "422": { "$ref": "#/components/responses/ValidationError" }
        }
      },
      "get": {
        "tags": ["Assessments"],
        "summary": "List recent assessments",
        "responses": {
          "200": { "description": "Assessment list", "content": { "application/json": { "schema": { "type": "object", "properties": { "items": { "type": "array", "items": { "$ref": "#/components/schemas/Assessment" } } } } } } },
          "401": { "$ref": "#/components/responses/Unauthorized" }
        }
      }
    },
    "/v1/assessments/{id}": {
      "get": {
        "tags": ["Assessments"],
        "summary": "Get one assessment",
        "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
        "responses": {
          "200": { "description": "Assessment", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Assessment" } } } },
          "401": { "$ref": "#/components/responses/Unauthorized" },
          "404": { "$ref": "#/components/responses/NotFound" }
        }
      }
    },
    "/v1/dashboard": {
      "get": {
        "tags": ["Dashboard"],
        "summary": "Dashboard read model",
        "responses": {
          "200": { "description": "Dashboard summary", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Dashboard" } } } },
          "401": { "$ref": "#/components/responses/Unauthorized" }
        }
      }
    },
    "/v1/adm/events": {
      "post": {
        "tags": ["ADM Safety"],
        "summary": "Ingest an ADM safety event",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/IngestADMEventRequest" } } } },
        "responses": {
          "202": { "description": "Event accepted", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/SafetyEvent" } } } },
          "401": { "$ref": "#/components/responses/Unauthorized" },
          "422": { "$ref": "#/components/responses/ValidationError" }
        }
      },
      "get": {
        "tags": ["ADM Safety"],
        "summary": "List ADM safety events",
        "responses": {
          "200": { "description": "Safety event list", "content": { "application/json": { "schema": { "type": "object", "properties": { "items": { "type": "array", "items": { "$ref": "#/components/schemas/SafetyEvent" } } } } } } },
          "401": { "$ref": "#/components/responses/Unauthorized" }
        }
      }
    },
    "/graphql": {
      "post": {
        "tags": ["GraphQL"],
        "summary": "GraphQL query endpoint",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/GraphQLRequest" } } } },
        "responses": {
          "200": { "description": "GraphQL response" },
          "401": { "$ref": "#/components/responses/Unauthorized" }
        }
      }
    },
    "/ws": {
      "get": {
        "tags": ["WebSocket"],
        "security": [],
        "summary": "Live event feed WebSocket",
        "description": "Connect with ws(s)://host/ws?api_key=GATEWAY_API_KEY. Frames include adm.safety-events and commerce.events channels.",
        "responses": { "101": { "description": "WebSocket upgrade" } }
      }
    },
    "/ucp/v1/sessions": {
      "post": {
        "tags": ["UCP Commerce"],
        "summary": "Open a monitored UCP commerce session",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/OpenSessionRequest" } } } },
        "responses": { "201": { "description": "Session", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/CommerceSession" } } } } }
      }
    },
    "/ucp/v1/discovery": {
      "post": {
        "tags": ["UCP Commerce"],
        "summary": "Discover catalog products under trust monitoring",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/DiscoveryRequest" } } } },
        "responses": { "200": { "description": "Products and trust trace", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/DiscoveryResponse" } } } } }
      }
    },
    "/ucp/v1/checkout-intents": {
      "post": {
        "tags": ["UCP Commerce"],
        "summary": "Create a checkout intent if the trust gate allows it",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/CheckoutIntentRequest" } } } },
        "responses": {
          "201": { "description": "Allowed checkout" },
          "202": { "description": "Flagged for review" },
          "403": { "description": "Blocked by trust gate" }
        }
      }
    },
    "/ucp/v1/trace": {
      "get": {
        "tags": ["UCP Commerce"],
        "summary": "List UCP trust trace events",
        "responses": { "200": { "description": "Trace event list", "content": { "application/json": { "schema": { "type": "object", "properties": { "items": { "type": "array", "items": { "$ref": "#/components/schemas/TraceEvent" } } } } } } } }
      }
    },
    "/iatg.v1.TrustService/EvaluateService": {
      "post": {
        "tags": ["Connect-RPC"],
        "summary": "Connect-RPC EvaluateService",
        "description": "Connect JSON endpoint. Send X-Api-Key and Content-Type: application/json.",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/EvaluateServiceRequest" } } } },
        "responses": { "200": { "description": "Connect assessment response" } }
      }
    },
    "/iatg.v1.TrustService/ListAssessments": {
      "post": {
        "tags": ["Connect-RPC"],
        "summary": "Connect-RPC ListAssessments",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "type": "object", "properties": { "limit": { "type": "integer" } } } } } },
        "responses": { "200": { "description": "Connect assessment list" } }
      }
    },
    "/iatg.v1.TrustService/ListSafetyEvents": {
      "post": {
        "tags": ["Connect-RPC"],
        "summary": "Connect-RPC ListSafetyEvents",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "type": "object", "properties": { "limit": { "type": "integer" } } } } } },
        "responses": { "200": { "description": "Connect safety event list" } }
      }
    },
    "/openapi.json": {
      "get": {
        "tags": ["System"],
        "security": [],
        "summary": "OpenAPI document",
        "responses": { "200": { "description": "OpenAPI JSON" } }
      }
    },
    "/docs": {
      "get": {
        "tags": ["System"],
        "security": [],
        "summary": "Swagger UI",
        "responses": { "200": { "description": "Swagger UI page" } }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "ApiKeyAuth": { "type": "apiKey", "in": "header", "name": "X-Api-Key" }
    },
    "responses": {
      "Unauthorized": { "description": "Missing or invalid API key" },
      "NotFound": { "description": "Resource not found" },
      "ValidationError": { "description": "Validation error" }
    },
    "schemas": {
      "Health": { "type": "object", "properties": { "status": { "type": "string", "example": "ok" } } },
      "Persona": {
        "type": "object",
        "properties": {
          "label": { "type": "string" },
          "ageGroup": { "type": "string" },
          "region": { "type": "string" },
          "needs": { "type": "array", "items": { "type": "string" } },
          "barriers": { "type": "array", "items": { "type": "string" } }
        }
      },
      "UseCase": {
        "type": "object",
        "required": ["name", "domain"],
        "properties": {
          "name": { "type": "string" },
          "domain": { "type": "string" },
          "description": { "type": "string" },
          "targetUsers": { "type": "array", "items": { "type": "string" } },
          "sdgs": { "type": "array", "items": { "type": "string" } },
          "openDataSources": { "type": "array", "items": { "type": "string" } },
          "aiCapabilities": { "type": "array", "items": { "type": "string" } },
          "safeguards": { "type": "array", "items": { "type": "string" } },
          "personas": { "type": "array", "items": { "$ref": "#/components/schemas/Persona" } }
        }
      },
      "CreateAssessmentRequest": {
        "type": "object",
        "required": ["useCase"],
        "properties": { "useCase": { "$ref": "#/components/schemas/UseCase" } }
      },
      "EvaluateServiceRequest": {
        "allOf": [{ "$ref": "#/components/schemas/UseCase" }]
      },
      "Assessment": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "domain": { "type": "string" },
          "inclusionScore": { "type": "integer", "minimum": 0, "maximum": 100 },
          "fairnessRisk": { "type": "integer", "minimum": 0, "maximum": 100 },
          "fairnessRiskLabel": { "type": "string" },
          "openDataReadiness": { "type": "integer", "minimum": 0, "maximum": 100 },
          "agentSafetyReadiness": { "type": "integer", "minimum": 0, "maximum": 100 },
          "evaluator": { "type": "string" },
          "createdAt": { "type": "string", "format": "date-time" }
        }
      },
      "Dashboard": {
        "type": "object",
        "additionalProperties": true
      },
      "IngestADMEventRequest": {
        "type": "object",
        "required": ["eventType", "severity", "detail"],
        "properties": {
          "eventType": { "type": "string", "enum": ["prompt_injection", "tool_policy", "containment", "provenance"] },
          "severity": { "type": "string", "example": "high" },
          "detail": {},
          "sessionId": { "type": "string" }
        }
      },
      "SafetyEvent": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "eventType": { "type": "string" },
          "severity": { "type": "string" },
          "detail": {},
          "sessionId": { "type": "string" },
          "receivedAt": { "type": "string", "format": "date-time" }
        }
      },
      "GraphQLRequest": {
        "type": "object",
        "required": ["query"],
        "properties": {
          "query": { "type": "string", "example": "query { assessments(limit: 5) { id name inclusionScore } }" },
          "variables": { "type": "object" }
        }
      },
      "OpenSessionRequest": {
        "type": "object",
        "required": ["agentId"],
        "properties": {
          "agentId": { "type": "string" },
          "personaId": { "type": "string" },
          "extensions": { "type": "object", "additionalProperties": { "type": "string" } }
        }
      },
      "CommerceSession": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "agentId": { "type": "string" },
          "personaId": { "type": "string" },
          "status": { "type": "string" },
          "startedAt": { "type": "string", "format": "date-time" }
        }
      },
      "DiscoveryRequest": {
        "type": "object",
        "required": ["sessionId"],
        "properties": {
          "sessionId": { "type": "string" },
          "query": { "type": "string" },
          "extensions": { "type": "object", "additionalProperties": { "type": "string" } }
        }
      },
      "Product": {
        "type": "object",
        "properties": {
          "sku": { "type": "string" },
          "name": { "type": "string" },
          "category": { "type": "string" },
          "priceTWD": { "type": "integer" },
          "fairPriceTWD": { "type": "integer" },
          "accessibleDescription": { "type": "boolean" }
        }
      },
      "TraceEvent": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "sessionId": { "type": "string" },
          "ucpAction": { "type": "string" },
          "trustVerdict": { "type": "string", "enum": ["allowed", "flagged", "blocked"] },
          "reason": { "type": "string" },
          "payload": {},
          "createdAt": { "type": "string", "format": "date-time" }
        }
      },
      "DiscoveryResponse": {
        "type": "object",
        "properties": {
          "products": { "type": "array", "items": { "$ref": "#/components/schemas/Product" } },
          "trust": { "$ref": "#/components/schemas/TraceEvent" }
        }
      },
      "CheckoutIntentRequest": {
        "type": "object",
        "required": ["sessionId", "sku"],
        "properties": {
          "sessionId": { "type": "string" },
          "sku": { "type": "string" },
          "quantity": { "type": "integer", "minimum": 1 },
          "extensions": { "type": "object", "additionalProperties": { "type": "string" } }
        }
      }
    }
  }
}`
