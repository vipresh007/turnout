// Turnout infrastructure: shared resources plus one "test" and one "live" environment.
// Deploy with ./provision.sh. Needs Owner on the resource group because it creates role assignments.
targetScope = 'resourceGroup'

param location string = resourceGroup().location
@description('Static Web Apps is only offered in a few regions.')
param webLocation string = 'eastus2'

@secure()
@description('Postgres admin password (alphanumeric, so it can go in a URL unescaped).')
param postgresPassword string
param postgresAdmin string = 'turnoutadmin'

@description('Current API image per environment, so re-provisioning never rolls back a deploy.')
param apiImages object = { test: '', live: '' }

@description('Custom web domains per environment (CNAME to the static web app must exist first). Empty = Azure default hostname.')
param webDomains object = { test: '', live: '' }

@description('Entra External ID settings per environment (empty until the tenant exists).')
param entra object = {
  authority: ''
  apiClientId: ''
}

@description('Create a dedicated AI Services account. When false, use externalAi (or none: the API falls back to its rule-based parser).')
param createAiAccount bool = false
@description('An existing Azure OpenAI / AI Foundry endpoint and deployment to use when createAiAccount is false.')
param externalAi object = { endpoint: '', deployment: '' }
@secure()
param externalAiKey string = ''
@description('GlobalStandard model deployments are not offered in every region; requests are processed globally either way.')
param aiLocation string = 'eastus2'
@description('Browser push (VAPID) keys, generated once by provision.sh.')
param vapidPublicKey string = ''
@secure()
param vapidPrivateKey string = ''

param aiModel string = 'gpt-4.1-mini'
param aiModelVersion string = '2025-04-14'

var suffix = uniqueString(resourceGroup().id)
var tags = { app: 'turnout' }

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-turnout'
  location: location
  tags: tags
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30 }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'acrturnout${suffix}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource cae 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-turnout'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: { customerId: logs.properties.customerId, sharedKey: logs.listKeys().primarySharedKey }
    }
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: 'psql-turnout-${suffix}'
  location: location
  tags: tags
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: postgresAdmin
    administratorLoginPassword: postgresPassword
    storage: { storageSizeGB: 32, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
  }
}

// TODO: move to private networking before real traffic. For now: Azure services only + strong password + TLS.
resource pgAllowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource ai 'Microsoft.CognitiveServices/accounts@2024-10-01' = if (createAiAccount) {
  name: 'ai-turnout-${suffix}'
  location: aiLocation
  tags: tags
  kind: 'AIServices'
  sku: { name: 'S0' }
  properties: { customSubDomainName: 'ai-turnout-${suffix}', publicNetworkAccess: 'Enabled' }
}

resource aiDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = if (createAiAccount) {
  parent: ai
  name: aiModel
  sku: { name: 'GlobalStandard', capacity: 20 }
  properties: { model: { format: 'OpenAI', name: aiModel, version: aiModelVersion } }
}

// Email through Azure Communication Services, from an Azure-managed sender domain for now.
// TODO: send from a dataeaver.ca address (needs SPF/DKIM DNS records).
resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: 'ecs-turnout-${suffix}'
  location: 'global'
  tags: tags
  properties: { dataLocation: 'Canada' }
}

resource emailDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  tags: tags
  properties: { domainManagement: 'AzureManaged', userEngagementTracking: 'Disabled' }
}

resource acs 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: 'acs-turnout-${suffix}'
  location: 'global'
  tags: tags
  properties: { dataLocation: 'Canada', linkedDomains: [emailDomain.id] }
}

module environments 'environment.bicep' = [for env in ['test', 'live']: {
  name: 'turnout-${env}'
  params: {
    env: env
    location: location
    webLocation: webLocation
    suffix: suffix
    tags: tags
    logsId: logs.id
    caeId: cae.id
    acrName: acr.name
    apiImage: apiImages[env]
    webDomain: webDomains[env]
    databaseUrl: 'postgres://${postgresAdmin}:${postgresPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/turnout_${env}?sslmode=require'
    databaseName: 'turnout_${env}'
    postgresName: postgres.name
    aiEndpoint: createAiAccount ? 'https://ai-turnout-${suffix}.openai.azure.com' : externalAi.endpoint
    aiKey: createAiAccount ? ai!.listKeys().key1 : externalAiKey
    aiDeployment: createAiAccount ? aiModel : externalAi.deployment
    entraAuthority: entra.authority
    entraApiClientId: entra.apiClientId
    vapidPublicKey: vapidPublicKey
    vapidPrivateKey: vapidPrivateKey
    acsConnectionString: acs.listKeys().primaryConnectionString
    emailSender: 'DoNotReply@${emailDomain.properties.mailFromSenderDomain}'
  }
}]

output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output test object = environments[0].outputs.info
output live object = environments[1].outputs.info
