using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/pulse")]
public class PulseController(Store db,IConfiguration config,ILogger<PulseController> logger):ControllerBase {
    [HttpPost,AllowAnonymous,RequestSizeLimit(262144)]
    public async Task<IActionResult> Receive(CancellationToken ct) {
        if(Request.ContentLength>262144)return StatusCode(413);
        byte[] raw;
        try {using var ms=new MemoryStream();await Request.Body.CopyToAsync(ms,ct);raw=ms.ToArray();Request.Body.Position=0;}
        catch(IOException){return StatusCode(413);}
        if(raw.Length>262144)return StatusCode(413);
        if(!PulseVerifier.Verify(raw,Request.Headers["X-Chariow-Signature"].ToString(),config["Chariow:PulseSecret"]??""))return Unauthorized(new{error="Signature invalide."});
        JsonObject? payload;
        try {payload=JsonNode.Parse(raw,new JsonNodeOptions(),new JsonDocumentOptions{MaxDepth=32}) as JsonObject;}
        catch(JsonException){return BadRequest(new{error="JSON invalide."});}
        if(payload is null)return BadRequest(new{error="Payload invalide."});
        CompletedSale? sale;
        try{sale=SalePayload.ParsePulse(payload);}
        catch(ArgumentException){return BadRequest(new{error="Payload ambigu ou propriétés dupliquées."});}
        catch(InvalidOperationException){return BadRequest(new{error="Structure du payload invalide."});}
        if(sale is null)return Ok(new{received=true,ignored=true});
        var product=config["Chariow:ProductId"];
        if(string.IsNullOrWhiteSpace(product))return StatusCode(503,new{error="Produit non configuré."});
        if(sale.ProductId!=product)return Ok(new{received=true,ignored=true,reason="different_product"});
        var delivery=Request.Headers["X-Pulse-Delivery-Id"].ToString();
        if(delivery.Length>255)return BadRequest(new{error="Identifiant de livraison invalide."});
        var result=await db.ActivatePaymentAsync(sale.UserId,sale.SaleId,sale.ProductId,string.IsNullOrEmpty(delivery)?null:delivery,Convert.ToHexString(SHA256.HashData(raw)).ToLowerInvariant(),ct);
        if(result==PaymentActivation.UnknownUser){logger.LogWarning("Pulse references unknown account for sale {SaleId}",sale.SaleId);return NotFound(new{error="Compte introuvable."});}
        if(result==PaymentActivation.Conflict){logger.LogWarning("Pulse ownership conflict for sale {SaleId}",sale.SaleId);return Conflict(new{error="Vente déjà liée à un autre compte."});}
        return Ok(new{received=true,activated=result==PaymentActivation.Activated,duplicate=result==PaymentActivation.Duplicate,already_paid=result==PaymentActivation.AlreadyPaid});
    }
}
