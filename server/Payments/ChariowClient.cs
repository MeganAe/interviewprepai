using System.Net.Http.Headers;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Caching.Memory;

public sealed class ChariowClient(IHttpClientFactory factory,IConfiguration config,IMemoryCache cache,ILogger<ChariowClient> logger) {
    public string ProductId=>config["Chariow:ProductId"]??"";
    void CheckConfiguration() {
        if(string.IsNullOrWhiteSpace(config["Chariow:ApiKey"])||string.IsNullOrWhiteSpace(ProductId))throw new ApiError("Le paiement n’est pas encore disponible. Contactez l’administrateur.",503);
    }
    async Task<JsonObject> Send(HttpMethod method,string endpoint,object? body,CancellationToken ct) {
        CheckConfiguration();using var request=new HttpRequestMessage(method,endpoint);
        if(body!=null)request.Content=JsonContent.Create(body);
        using var client=factory.CreateClient("chariow");
        HttpResponseMessage response;
        try {response=await client.SendAsync(request,ct);}catch(OperationCanceledException) when(!ct.IsCancellationRequested){throw new ApiError("Le service de paiement met trop de temps à répondre. Réessayez.",504);}catch(HttpRequestException){throw new ApiError("Le service de paiement est momentanément injoignable.",502);}
        using(response) {
            if(!response.IsSuccessStatusCode){logger.LogWarning("Chariow {Operation}: HTTP {Status}",method.Method,(int)response.StatusCode);throw new ApiError(response.StatusCode==System.Net.HttpStatusCode.TooManyRequests?"Le service de paiement est très sollicité. Réessayez dans une minute.":"Le paiement n’a pas pu être préparé. Vérifiez les informations ou contactez l’administrateur.",502);}
            try{return JsonNode.Parse(await response.Content.ReadAsStringAsync(ct)) as JsonObject??throw new Exception();}
            catch{throw new ApiError("Réponse du service de paiement invalide.",502);}
        }
    }
    public async Task<JsonObject> Product(CancellationToken ct) {
        CheckConfiguration();var key="chariow-product:"+ProductId;
        if(cache.TryGetValue<JsonObject>(key,out var cached))return cached!.DeepClone().AsObject();
        var response=await Send(HttpMethod.Get,"products/"+Uri.EscapeDataString(ProductId),null,ct);
        var product=response["data"] as JsonObject??throw new ApiError("Tarif indisponible.",502);
        if(SalePayload.Text(product["id"])!=ProductId)throw new ApiError("Configurez l’identifiant public exact du produit de paiement, et non son slug.",503);
        var pricing=product["pricing"] as JsonObject??throw new ApiError("Tarif indisponible.",502);
        var settings=product["settings"] as JsonObject??throw new ApiError("Configuration du produit invalide.",502);
        if(settings["is_requires_shipping_address"] is not JsonValue shipping||!shipping.TryGetValue<bool>(out var needsShipping))throw new ApiError("Configuration de livraison invalide.",502);
        if(SalePayload.Text(product["status"])!="published" || SalePayload.Text(product["type"]) is not ("license" or "downloadable" or "course" or "bundle") || SalePayload.Text(pricing["type"]) is not ("one_time" or "free") || needsShipping)
            throw new ApiError("Le produit configuré ne permet pas ce paiement en ligne. Contactez l’administrateur.",503);
        // This form intentionally supports no extra product-specific checkout fields.
        if(product["fields"] is not null && product["fields"] is not JsonArray {Count:0} && product["fields"] is not JsonObject {Count:0})
            throw new ApiError("Ce produit demande des champs de paiement supplémentaires non pris en charge. Contactez l’administrateur.",503);
        var price=pricing["current_price"] as JsonObject;
        if(price?["value"] is not JsonValue pv||!pv.TryGetValue<decimal>(out var amount)||amount<0||string.IsNullOrWhiteSpace(SalePayload.Text(price["formatted"]))||string.IsNullOrWhiteSpace(SalePayload.Text(price["currency"])))throw new ApiError("Le tarif du produit est incomplet.",502);
        cache.Set(key,product.DeepClone().AsObject(),TimeSpan.FromSeconds(60));return product;
    }
    public Task<JsonObject> Checkout(object body,CancellationToken ct)=>Send(HttpMethod.Post,"checkout",body,ct);
    public static bool ValidCheckoutUrl(string? url)=>Uri.TryCreate(url,UriKind.Absolute,out var uri)&&uri.Scheme=="https"&&string.IsNullOrEmpty(uri.UserInfo)&&url!.Length<=2048;
}
