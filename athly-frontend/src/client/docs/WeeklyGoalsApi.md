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

> WeeklyGoalModel weeklyGoalsControllerCreateWeeklyGoal(createWeeklyGoalInput)



### Example

```ts
import {
  Configuration,
  WeeklyGoalsApi,
} from '';
import type { WeeklyGoalsControllerCreateWeeklyGoalRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeeklyGoalsApi(config);

  const body = {
    // CreateWeeklyGoalInput
    createWeeklyGoalInput: ...,
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
| **createWeeklyGoalInput** | [CreateWeeklyGoalInput](CreateWeeklyGoalInput.md) |  | |

### Return type

[**WeeklyGoalModel**](WeeklyGoalModel.md)

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
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeeklyGoalsApi(config);

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

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## weeklyGoalsControllerGetWeeklyGoalById

> WeeklyGoalModel weeklyGoalsControllerGetWeeklyGoalById(uuid)



### Example

```ts
import {
  Configuration,
  WeeklyGoalsApi,
} from '';
import type { WeeklyGoalsControllerGetWeeklyGoalByIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeeklyGoalsApi(config);

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

[**WeeklyGoalModel**](WeeklyGoalModel.md)

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


## weeklyGoalsControllerGetWeeklyGoalsByTrainingPlan

> Array&lt;WeeklyGoalModel&gt; weeklyGoalsControllerGetWeeklyGoalsByTrainingPlan(trainingPlanId)



### Example

```ts
import {
  Configuration,
  WeeklyGoalsApi,
} from '';
import type { WeeklyGoalsControllerGetWeeklyGoalsByTrainingPlanRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeeklyGoalsApi(config);

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

[**Array&lt;WeeklyGoalModel&gt;**](WeeklyGoalModel.md)

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


## weeklyGoalsControllerUpdateWeeklyGoal

> WeeklyGoalModel weeklyGoalsControllerUpdateWeeklyGoal(uuid, updateWeeklyGoalInput)



### Example

```ts
import {
  Configuration,
  WeeklyGoalsApi,
} from '';
import type { WeeklyGoalsControllerUpdateWeeklyGoalRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeeklyGoalsApi(config);

  const body = {
    // string
    uuid: uuid_example,
    // UpdateWeeklyGoalInput
    updateWeeklyGoalInput: ...,
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
| **updateWeeklyGoalInput** | [UpdateWeeklyGoalInput](UpdateWeeklyGoalInput.md) |  | |

### Return type

[**WeeklyGoalModel**](WeeklyGoalModel.md)

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

