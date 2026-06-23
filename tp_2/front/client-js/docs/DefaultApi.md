# VolsApi.DefaultApi

All URIs are relative to *http://localhost:8080/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**getProfil**](DefaultApi.md#getProfil) | **GET** /profil | Profil de l&#39;utilisateur connecté
[**getVols**](DefaultApi.md#getVols) | **GET** /vol | Liste des vols disponibles



## getProfil

> Profil getProfil()

Profil de l&#39;utilisateur connecté

Retourne les informations de l&#39;utilisateur extraites du JWT Keycloak.

### Example

```javascript
import VolsApi from 'vols-api';
let defaultClient = VolsApi.ApiClient.instance;
// Configure Bearer (JWT) access token for authorization: bearerAuth
let bearerAuth = defaultClient.authentications['bearerAuth'];
bearerAuth.accessToken = "YOUR ACCESS TOKEN"

let apiInstance = new VolsApi.DefaultApi();
apiInstance.getProfil().then((data) => {
  console.log('API called successfully. Returned data: ' + data);
}, (error) => {
  console.error(error);
});

```

### Parameters

This endpoint does not need any parameter.

### Return type

[**Profil**](Profil.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getVols

> [Vol] getVols()

Liste des vols disponibles

Retourne la liste statique des vols. JWT Keycloak requis.

### Example

```javascript
import VolsApi from 'vols-api';
let defaultClient = VolsApi.ApiClient.instance;
// Configure Bearer (JWT) access token for authorization: bearerAuth
let bearerAuth = defaultClient.authentications['bearerAuth'];
bearerAuth.accessToken = "YOUR ACCESS TOKEN"

let apiInstance = new VolsApi.DefaultApi();
apiInstance.getVols().then((data) => {
  console.log('API called successfully. Returned data: ' + data);
}, (error) => {
  console.error(error);
});

```

### Parameters

This endpoint does not need any parameter.

### Return type

[**[Vol]**](Vol.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

