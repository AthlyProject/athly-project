# AiPlannerApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**aiPlannerControllerPlanNextWeek**](AiPlannerApi.md#aiplannercontrollerplannextweek) | **POST** /ai-planner/plan-next-week |  |



## aiPlannerControllerPlanNextWeek

> aiPlannerControllerPlanNextWeek(body)



### Example

```ts
import {
  Configuration,
  AiPlannerApi,
} from '';
import type { AiPlannerControllerPlanNextWeekRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AiPlannerApi();

  const body = {
    // object
    body: Object,
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

