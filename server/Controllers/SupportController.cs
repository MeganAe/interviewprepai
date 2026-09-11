using System.Text.Json.Nodes;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Npgsql;

public record NewTicket(string? Id,string? Subject,string? Category,string? Body);
public record TicketReply(string? Id,string? Body);
public record TicketState(string? Status);

// All queries use server cookie identity. No user_id/author/from_admin input is accepted.
[ApiController,Authorize,RequestSizeLimit(32768),Route("api/support/tickets")]
public class SupportController(NpgsqlDataSource source,AdminAccess admin):ControllerBase {
    string Owner=>Auth.Id(HttpContext);
    static Guid Id(string? value)=>Guid.TryParse(value,out var id)&&id!=Guid.Empty?id:throw new ApiError("Identifiant invalide.",400);
    static string Body(string? value,int min=2) {var text=value?.Trim()??"";if(text.EnumerateRunes().Count()<min||text.Length>6000)throw new ApiError($"Le message doit contenir entre {min} et 6 000 caractères.",400);return text;}
    static object Row(NpgsqlDataReader r)=>new{id=r.GetGuid(0),subject=r.GetString(1),category=r.GetString(2),status=r.GetString(3),created_at=r.GetDateTime(4),updated_at=r.GetDateTime(5)};
    [HttpGet]
    public async Task<object> List(int page=1,CancellationToken ct=default) {
        if(page<1||page>100000)throw new ApiError("Page invalide.",400);
        await using var cmd=source.CreateCommand("SELECT id,subject,category,status,created_at,updated_at FROM public.support_tickets WHERE user_id=@u ORDER BY updated_at DESC,id LIMIT 20 OFFSET @skip");
        cmd.Parameters.AddWithValue("u",Owner);cmd.Parameters.AddWithValue("skip",(page-1)*20);
        var items=new List<object>();await using(var r=await cmd.ExecuteReaderAsync(ct)){while(await r.ReadAsync(ct))items.Add(Row(r));}
        await using var count=source.CreateCommand("SELECT count(*) FROM public.support_tickets WHERE user_id=@u");count.Parameters.AddWithValue("u",Owner);
        return new{items,total=(long)(await count.ExecuteScalarAsync(ct))!,page,page_size=20};
    }
    [HttpGet("/api/support/export")]
    public async Task<object> Export(CancellationToken ct) {
        await using var cmd=source.CreateCommand("SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'subject',t.subject,'category',t.category,'status',t.status,'created_at',t.created_at,'updated_at',t.updated_at,'messages',(SELECT coalesce(jsonb_agg(jsonb_build_object('from_admin',m.from_admin,'body',m.body,'created_at',m.created_at) ORDER BY m.created_at,m.id),'[]'::jsonb) FROM public.support_messages m WHERE m.ticket_id=t.id)) ORDER BY t.created_at,t.id),'[]'::jsonb)::text FROM public.support_tickets t WHERE t.user_id=@u");
        cmd.Parameters.AddWithValue("u",Owner);var json=(string)(await cmd.ExecuteScalarAsync(ct))!;
        return new{exported_at=DateTimeOffset.UtcNow,tickets=JsonNode.Parse(json)};
    }
    [HttpPost,EnableRateLimiting("support")]
    public async Task<object> Create(NewTicket input,CancellationToken ct) {
        var id=Id(input.Id);var subject=input.Subject?.Trim()??"";var body=Body(input.Body,10);
        if(subject.EnumerateRunes().Count()<4||subject.Length>140||input.Category is not ("general" or "technical" or "billing" or "privacy"))throw new ApiError("Vérifiez l’objet (4 à 140 caractères) et la catégorie.",400);
        await using var conn=await source.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
        await using var cmd=new NpgsqlCommand("INSERT INTO public.support_tickets(id,user_id,subject,category) VALUES(@id,@u,@s,@c) ON CONFLICT(id) DO NOTHING RETURNING id",conn,tx);
        cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("u",Owner);cmd.Parameters.AddWithValue("s",subject);cmd.Parameters.AddWithValue("c",input.Category);
        if(await cmd.ExecuteScalarAsync(ct)==null) {
            await using var retry=new NpgsqlCommand("SELECT 1 FROM public.support_tickets t JOIN public.support_messages m ON m.ticket_id=t.id AND m.id=t.id WHERE t.id=@id AND t.user_id=@u AND t.subject=@s AND t.category=@c AND m.body=@b",conn,tx);
            retry.Parameters.AddWithValue("id",id);retry.Parameters.AddWithValue("u",Owner);retry.Parameters.AddWithValue("s",subject);retry.Parameters.AddWithValue("c",input.Category);retry.Parameters.AddWithValue("b",body);
            if(await retry.ExecuteScalarAsync(ct)==null)throw new ApiError("Cette demande existe avec un autre contenu. Actualisez la liste avant de réessayer.",409);
        } else {
            await using var message=new NpgsqlCommand("INSERT INTO public.support_messages(id,ticket_id,author_id,from_admin,body) VALUES(@id,@id,@u,false,@body)",conn,tx);
            message.Parameters.AddWithValue("id",id);message.Parameters.AddWithValue("u",Owner);message.Parameters.AddWithValue("body",body);await message.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);return new{id};
    }
    async Task<string> Lock(NpgsqlConnection conn,NpgsqlTransaction tx,Guid id,CancellationToken ct) {
        await using var cmd=new NpgsqlCommand("SELECT status FROM public.support_tickets WHERE id=@id AND (user_id=@u OR @admin) FOR UPDATE",conn,tx);
        cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("u",Owner);cmd.Parameters.AddWithValue("admin",admin.IsAdmin(Owner));
        return await cmd.ExecuteScalarAsync(ct) as string??throw new ApiError("Demande introuvable.",404);
    }
    [HttpGet("{ticketId}")]
    public async Task<object> Detail(string ticketId,int page=1,CancellationToken ct=default) {
        var id=Id(ticketId);if(page<1||page>100000)throw new ApiError("Page invalide.",400);
        await using var cmd=source.CreateCommand("SELECT t.id,t.subject,t.category,t.status,t.created_at,t.updated_at,u.name,u.email FROM public.support_tickets t JOIN public.users u ON u.id=t.user_id WHERE t.id=@id AND (t.user_id=@u OR @admin)");
        cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("u",Owner);cmd.Parameters.AddWithValue("admin",admin.IsAdmin(Owner));
        object ticket;string name,email;
        await using(var r=await cmd.ExecuteReaderAsync(ct)){if(!await r.ReadAsync(ct))throw new ApiError("Demande introuvable.",404);ticket=Row(r);name=r.GetString(6);email=r.GetString(7);}
        await using var msgs=source.CreateCommand("SELECT id,from_admin,body,created_at FROM public.support_messages WHERE ticket_id=@id ORDER BY created_at,id LIMIT 50 OFFSET @skip");
        msgs.Parameters.AddWithValue("id",id);msgs.Parameters.AddWithValue("skip",(page-1)*50);
        var messages=new List<object>();await using(var r=await msgs.ExecuteReaderAsync(ct)){while(await r.ReadAsync(ct))messages.Add(new{id=r.GetGuid(0),from_admin=r.GetBoolean(1),body=r.GetString(2),created_at=r.GetDateTime(3)});}
        await using var count=source.CreateCommand("SELECT count(*) FROM public.support_messages WHERE ticket_id=@id");count.Parameters.AddWithValue("id",id);
        return new{ticket,messages,total=(long)(await count.ExecuteScalarAsync(ct))!,page,page_size=50,customer=admin.IsAdmin(Owner)?new{name,email}:null};
    }
    [HttpPost("{ticketId}/messages"),EnableRateLimiting("support")]
    public async Task<object> Reply(string ticketId,TicketReply input,CancellationToken ct) {
        var ticket=Id(ticketId);var message=Id(input.Id);var body=Body(input.Body);var isAdmin=admin.IsAdmin(Owner);
        await using var conn=await source.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
        var state=await Lock(conn,tx,ticket,ct);
        // Check retries before status so a response lost before closure is still acknowledged.
        await using(var prior=new NpgsqlCommand("SELECT ticket_id,author_id,body,from_admin FROM public.support_messages WHERE id=@id",conn,tx)) {
            prior.Parameters.AddWithValue("id",message);await using var r=await prior.ExecuteReaderAsync(ct);
            if(await r.ReadAsync(ct)) {
                if(r.GetGuid(0)==ticket&&!r.IsDBNull(1)&&r.GetString(1)==Owner&&r.GetString(2)==body&&r.GetBoolean(3)==isAdmin)return new{id=message};
                throw new ApiError("Identifiant de message déjà utilisé. Actualisez la conversation.",409);
            }
        }
        if(state=="closed")throw new ApiError("Rouvrez la demande avant de répondre.",409);
        await using(var cmd=new NpgsqlCommand("INSERT INTO public.support_messages(id,ticket_id,author_id,from_admin,body) VALUES(@id,@t,@u,@a,@b) ON CONFLICT(id) DO NOTHING RETURNING id",conn,tx)) {
            cmd.Parameters.AddWithValue("id",message);cmd.Parameters.AddWithValue("t",ticket);cmd.Parameters.AddWithValue("u",Owner);cmd.Parameters.AddWithValue("a",isAdmin);cmd.Parameters.AddWithValue("b",body);
            if(await cmd.ExecuteScalarAsync(ct)==null)throw new ApiError("Identifiant de message déjà utilisé.",409);
        }
        await using(var cmd=new NpgsqlCommand("UPDATE public.support_tickets SET status=@s,updated_at=clock_timestamp() WHERE id=@id",conn,tx)) {
            cmd.Parameters.AddWithValue("id",ticket);cmd.Parameters.AddWithValue("s",isAdmin?"waiting":"open");await cmd.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);return new{id=message};
    }
    [HttpPatch("{ticketId}"),EnableRateLimiting("support")]
    public async Task<object> State(string ticketId,TicketState input,CancellationToken ct) {
        var id=Id(ticketId);if(input.Status is not ("open" or "closed"))throw new ApiError("État invalide.",400);
        await using var conn=await source.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);await Lock(conn,tx,id,ct);
        await using var cmd=new NpgsqlCommand("UPDATE public.support_tickets SET status=@s,updated_at=clock_timestamp() WHERE id=@id",conn,tx);
        cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("s",input.Status);await cmd.ExecuteNonQueryAsync(ct);await tx.CommitAsync(ct);return new{ok=true};
    }
}
