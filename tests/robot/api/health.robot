*** Settings ***
Documentation     Liveness checks for the gateway API.
...
...               Runs against any deployment tier (local, Back4App staging,
...               Cloudflare-fronted production) via the BASE_URL variable.
Resource          ../resources/common.resource
Suite Setup       Create Gateway Session

*** Test Cases ***
Gateway Health Endpoint Responds
    [Documentation]    /healthz must return 200 with a status payload.
    [Tags]    smoke    api
    ${response}=    GET On Session    gateway    /healthz    expected_status=200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body['status']}    ok

Gateway Rejects Unknown Routes
    [Documentation]    Unknown paths must 404 rather than leak internals.
    [Tags]    api
    GET On Session    gateway    /definitely-not-a-route    expected_status=404
