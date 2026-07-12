*** Settings ***
Documentation     Contract tests for the /v1/assessments workflow
...               (endpoints reserved in services/gateway/README.md).
...
...               These encode the API contract from
...               docs/dev-plan/implementation.plan.md §2–3 ahead of the
...               gateway implementation (subtask 4). They are excluded from
...               CI smoke runs via tagging until the service exists.
Resource          ../resources/common.resource
Library           Collections
Suite Setup       Create Gateway Session

*** Variables ***
&{USE_CASE}       name=Care navigation assistant
...               domain=care-services
...               description=AI assistant helping residents find eligible care services

*** Test Cases ***
Create Assessment Returns Scores
    [Documentation]    POST /v1/assessments returns the four trust scores.
    [Tags]    api    assessments
    ${headers}=    Gateway Auth Headers
    ${payload}=    Create Dictionary    useCase=&{USE_CASE}
    ${response}=    POST On Session    gateway    /v1/assessments
    ...    json=${payload}    headers=${headers}    expected_status=201
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    id
    FOR    ${score}    IN    inclusionScore    fairnessRisk    openDataReadiness    agentSafetyReadiness
        Dictionary Should Contain Key    ${body}    ${score}
        ${value}=    Get From Dictionary    ${body}    ${score}
        Should Be True    0 <= ${value} <= 100
    END

Assessment Is Retrievable By Id
    [Documentation]    GET /v1/assessments/:id round-trips the created record.
    [Tags]    api    assessments
    ${headers}=    Gateway Auth Headers
    ${payload}=    Create Dictionary    useCase=&{USE_CASE}
    ${created}=    POST On Session    gateway    /v1/assessments
    ...    json=${payload}    headers=${headers}    expected_status=201
    ${id}=    Set Variable    ${created.json()['id']}
    ${response}=    GET On Session    gateway    /v1/assessments/${id}
    ...    headers=${headers}    expected_status=200
    Should Be Equal As Strings    ${response.json()['id']}    ${id}

Create Assessment Requires Api Key
    [Documentation]    Requests without X-Api-Key must be rejected.
    [Tags]    api    assessments    security
    ${payload}=    Create Dictionary    useCase=&{USE_CASE}
    POST On Session    gateway    /v1/assessments
    ...    json=${payload}    expected_status=401

Adm Event Ingestion Accepts Safety Signal
    [Documentation]    POST /v1/adm/events accepts an ADM telemetry event.
    [Tags]    api    adm
    ${headers}=    Gateway Auth Headers
    ${event}=    Create Dictionary
    ...    eventType=prompt_injection
    ...    severity=high
    ...    detail=Blocked instruction override attempt in citizen chat session
    ${response}=    POST On Session    gateway    /v1/adm/events
    ...    json=${event}    headers=${headers}    expected_status=202
    Dictionary Should Contain Key    ${response.json()}    id
