# WeeklyGoalsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**weeklyGoalsControllerCreateWeeklyGoal**](WeeklyGoalsApi.md#weeklygoalscontrollercreateweeklygoal) | **POST** /weekly-goals |  |
| [**weeklyGoalsControllerDeleteWeeklyGoal**](WeeklyGoalsApi.md#weeklygoalscontrollerdeleteweeklygoal) | **DELETE** /weekly-goals/{uuid} |  |
| [**weeklyGoalsControllerGetWeeklyGoalById**](WeeklyGoalsApi.md#weeklygoalscontrollergetweeklygoalbyid) | **GET** /weekly-goals/{uuid} |  |
| [**weeklyGoalsControllerGetWeeklyGoalsByTrainingPlan**](WeeklyGoalsApi.md#weeklygoalscontrollergetweeklygoalsbytrainingplan) | **GET** /weekly-goals/training-plan/{trainingPlanId} |  |
| [**weeklyGoalsControllerUpdateWeeklyGoal**](WeeklyGoalsApi.md#weeklygoalscontrollerupdateweeklygoal) | **PUT** /weekly-goals/{uuid} |  |



## weeklyGoalsControllerCreateWeeklyGoal

> weeklyGoalsControllerCreateWeeklyGoal(body)



### Example

```ts
import {
  Configuration,
  WeeklyGoalsApi,
} from '';
import type { WeeklyGoalsControllerCreateWeeklyGoalRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeeklyGoalsApi();

  const body = {
    // object
    body: Object,
  } satisfies WeeklyGoalsControllerCreateWeeklyGoalRequest;

  try {
    const data = await api.weeklyGoalsControllerCreateWeeklyGoal(body);
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


## weeklyGoalsControllerDeleteWeeklyGoal

> weeklyGoalsControllerDeleteWeeklyGoal(uuid)



### Example

```ts
import {
  Configuration,
  WeeklyGoalsApi,
} from '';
import type { WeeklyGoalsControllerDeleteWeeklyGoalRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeeklyGoalsApi();

  const body = {
    // string
    uuid: uuid_example,
  } satisfies WeeklyGoalsControllerDeleteWeeklyGoalRequest;

  try {
    const data = await api.weeklyGoalsControllerDeleteWeeklyGoal(body);
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
| **uuid** | `string` |  | [Defaults to `undefined`] |

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


## weeklyGoalsControllerGetWeeklyGoalById

> weeklyGoalsControllerGetWeeklyGoalById(uuid)



### Example

```ts
import {
  Configuration,
  WeeklyGoalsApi,
} from '';
import type { WeeklyGoalsControllerGetWeeklyGoalByIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeeklyGoalsApi();

  const body = {
    // string
    uuid: uuid_example,
  } satisfies WeeklyGoalsControllerGetWeeklyGoalByIdRequest;

  try {
    const data = await api.weeklyGoalsControllerGetWeeklyGoalById(body);
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
| **uuid** | `string` |  | [Defaults to `undefined`] |

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


## weeklyGoalsControllerGetWeeklyGoalsByTrainingPlan

> weeklyGoalsControllerGetWeeklyGoalsByTrainingPlan(trainingPlanId)



### Example

```ts
import {
  Configuration,
  WeeklyGoalsApi,
} from '';
import type { WeeklyGoalsControllerGetWeeklyGoalsByTrainingPlanRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeeklyGoalsApi();

  const body = {
    // string
    trainingPlanId: trainingPlanId_example,
  } satisfies WeeklyGoalsControllerGetWeeklyGoalsByTrainingPlanRequest;

  try {
    const data = await api.weeklyGoalsControllerGetWeeklyGoalsByTrainingPlan(body);
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


## weeklyGoalsControllerUpdateWeeklyGoal

> weeklyGoalsControllerUpdateWeeklyGoal(uuid, body)



### Example

```ts
import {
  Configuration,
  WeeklyGoalsApi,
} from '';
import type { WeeklyGoalsControllerUpdateWeeklyGoalRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeeklyGoalsApi();

  const body = {
    // string
    uuid: uuid_example,
    // object
    body: Object,
  } satisfies WeeklyGoalsControllerUpdateWeeklyGoalRequest;

  try {
    const data = await api.weeklyGoalsControllerUpdateWeeklyGoal(body);
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
| **uuid** | `string` |  | [Defaults to `undefined`] |
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

