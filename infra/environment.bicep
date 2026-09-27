// One Turnout environment (test or live): API container app, static web app, Web PubSub, App Insights, database.
param env string
param location string
param webLocation string
param suffix string
param tags object
param logsId string
param caeId string
param acrName string
@description('Custom domain for the web app, e.g. turnout.dataeaver.ca. Its CNAME must already point at the static web app.')
param webDomain string = ''
@description('0 scales to zero when idle; 1 keeps one API replica warm.')
param minReplicas int = 0
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
@description('App registration Entra uses to call our auth-events endpoint (custom sign-in code emails).')
param entraEventsAppId string = ''
param vapidPublicKey string = ''
@secure()
param vapidPrivateKey string = ''
@secure()
param acsConnectionString string = ''
param emailSender string = ''

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

// Free managed certificate; Azure validates by the CNAME, so add the DNS record before setting webDomain.
resource webCustomDomain 'Microsoft.Web/staticSites/customDomains@2023-12-01' = if (!empty(webDomain)) {
  parent: web
  name: empty(webDomain) ? 'unused' : webDomain
  properties: { validationMethod: 'cname-delegation' }
}

var defaultOrigin = 'https://${web.properties.defaultHostname}'
var webOrigin = empty(webDomain) ? defaultOrigin : 'https://${webDomain}'
var hasAi = !empty(aiKey)
var hasPush = !empty(vapidPrivateKey)
var hasEmail = !empty(acsConnectionString)

// Shared by the API and the reminder job. Container Apps rejects empty secrets, so optional ones
// are only added when configured.
var appSecrets = concat(
  [
    { name: 'database-url', value: databaseUrl }
    { name: 'web-pubsub', value: pubsub.listKeys().primaryConnectionString }
    { name: 'appi', value: appi.properties.ConnectionString }
  ],
  hasAi ? [{ name: 'ai-key', value: aiKey }] : [],
  hasPush ? [{ name: 'vapid-private', value: vapidPrivateKey }] : [],
  hasEmail ? [{ name: 'acs', value: acsConnectionString }] : []
)
var appEnv = concat(
  [
    { name: 'NODE_ENV', value: 'production' }
    { name: 'TURNOUT_ENV', value: env }
    { name: 'WEB_URL', value: webOrigin }
    { name: 'DATABASE_URL', secretRef: 'database-url' }
    { name: 'WEB_PUBSUB_CONNECTION_STRING', secretRef: 'web-pubsub' }
    { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', secretRef: 'appi' }
    { name: 'ENTRA_AUTHORITY', value: entraAuthority }
    { name: 'ENTRA_API_CLIENT_ID', value: entraApiClientId }
    { name: 'ENTRA_EVENTS_APP_ID', value: entraEventsAppId }
  ],
  hasAi ? [
    { name: 'AZURE_AI_ENDPOINT', value: aiEndpoint }
    { name: 'AZURE_AI_API_KEY', secretRef: 'ai-key' }
    { name: 'AZURE_AI_DEPLOYMENT', value: aiDeployment }
  ] : [],
  hasPush ? [
    { name: 'VAPID_PUBLIC_KEY', value: vapidPublicKey }
    { name: 'VAPID_PRIVATE_KEY', secretRef: 'vapid-private' }
  ] : [],
  hasEmail ? [
    { name: 'ACS_CONNECTION_STRING', secretRef: 'acs' }
    { name: 'EMAIL_SENDER', value: emailSender }
  ] : []
)

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
      secrets: appSecrets
    }
    template: {
      containers: [
        {
          name: 'api'
          image: usePlaceholder ? placeholderImage : apiImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: concat(appEnv, [
            { name: 'PORT', value: '8080' }
            // The default hostname keeps working after a custom domain is added, so allow both.
            // The test environment also accepts the local Expo dev server.
            { name: 'CORS_ORIGIN', value: join(union([webOrigin, defaultOrigin], env == 'test' ? ['http://localhost:8081'] : []), ',') }
          ])
          probes: usePlaceholder ? [] : [
            { type: 'Liveness', httpGet: { path: '/health', port: 8080 }, periodSeconds: 30 }
            { type: 'Readiness', httpGet: { path: '/health', port: 8080 }, periodSeconds: 10 }
          ]
        }
      ]
      scale: { minReplicas: minReplicas, maxReplicas: env == 'live' ? 3 : 1, rules: [{ name: 'http', http: { metadata: { concurrentRequests: '50' } } }] }
    }
  }
}

// Every 15 minutes: send reminders that are due. Same image as the API, different entry point.
// Skipped until a real image exists (the placeholder is a web server that never exits).
resource reminderJob 'Microsoft.App/jobs@2024-03-01' = if (!usePlaceholder) {
  name: 'caj-turnout-reminders-${env}'
  location: location
  tags: envTags
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }
  dependsOn: [acrPull]
  properties: {
    environmentId: caeId
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 300
      replicaRetryLimit: 0
      scheduleTriggerConfig: { cronExpression: '*/15 * * * *', parallelism: 1, replicaCompletionCount: 1 }
      registries: [{ server: acr.properties.loginServer, identity: identity.id }]
      secrets: appSecrets
    }
    template: {
      containers: [
        {
          name: 'reminders'
          image: apiImage
          command: ['node', '--import', './src/telemetry.ts', 'src/jobs/reminders.ts']
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: appEnv
        }
      ]
    }
  }
}

output info object = {
  apiName: api.name
  jobName: usePlaceholder ? '' : 'caj-turnout-reminders-${env}'
  apiUrl: 'https://${api.properties.configuration.ingress.fqdn}'
  webName: web.name
  webUrl: webOrigin
  defaultWebUrl: defaultOrigin
}
