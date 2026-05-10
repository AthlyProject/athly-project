# GoalsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**goalsControllerCreate**](GoalsApi.md#goalscontrollercreate) | **POST** /goals | Criar objetivo de corrida em texto livre |
| [**goalsControllerGetActive**](GoalsApi.md#goalscontrollergetactive) | **GET** /goals/active | Buscar objetivo ativo do usuário |
| [**goalsControllerList**](GoalsApi.md#goalscontrollerlist) | **GET** /goals | Listar todos os objetivos do usuário |



## goalsControllerCreate

> goalsControllerCreate(createGoalDto)

Criar objetivo de corrida em texto livre

### Example

```ts
import {
  Configuration,
  GoalsApi,
} from '';
import type { GoalsControllerCreateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new GoalsApi(config);

  const body = {
    // CreateGoalDto
    createGoalDto: ...,
  } satisfies GoalsControllerCreateRequest;

  try {
    const data = await api.goalsControllerCreate(body);
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
| **createGoalDto** | [CreateGoalDto](CreateGoalDto.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## goalsControllerGetActive

> object goalsControllerGetActive()

Buscar objetivo ativo do usuário

### Example

```ts
import {
  Configuration,
  GoalsApi,
} from '';
import type { GoalsControllerGetActiveRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new GoalsApi(config);

  try {
    const data = await api.goalsControllerGetActive();
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

**object**

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


## goalsControllerList

> goalsControllerList()

Listar todos os objetivos do usuário

### Example

```ts
import {
  Configuration,
  GoalsApi,
} from '';
import type { GoalsControllerListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new GoalsApi(config);

  try {
    const data = await api.goalsControllerList();
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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

