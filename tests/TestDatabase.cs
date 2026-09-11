using Npgsql;
using Xunit;
[assembly:CollectionBehavior(DisableTestParallelization=true)]

public sealed class TestDatabase:IDisposable {
    readonly string admin;
    readonly string name="prep_test_"+Guid.NewGuid().ToString("N");
    public string ConnectionString {get;}
    public TestDatabase() {
        admin=Environment.GetEnvironmentVariable("TEST_POSTGRES_CONNECTION")??throw new InvalidOperationException("Tests require a real, disposable PostgreSQL server. Set TEST_POSTGRES_CONNECTION (role with CREATEDB). Never use a production Supabase database for tests.");
        using(var c=new NpgsqlConnection(admin)){c.Open();using var cmd=new NpgsqlCommand($"CREATE DATABASE \"{name}\"",c);cmd.ExecuteNonQuery();}
        ConnectionString=new NpgsqlConnectionStringBuilder(admin){Database=name,MaxPoolSize=15}.ConnectionString;
        using(var c=new NpgsqlConnection(ConnectionString)){c.Open();using var cmd=new NpgsqlCommand(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"schema.sql")),c);cmd.ExecuteNonQuery();}
    }
    public long Scalar(string sql) {using var c=new NpgsqlConnection(ConnectionString);c.Open();using var cmd=new NpgsqlCommand(sql,c);return Convert.ToInt64(cmd.ExecuteScalar());}
    public void Execute(string sql){using var c=new NpgsqlConnection(ConnectionString);c.Open();using var cmd=new NpgsqlCommand(sql,c);cmd.ExecuteNonQuery();}
    public void Dispose(){NpgsqlConnection.ClearAllPools();using var c=new NpgsqlConnection(admin);c.Open();using var cmd=new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)",c);cmd.ExecuteNonQuery();}
}
