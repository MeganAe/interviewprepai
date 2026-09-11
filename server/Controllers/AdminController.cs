using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Npgsql;

public record SiteInput(string? Publisher,string? Country,string? Address,string? Email,string? Registration,int Version);

[ApiController,Route("api")]
public class AdminController(NpgsqlDataSource source,AdminAccess admin):ControllerBase {
    static void Page(int page,string? q){if(page<1||page>100000||(q?.Length??0)>100)throw new ApiError("Page ou recherche invalide (100 caractères maximum).",400);}
    async Task<long> Count(string sql,CancellationToken ct,params (string,object)[] args){await using var cmd=source.CreateCommand(sql);foreach(var(k,v) in args)cmd.Parameters.AddWithValue(k,v);return Convert.ToInt64(await cmd.ExecuteScalarAsync(ct));}
    [Authorize,HttpGet("admin/overview")]
    public async Task<object> Overview(CancellationToken ct) {
        admin.Require(HttpContext);
        // One aggregate statement: no private record bodies and no invented revenue.
        await using var cmd=source.CreateCommand("SELECT (SELECT count(*) FROM public.users),(SELECT count(*) FROM public.users WHERE is_paid),(SELECT count(*) FROM public.payment_receipts),(SELECT count(*) FROM public.support_tickets WHERE status='open'),(SELECT count(*) FROM public.support_tickets WHERE status='waiting'),(SELECT count(*) FROM public.support_tickets WHERE status='closed'),(SELECT count(*) FROM public.records WHERE kind='cv'),(SELECT count(*) FROM public.records WHERE kind='session')");
        await using var r=await cmd.ExecuteReaderAsync(ct);await r.ReadAsync(ct);
        return new{users=r.GetInt64(0),paid_users=r.GetInt64(1),receipts=r.GetInt64(2),open_tickets=r.GetInt64(3),waiting_tickets=r.GetInt64(4),closed_tickets=r.GetInt64(5),cvs=r.GetInt64(6),sessions=r.GetInt64(7),as_of=DateTimeOffset.UtcNow};
    }
    [Authorize,HttpGet("admin/users")]
    public async Task<object> Users(int page=1,string q="",string access="all",CancellationToken ct=default) {
        admin.Require(HttpContext);Page(page,q);if(access is not ("all" or "paid" or "unpaid" or "admin"))throw new ApiError("Filtre invalide.",400);
        const string where=" WHERE (@q='' OR strpos(lower(name||' '||email),lower(@q))>0) AND (@access='all' OR (@access='admin' AND id=@admin) OR (@access='paid' AND is_paid) OR (@access='unpaid' AND NOT is_paid AND id<>@admin))";
        await using var cmd=source.CreateCommand("SELECT id,name,email,is_paid,paid_at FROM public.users"+where+" ORDER BY lower(name),id LIMIT 20 OFFSET @skip");
        cmd.Parameters.AddWithValue("q",q.Trim());cmd.Parameters.AddWithValue("access",access);cmd.Parameters.AddWithValue("admin",admin.UserId??"");cmd.Parameters.AddWithValue("skip",(page-1)*20);
        var items=new List<object>();await using(var r=await cmd.ExecuteReaderAsync(ct)){while(await r.ReadAsync(ct))items.Add(new{id=r.GetString(0),name=r.GetString(1),email=r.GetString(2),is_paid=r.GetBoolean(3),paid_at=r.IsDBNull(4)?(DateTime?)null:r.GetDateTime(4),is_admin=admin.IsAdmin(r.GetString(0))});}
        var total=await Count("SELECT count(*) FROM public.users"+where,ct,("q",q.Trim()),("access",access),("admin",admin.UserId??""));return new{items,total,page,page_size=20};
    }
    [Authorize,HttpGet("admin/payments")]
    public async Task<object> Payments(int page=1,string q="",CancellationToken ct=default) {
        admin.Require(HttpContext);Page(page,q);
        const string where=" FROM public.payment_receipts p LEFT JOIN public.users u ON u.id=p.user_id WHERE (@q='' OR strpos(lower(p.sale_id||' '||coalesce(u.email,'')),lower(@q))>0)";
        await using var cmd=source.CreateCommand("SELECT p.sale_id,p.product_id,p.received_at,u.name,u.email"+where+" ORDER BY p.received_at DESC,p.sale_id LIMIT 20 OFFSET @skip");
        cmd.Parameters.AddWithValue("q",q.Trim());cmd.Parameters.AddWithValue("skip",(page-1)*20);var items=new List<object>();
        await using(var r=await cmd.ExecuteReaderAsync(ct)){while(await r.ReadAsync(ct))items.Add(new{sale_id=r.GetString(0),product_id=r.GetString(1),received_at=r.GetDateTime(2),name=r.IsDBNull(3)?null:r.GetString(3),email=r.IsDBNull(4)?null:r.GetString(4)});}
        return new{items,total=await Count("SELECT count(*)"+where,ct,("q",q.Trim())),page,page_size=20};
    }
    [Authorize,HttpGet("admin/tickets")]
    public async Task<object> Tickets(int page=1,string q="",string status="all",CancellationToken ct=default) {
        admin.Require(HttpContext);Page(page,q);if(status is not ("all" or "open" or "waiting" or "closed"))throw new ApiError("Filtre invalide.",400);
        const string where=" FROM public.support_tickets t JOIN public.users u ON u.id=t.user_id WHERE (@status='all' OR t.status=@status) AND (@q='' OR strpos(lower(t.subject||' '||u.email),lower(@q))>0)";
        await using var cmd=source.CreateCommand("SELECT t.id,t.subject,t.category,t.status,t.updated_at,u.name,u.email"+where+" ORDER BY t.updated_at DESC,t.id LIMIT 20 OFFSET @skip");
        cmd.Parameters.AddWithValue("status",status);cmd.Parameters.AddWithValue("q",q.Trim());cmd.Parameters.AddWithValue("skip",(page-1)*20);var items=new List<object>();
        await using(var r=await cmd.ExecuteReaderAsync(ct)){while(await r.ReadAsync(ct))items.Add(new{id=r.GetGuid(0),subject=r.GetString(1),category=r.GetString(2),status=r.GetString(3),updated_at=r.GetDateTime(4),name=r.GetString(5),email=r.GetString(6)});}
        return new{items,total=await Count("SELECT count(*)"+where,ct,("status",status),("q",q.Trim())),page,page_size=20};
    }
    [AllowAnonymous,HttpGet("site"),EnableRateLimiting("offer")]
    public async Task<object> Site(CancellationToken ct) {
        await using var cmd=source.CreateCommand("SELECT payload::text,version,updated_at FROM public.site_settings WHERE id=true");await using var r=await cmd.ExecuteReaderAsync(ct);
        if(!await r.ReadAsync(ct))return new{publisher="",country="",address="",email="",registration="",version=0,updated_at=(DateTime?)null};
        var stored=JsonNode.Parse(r.GetString(0))!.AsObject();var payload=new JsonObject();
        foreach(var key in new[]{"publisher","country","address","email","registration"})payload[key]=stored[key]?.GetValue<string>()??"";
        payload["version"]=r.GetInt32(1);payload["updated_at"]=r.GetDateTime(2);return payload;
    }
    [Authorize,HttpPut("admin/site"),EnableRateLimiting("support"),RequestSizeLimit(8192)]
    public async Task<object> SaveSite(SiteInput input,CancellationToken ct) {
        admin.Require(HttpContext);
        string Text(string? s,int max){s=s?.Trim()??"";if(s.Length>max||s.Any(c=>char.IsControl(c)&&c!='\n'&&c!='\r'))throw new ApiError("Une coordonnée dépasse la longueur autorisée ou contient un caractère invalide.",400);return s;}
        var publisher=Text(input.Publisher,160);var country=Text(input.Country,100);var address=Text(input.Address,400);var email=Text(input.Email,200);var registration=Text(input.Registration,160);
        if(input.Version<0||email.Length>0&&!new EmailAddressAttribute().IsValid(email))throw new ApiError("Adresse e-mail ou version invalide.",400);
        var json=JsonSerializer.Serialize(new{publisher,country,address,email,registration});
        await using var cmd=source.CreateCommand("INSERT INTO public.site_settings(id,payload,version) SELECT true,@payload::jsonb,1 WHERE @v=0 OR EXISTS(SELECT 1 FROM public.site_settings WHERE id=true) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,version=site_settings.version+1,updated_at=CURRENT_TIMESTAMP WHERE site_settings.version=@v RETURNING version");
        cmd.Parameters.AddWithValue("payload",json);cmd.Parameters.AddWithValue("v",input.Version);
        if(await cmd.ExecuteScalarAsync(ct)==null)throw new ApiError("Ces informations ont changé dans un autre onglet. Rechargez-les avant d’enregistrer.",409);
        return await Site(ct);
    }
}
