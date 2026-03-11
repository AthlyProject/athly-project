# IntegrationsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**integrationsControllerConnectIntegration**](IntegrationsApi.md#integrationscontrollerconnectintegration) | **POST** /integrations/{integrationId}/connect |  |
| [**integrationsControllerDisconnectIntegration**](IntegrationsApi.md#integrationscontrollerdisconnectintegration) | **DELETE** /integrations/{integrationId}/disconnect |  |
| [**integrationsControllerDisconnectStrava**](IntegrationsApi.md#integrationscontrollerdisconnectstrava) | **POST** /integrations/strava/disconnect |  |
| [**integrationsControllerGetStravaAuthUrl**](IntegrationsApi.md#integrationscontrollergetstravaauthurl) | **GET** /integrations/strava/auth |  |
| [**integrationsControllerHandleStravaCallback**](IntegrationsApi.md#integrationscontrollerhandlestravacallback) | **POST** /integrations/strava/callback |  |
| [**integrationsControllerIntegrations**](IntegrationsApi.md#integrationscontrollerintegrations) | **GET** /integrations |  |
| [**integrationsControllerSyncStrava**](IntegrationsApi.md#integrationscontrollersyncstrava) | **POST** /integrations/strava/sync |  |



## integrationsControllerConnectIntegration

> IntegrationModel integrationsControllerConnectIntegration(integrationId)



### Example

```ts
import {
  Configuration,
  IntegrationsApi,
} from '';
import type { IntegrationsControllerConnectIntegrationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new IntegrationsApi(config);

  const body = {
    // string
    integrationId: integrationId_example,
  } satisfies IntegrationsControllerConnectIntegrationRequest;

  try {
    const data = await api.integrationsControllerConnectIntegration(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **integrationId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**IntegrationModel**](IntegrationModel.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## integrationsControllerDisconnectIntegration

> IntegrationModel integrationsControllerDisconnectIntegration(integrationId)



### Example

```ts
import {
  Configuration,
  IntegrationsApi,
} from '';
import type { IntegrationsControllerDisconnectIntegrationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new IntegrationsApi(config);

  const body = {
    // string
    integrationId: integrationId_example,
  } satisfies IntegrationsControllerDisconnectIntegrationRequest;

  try {
    const data = await api.integrationsControllerDisconnectIntegration(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **integrationId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**IntegrationModel**](IntegrationModel.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## integrationsControllerDisconnectStrava

> integrationsControllerDisconnectStrava()



### Example

```ts
import {
  Configuration,
  IntegrationsApi,
} from '';
import type { IntegrationsControllerDisconnectStravaRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new IntegrationsApi(config);

  try {
    const data = await api.integrationsControllerDisconnectStrava();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

`void` (Empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## integrationsControllerGetStravaAuthUrl

> IntegrationsControllerGetStravaAuthUrl200Response integrationsControllerGetStravaAuthUrl()



### Example

```ts
import {
  Configuration,
  IntegrationsApi,
} from '';
import type { IntegrationsControllerGetStravaAuthUrlRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new IntegrationsApi(config);

  try {
    const data = await api.integrationsControllerGetStravaAuthUrl();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**IntegrationsControllerGetStravaAuthUrl200Response**](IntegrationsControllerGetStravaAuthUrl200Response.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## integrationsControllerHandleStravaCallback

> IntegrationModel integrationsControllerHandleStravaCallback(stravaCallbackInput)



### Example

```ts
import {
  Configuration,
  IntegrationsApi,
} from '';
import type { IntegrationsControllerHandleStravaCallbackRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new IntegrationsApi(config);

  const body = {
    // StravaCallbackInput
    stravaCallbackInput: ...,
  } satisfies IntegrationsControllerHandleStravaCallbackRequest;

  try {
    const data = await api.integrationsControllerHandleStravaCallback(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **stravaCallbackInput** | [StravaCallbackInput](StravaCallbackInput.md) |  | |

### Return type

[**IntegrationModel**](IntegrationModel.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## integrationsControllerIntegrations

> Array&lt;IntegrationModel&gt; integrationsControllerIntegrations()



### Example

```ts
import {
  Configuration,
  IntegrationsApi,
} from '';
import type { IntegrationsControllerIntegrationsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new IntegrationsApi(config);

  try {
    const data = await api.integrationsControllerIntegrations();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**Array&lt;IntegrationModel&gt;**](IntegrationModel.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## integrationsControllerSyncStrava

> IntegrationsControllerSyncStrava200Response integrationsControllerSyncStrava()



### Example

```ts
import {
  Configuration,
  IntegrationsApi,
} from '';
import type { IntegrationsControllerSyncStravaRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new IntegrationsApi(config);

  try {
    const data = await api.integrationsControllerSyncStrava();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**IntegrationsControllerSyncStrava200Response**](IntegrationsControllerSyncStrava200Response.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

