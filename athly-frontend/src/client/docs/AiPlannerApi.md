# AiPlannerApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**aiPlannerControllerPlanNextWeek**](AiPlannerApi.md#aiplannercontrollerplannextweek) | **POST** /ai-planner/plan-next-week |  |



## aiPlannerControllerPlanNextWeek

> AiPlannerResultModel aiPlannerControllerPlanNextWeek(planNextWeekInput)



### Example

```ts
import {
  Configuration,
  AiPlannerApi,
} from '';
import type { AiPlannerControllerPlanNextWeekRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AiPlannerApi(config);

  const body = {
    // PlanNextWeekInput
    planNextWeekInput: ...,
  } satisfies AiPlannerControllerPlanNextWeekRequest;

  try {
    const data = await api.aiPlannerControllerPlanNextWeek(body);
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
| **planNextWeekInput** | [PlanNextWeekInput](PlanNextWeekInput.md) |  | |

### Return type

[**AiPlannerResultModel**](AiPlannerResultModel.md)

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

