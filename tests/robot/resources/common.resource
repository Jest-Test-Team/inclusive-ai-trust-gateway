*** Settings ***
Documentation     Shared variables and keywords for Inclusive AI Trust Gateway suites.
...
...               Override targets at runtime, e.g.:
...               robot --variable BASE_URL:https://api.example.org --variable APP_URL:https://app.example.org tests/robot
Library           RequestsLibrary

*** Variables ***
# Gateway API base URL (Choreo container or local `pnpm --dir services/gateway dev`).
${BASE_URL}       http://127.0.0.1:8080
# Frontend base URL (Vercel deployment or local `pnpm preview`).
${APP_URL}        http://127.0.0.1:4173
# Agency API key; injected via --variable or the GATEWAY_API_KEY env var in CI.
${API_KEY}        %{GATEWAY_API_KEY=dev-key}

*** Keywords ***
Create Gateway Session
    [Documentation]    Opens an HTTP session against the gateway API with auth header.
    Create Session    gateway    ${BASE_URL}    headers=&{EMPTY}
    ...    verify=${True}

Gateway Auth Headers
    [Documentation]    Returns headers carrying the agency API key.
    ${headers}=    Create Dictionary    X-Api-Key=${API_KEY}    Content-Type=application/json
    RETURN    ${headers}

Frontend Should Serve HTML
    [Documentation]    Asserts the frontend host returns an HTML document.
    ${response}=    GET    ${APP_URL}/    expected_status=200
    Should Contain    ${response.headers['Content-Type']}    text/html
    Should Contain    ${response.text}    Inclusive AI Trust Gateway
