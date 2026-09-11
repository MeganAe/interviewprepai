using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

public static class PulseVerifier {
    public static bool Verify(ReadOnlySpan<byte> raw,string signature,string secret) {
        if(string.IsNullOrWhiteSpace(secret)||signature.Length!=71||!signature.StartsWith("sha256=",StringComparison.Ordinal))return false;
        try {
            var received=Convert.FromHexString(signature[7..]);
            var expected=HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret),raw);
            return received.Length==expected.Length&&CryptographicOperations.FixedTimeEquals(received,expected);
        } catch(FormatException) {return false;}
    }
}
public record CompletedSale(string SaleId,string UserId,string ProductId);
public static class SalePayload {
    public static string? Text(JsonNode? n)=>n is JsonValue v&&v.TryGetValue<string>(out var text)?text:null;
    // Official: {event:'successful.sale',sale:{...},product:{id:...}}
    // Compatibility: {event:'sale.completed',data:{id,status,custom_metadata,product:{id}}}
    public static CompletedSale? ParsePulse(JsonObject root) {
        var evt=Text(root["event"]);
        if(evt is not ("successful.sale" or "sale.completed"))return null;
        // Signed dashboard test payloads are acknowledgements only, never entitlements.
        if(root.ContainsKey("note"))return null;
        var sale=root["sale"] as JsonObject??root["data"] as JsonObject;
        if(sale==null)throw new ApiError("Payload de vente incomplet.",422);
        var parsed=ParseSale(sale,root["product"] as JsonObject,root["custom_metadata"] as JsonObject);
        return parsed;
    }
    public static CompletedSale ParseSale(JsonObject sale,JsonObject? product=null,JsonObject? metadata=null) {
        if(Text(sale["status"])!="completed")throw new ApiError("La vente n’est pas terminée.",422);
        var saleId=Text(sale["id"]);var nestedMeta=sale["custom_metadata"] as JsonObject;
        var userId=Text(nestedMeta?["user_id"])??Text(metadata?["user_id"]);
        if(nestedMeta!=null&&metadata!=null&&Text(nestedMeta["user_id"])!=Text(metadata["user_id"]))throw new ApiError("Métadonnées contradictoires.",422);
        var nestedProduct=sale["product"] as JsonObject;
        var productId=Text(product?["id"])??Text(nestedProduct?["id"])??Text(sale["product_id"]);
        if(product!=null&&nestedProduct!=null&&Text(product["id"])!=Text(nestedProduct["id"]))throw new ApiError("Produit contradictoire.",422);
        if(string.IsNullOrWhiteSpace(saleId)||saleId.Length>255||!Guid.TryParse(userId,out _)||string.IsNullOrWhiteSpace(productId)||productId.Length>255)throw new ApiError("Identifiant de vente, produit ou custom_metadata.user_id manquant ou invalide.",422);
        return new(saleId,userId!,productId);
    }
}
