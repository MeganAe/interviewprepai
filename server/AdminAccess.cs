// A single, immutable account ID is selected by the operator, never by a browser/email claim.
public sealed class AdminAccess(IConfiguration config) {
    public string? UserId {
        get {
            var value=config["Admin:UserId"]?.Trim();
            return Guid.TryParse(value,out var id) && id!=Guid.Empty ? id.ToString() : null;
        }
    }
    public bool IsAdmin(string id)=>UserId is string selected && string.Equals(selected,id,StringComparison.Ordinal);
    public void Require(HttpContext context) {
        if(!IsAdmin(Auth.Id(context)))throw new ApiError("Cet espace est réservé à l’administrateur.",403);
    }
}
