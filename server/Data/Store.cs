using System.Data;
using System.Text.Json.Nodes;
using Npgsql;

public record User(string Id,string Name,string Email,string Salt,string Hash,bool IsPaid,DateTime? PaidAt,string? ChariowSaleId);
public enum PaymentActivation { Activated, Duplicate, AlreadyPaid, UnknownUser, Conflict }

public class Store(NpgsqlDataSource source) {
    public NpgsqlConnection Open()=>source.OpenConnection();
    public ValueTask<NpgsqlConnection> OpenAsync(CancellationToken ct=default)=>source.OpenConnectionAsync(ct);
    public void Execute(string sql,params (string,object)[] values) {
        using var cmd=source.CreateCommand(sql);
        foreach(var(k,v) in values)cmd.Parameters.AddWithValue(k,v);
        cmd.ExecuteNonQuery();
    }
    static User ReadUser(NpgsqlDataReader r)=>new(r.GetString(0),r.GetString(1),r.GetString(2),r.GetString(3),r.GetString(4),r.GetBoolean(5),r.IsDBNull(6)?null:r.GetDateTime(6),r.IsDBNull(7)?null:r.GetString(7));
    User? UserQuery(string field,string value) {
        if(field is not ("id" or "email"))throw new ArgumentException("Unsupported user field");
        using var cmd=source.CreateCommand($"SELECT id,name,email,salt,hash,is_paid,paid_at,chariow_sale_id FROM public.users WHERE {field}=@value");
        cmd.Parameters.AddWithValue("value",value);using var r=cmd.ExecuteReader();return r.Read()?ReadUser(r):null;
    }
    public User? UserById(string id)=>UserQuery("id",id);
    public User? UserByEmail(string email)=>UserQuery("email",email);
    public async Task<User?> UserByIdAsync(string id,CancellationToken ct=default) {
        await using var cmd=source.CreateCommand("SELECT id,name,email,salt,hash,is_paid,paid_at,chariow_sale_id FROM public.users WHERE id=@id");
        cmd.Parameters.AddWithValue("id",id);await using var r=await cmd.ExecuteReaderAsync(ct);return await r.ReadAsync(ct)?ReadUser(r):null;
    }
    public List<JsonNode> List(string user,string kind) {
        using var cmd=source.CreateCommand("SELECT data FROM public.records WHERE \"userId\"=@u AND kind=@k ORDER BY (data::jsonb ->> 'createdAt') DESC NULLS LAST, id DESC");
        cmd.Parameters.AddWithValue("u",user);cmd.Parameters.AddWithValue("k",kind);
        using var r=cmd.ExecuteReader();var list=new List<JsonNode>();while(r.Read())list.Add(JsonNode.Parse(r.GetString(0))!);return list;
    }
    public JsonObject Get(string user,string id,string kind) {
        using var cmd=source.CreateCommand("SELECT data FROM public.records WHERE id=@id AND \"userId\"=@u AND kind=@k");
        cmd.Parameters.AddWithValue("u",user);cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("k",kind);
        return cmd.ExecuteScalar() is string json?JsonNode.Parse(json)!.AsObject():throw new ApiError("Élément introuvable.",404);
    }
    public void Save(string user,string kind,JsonObject data)=>Execute("INSERT INTO public.records(id,\"userId\",kind,data) VALUES(@id,@u,@k,@d) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data WHERE records.\"userId\"=@u",("id",data["id"]!.GetValue<string>()),("u",user),("k",kind),("d",data.ToJsonString()));

    // Row lock + unique sale receipt + conditional update: safe across Render instances.
    public async Task<PaymentActivation> ActivatePaymentAsync(string userId,string saleId,string productId,string? deliveryId,string hash,CancellationToken ct=default) {
        await using var conn=await OpenAsync(ct);await using var tx=await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted,ct);
        async Task<(bool Found,string? Owner)> Receipt() {
            await using var cmd=new NpgsqlCommand("SELECT user_id FROM public.payment_receipts WHERE sale_id=@sale",conn,tx);
            cmd.Parameters.AddWithValue("sale",saleId);await using var r=await cmd.ExecuteReaderAsync(ct);
            return await r.ReadAsync(ct)?(true,r.IsDBNull(0)?null:r.GetString(0)):(false,null);
        }
        var existing=await Receipt();
        if(existing.Found)return existing.Owner is null || existing.Owner==userId?PaymentActivation.Duplicate:PaymentActivation.Conflict;
        bool paid;
        await using(var cmd=new NpgsqlCommand("SELECT is_paid FROM public.users WHERE id=@id FOR UPDATE",conn,tx)) {
            cmd.Parameters.AddWithValue("id",userId);var v=await cmd.ExecuteScalarAsync(ct);
            if(v is not bool b)return PaymentActivation.UnknownUser;paid=b;
        }
        // Also check the required users.chariow_sale_id, including manually imported payments.
        await using(var cmd=new NpgsqlCommand("SELECT id FROM public.users WHERE chariow_sale_id=@sale",conn,tx)) {
            cmd.Parameters.AddWithValue("sale",saleId);var owner=await cmd.ExecuteScalarAsync(ct) as string;
            if(owner!=null)return owner==userId?PaymentActivation.Duplicate:PaymentActivation.Conflict;
        }
        await using(var cmd=new NpgsqlCommand("INSERT INTO public.payment_receipts(sale_id,user_id,product_id,delivery_id,payload_sha256) VALUES(@sale,@u,@p,@delivery,@hash) ON CONFLICT(sale_id) DO NOTHING RETURNING sale_id",conn,tx)) {
            cmd.Parameters.AddWithValue("sale",saleId);cmd.Parameters.AddWithValue("u",userId);cmd.Parameters.AddWithValue("p",productId);
            cmd.Parameters.AddWithValue("delivery",(object?)deliveryId??DBNull.Value);cmd.Parameters.AddWithValue("hash",hash);
            if(await cmd.ExecuteScalarAsync(ct)==null) {
                existing=await Receipt();return existing.Owner is null || existing.Owner==userId?PaymentActivation.Duplicate:PaymentActivation.Conflict;
            }
        }
        if(!paid) {
            await using var cmd=new NpgsqlCommand("UPDATE public.users SET is_paid=true, paid_at=CURRENT_TIMESTAMP, chariow_sale_id=@sale WHERE id=@u AND is_paid=false",conn,tx);
            cmd.Parameters.AddWithValue("sale",saleId);cmd.Parameters.AddWithValue("u",userId);await cmd.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);return paid?PaymentActivation.AlreadyPaid:PaymentActivation.Activated;
    }
}
