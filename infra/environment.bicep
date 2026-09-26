// One Turnout environment (test or live): API container app, static web app, Web PubSub, App Insights, database.
param env string
param location string
param webLocation string
param suffix string
param tags object
param logsId string
param caeId string
param acrName string
@description('Leave empty on first deploy to use a public placeholder image.')
param apiImage string
@secure()
param databaseUrl string
param databaseName string
param postgresName string
param aiEndpoint string
@secure()
param aiKey string
param aiDeployment string
param entraAuthority string
param entraApiClientId string

var placeholderImage = 'mcr.microsoft.com/k8se/quickstart:latest'
var usePlaceholder = empty(apiImage)
var envTags = union(tags, { environment: env })

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' existing = {
  name: postgresName
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: databaseName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

resource appi 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-turnout-${env}'
  location: location
  tags: envTags
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: logsId }
}

resource pubsub 'Microsoft.SignalRService/webPubSub@2024-03-01' = {
  name: 'wps-turnout-${env}-${suffix}'
  location: location
  tags: envTags
  sku: { name: 'Free_F1', capacity: 1 }
  properties: {}
}

resource web 'Microsoft.Web/staticSites@2023-12-01' = {
  name: 'swa-turnout-${env}'
  location: webLocation
  tags: envTags
  sku: { name: 'Free', tier: 'Free' }
  properties: {}
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-turnout-api-${env}'
  location: location
  tags: envTags
}

// AcrPull, so the API can pull its image without registry passwords.
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, identity.id, 'acrpull')
  scope: acr
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}

var webOrigin = 'https://${web.properties.defaultHostname}'
var hasAi = !empty(aiKey)

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-turnout-api-${env}'
  location: location
  tags: envTags
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }
  dependsOn: [acrPull, database]
  properties: {
    managedEnvironmentId: caeId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: { external: true, targetPort: usePlaceholder ? 80 : 8080, transport: 'auto', allowInsecure: false }
      registries: [{ server: acr.properties.loginServer, identity: identity.id }]
      // Container Apps rejects empty secrets, so the AI key is only added when there is one.
      secrets: concat([
        { name: 'database-url', value: databaseUrl }
        { name: 'web-pubsub', value: pubsub.listKeys().primaryConnectionString }
        { name: 'appi', value: appi.properties.ConnectionString }
      ], hasAi ? [{ name: 'ai-key', value: aiKey }] : [])
    }
    template: {
      containers: [
        {
          name: 'api'
          image: usePlaceholder ? placeholderImage : apiImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: concat([
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '8080' }
            { name: 'TURNOUT_ENV', value: env }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'WEB_PUBSUB_CONNECTION_STRING', secretRef: 'web-pubsub' }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', secretRef: 'appi' }
            { name: 'ENTRA_AUTHORITY', value: entraAuthority }
            { name: 'ENTRA_API_CLIENT_ID', value: entraApiClientId }
            // The test environment also accepts the local Expo dev server.
            { name: 'CORS_ORIGIN', value: env == 'test' ? '${webOrigin},http://localhost:8081' : webOrigin }
          ], hasAi ? [
            { name: 'AZURE_AI_ENDPOINT', value: aiEndpoint }
            { name: 'AZURE_AI_API_KEY', secretRef: 'ai-key' }
            { name: 'AZURE_AI_DEPLOYMENT', value: aiDeployment }
          ] : [])
          probes: usePlaceholder ? [] : [
            { type: 'Liveness', httpGet: { path: '/health', port: 8080 }, periodSeconds: 30 }
            { type: 'Readiness', httpGet: { path: '/health', port: 8080 }, periodSeconds: 10 }
          ]
        }
      ]
      // Scale to zero when idle (a few seconds of cold start on the first request).
      scale: { minReplicas: 0, maxReplicas: env == 'live' ? 3 : 1, rules: [{ name: 'http', http: { metadata: { concurrentRequests: '50' } } }] }
    }
  }
}

output info object = {
  apiName: api.name
  apiUrl: 'https://${api.properties.configuration.ingress.fqdn}'
  webName: web.name
  webUrl: webOrigin
}
