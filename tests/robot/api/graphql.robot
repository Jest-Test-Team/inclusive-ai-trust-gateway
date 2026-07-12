*** Settings ***
Documentation     GraphQL read-model contract: the same CQRS queries exposed
...               at /graphql for partners and analysts.
Resource          ../resources/common.resource
Library           Collections
Suite Setup       Create Gateway Session

*** Test Cases ***
GraphQL Lists Assessments
    [Documentation]    An assessment created over REST is visible via GraphQL.
    [Tags]    api    graphql
    ${headers}=    Gateway Auth Headers
    ${useCase}=    Create Dictionary    name=GraphQL probe    domain=governance
    ${payload}=    Create Dictionary    useCase=${useCase}
    POST On Session    gateway    /v1/assessments    json=${payload}    headers=${headers}    expected_status=201

    ${query}=    Create Dictionary
    ...    query=query { assessments(limit: 50) { id name inclusionScore } }
    ${response}=    POST On Session    gateway    /graphql    json=${query}    headers=${headers}    expected_status=200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    data
    ${names}=    Evaluate    [a['name'] for a in $body['data']['assessments']]
    Should Contain    ${names}    GraphQL probe

GraphQL Requires Api Key
    [Documentation]    /graphql is behind the same agency auth as /v1.
    [Tags]    api    graphql    security
    ${query}=    Create Dictionary    query=query { assessments { id } }
    POST On Session    gateway    /graphql    json=${query}    expected_status=401
