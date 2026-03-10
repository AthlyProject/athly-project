# WorkoutsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**workoutsControllerCompleteWorkout**](WorkoutsApi.md#workoutscontrollercompleteworkout) | **PATCH** /workouts/{workoutId}/complete |  |
| [**workoutsControllerCreateWorkout**](WorkoutsApi.md#workoutscontrollercreateworkout) | **POST** /workouts |  |
| [**workoutsControllerSkipWorkout**](WorkoutsApi.md#workoutscontrollerskipworkout) | **PATCH** /workouts/{workoutId}/skip |  |
| [**workoutsControllerSubmitWorkoutFeedback**](WorkoutsApi.md#workoutscontrollersubmitworkoutfeedback) | **POST** /workouts/{workoutId}/feedback |  |
| [**workoutsControllerTodayWorkout**](WorkoutsApi.md#workoutscontrollertodayworkout) | **GET** /workouts/today |  |
| [**workoutsControllerUpdateWorkout**](WorkoutsApi.md#workoutscontrollerupdateworkout) | **PUT** /workouts/{workoutId} |  |
| [**workoutsControllerWorkout**](WorkoutsApi.md#workoutscontrollerworkout) | **GET** /workouts/{id} |  |
| [**workoutsControllerWorkoutHistory**](WorkoutsApi.md#workoutscontrollerworkouthistory) | **GET** /workouts/history |  |
| [**workoutsControllerWorkoutsByTrainingPlan**](WorkoutsApi.md#workoutscontrollerworkoutsbytrainingplan) | **GET** /workouts/training-plan/{trainingPlanId} |  |



## workoutsControllerCompleteWorkout

> workoutsControllerCompleteWorkout(workoutId)



### Example

```ts
import {
  Configuration,
  WorkoutsApi,
} from '';
import type { WorkoutsControllerCompleteWorkoutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WorkoutsApi();

  const body = {
    // string
    workoutId: workoutId_example,
  } satisfies WorkoutsControllerCompleteWorkoutRequest;

  try {
    const data = await api.workoutsControllerCompleteWorkout(body);
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
| **workoutId** | `string` |  | [Defaults to `undefined`] |

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


## workoutsControllerCreateWorkout

> workoutsControllerCreateWorkout(body)



### Example

```ts
import {
  Configuration,
  WorkoutsApi,
} from '';
import type { WorkoutsControllerCreateWorkoutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WorkoutsApi();

  const body = {
    // object
    body: Object,
  } satisfies WorkoutsControllerCreateWorkoutRequest;

  try {
    const data = await api.workoutsControllerCreateWorkout(body);
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


## workoutsControllerSkipWorkout

> workoutsControllerSkipWorkout(workoutId)



### Example

```ts
import {
  Configuration,
  WorkoutsApi,
} from '';
import type { WorkoutsControllerSkipWorkoutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WorkoutsApi();

  const body = {
    // string
    workoutId: workoutId_example,
  } satisfies WorkoutsControllerSkipWorkoutRequest;

  try {
    const data = await api.workoutsControllerSkipWorkout(body);
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
| **workoutId** | `string` |  | [Defaults to `undefined`] |

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


## workoutsControllerSubmitWorkoutFeedback

> workoutsControllerSubmitWorkoutFeedback(workoutId, body)



### Example

```ts
import {
  Configuration,
  WorkoutsApi,
} from '';
import type { WorkoutsControllerSubmitWorkoutFeedbackRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WorkoutsApi();

  const body = {
    // string
    workoutId: workoutId_example,
    // object
    body: Object,
  } satisfies WorkoutsControllerSubmitWorkoutFeedbackRequest;

  try {
    const data = await api.workoutsControllerSubmitWorkoutFeedback(body);
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
| **workoutId** | `string` |  | [Defaults to `undefined`] |
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


## workoutsControllerTodayWorkout

> workoutsControllerTodayWorkout()



### Example

```ts
import {
  Configuration,
  WorkoutsApi,
} from '';
import type { WorkoutsControllerTodayWorkoutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WorkoutsApi();

  try {
    const data = await api.workoutsControllerTodayWorkout();
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


## workoutsControllerUpdateWorkout

> workoutsControllerUpdateWorkout(workoutId, body)



### Example

```ts
import {
  Configuration,
  WorkoutsApi,
} from '';
import type { WorkoutsControllerUpdateWorkoutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WorkoutsApi();

  const body = {
    // string
    workoutId: workoutId_example,
    // object
    body: Object,
  } satisfies WorkoutsControllerUpdateWorkoutRequest;

  try {
    const data = await api.workoutsControllerUpdateWorkout(body);
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
| **workoutId** | `string` |  | [Defaults to `undefined`] |
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


## workoutsControllerWorkout

> workoutsControllerWorkout(id)



### Example

```ts
import {
  Configuration,
  WorkoutsApi,
} from '';
import type { WorkoutsControllerWorkoutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WorkoutsApi();

  const body = {
    // string
    id: id_example,
  } satisfies WorkoutsControllerWorkoutRequest;

  try {
    const data = await api.workoutsControllerWorkout(body);
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


## workoutsControllerWorkoutHistory

> workoutsControllerWorkoutHistory()



### Example

```ts
import {
  Configuration,
  WorkoutsApi,
} from '';
import type { WorkoutsControllerWorkoutHistoryRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WorkoutsApi();

  try {
    const data = await api.workoutsControllerWorkoutHistory();
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


## workoutsControllerWorkoutsByTrainingPlan

> workoutsControllerWorkoutsByTrainingPlan(trainingPlanId)



### Example

```ts
import {
  Configuration,
  WorkoutsApi,
} from '';
import type { WorkoutsControllerWorkoutsByTrainingPlanRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WorkoutsApi();

  const body = {
    // string
    trainingPlanId: trainingPlanId_example,
  } satisfies WorkoutsControllerWorkoutsByTrainingPlanRequest;

  try {
    const data = await api.workoutsControllerWorkoutsByTrainingPlan(body);
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
| **trainingPlanId** | `string` |  | [Defaults to `undefined`] |

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

