using Npgsql;

// The application role is read from PostgreSQL on every authorization check.
// No cookie role, environment fallback, email heuristic or process-wide role cache.
// The partial unique index on users.is_admin enforces at most one administrator.
public sealed class AdminAccess(NpgsqlDataSource source) {
    public bool IsAdmin(string id) {
        using var cmd=source.CreateCommand("SELECT is_admin FROM public.users WHERE id=@id");
        cmd.Parameters.AddWithValue("id",id);
        return cmd.ExecuteScalar() is true;
    }
    public void Require(HttpContext context) {
        if(!IsAdmin(Auth.Id(context)))throw new ApiError("Cet espace est réservé à l’administrateur.",403);
    }
}
