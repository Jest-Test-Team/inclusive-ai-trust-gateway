*** Settings ***
Documentation     UCP inclusive-commerce scenario walk (plan §5.3): a
...               delegated shopping agent transacts through the trust
...               gateway; fair offers pass, price-gouged offers are
...               blocked, and ADM containment freezes the session.
Resource          ../resources/common.resource
Library           Collections
Suite Setup       Create Gateway Session

*** Keywords ***
Open Shopping Session
    ${headers}=    Gateway Auth Headers
    ${body}=    Create Dictionary    agentId=robot-demo-agent    personaId=rural-older-adult
    ${response}=    POST On Session    gateway    /ucp/v1/sessions    json=${body}    headers=${headers}    expected_status=201
    RETURN    ${response.json()['id']}

*** Test Cases ***
Fair Checkout Intent Is Allowed
    [Tags]    api    ucp
    ${headers}=    Gateway Auth Headers
    ${session}=    Open Shopping Session
    ${body}=    Create Dictionary    sessionId=${session}    sku=CARE-002    quantity=${1}
    ${response}=    POST On Session    gateway    /ucp/v1/checkout-intents    json=${body}    headers=${headers}    expected_status=201
    Should Be Equal As Strings    ${response.json()['trust']['trustVerdict']}    allowed

Price Gouged Checkout Is Blocked
    [Documentation]    CARE-004 is priced >50% above its open-data fair
    ...                reference price and must be rejected.
    [Tags]    api    ucp
    ${headers}=    Gateway Auth Headers
    ${session}=    Open Shopping Session
    ${body}=    Create Dictionary    sessionId=${session}    sku=CARE-004    quantity=${1}
    ${response}=    POST On Session    gateway    /ucp/v1/checkout-intents    json=${body}    headers=${headers}    expected_status=403
    Should Be Equal As Strings    ${response.json()['trust']['trustVerdict']}    blocked

Contained Session Cannot Transact
    [Documentation]    An ADM containment event for the session must block
    ...                subsequent checkout intents (asynchronous, so retried).
    [Tags]    api    ucp    security
    ${headers}=    Gateway Auth Headers
    ${session}=    Open Shopping Session
    ${event}=    Create Dictionary
    ...    eventType=containment
    ...    severity=critical
    ...    detail=Agent hijack detected mid-session
    ...    sessionId=${session}
    POST On Session    gateway    /v1/adm/events    json=${event}    headers=${headers}    expected_status=202
    ${body}=    Create Dictionary    sessionId=${session}    sku=CARE-002    quantity=${1}
    Wait Until Keyword Succeeds    5s    0.5s
    ...    POST On Session    gateway    /ucp/v1/checkout-intents    json=${body}    headers=${headers}    expected_status=403
