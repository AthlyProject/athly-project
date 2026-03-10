# EquipmentsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**equipmentsControllerAddEquipmentToUser**](EquipmentsApi.md#equipmentscontrolleraddequipmenttouser) | **POST** /equipments/{equipmentId}/add |  |
| [**equipmentsControllerCreateEquipment**](EquipmentsApi.md#equipmentscontrollercreateequipment) | **POST** /equipments |  |
| [**equipmentsControllerDeleteEquipment**](EquipmentsApi.md#equipmentscontrollerdeleteequipment) | **DELETE** /equipments/{uuid} |  |
| [**equipmentsControllerGetAllEquipments**](EquipmentsApi.md#equipmentscontrollergetallequipments) | **GET** /equipments |  |
| [**equipmentsControllerGetEquipmentById**](EquipmentsApi.md#equipmentscontrollergetequipmentbyid) | **GET** /equipments/{uuid} |  |
| [**equipmentsControllerGetUserEquipments**](EquipmentsApi.md#equipmentscontrollergetuserequipments) | **GET** /equipments/my-equipments |  |
| [**equipmentsControllerRemoveEquipmentFromUser**](EquipmentsApi.md#equipmentscontrollerremoveequipmentfromuser) | **DELETE** /equipments/{equipmentId}/remove |  |
| [**equipmentsControllerUpdateEquipment**](EquipmentsApi.md#equipmentscontrollerupdateequipment) | **PUT** /equipments/{uuid} |  |



## equipmentsControllerAddEquipmentToUser

> equipmentsControllerAddEquipmentToUser(equipmentId)



### Example

```ts
import {
  Configuration,
  EquipmentsApi,
} from '';
import type { EquipmentsControllerAddEquipmentToUserRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EquipmentsApi();

  const body = {
    // string
    equipmentId: equipmentId_example,
  } satisfies EquipmentsControllerAddEquipmentToUserRequest;

  try {
    const data = await api.equipmentsControllerAddEquipmentToUser(body);
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
| **equipmentId** | `string` |  | [Defaults to `undefined`] |

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
| **201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## equipmentsControllerCreateEquipment

> equipmentsControllerCreateEquipment(body)



### Example

```ts
import {
  Configuration,
  EquipmentsApi,
} from '';
import type { EquipmentsControllerCreateEquipmentRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EquipmentsApi();

  const body = {
    // object
    body: Object,
  } satisfies EquipmentsControllerCreateEquipmentRequest;

  try {
    const data = await api.equipmentsControllerCreateEquipment(body);
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


## equipmentsControllerDeleteEquipment

> equipmentsControllerDeleteEquipment(uuid)



### Example

```ts
import {
  Configuration,
  EquipmentsApi,
} from '';
import type { EquipmentsControllerDeleteEquipmentRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EquipmentsApi();

  const body = {
    // string
    uuid: uuid_example,
  } satisfies EquipmentsControllerDeleteEquipmentRequest;

  try {
    const data = await api.equipmentsControllerDeleteEquipment(body);
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


## equipmentsControllerGetAllEquipments

> equipmentsControllerGetAllEquipments()



### Example

```ts
import {
  Configuration,
  EquipmentsApi,
} from '';
import type { EquipmentsControllerGetAllEquipmentsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EquipmentsApi();

  try {
    const data = await api.equipmentsControllerGetAllEquipments();
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


## equipmentsControllerGetEquipmentById

> equipmentsControllerGetEquipmentById(uuid)



### Example

```ts
import {
  Configuration,
  EquipmentsApi,
} from '';
import type { EquipmentsControllerGetEquipmentByIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EquipmentsApi();

  const body = {
    // string
    uuid: uuid_example,
  } satisfies EquipmentsControllerGetEquipmentByIdRequest;

  try {
    const data = await api.equipmentsControllerGetEquipmentById(body);
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


## equipmentsControllerGetUserEquipments

> equipmentsControllerGetUserEquipments()



### Example

```ts
import {
  Configuration,
  EquipmentsApi,
} from '';
import type { EquipmentsControllerGetUserEquipmentsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EquipmentsApi();

  try {
    const data = await api.equipmentsControllerGetUserEquipments();
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


## equipmentsControllerRemoveEquipmentFromUser

> equipmentsControllerRemoveEquipmentFromUser(equipmentId)



### Example

```ts
import {
  Configuration,
  EquipmentsApi,
} from '';
import type { EquipmentsControllerRemoveEquipmentFromUserRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EquipmentsApi();

  const body = {
    // string
    equipmentId: equipmentId_example,
  } satisfies EquipmentsControllerRemoveEquipmentFromUserRequest;

  try {
    const data = await api.equipmentsControllerRemoveEquipmentFromUser(body);
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
| **equipmentId** | `string` |  | [Defaults to `undefined`] |

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


## equipmentsControllerUpdateEquipment

> equipmentsControllerUpdateEquipment(uuid, body)



### Example

```ts
import {
  Configuration,
  EquipmentsApi,
} from '';
import type { EquipmentsControllerUpdateEquipmentRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EquipmentsApi();

  const body = {
    // string
    uuid: uuid_example,
    // object
    body: Object,
  } satisfies EquipmentsControllerUpdateEquipmentRequest;

  try {
    const data = await api.equipmentsControllerUpdateEquipment(body);
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

