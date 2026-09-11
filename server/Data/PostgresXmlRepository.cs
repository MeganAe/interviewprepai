using System.Xml.Linq;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Npgsql;

public sealed class PostgresXmlRepository(NpgsqlDataSource source):IXmlRepository {
    public IReadOnlyCollection<XElement> GetAllElements() {
        using var cmd=source.CreateCommand("SELECT xml FROM public.data_protection_keys ORDER BY created_at,name");
        using var reader=cmd.ExecuteReader();var items=new List<XElement>();while(reader.Read())items.Add(XElement.Parse(reader.GetString(0)));return items;
    }
    public void StoreElement(XElement element,string friendlyName) {
        using var cmd=source.CreateCommand("INSERT INTO public.data_protection_keys(name,xml) VALUES(@name,@xml) ON CONFLICT(name) DO NOTHING");
        cmd.Parameters.AddWithValue("name",friendlyName);cmd.Parameters.AddWithValue("xml",element.ToString(SaveOptions.DisableFormatting));cmd.ExecuteNonQuery();
    }
}
