*** Settings ***
Documentation     Frontend smoke checks for the trust dashboard.
...
...               `Dashboard Serves HTML Shell` is HTTP-only and safe for CI.
...               The Selenium case needs headless Chrome and runs with
...               `--include ui` locally or in the dedicated CI job.
Resource          ../resources/common.resource
Library           SeleniumLibrary

*** Variables ***
${BROWSER}        headlesschrome

*** Test Cases ***
Dashboard Serves HTML Shell
    [Documentation]    The frontend host returns the app shell over HTTP.
    [Tags]    smoke    web
    Frontend Should Serve HTML

Dashboard Renders Trust Assessment UI
    [Documentation]    The dashboard boots and renders its main landmarks.
    [Tags]    ui    web
    Open Browser    ${APP_URL}/    ${BROWSER}
    Wait Until Element Is Visible    tag:main    timeout=10s
    Title Should Be    Inclusive AI Trust Gateway
    [Teardown]    Close All Browsers
