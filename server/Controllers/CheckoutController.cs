using System.ComponentModel.DataAnnotations;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Npgsql;

public record CheckoutCustomer(string? FirstName,string? LastName,string? Email,string? Phone,string? CountryCode);

[ApiController,Authorize,Route("api/checkout")]
public class CheckoutController(Store db,ChariowClient chariow,IConfiguration config,IWebHostEnvironment env,AdminAccess admin):ControllerBase {
    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct) {
        var user=await db.UserByIdAsync(Auth.Id(HttpContext),ct);if(user==null)return Unauthorized();
        var isAdmin=admin.IsAdmin(user.Id);
        return Ok(new{is_paid=user.IsPaid,paid_at=user.PaidAt,is_admin=isAdmin,has_access=user.IsPaid||isAdmin});
    }
    [AllowAnonymous,HttpGet("offer"),EnableRateLimiting("offer")]
    public async Task<IActionResult> Offer(CancellationToken ct) {
        var p=await chariow.Product(ct);
        var price=p["pricing"]!["current_price"]!;
        return Ok(new{product_id=chariow.ProductId,name=SalePayload.Text(p["name"]),price=new{value=price["value"]!.GetValue<decimal>(),formatted=SalePayload.Text(price["formatted"]),currency=SalePayload.Text(price["currency"])},billing="one_time"});
    }
    [HttpPost,EnableRateLimiting("checkout")]
    public async Task<IActionResult> Create([FromBody] CheckoutCustomer customer,CancellationToken ct) {
        var id=Auth.Id(HttpContext);var user=await db.UserByIdAsync(id,ct);
        if(user==null)return Unauthorized();
        if(admin.IsAdmin(user.Id))return Ok(new{data=new{step="admin_access",payment=new{checkout_url=(string?)null}}});
        if(user.IsPaid)return Ok(new{data=new{step="already_paid",payment=new{checkout_url=(string?)null}}});
        var first=customer.FirstName?.Trim()??"";var last=customer.LastName?.Trim()??"";
        var email=customer.Email?.Trim().ToLowerInvariant()??"";
        var phone=Regex.Replace(customer.Phone??"",@"[\s().-]","");var country=customer.CountryCode?.Trim().ToUpperInvariant()??"";
        if(first.Length is <1 or >50 ||last.Length is <1 or >50 ||email.Length>200||!new EmailAddressAttribute().IsValid(email)||email!=user.Email||!Regex.IsMatch(phone,@"^[0-9]{6,15}$")||!Regex.IsMatch(country,@"^[A-Z]{2}$"))
            return BadRequest(new{code="INVALID_CUSTOMER",error="Vérifiez vos prénom, nom, e-mail du compte, numéro national et code pays ISO (FR, CI, SN…)."});
        await chariow.Product(ct); // Reject unsupported types before creating a sale.
        var publicUrl=config["App:PublicUrl"];
        if(string.IsNullOrWhiteSpace(publicUrl))publicUrl=config["RENDER_EXTERNAL_URL"];
        if(!Uri.TryCreate(publicUrl,UriKind.Absolute,out var origin)||(!env.IsDevelopment()&&origin.Scheme!="https")||origin.Scheme is not ("http" or "https")||!string.IsNullOrEmpty(origin.UserInfo)||origin.AbsolutePath!="/"||!string.IsNullOrEmpty(origin.Query)||!string.IsNullOrEmpty(origin.Fragment))
            throw new ApiError("L’adresse de retour du paiement n’est pas configurée. Contactez l’administrateur.",503);
        var returnUrl=origin.GetLeftPart(UriPartial.Authority)+"/#merci";
        await using var conn=await db.OpenAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
        // Transaction-scoped advisory lock serializes checkout creation per account,
        // including across multiple instances. It never authorizes a payment.
        await using(var lockCmd=new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@key,0))",conn,tx)) {
            lockCmd.Parameters.AddWithValue("key","checkout:"+id);await lockCmd.ExecuteNonQueryAsync(ct);
        }
        await using(var verify=new NpgsqlCommand("SELECT is_paid FROM public.users WHERE id=@id",conn,tx)) {
            verify.Parameters.AddWithValue("id",id);var paid=await verify.ExecuteScalarAsync(ct);
            if(paid is not bool isPaid)return Unauthorized();
            if(isPaid)return Ok(new{data=new{step="already_paid",payment=new{checkout_url=(string?)null}}});
        }
        await using(var read=new NpgsqlCommand("SELECT response FROM public.checkout_sessions WHERE user_id=@id AND expires_at>CURRENT_TIMESTAMP",conn,tx)) {
            read.Parameters.AddWithValue("id",id);
            if(await read.ExecuteScalarAsync(ct) is string previous)return Ok(JsonNode.Parse(previous));
        }
        var response=await chariow.Checkout(new{
            product_id=chariow.ProductId,email,first_name=first,last_name=last,
            phone=new{number=phone,country_code=country},redirect_url=returnUrl,
            custom_metadata=new{user_id=id}
        },ct);
        var data=response["data"] as JsonObject??throw new ApiError("Réponse de paiement incomplète.",502);
        var step=SalePayload.Text(data["step"]);
        if(step=="already_purchased") {
            // Ownership of an email/product in Chariow is NOT ownership of this app account.
            // Only a signed sale with our metadata.user_id can unlock the account.
            return Conflict(new{code="PAYMENT_LINK_MISSING",error="Un achat existe déjà pour cette adresse. Vérifiez la confirmation du paiement ou contactez l’assistance pour faire rejouer sa notification. Ne payez pas une seconde fois."});
        }
        if(step is not ("payment" or "completed"))throw new ApiError("Étape de paiement inconnue.",502);
        var payment=data["payment"] as JsonObject;var purchase=data["purchase"] as JsonObject;
        var checkoutUrl=SalePayload.Text(payment?["checkout_url"]);
        if(step=="payment"&&!ChariowClient.ValidCheckoutUrl(checkoutUrl))throw new ApiError("Le lien de paiement reçu est invalide.",502);
        // Only return the checkout fields required by this app, not licenses/files/PII.
        var output=new JsonObject{["data"]=new JsonObject{["step"]=step,["purchase"]=new JsonObject{["id"]=SalePayload.Text(purchase?["id"]),["status"]=SalePayload.Text(purchase?["status"])},["payment"]=new JsonObject{["checkout_url"]=checkoutUrl}}};
        await using(var save=new NpgsqlCommand("INSERT INTO public.checkout_sessions(user_id,response,expires_at) VALUES(@id,@response,CURRENT_TIMESTAMP+INTERVAL '15 minutes') ON CONFLICT(user_id) DO UPDATE SET response=EXCLUDED.response,expires_at=EXCLUDED.expires_at",conn,tx)) {
            save.Parameters.AddWithValue("id",id);save.Parameters.AddWithValue("response",output.ToJsonString());await save.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
        // Even 'completed' (free product) waits for the signed Pulse for activation.
        return Ok(output);
    }
}
