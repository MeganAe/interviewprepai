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
        if(SalePayload.Text(product["status"])!="published")
            throw new ApiError("Le produit Chariow doit être publié avant de proposer le paiement.",503);
        if(SalePayload.Text(product["type"]) is not ("license" or "downloadable" or "course" or "bundle"))
            throw new ApiError("Ce type de produit Chariow n’est pas pris en charge. Utilisez un produit licence, téléchargement, cours ou bundle.",503);
        if(SalePayload.Text(pricing["type"]) is not ("one_time" or "free"))
            throw new ApiError("Configurez un prix fixe à paiement unique pour ce produit Chariow.",503);
        if(RequiresShipping(product["settings"]))
            throw new ApiError("Ce produit exige une adresse de livraison. Désactivez cette exigence dans Chariow pour l’accès numérique.",503);
        // This form intentionally supports no extra product-specific checkout fields.
        if(product["fields"] is not null && product["fields"] is not JsonArray {Count:0} && product["fields"] is not JsonObject {Count:0})
            throw new ApiError("Ce produit demande des champs de paiement supplémentaires non pris en charge. Contactez l’administrateur.",503);
        var price=pricing["current_price"] as JsonObject;
        if(price?["value"] is not JsonValue pv||!pv.TryGetValue<decimal>(out var amount)||amount<0||string.IsNullOrWhiteSpace(SalePayload.Text(price["formatted"]))||string.IsNullOrWhiteSpace(SalePayload.Text(price["currency"])))throw new ApiError("Le tarif du produit est incomplet.",502);
        cache.Set(key,product.DeepClone().AsObject(),TimeSpan.FromSeconds(60));return product;
    }
    // Provider flags can be omitted/null or represented as JSON booleans, 0/1,
    // or their string equivalents. Only explicit known representations are accepted.
    // An unset flag does not declare a shipping requirement. Non-digital product
    // types are rejected separately; this flag can never activate an entitlement.
    public static bool RequiresShipping(JsonNode? settings) {
        if(settings is null)return false;
        if(settings is not JsonObject obj)
            throw new ApiError("La configuration du produit reçue de Chariow est invalide.",502);
        var flag=obj["is_requires_shipping_address"];
        if(flag is null)return false;
        if(flag is JsonValue value) {
            if(value.TryGetValue<bool>(out var boolean))return boolean;
            if(value.TryGetValue<decimal>(out var number)) {
                if(number==0)return false;
                if(number==1)return true;
            }
            if(value.TryGetValue<string>(out var text)) {
                switch(text.Trim().ToLowerInvariant()) {
                    case "":case "0":case "false":return false;
                    case "1":case "true":return true;
                }
            }
        }
        throw new ApiError("Le paramètre de livraison reçu de Chariow n’est pas reconnu. Contactez l’administrateur.",502);
    }
    public Task<JsonObject> Checkout(object body,CancellationToken ct)=>Send(HttpMethod.Post,"checkout",body,ct);
    public static bool ValidCheckoutUrl(string? url)=>Uri.TryCreate(url,UriKind.Absolute,out var uri)&&uri.Scheme=="https"&&string.IsNullOrEmpty(uri.UserInfo)&&url!.Length<=2048;
}
