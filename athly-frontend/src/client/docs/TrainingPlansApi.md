# TrainingPlansApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**trainingPlansControllerCreateTrainingPlan**](TrainingPlansApi.md#trainingplanscontrollercreatetrainingplan) | **POST** /training-plans |  |
| [**trainingPlansControllerDeleteTrainingPlan**](TrainingPlansApi.md#trainingplanscontrollerdeletetrainingplan) | **DELETE** /training-plans/{id} |  |
| [**trainingPlansControllerGetMyTrainingPlan**](TrainingPlansApi.md#trainingplanscontrollergetmytrainingplan) | **GET** /training-plans/me |  |
| [**trainingPlansControllerGetTrainingPlanById**](TrainingPlansApi.md#trainingplanscontrollergettrainingplanbyid) | **GET** /training-plans/{id} |  |
| [**trainingPlansControllerUpdateTrainingPlan**](TrainingPlansApi.md#trainingplanscontrollerupdatetrainingplan) | **PUT** /training-plans/{id} |  |



## trainingPlansControllerCreateTrainingPlan

> trainingPlansControllerCreateTrainingPlan(body)



### Example

```ts
import {
  Configuration,
  TrainingPlansApi,
} from '';
import type { TrainingPlansControllerCreateTrainingPlanRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TrainingPlansApi();

  const body = {
    // object
    body: Object,
  } satisfies TrainingPlansControllerCreateTrainingPlanRequest;

  try {
    const data = await api.trainingPlansControllerCreateTrainingPlan(body);
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
| **body** | `object` |  | |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## trainingPlansControllerDeleteTrainingPlan

> trainingPlansControllerDeleteTrainingPlan(id)



### Example

```ts
import {
  Configuration,
  TrainingPlansApi,
} from '';
import type { TrainingPlansControllerDeleteTrainingPlanRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TrainingPlansApi();

  const body = {
    // string
    id: id_example,
  } satisfies TrainingPlansControllerDeleteTrainingPlanRequest;

  try {
    const data = await api.trainingPlansControllerDeleteTrainingPlan(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## trainingPlansControllerGetMyTrainingPlan

> trainingPlansControllerGetMyTrainingPlan()



### Example

```ts
import {
  Configuration,
  TrainingPlansApi,
} from '';
import type { TrainingPlansControllerGetMyTrainingPlanRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TrainingPlansApi();

  try {
    const data = await api.trainingPlansControllerGetMyTrainingPlan();
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

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## trainingPlansControllerGetTrainingPlanById

> trainingPlansControllerGetTrainingPlanById(id)



### Example

```ts
import {
  Configuration,
  TrainingPlansApi,
} from '';
import type { TrainingPlansControllerGetTrainingPlanByIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TrainingPlansApi();

  const body = {
    // string
    id: id_example,
  } satisfies TrainingPlansControllerGetTrainingPlanByIdRequest;

  try {
    const data = await api.trainingPlansControllerGetTrainingPlanById(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## trainingPlansControllerUpdateTrainingPlan

> trainingPlansControllerUpdateTrainingPlan(id, body)



### Example

```ts
import {
  Configuration,
  TrainingPlansApi,
} from '';
import type { TrainingPlansControllerUpdateTrainingPlanRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TrainingPlansApi();

  const body = {
    // string
    id: id_example,
    // object
    body: Object,
  } satisfies TrainingPlansControllerUpdateTrainingPlanRequest;

  try {
    const data = await api.trainingPlansControllerUpdateTrainingPlan(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |
| **body** | `object` |  | |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

