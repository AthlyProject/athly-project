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

> TrainingPlanModel trainingPlansControllerCreateTrainingPlan(createTrainingPlanInput)



### Example

```ts
import {
  Configuration,
  TrainingPlansApi,
} from '';
import type { TrainingPlansControllerCreateTrainingPlanRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new TrainingPlansApi(config);

  const body = {
    // CreateTrainingPlanInput
    createTrainingPlanInput: ...,
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
| **createTrainingPlanInput** | [CreateTrainingPlanInput](CreateTrainingPlanInput.md) |  | |

### Return type

[**TrainingPlanModel**](TrainingPlanModel.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


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
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new TrainingPlansApi(config);

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

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## trainingPlansControllerGetMyTrainingPlan

> TrainingPlanModel trainingPlansControllerGetMyTrainingPlan()



### Example

```ts
import {
  Configuration,
  TrainingPlansApi,
} from '';
import type { TrainingPlansControllerGetMyTrainingPlanRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new TrainingPlansApi(config);

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

[**TrainingPlanModel**](TrainingPlanModel.md)

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


## trainingPlansControllerGetTrainingPlanById

> TrainingPlanModel trainingPlansControllerGetTrainingPlanById(id)



### Example

```ts
import {
  Configuration,
  TrainingPlansApi,
} from '';
import type { TrainingPlansControllerGetTrainingPlanByIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new TrainingPlansApi(config);

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

[**TrainingPlanModel**](TrainingPlanModel.md)

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


## trainingPlansControllerUpdateTrainingPlan

> TrainingPlanModel trainingPlansControllerUpdateTrainingPlan(id, updateTrainingPlanInput)



### Example

```ts
import {
  Configuration,
  TrainingPlansApi,
} from '';
import type { TrainingPlansControllerUpdateTrainingPlanRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new TrainingPlansApi(config);

  const body = {
    // string
    id: id_example,
    // UpdateTrainingPlanInput
    updateTrainingPlanInput: ...,
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
| **updateTrainingPlanInput** | [UpdateTrainingPlanInput](UpdateTrainingPlanInput.md) |  | |

### Return type

[**TrainingPlanModel**](TrainingPlanModel.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

